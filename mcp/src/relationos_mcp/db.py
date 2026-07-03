"""Tenant-scoped Postgres access — mirrors the production two-role pattern.

- The AUTH connection (relos_auth) is used exactly once, at startup, to
  resolve the tenant slug -> id and load terminology. It can see identity
  tables across tenants; nothing else runs through it.
- Every tool query runs on the APP pool (relos_app), which is RLS-bound:
  each transaction sets `app.tenant_id`, and Postgres guarantees the tenant
  boundary even if a query here has a bug.
"""

import asyncio
import json
import uuid as uuid_mod
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import asyncpg

from .settings import settings


@dataclass
class Tenant:
    id: str
    slug: str
    name: str
    currency: str
    autonomy_level: int
    terminology: dict[str, str] = field(default_factory=dict)

    def label(self, key: str, default: str) -> str:
        return self.terminology.get(key, default)


def _scalar(v: Any) -> Any:
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, uuid_mod.UUID):
        return str(v)
    if isinstance(v, Decimal):
        return float(v)
    return v


def clean(row: asyncpg.Record | dict) -> dict:
    """asyncpg Record -> JSON-safe dict."""
    return {k: _scalar(v) for k, v in dict(row).items()}


async def _init_conn(conn: asyncpg.Connection) -> None:
    for typ in ("jsonb", "json"):
        await conn.set_type_codec(
            typ, encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
        )


class Database:
    def __init__(self) -> None:
        self._pool: asyncpg.Pool | None = None
        self._lock = asyncio.Lock()
        self.tenant: Tenant | None = None

    async def ensure(self) -> Tenant:
        async with self._lock:
            if self._pool is None:
                await self._bootstrap()
        assert self.tenant is not None
        return self.tenant

    async def _bootstrap(self) -> None:
        auth = await asyncpg.connect(settings.db_url_auth)
        try:
            await _init_conn(auth)
            row = await auth.fetchrow(
                "select id, slug, name, currency, autonomy_level from tenants where slug = $1",
                settings.tenant_slug,
            )
            if row is None:
                raise RuntimeError(
                    f"Tenant '{settings.tenant_slug}' not found — is the seed pack applied?"
                )
            terminology = await auth.fetchval(
                "select value from tenant_settings where tenant_id = $1 and key = 'terminology'",
                row["id"],
            )
        finally:
            await auth.close()

        self.tenant = Tenant(
            id=str(row["id"]),
            slug=row["slug"],
            name=row["name"],
            currency=row["currency"].strip(),
            autonomy_level=row["autonomy_level"],
            terminology=terminology or {},
        )
        self._pool = await asyncpg.create_pool(
            dsn=settings.db_url_app, min_size=1, max_size=5, init=_init_conn
        )

    @asynccontextmanager
    async def tx(self):
        """A transaction scoped to the tenant. ALL tool SQL goes through this."""
        tenant = await self.ensure()
        assert self._pool is not None
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.fetchval(
                    "select set_config('app.tenant_id', $1, true)", tenant.id
                )
                yield conn


db = Database()


async def emit_event(
    conn: asyncpg.Connection,
    event_key: str,
    subject_kind: str,
    subject_id: str,
    payload: dict | None = None,
) -> None:
    """Every write emits a domain event — the self-driving loop consumes these."""
    assert db.tenant is not None
    await conn.execute(
        """insert into domain_events (tenant_id, event_key, subject_kind, subject_id, payload)
           values ($1, $2, $3, $4, $5)""",
        db.tenant.id, event_key, subject_kind, subject_id, payload or {},
    )


async def log_activity(
    conn: asyncpg.Connection,
    kind: str,
    body: str,
    contact_id: str | None = None,
    deal_id: str | None = None,
    meta: dict | None = None,
) -> None:
    assert db.tenant is not None
    await conn.execute(
        """insert into activities (tenant_id, kind, actor, contact_id, deal_id, body, meta)
           values ($1, $2, 'ai', $3, $4, $5, $6)""",
        db.tenant.id, kind, contact_id, deal_id, body, meta or {},
    )
