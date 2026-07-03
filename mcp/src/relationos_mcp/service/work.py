"""Tasks and the activity feed."""

from datetime import datetime

from ..db import clean, db, emit_event, log_activity


async def create_task(
    title: str,
    contact_id: str | None = None,
    due_at: str | None = None,
    priority: str = "medium",
) -> dict:
    """Create a task/reminder (optionally attached to a contact).
    due_at is ISO-8601, e.g. '2026-07-03T10:00:00+05:30'."""
    tenant = await db.ensure()
    if priority not in ("high", "medium", "low"):
        raise ValueError("priority must be high|medium|low")
    due = datetime.fromisoformat(due_at) if due_at else None
    async with db.tx() as conn:
        task_id = await conn.fetchval(
            """insert into tasks (tenant_id, contact_id, title, due_at, priority,
                                  origin_kind, created_by)
               values ($1,$2,$3,$4,$5,'ai','ai') returning id""",
            tenant.id, contact_id, title, due, priority,
        )
        await emit_event(conn, "task.created", "task", str(task_id), {"title": title})
    return {"task_id": str(task_id), "title": title}


async def get_activity_feed(limit: int = 20) -> list[dict]:
    """The live feed of what has happened in this workspace, newest first."""
    await db.ensure()
    async with db.tx() as conn:
        rows = await conn.fetch(
            """select a.kind, a.actor, a.body, a.meta, a.occurred_at,
                      c.display_name as contact
               from activities a
               left join contacts c on c.id = a.contact_id
               order by a.occurred_at desc limit $1""",
            limit,
        )
    return [clean(r) for r in rows]
