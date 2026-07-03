# RelationOS

**AI-native, config-driven CRM.** One generic engine; each industry (real
estate today, education next, any vertical after) is a configuration pack —
rows in Postgres, not code.

**Delivery strategy is MCP-first**: the CRM ships as an MCP server — a set of
tools any AI can operate (Claude connectors, ChatGPT connectors, Claude Code) —
before the web UI is wired to the backend. Read
[`docs/mcp-first-strategy.md`](docs/mcp-first-strategy.md).

```
web/    Next.js frontend (production-shaped demo on mock data; wired last)
mcp/    Python MCP server — the product's primary interface
api/    (future) FastAPI backend for the web app, reusing the mcp core
db/     Postgres schema (generic core) + industry seed packs + design doc
docs/   Strategy & roadmap
```

## Quick start

```bash
# 1. Database (Postgres 16 + pgvector in Docker)
docker run -d --name relos-dev -e POSTGRES_PASSWORD=relos \
  -p 127.0.0.1:55432:5432 pgvector/pgvector:pg16
docker exec -i relos-dev psql -U postgres -c "create database relos"
docker exec -i relos-dev psql -U postgres -d relos < db/schema.sql
docker exec -i relos-dev psql -U postgres -d relos < db/dev_roles.sql
docker exec -i relos-dev psql -U postgres -d relos < db/seeds/real_estate_pack.sql

# 2. MCP server
cd mcp && uv sync && cp .env.example .env && uv run relationos-mcp

# 3. Frontend demo (mock data)
cd web && npm install && npm run dev
```

## The idea in one line

A CRM whose primary user is an AI: leads are captured, qualified, scored and
driven to close by model-operated tools over a config-driven Postgres core —
with humans approving the moves that matter.
