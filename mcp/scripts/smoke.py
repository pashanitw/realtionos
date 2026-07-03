"""In-process smoke test: exercises every service function against the live
dev database. Run: cd mcp && uv run python scripts/smoke.py"""

import asyncio
import json

from relationos_mcp.service import catalog, contacts, pipeline, work, workspace


def show(label: str, data) -> None:
    print(f"\n=== {label} ===")
    print(json.dumps(data, indent=2, default=str)[:1200])


async def main() -> None:
    ws = await workspace.get_workspace()
    show("workspace", {
        "tenant": ws["tenant"], "terminology": ws["terminology"],
        "stages": [s["key"] for p in ws["pipelines"] for s in p["stages"]],
        "contact_fields": [f["key"] for f in ws["contact_fields"]],
    })

    created = await contacts.create_contact(
        name="Smoke Test Buyer",
        phone="+91 90000 11111",
        source_key="whatsapp",
        budget_max=14_000_000,
        attributes={"bhk_config": "3BHK", "locality_prefs": ["Kokapet"], "urgency": "high"},
    )
    show("create_contact", created)
    cid = created["contact_id"]

    show("set_contact_field", await contacts.set_contact_field(
        cid, "loan_status", "pre-approved", source_quote="HDFC already sanctioned my loan"
    ))

    # config validation must reject nonsense
    try:
        await contacts.create_contact(name="Bad", attributes={"ielts_score": 8})
    except ValueError as e:
        show("validation rejects wrong-vertical field", str(e))

    show("worklist", await contacts.get_worklist(limit=3))
    show("search", await contacts.search_contacts("Smoke"))
    show("matches", await catalog.match_catalog_for_contact(cid))
    show("inventory", await catalog.list_inventory(limit=3))

    deal = await pipeline.create_deal(cid, value=14_000_000)
    show("create_deal", deal)
    try:
        await pipeline.move_deal_stage(deal["deal_id"], "qualified")
    except ValueError as e:
        show("mandatory remark enforced from config", str(e))
    show("move_deal_stage", await pipeline.move_deal_stage(
        deal["deal_id"], "qualified", remark="Budget + locality confirmed on call"
    ))

    show("create_task", await work.create_task(
        "Call Smoke Test Buyer about site visit", contact_id=cid,
        due_at="2026-07-03T10:00:00+05:30", priority="high",
    ))
    show("contact 360", await contacts.get_contact(cid))
    show("activity feed", await work.get_activity_feed(limit=6))
    print("\nSMOKE OK")


if __name__ == "__main__":
    asyncio.run(main())
