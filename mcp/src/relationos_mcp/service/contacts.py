"""Contacts — the generic party ('Buyer'/'Student' per tenant terminology)."""

import json

from ..db import clean, db, emit_event, log_activity


async def _field_defs(conn) -> dict[str, dict]:
    rows = await conn.fetch(
        """select id, key, label, data_type, options
           from field_definitions where entity = 'contact' and active"""
    )
    return {r["key"]: clean(r) for r in rows}


def _validate(defs: dict[str, dict], attributes: dict) -> None:
    for key, value in attributes.items():
        d = defs.get(key)
        if d is None:
            raise ValueError(
                f"Unknown contact field '{key}'. Valid field keys: {sorted(defs)}"
            )
        choices = (d.get("options") or {}).get("choices") or []
        if choices and d["data_type"] == "select" and value not in choices:
            raise ValueError(f"'{key}' must be one of {choices}, got {value!r}")
        if choices and d["data_type"] == "multiselect":
            bad = [v for v in (value or []) if v not in choices]
            if bad:
                raise ValueError(f"'{key}' values {bad} not in allowed {choices}")


async def get_worklist(
    limit: int = 20,
    temperature: str | None = None,
    overdue_only: bool = False,
) -> list[dict]:
    """The ranked worklist: contacts ordered by AI intent score (highest
    first). Filter by temperature label (e.g. 'Hot') or overdue_only (SLA
    follow-up time passed). This answers 'who should I contact today?'.
    """
    await db.ensure()
    where = ["c.deleted_at is null", "c.merged_into_id is null",
             "c.review_status = 'accepted'"]
    args: list = []
    if temperature:
        args.append(temperature)
        where.append(f"c.temperature = ${len(args)}")
    if overdue_only:
        where.append("c.next_follow_up_at < now()")
    args.append(limit)
    async with db.tx() as conn:
        rows = await conn.fetch(
            f"""select c.id, c.display_name, c.phone, c.score, c.temperature,
                       c.stalled, c.requirement_summary, c.budget_min, c.budget_max,
                       c.next_follow_up_at, c.last_touch_at, c.attributes,
                       s.label as stage, ls.label as source
                from contacts c
                left join pipeline_stages s on s.id = c.stage_id
                left join lead_sources ls on ls.id = c.source_id
                where {' and '.join(where)}
                order by c.score desc limit ${len(args)}""",
            *args,
        )
    return [clean(r) for r in rows]


async def search_contacts(query: str) -> list[dict]:
    """Fuzzy-search contacts by name, phone or email."""
    await db.ensure()
    async with db.tx() as conn:
        rows = await conn.fetch(
            """select c.id, c.display_name, c.phone, c.email, c.score,
                      s.label as stage
               from contacts c
               left join pipeline_stages s on s.id = c.stage_id
               where c.deleted_at is null and c.merged_into_id is null
                 and (c.display_name ilike '%' || $1 || '%'
                      or c.phone ilike '%' || $1 || '%'
                      or c.email::text ilike '%' || $1 || '%')
               order by c.score desc limit 10""",
            query,
        )
    return [clean(r) for r in rows]


async def get_contact(contact_id: str) -> dict:
    """The full 360 view of one contact: profile fields (each with its source
    quote and confidence — the AI cites everything), score evidence, recent
    conversation timeline, deals, open tasks and catalog matches.
    """
    await db.ensure()
    async with db.tx() as conn:
        c = await conn.fetchrow(
            """select c.*, s.label as stage_label, ls.label as source_label
               from contacts c
               left join pipeline_stages s on s.id = c.stage_id
               left join lead_sources ls on ls.id = c.source_id
               where c.id = $1""",
            contact_id,
        )
        if c is None:
            raise ValueError(f"No contact with id {contact_id}")
        fields = await conn.fetch(
            """select f.key, f.label, v.value, v.confidence, v.captured_by,
                      v.source_quote, v.created_at
               from contact_field_values v
               join field_definitions f on f.id = v.field_id
               where v.contact_id = $1 and v.superseded_at is null
               order by f.sort_order""",
            contact_id,
        )
        evidence = await conn.fetch(
            """select e.polarity, e.weight, e.reason, e.source_quote,
                      sd.label as signal
               from score_evidence e
               left join signal_definitions sd on sd.id = e.signal_id
               where e.contact_id = $1 and e.superseded_at is null
               order by e.created_at desc""",
            contact_id,
        )
        timeline = await conn.fetch(
            """select channel_key, direction, coalesce(summary, left(body, 200)) as text,
                      handled_by, sent_at
               from messages where contact_id = $1
               order by sent_at desc limit 10""",
            contact_id,
        )
        deals = await conn.fetch(
            """select d.id, d.title, d.value, s.label as stage
               from deals d join pipeline_stages s on s.id = d.stage_id
               where d.contact_id = $1 and d.deleted_at is null""",
            contact_id,
        )
        tasks = await conn.fetch(
            """select id, title, due_at, priority from tasks
               where contact_id = $1 and status = 'open' order by due_at nulls last""",
            contact_id,
        )
        matches = await conn.fetch(
            """select m.score, m.reasons, i.id as item_id, i.name, i.code,
                      i.list_price, p.name as parent
               from contact_catalog_matches m
               join catalog_items i on i.id = m.catalog_item_id
               left join catalog_items p on p.id = i.parent_id
               where m.contact_id = $1 order by m.score desc limit 5""",
            contact_id,
        )
    out = clean(c)
    out.pop("embedding", None)
    out.pop("search", None)
    out.update(
        profile=[clean(r) for r in fields],
        score_evidence=[clean(r) for r in evidence],
        timeline=[clean(r) for r in timeline],
        deals=[clean(r) for r in deals],
        open_tasks=[clean(r) for r in tasks],
        catalog_matches=[clean(r) for r in matches],
    )
    return out


