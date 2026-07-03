# MCP-First Strategy

**The idea: the CRM's primary interface is not a web app — it's a set of tools
an AI operates.** We ship the backend as an MCP (Model Context Protocol)
server first, drive it from Claude Code during development, distribute it as a
connector (Claude connectors / ChatGPT connectors / any MCP client), and wire
the web frontend **last**.

## Why MCP-first

1. **The product thesis is "AI operates the CRM"** — capture, qualify, score,
   draft, book, escalate. An MCP server *is* that thesis executable: every
   capability becomes a tool a model can call. Building the UI first would
   mean simulating the AI (which the demo already does); building the tools
   first makes the AI real on day one.
2. **Instant distribution surface.** A remote MCP server is a product on its
   own: any Claude or ChatGPT user connects it and gets a conversational CRM —
   "who should I call today?", "add a buyer, 2BHK Narsingi ₹85L", "move the
   Kapoor deal to Booking, remark: token received". No frontend deploy, no
   app-store, no sales demo environment.
3. **It forces the config-driven core to be honest.** Tools take no vertical
   assumptions: they read `field_definitions`, stage tags, terminology at
   runtime. If the MCP server needs an `if real-estate` anywhere, the design
   failed — better to discover that now than after wiring 20 screens.
4. **Development loop = product loop.** We operate the CRM from Claude Code
   while building it. Every gap we feel as operators is a missing tool or a
   bad description — the exact quality the connector user will experience.

## Delivery phases

| Phase | What ships | Interface |
|---|---|---|
| **1. MCP core** (now) | Python MCP server over the validated Postgres core: worklist, contact 360, capture, pipeline, inventory, matching, tasks | stdio, driven from Claude Code |
| **2. Operate & harden** | Use it daily from here; add tools as gaps appear (approvals, campaigns, KB, analytics); every write emits domain_events + activities | stdio |
| **3. Connector** | Remote MCP (streamable HTTP) + Firebase-backed OAuth; tenant resolved from the authenticated user via memberships; Guardian policy checks on write tools | Claude connectors / ChatGPT connectors |
| **4. API for the web** | `api/` FastAPI app reusing the same service layer (`relationos_core`), REST/SSE shaped for screens | web frontend |
| **5. Frontend wiring** | `web/` swaps its mock `DataSource` for the API — screens don't change; that seam was the point | humans |

## Architecture

```
                       ┌──────────────────────────────┐
 Claude Code (dev) ───►│                              │
 Claude connector ────►│   mcp/  (Python, FastMCP)    │──┐
 ChatGPT connector ───►│   tools = CRM capabilities   │  │  service layer
                       └──────────────────────────────┘  │  (config-driven,
                       ┌──────────────────────────────┐  │   later extracted
 web/ (Next.js) ──────►│   api/  (FastAPI, phase 4)   │──┤   as relationos_core)
                       └──────────────────────────────┘  │
                                                          ▼
                                        Postgres (db/schema.sql)
                                        RLS · two-role pattern
                                        relos_auth → resolve tenant
                                        relos_app  → set app.tenant_id
```

Rules that hold across phases:

- **MCP talks to Postgres directly** through the service layer — no HTTP hop.
  The FastAPI app is for the browser, not for the model.
- **Security is the DB's design, not the server's discipline**: the MCP server
  connects RLS-bound (`relos_app`), sets `app.tenant_id` per transaction,
  and cannot read another tenant even if a tool has a bug.
- **Tools are vertical-blind.** Labels come from tenant terminology; fields
  from `field_definitions`; stage semantics from tags; compliance from
  `policy_rules`. The same server serves Aurum (buyers/units/cabs) and
  Meridian (students/programs) with zero code difference.
- **Every write emits a `domain_event`** and an activity — the self-driving
  loop (scoring, automations, briefs) consumes events, regardless of whether
  the write came from MCP, API, or a channel connector.

## Tool surface (phase 1 slice)

Read: `get_workspace` (terminology, stages, fields — orients the model) ·
`get_worklist` · `search_contacts` · `get_contact` (360: profile w/ provenance,
score evidence, timeline, matches) · `get_pipeline` · `list_inventory` ·
`match_catalog_for_contact`.

Write: `create_contact` (validates attributes against field_definitions) ·
`set_contact_field` (with provenance, supersedes prior value) ·
`move_deal_stage` (enforces the stage's mandatory-remark config) ·
`create_task` · `log_activity`.

Phase 2 adds: approvals queue, appointments/site-visits, campaigns (consent-
gated), KB search (RAG), briefs, analytics queries.

## What we are explicitly NOT doing yet

- No frontend/backend integration (phase 5; the mock demo stays as-is in `web/`)
- No `api/` folder until phase 4 — premature layers are how seams rot
- No LLM calls *inside* the MCP server in phase 1 — the model operating the
  tools **is** the intelligence; server-side AI (scoring engine, concierge)
  lands with the event consumers
