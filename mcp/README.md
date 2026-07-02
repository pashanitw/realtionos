# relationos-mcp

The RelationOS CRM as an MCP server — 13 config-driven tools over the generic
Postgres core (`db/schema.sql`). One server instance serves one tenant; the
vertical (labels, fields, stages, matching rules) is read from the tenant's
config at runtime. See `docs/mcp-first-strategy.md` for why MCP-first.

## Run

```bash
# prerequisites: the relos-dev Postgres (see root README), roles + a seed pack applied
cp .env.example .env      # points at localhost:55432, tenant 'aurum'
uv sync
uv run relationos-mcp     # stdio
```

Claude Code picks it up automatically via the repo-root `.mcp.json`.

## Smoke test

```bash
uv run python scripts/smoke.py
```

Exercises every tool against the live dev DB: capture with field validation,
provenance-preserving field updates, config-driven matching, mandatory-remark
stage moves, tasks, activity feed.

## Layout

```
src/relationos_mcp/
  server.py     FastMCP instance + tool registration (thin)
  db.py         two-role tenant-scoped Postgres access (RLS-bound app pool)
  settings.py   env config
  service/      plain async functions = the actual capabilities
                (imported by server.py; the future api/ FastAPI app
                 reuses these directly — extract as relationos_core then)
```

Security model: queries run as `relos_app` with `app.tenant_id` set per
transaction — Postgres RLS guarantees tenant isolation below this code.