async def create_contact(
    name: str,
    phone: str | None = None,
    email: str | None = None,
    source_key: str | None = None,
    budget_min: float | None = None,
    budget_max: float | None = None,
    attributes: dict | None = None,
) -> dict:
    """Capture a new lead/contact. `attributes` must use this workspace's
    contact field keys (see get_workspace) — values are validated against the
    tenant's field definitions, e.g. real estate: {"bhk_config": "3BHK",
    "locality_prefs": ["Kokapet"], "urgency": "high"}.
    """
    tenant = await db.ensure()
    attributes = attributes or {}
    async with db.tx() as conn:
        defs = await _field_defs(conn)
        _validate(defs, attributes)
        source_id = None
        if source_key:
            source_id = await conn.fetchval(
                "select id from lead_sources where key = $1", source_key
            )
            if source_id is None:
                raise ValueError(f"Unknown source '{source_key}'")
        stage = await conn.fetchrow(
            """select s.id, s.pipeline_id from pipeline_stages s
               join pipelines p on p.id = s.pipeline_id and p.is_default
               order by s.sort_order limit 1"""
        )
        contact_id = await conn.fetchval(
            """insert into contacts
                 (tenant_id, display_name, phone, email, source_id,
                  budget_min, budget_max, currency, pipeline_id, stage_id,
                  stage_entered_at, captured_by, last_touch_at, attributes)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), 'ai', now(), $11)
               returning id""",
            tenant.id, name, phone, email, source_id, budget_min, budget_max,
            tenant.currency, stage["pipeline_id"] if stage else None,
            stage["id"] if stage else None, attributes,
        )
        for key, value in attributes.items():
            await conn.execute(
                """insert into contact_field_values
                     (tenant_id, contact_id, field_id, value, captured_by)
                   values ($1,$2,$3,$4,'ai')""",
                tenant.id, contact_id, defs[key]["id"], value,
            )
        await emit_event(conn, "contact.created", "contact", str(contact_id),
                         {"name": name, "source": source_key})
        await log_activity(conn, "lead", f"New {tenant.label('contact','contact')} captured · {name}",
                           contact_id=str(contact_id))
    return {"contact_id": str(contact_id), "name": name, "captured": True}


async def set_contact_field(
    contact_id: str, field_key: str, value, source_quote: str | None = None
) -> dict:
    """Set/update one profile field on a contact, with provenance. The prior
    value is superseded (kept as history), never overwritten.
    """
    tenant = await db.ensure()
    async with db.tx() as conn:
        defs = await _field_defs(conn)
        _validate(defs, {field_key: value})
        field_id = defs[field_key]["id"]
        old_id = await conn.fetchval(
            """update contact_field_values set superseded_at = now()
               where contact_id = $1 and field_id = $2 and superseded_at is null
               returning id""",
            contact_id, field_id,
        )
        new_id = await conn.fetchval(
            """insert into contact_field_values
                 (tenant_id, contact_id, field_id, value, captured_by, source_quote)
               values ($1,$2,$3,$4,'ai',$5) returning id""",
            tenant.id, contact_id, field_id, value, source_quote,
        )
        if old_id:
            await conn.execute(
                "update contact_field_values set superseded_by = $1 where id = $2",
                new_id, old_id,
            )
        await conn.execute(
            """update contacts
               set attributes = attributes || $2, last_touch_at = now()
               where id = $1""",
            contact_id, {field_key: value},
        )
        await emit_event(conn, "contact.field_updated", "contact", contact_id,
                         {"field": field_key, "value": value, "superseded": bool(old_id)})
    return {"contact_id": contact_id, "field": field_key, "value": value,
            "superseded_previous": bool(old_id)}
