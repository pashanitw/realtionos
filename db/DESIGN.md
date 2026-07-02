# RelationOS — Database Design

**Config-driven, AI-native, multi-tenant CRM on PostgreSQL.**
This document explains the schema in `db/schema.sql`, the decisions behind it,
and how every frontend feature maps to tables. The vertical (real estate today)
lives entirely in `db/seeds/real_estate_pack.sql`; `education_pack.sql` proves
the same schema runs a second industry without touching a single table.

---

## 1. Principles

1. **Config, not code.** One generic core. A new industry = a config pack
   (rows), never new tables/columns or a deploy.
2. **Three-tier fields.** Universal facts are fixed columns → vertical pack
   fields are config rows → tenant-added custom fields are *the same config
   rows*, added at runtime from Settings. One mechanism, three entry points.
3. **The AI cites everything.** Every AI-captured fact and score reason carries
   provenance: source message, exact quote, confidence. No fabricated facts.
4. **Events drive the "self-driving".** Every change emits a `domain_event`;
   scoring, automations, realtime and the activity feed are consumers.
5. **Humans stay in the loop.** Anything the AI wants to do beyond its autonomy
   level becomes an `approvals` row — one queue, every kind of nod.
6. **Production posture.** Tenant isolation via RLS, append-only audit trail,
   consent ledger (DPDP/WhatsApp), Guardian policy rules as data, Firebase Auth
   alignment, files as first-class rows.

## 2. The three layers

```
┌─ Platform registry ──────────── channels
├─ Tenant config (the vertical) ─ roles · lead_sources · connectors · pipelines
│                                 pipeline_stages · field_definitions
│                                 catalog_item_types · scoring_models
│                                 signal_definitions · personas · playbooks
│                                 lost_reasons · sla_policies · policy_rules
│                                 resource_types · appointment_types
│                                 assessment_types · kb_categories
└─ Operational data ───────────── contacts · deals · messages · scores …
                                  (shaped at runtime by the layer above)
```

Onboarding runs a versioned **industry pack** — plain SQL under `db/seeds/`,
one per vertical, reviewed and versioned in git — that fills the tenant's
config tables. Terminology ("contact" → *Buyer* / *Student*) is a
`tenant_settings` document the UI reads for labels.

## 3. Enum vs. config — the rule

**ENUM** only for mechanical states code must switch on and no vertical would
ever extend: message direction, approval status, task status, actor kind
(ai/human/system), invoice status.

**Config rows** for anything a vertical or tenant could plausibly change:
stages, sources, signals, field types, KB categories, resource status flows,
policy rules, personas. Channels are a platform reference *table* (not enum) so
a new channel is a row + connector implementation, not a migration.

Stage *semantics* travel as **tags** (`visit`, `booked`, `won`, `lost`,
`milestone`) so code never hardcodes stage names — "is this deal booked?"
means "does its stage carry the `booked` tag".

### JSONB discipline

JSONB does exactly three jobs in this schema — anything else should be a row
or a column:

1. **Interpreted specs (mini-DSLs)** — `status_flow`, `playbooks.steps`,
   `personas.rules`, `automations.{trigger,conditions,actions}`,
   `policy_rules.definition`. Shape varies by kind; normalizing would mean a
   dozen sparse tables reassembling one document.
2. **Payloads & snapshots** — `domain_events.payload`, `audit_log.before/after`,
   `ai_runs.grounding`, `interaction_analyses.scores`. Write-once, read-as-blob,
   never joined.
3. **Derived cache** — `contacts.attributes` mirrors current
   `contact_field_values`. It is a **cache, not truth**: nothing writes to it
   directly, and a rebuild function must exist.

The four rules:

