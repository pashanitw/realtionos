"""Catalog (inventory) + config-driven matching.

Matching is vertical-blind: field_definitions rows declare which contact
fields match which catalog attributes (use_in_matching + match_against).
Real estate: bhk_config->bhk_config, locality_prefs->locality. Education:
target_country->country. Same code either way.
"""

from ..db import clean, db


async def list_inventory(
    item_type_key: str | None = None,
    availability: str | None = None,
    query: str | None = None,
    limit: int = 25,
) -> list[dict]:
    """List catalog items (this tenant may call them Units, Programs, Plans —
    see get_workspace terminology). Filter by type key, availability state
    (available/held/committed/closed) or a name search.
    """
    await db.ensure()
    where = ["i.deleted_at is null", "i.active"]
    args: list = []
    if item_type_key:
        args.append(item_type_key)
        where.append(f"t.key = ${len(args)}")
    if availability:
        args.append(availability)
        where.append(f"i.availability = ${len(args)}::availability_status")
    if query:
        args.append(query)
        where.append(f"(i.name ilike '%' || ${len(args)} || '%' or i.code ilike '%' || ${len(args)} || '%')")
    args.append(limit)
    async with db.tx() as conn:
        rows = await conn.fetch(
            f"""select i.id, i.name, i.code, i.list_price, i.availability,
                       i.attributes, t.key as item_type, p.name as parent
                from catalog_items i
                join catalog_item_types t on t.id = i.type_id
                left join catalog_items p on p.id = i.parent_id
                where {' and '.join(where)}
                order by i.list_price nulls last limit ${len(args)}""",
            *args,
        )
    return [clean(r) for r in rows]


async def match_catalog_for_contact(contact_id: str) -> list[dict]:
    """Find the best catalog matches for a contact using the tenant's
    configured matching rules (contact field -> catalog attribute) plus budget
    fit against list price. Persists results so they appear on the contact's
    360 view. Returns the top 5 with reasons.
    """
    tenant = await db.ensure()
    async with db.tx() as conn:
        contact = await conn.fetchrow(
            "select id, display_name, attributes, budget_min, budget_max from contacts where id = $1",
            contact_id,
        )
        if contact is None:
            raise ValueError(f"No contact with id {contact_id}")
        rules = await conn.fetch(
            """select key, match_against from field_definitions
               where entity = 'contact' and active and use_in_matching
                 and match_against is not null"""
        )
        # leaf item types (unit/program level); fall back to all types if flat
        leaf_types = [r["id"] for r in await conn.fetch(
            "select id from catalog_item_types where parent_type_id is not null"
        )] or [r["id"] for r in await conn.fetch("select id from catalog_item_types")]
        items = await conn.fetch(
            """select i.id, i.name, i.code, i.list_price, i.attributes,
                      p.name as parent, p.attributes as parent_attributes
               from catalog_items i
               left join catalog_items p on p.id = i.parent_id
               where i.availability = 'available' and i.deleted_at is null
                 and i.active and i.type_id = any($1)""",
            leaf_types,
        )

        cattrs = contact["attributes"] or {}
        bmin, bmax = contact["budget_min"], contact["budget_max"]
        scored = []
        for it in items:
            iattrs = {**(it["parent_attributes"] or {}), **(it["attributes"] or {})}
            hits, total, reasons = 0.0, 0.0, []
            for r in rules:
                want = cattrs.get(r["key"])
                if want in (None, [], ""):
                    continue
                total += 1
                have = iattrs.get(r["match_against"])
                wants = want if isinstance(want, list) else [want]
                haves = have if isinstance(have, list) else [have]
                if any(w == h for w in wants for h in haves) or (
                    "either" in [str(w).lower() for w in wants]
                ):
                    hits += 1
                    reasons.append(f"{r['key']} matches ({have})")
            if bmax and it["list_price"]:
                total += 1
                price = float(it["list_price"])
                if (bmin or 0) * 0.9 <= price <= float(bmax) * 1.1:
                    hits += 1
                    reasons.append(f"price {price:,.0f} fits budget")
            if total == 0:
                continue
            score = round(100 * hits / total, 1)
            if score > 0:
                scored.append((score, it, reasons))

        scored.sort(key=lambda x: -x[0])
        top = scored[:5]
        for score, it, reasons in top:
            await conn.execute(
                """insert into contact_catalog_matches
                     (tenant_id, contact_id, catalog_item_id, score, reasons)
                   values ($1,$2,$3,$4,$5)
                   on conflict (contact_id, catalog_item_id)
                   do update set score = $4, reasons = $5, computed_at = now()""",
                tenant.id, contact_id, it["id"], score, reasons,
            )

    return [
        {"item_id": str(it["id"]), "name": it["name"], "code": it["code"],
         "parent": it["parent"], "list_price": float(it["list_price"] or 0),
         "score": score, "reasons": reasons}
        for score, it, reasons in top
    ]
