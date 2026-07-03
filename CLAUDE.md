# RelationOS — AI-native, config-driven CRM (monorepo)

Production system (not a demo backend). One generic core; industries are
config packs, never code. Strategy: **MCP-first** — see `docs/mcp-first-strategy.md`.

## Layout

- `web/` — Next.js frontend (currently mock-data demo; wired LAST).
  ⚠ Before writing any Next.js code, read `web/AGENTS.md` — this Next version
  has breaking changes; consult `web/node_modules/next/dist/docs/`.
- `mcp/` — Python MCP server (uv + official `mcp` SDK). The primary product
  interface: CRM tools for Claude/ChatGPT connectors and Claude Code.
- `api/` — (future) FastAPI backend for the web frontend; reuses the mcp
  service layer. Do not scaffold until frontend wiring begins.
- `db/` — Postgres schema (generic core) + industry seed packs + DESIGN.md.
  Read `db/DESIGN.md` before touching the schema. Validated on pg16+pgvector.
- `docs/` — strategy + roadmap.

## Dev database

`relos-dev` Docker container (pgvector/pgvector:pg16), port 55432, db `relos`,
password `relos`. Seeded with the real-estate (aurum) + education (meridian)
packs. Recreate: run `db/schema.sql`, `db/dev_roles.sql`, then the seed packs.

## Rules

- Auth is Firebase; Postgres owns authorization (memberships/roles + RLS).
  Never bypass the two-role pattern (`relos_auth` bootstrap / `relos_app` RLS-bound).
- Vertical-specific behavior belongs in config rows (field_definitions,
  pipeline_stages tags, policy_rules…) — never `if industry == …` in code.
- Writes emit `domain_events`; AI-captured facts carry provenance
  (source message + quote + confidence).
