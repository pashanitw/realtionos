"""Deals & the pipeline board — stage semantics come from config tags."""

from ..db import clean, db, emit_event, log_activity


async def get_pipeline() -> dict:
    """The pipeline board: every stage with its deal count, total value and
    the deals in it (like the kanban view). Stage order and labels are this
    tenant's configuration.
    """
    await db.ensure()
    async with db.tx() as conn:
        stages = await conn.fetch(
            """select s.id, s.key, s.label, s.sort_order, s.tags, s.probability
               from pipeline_stages s
               join pipelines p on p.id = s.pipeline_id and p.is_default
               order by s.sort_order"""
        )
        deals = await conn.fetch(
            """select d.id, d.stage_id, d.title, d.value, d.stalled,
                      d.expected_close_at, c.display_name as contact,
                      i.name as catalog_item
               from deals d
               join contacts c on c.id = d.contact_id
               left join catalog_items i on i.id = d.catalog_item_id
               where d.deleted_at is null and d.won_at is null and d.lost_at is null
               order by d.value desc nulls last"""
        )
    board = []
    by_stage: dict = {}
    for s in stages:
        entry = clean(s)
        entry["deals"] = []
        entry["total_value"] = 0.0
        by_stage[s["id"]] = entry
        board.append(entry)
    for d in deals:
        entry = by_stage.get(d["stage_id"])
        if entry is not None:
            dd = clean(d)
            dd.pop("stage_id", None)
            entry["deals"].append(dd)
            entry["total_value"] += float(d["value"] or 0)
    for entry in board:
        entry["deal_count"] = len(entry["deals"])
        entry.pop("id", None)
    return {"stages": board}


async def create_deal(
    contact_id: str,
    title: str | None = None,
    catalog_item_id: str | None = None,
    value: float | None = None,
) -> dict:
    """Open a deal for a contact (optionally against a catalog item, e.g. a
    specific unit). It starts in the first stage of the default pipeline.
    """
    tenant = await db.ensure()
    async with db.tx() as conn:
        contact = await conn.fetchrow(
            "select id, display_name from contacts where id = $1", contact_id
        )
        if contact is None:
            raise ValueError(f"No contact with id {contact_id}")
        stage = await conn.fetchrow(
            """select s.id, s.pipeline_id, s.label from pipeline_stages s
               join pipelines p on p.id = s.pipeline_id and p.is_default
               order by s.sort_order limit 1"""
        )
        if stage is None:
            raise ValueError("No default pipeline configured for this tenant")
        deal_id = await conn.fetchval(
            """insert into deals (tenant_id, contact_id, title, pipeline_id,
                                  stage_id, catalog_item_id, value, currency)
               values ($1,$2,$3,$4,$5,$6,$7,$8) returning id""",
            tenant.id, contact_id,
            title or f"{contact['display_name']} · new {tenant.label('deal', 'deal')}",
            stage["pipeline_id"], stage["id"], catalog_item_id, value, tenant.currency,
        )
        await conn.execute(
            """insert into stage_events (tenant_id, deal_id, to_stage_id, moved_by)
               values ($1,$2,$3,'ai')""",
            tenant.id, deal_id, stage["id"],
        )
        await emit_event(conn, "deal.created", "deal", str(deal_id),
                         {"contact_id": contact_id, "value": value})
        await log_activity(conn, "lead",
                           f"{tenant.label('deal','Deal')} opened · {contact['display_name']}",
                           contact_id=contact_id, deal_id=str(deal_id))
    return {"deal_id": str(deal_id), "stage": stage["label"]}


async def move_deal_stage(deal_id: str, to_stage_key: str, remark: str | None = None) -> dict:
    """Move a deal to another stage by stage key. If the target stage is
    configured to require a note on entry (most are), you MUST pass a remark
    explaining the move — it becomes part of the deal's audit trail.
    """
    tenant = await db.ensure()
    async with db.tx() as conn:
        deal = await conn.fetchrow(
            """select d.id, d.pipeline_id, d.stage_id, d.title,
                      c.id as contact_id, c.display_name
               from deals d join contacts c on c.id = d.contact_id
               where d.id = $1 and d.deleted_at is null""",
            deal_id,
        )
        if deal is None:
            raise ValueError(f"No deal with id {deal_id}")
        stage = await conn.fetchrow(
            """select id, key, label, tags, require_note_on_entry
               from pipeline_stages where pipeline_id = $1 and key = $2""",
            deal["pipeline_id"], to_stage_key,
        )
        if stage is None:
            keys = [r["key"] for r in await conn.fetch(
                "select key from pipeline_stages where pipeline_id = $1 order by sort_order",
                deal["pipeline_id"],
            )]
            raise ValueError(f"Unknown stage '{to_stage_key}'. Stages: {keys}")
        if stage["require_note_on_entry"] and not (remark and remark.strip()):
            raise ValueError(
                f"Stage '{stage['label']}' requires a remark on entry (tenant policy). "
                "Pass remark= explaining why this deal is moving."
            )
        tags = stage["tags"] or []
        await conn.execute(
            """update deals set stage_id = $2, stage_entered_at = now(), stalled = false,
                    won_at  = case when $3 then now() else won_at end,
                    lost_at = case when $4 then now() else lost_at end
               where id = $1""",
            deal_id, stage["id"], "won" in tags, "lost" in tags,
        )
        await conn.execute(
            """insert into stage_events
                 (tenant_id, deal_id, from_stage_id, to_stage_id, note, moved_by)
               values ($1,$2,$3,$4,$5,'ai')""",
            tenant.id, deal_id, deal["stage_id"], stage["id"], remark,
        )
        await emit_event(conn, "stage.changed", "deal", deal_id,
                         {"to": stage["key"], "remark": remark, "tags": tags})
        await log_activity(conn, "booking" if "booked" in tags else "lead",
                           f"{deal['display_name']} → {stage['label']}",
                           contact_id=str(deal["contact_id"]), deal_id=deal_id,
                           meta={"remark": remark})
    return {"deal_id": deal_id, "moved_to": stage["label"], "stage_tags": list(tags),
            "won": "won" in tags, "lost": "lost" in tags}
