"""Workspace orientation — how the model learns this tenant's world."""

from ..db import clean, db


async def get_workspace() -> dict:
    """Describe this CRM workspace: the tenant, its terminology (what to call
    contacts/deals/appointments here), pipeline stages, custom field
    definitions, lead sources and personas. Call this FIRST to understand the
    vertical you are operating in — every other tool speaks this configuration.
    """
    tenant = await db.ensure()
    async with db.tx() as conn:
        pipelines = [clean(r) for r in await conn.fetch(
            """select p.id, p.key, p.name, p.entity, p.is_default
               from pipelines p order by p.sort_order"""
        )]
        for p in pipelines:
            p["stages"] = [clean(r) for r in await conn.fetch(
                """select key, label, sort_order, probability, tags,
                          require_note_on_entry, is_terminal
                   from pipeline_stages where pipeline_id = $1 order by sort_order""",
                p["id"],
            )]
        contact_fields = [clean(r) for r in await conn.fetch(
            """select key, label, data_type, options, required, is_qualifying,
                      ai_capture, use_in_matching, match_against
               from field_definitions
               where entity = 'contact' and active order by sort_order"""
        )]
        catalog_types = [clean(r) for r in await conn.fetch(
            """select t.key, t.label_singular, t.label_plural,
                      pt.key as parent_type, t.availability_labels
               from catalog_item_types t
               left join catalog_item_types pt on pt.id = t.parent_type_id
               order by t.sort_order"""
        )]
        sources = [clean(r) for r in await conn.fetch(
            "select key, label, kind from lead_sources where active order by sort_order"
        )]
        personas = [clean(r) for r in await conn.fetch(
            "select key, label, rules from personas order by sort_order"
        )]
        policy_rules = [clean(r) for r in await conn.fetch(
            "select key, label, category, severity from policy_rules where active order by category"
        )]

    return {
        "tenant": {"name": tenant.name, "slug": tenant.slug,
                   "currency": tenant.currency, "autonomy_level": tenant.autonomy_level},
        "terminology": tenant.terminology,
        "pipelines": pipelines,
        "contact_fields": contact_fields,
        "catalog_types": catalog_types,
        "sources": sources,
        "personas": personas,
        "policy_rules": policy_rules,
    }