- **No FKs inside JSON.** If a blob contains an id you care about, make it a
  row (that's why offers, matches, consents, evidence are tables).
- **Every JSONB column has an app-layer schema** (zod / JSON Schema) validated
  on write — Postgres validates nothing inside it.
- **Promote when hot.** A JSON key that gets filtered/sorted routinely becomes
  a generated column + index (one-liner, no rewrite).
- **JSON shape changes are still migrations** — version the shapes
  (`policy_rules.version`, `scoring_models.version`); old rows keep meaning
  what they meant when written.

## 4. Identity & authorization (Firebase Auth alignment)

- **Firebase owns credentials** (passwords, MFA, OAuth). There are no
  password/session tables. `users.firebase_uid` links our internal uuid to the
  Firebase identity; email is mirrored from the verified token.
- **Postgres owns authorization.** The API verifies the ID token, resolves
  `memberships` → `roles` (data_scope: own/team/tenant + nav_items +
  permissions), and sets `app.tenant_id` for RLS. Custom claims may mirror the
  role for client-side nav gating only — never for data access (claims go
  stale until token refresh; DB checks revoke instantly).
- **Provisioning is invite-first JIT**: `invitations` (email + role + expiry) →
  first Firebase sign-in matches the verified email → user gets `firebase_uid`,
  membership is created, invite marked accepted.
- Ownership FKs point at `memberships` (a seat in a tenant), not `users`, so
  ownership is always tenant-consistent.

## 5. Multi-tenancy

Single database, shared schema, `tenant_id` on every tenant-owned row.
RLS is enabled programmatically on all such tables (§21 of schema.sql):

```sql
set local app.tenant_id = '<uuid>';   -- per transaction, after token verification
```

Role-based scoping *within* a tenant (agent sees own book, manager sees all)
is applied in the query layer from `roles.data_scope`; RLS guarantees the
tenant boundary even if application code has a bug.

## 6. Domain walkthrough

### Contacts & intelligence
`contacts` holds only universals (name, phone, email, source, owner, stage,
score, budget, SLA clocks). Everything vertical lives in
`contact_field_values`: one row per captured fact with `source_message_id`,
`source_quote`, `confidence`, versioned via `superseded_at` — current values
mirrored into `contacts.attributes` (JSONB) for cheap reads.

- Buyer-360 profile chips with "captured from this message" → field values
- Budget-evolution chart → history of the budget field
- "Fields auto-filled · 0 corrections" → an AI value later superseded by a
  human value *is* a correction; capture-precision analytics come free
- Overnight leads → `captured_by='ai'` + `review_status='pending'`
- Enrichment (LinkedIn/company/news) → `enrichment_records`
- Loan eligibility → `assessments` against config `assessment_types`
- Dedupe → `duplicate_candidates` (pending → approvals → merged;
  `contacts.merged_into_id`)

### Scoring (explainable, per-tenant models)
`scoring_models` (versioned; temperature bands + lifecycle classification
rules) → `signal_definitions` (categories + default weights) →
`contact_signal_values` (0–100 per signal, optional per-contact weight
override — the Buyer-360 sliders) → denormalized `contacts.score` for ranking,
append-only `contact_scores` history (sparkline, deltas), and
`score_evidence` (polarity, weight, reason, source quote) for the citation UI.
Score = Σ(value·weight)/Σ(weight) — same math as `lib/data/scoring.ts`.

### Conversations & AI concierge
`conversations` (channel thread; `handled_by` ai/human; takeover =
`handed_off`) → `messages` (direction, provider `external_id` for idempotency,
AI `summary`) → `transcripts` + `transcript_segments` (one transcript per
call-message *or* meeting; `status='processing'` while the Live Call Copilot
streams). `conversation_catalog_items` records what the AI offered.
`contact_consents` is the append-only opt-in/opt-out ledger per channel.

### Live Call Copilot & Auditor AI
A call is a `messages` row via the telephony connector; segments stream into
`transcript_segments`; live hints are `ai_runs` (kind `live_hint`) grounded on
`kb_articles` and `score_evidence`. When the call ends:
`interaction_analyses` stores quality scores (talk-ratio, objection handling),
Guardian `policy_flags` (citing `policy_rules` key + version), the
`approach_key`/playbook used and the `outcome`. "Investor-first won 8/11
similar, +26% faster" is a *query* over analyses × deals — no stats table.

### Deals, pipeline & money
`deals` (contact, stage, matched `catalog_item`, value, won/lost +
`lost_reason_id`) · `stage_events` (one audit trail for contact & deal moves,
carries the **mandatory remark**, `suggested_by_ai`) · `payments` (token /
installments) · `invoices` (unique number per tenant, line items, PDF
attachment). AI stage suggestions are `approvals` of kind `stage_move`
surfaced inline on the card.

### Catalog & matching
`catalog_item_types` defines the hierarchy per vertical (project→unit,
university→program) with per-type availability labels over generic states
(available/held/committed/closed). `catalog_items` carries promoted
`list_price` + config-defined `attributes` + embedding.
Matching: `field_definitions.use_in_matching` + `match_against` map contact
fields to catalog fields; results in `contact_catalog_matches` (score +
reasons). Excel upload → `import_jobs` + bulk `catalog_items`.

### Scheduling & field ops
`appointments` (typed via config; status incl. `no_show` feeding re-engagement
automations). Cab logistics generalized: `resource_types` (config **status
flow** — Assigned→Pickup→En route→At site→Completed), `resources` (fleet),
`resource_operators` (drivers), `resource_bookings` (the run; each transition
emits a domain event → ETA/arrival alerts into the activity feed).

### Work, approvals & automation
`tasks` (origin: manual/meeting/ai/automation/playbook) · `activities` (the
live feed; presentation layer over events) · `approvals` (every "needs your
nod": drafted outbound, new-lead accept, stage move, field update, duplicate
merge — with `proposed_action` payload, confidence, autonomy level, decided_by)
· `campaigns` + `campaign_recipients` (merge tags = field keys; consent-gated)
· `domain_events` (transactional outbox, bigint-ordered, `processed_at`) ·
`automations` (NL sentence kept in `nl_source` + compiled trigger/conditions/
actions) · `automation_runs` (log + optional resulting approval).

### Knowledge & AI infra
`kb_categories` (config) + `kb_articles` (summary/body/tags, `used_by_ai`,
approval status, view_count, embedding for RAG — grounding for concierge
replies and copilot FAQs). `ai_runs` traces **every** model call (model, cost,
latency, trace id, grounding citations, guardrail status) — the AI-gateway
ledger. `ai_briefs` stores Morning Brief / weekly exec brief (stats + prose).
`assistant_threads`/`assistant_messages` persist the internal ⌘L copilot,
including the actions it committed. `meetings` + `meeting_action_items`
(promoted to tasks on "Add to Tasks").

### Production layer
`policy_rules` (Guardian's tenant-editable rulebook; versioned; severities
block/warn/flag) · `audit_log` (append-only — trigger-enforced — actor,
firebase_uid, before/after, auth context) · `contact_consents` ·
`attachments` (object-storage keys; recordings, PDFs, uploads).
There is deliberately **no** custom-object escape hatch: even the oddest
module (cab logistics) fit the generic core; add one only when a real
vertical proves the need.

## 7. Frontend feature → table map

| Screen / feature | Tables |
|---|---|
| Login / RBAC / route guard | users (firebase_uid), memberships, roles (data_scope, nav_items), invitations |
| Home dashboards | aggregates over deals/contacts/approvals + ai_briefs |
| Worklist (ranked, SLA, filters) | contacts (score desc, next_follow_up_at), sla_policies, contact_catalog_matches |
| Leads (overnight + morning brief + nod rail) | contacts (captured_by, review_status), ai_briefs, approvals |
| Buyer 360 timeline | messages, transcripts, transcript_segments, activities |
| Profile chips + provenance hover | contact_field_values (source_message_id, source_quote) |
| Score + evidence + weight sliders | scoring_models, signal_definitions, contact_signal_values, contact_scores, score_evidence |
| Buyer intelligence / best-time-to-contact | contact_field_values (urgency, competitor, best_contact_window…) |
| Enrichment / loan eligibility | enrichment_records / assessments + assessment_types |
| Milestone tracker / playbook | pipeline_stages.tags ('milestone') / playbooks + personas |
| Channel drawers ("context to speak") | derived: score_evidence + messages + field values (ai_runs for drafts) |
| Live Call Copilot | messages(call) + transcripts(processing) + ai_runs(live_hint) + kb_articles |
| Auditor AI / Guardian call score | interaction_analyses + policy_rules |
| Concierge inbox + takeover | conversations (handled_by, state), messages, conversation_catalog_items |
| Meetings → tasks | meetings, transcripts, meeting_action_items, tasks |
| Pipeline (drag + remark, interest filter, invoice) | deals, stage_events (note), scoring bands (temperature), invoices, payments |
| Inventory + Excel import + match-for-buyer | catalog_item_types, catalog_items, import_jobs, contact_catalog_matches |
| Logistics (fleet, movement board, alerts) | resource_types (status_flow), resources, resource_operators, resource_bookings, domain_events |
| Broadcast (segments, merge tags, history) | campaigns, campaign_recipients, contact_consents, field_definitions (is_merge_tag) |
| Automations (NL → workflow, runs) | automations (nl_source), automation_runs, domain_events |
| Approvals | approvals (+ duplicate_candidates) |
| Team | teams, memberships (monthly_target), mv_* leaderboards |
| Analytics | mv_pipeline_funnel, mv_source_performance, mv_stage_velocity, lost_reasons, ai_briefs, interaction_analyses |
| Settings: sources / autonomy / fields | connectors, lead_sources / tenants.autonomy_level / field_definitions |
| Knowledge Base | kb_categories, kb_articles (used_by_ai, status, views, embedding) |
| ⌘K commit-a-record / global search | contacts et al. tsvector + pg_trgm; ai_runs |
| ⌘L Agent Copilot | assistant_threads, assistant_messages, ai_runs |
| Activity feed | activities (fed by domain_events consumers) |

## 8. Search & embeddings

- **Lexical**: generated `tsvector` columns + GIN on contacts, catalog_items,
  kb_articles; `pg_trgm` on names/phones for fuzzy ⌘K lookup.
- **Semantic**: pgvector columns (contacts requirement, catalog items, KB,
  messages) with HNSW indexes — matching, dedupe assist, RAG retrieval. One
  database: embeddings live/die transactionally with their rows. Dimension is
  1536; changing embedding models is an additive column + backfill.

## 9. Analytics posture

Everything on the Analytics screen is **derived** — materialized views
(examples in §22: funnel, source ROI, stage velocity) refreshed on schedule or
event. Revenue leakage = stalled deals × stage probability; win/loss root
cause = lost_reasons × stage_events; AI health (capture precision, AI-handled
share, dedupe rate) = contact_field_values corrections, messages.handled_by,
duplicate_candidates. No screen-shaped tables.

## 10. Deliberately out of scope (owned elsewhere)

- Credentials, sessions, MFA → Firebase Auth
- Connector secrets → secret manager/vault (connectors.config holds refs only)
- File bytes → object storage (attachments holds keys)
- Job/queue state → the queue system; DB keeps the durable outbox
  (domain_events) and outcomes (automation_runs, ai_runs)

## 11. Migration & evolution posture

Additive-first: new capability = new config rows, else a new nullable
column/table. The audit trail, consent ledger and domain events are
append-only. Industry packs are versioned in git; `policy_rules.version` +
`scoring_models.version` allow config evolution without rewriting history —
past decisions keep pointing at the version that made them.
