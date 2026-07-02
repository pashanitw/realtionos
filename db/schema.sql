-- ============================================================================
-- RelationOS — AI-native CRM · PostgreSQL schema
-- ============================================================================
-- One generic, config-driven core. Verticals (real estate, education,
-- insurance, …) are rows in the config tables — never new tables or columns.
--
--   Layer 1 · Platform registry  — shared reference data (channels)
--   Layer 2 · Tenant config      — pipelines, stages, fields, signals, sources,
--                                  personas, playbooks, resource flows … per tenant
--   Layer 3 · Operational data   — contacts, deals, messages, scores, tasks …
--                                  shaped at runtime by Layer 2
--
-- Conventions
--   · every tenant-owned row carries tenant_id → RLS tenant isolation (see §21)
--   · uuid PKs (gen_random_uuid), timestamptz everywhere, soft delete where noted
--   · money = numeric(14,2) + currency char(3) (tenant default INR)
--   · ENUM only for mechanical states that code must switch on;
--     anything a vertical could extend is a config table row (see DESIGN.md)
--   · provenance: AI-captured facts keep source_message_id + source_quote
-- Target: PostgreSQL 15+ · extensions: citext, pg_trgm, vector (pgvector)
-- ============================================================================

create extension if not exists citext;
create extension if not exists pg_trgm;
create extension if not exists vector;

-- ============================================================================
-- §1 · Mechanical enums (universal, code-level; vertical concepts are NOT here)
-- ============================================================================

create type actor_kind          as enum ('ai', 'human', 'system');
create type msg_direction       as enum ('inbound', 'outbound');
create type conversation_state  as enum ('open', 'ai_handling', 'handed_off', 'snoozed', 'closed');
create type capture_review      as enum ('pending', 'accepted', 'dismissed');
create type approval_status     as enum ('pending', 'approved', 'dismissed', 'expired');
create type task_status         as enum ('open', 'completed', 'cancelled');
create type task_priority       as enum ('high', 'medium', 'low');
create type appointment_status  as enum ('scheduled', 'confirmed', 'completed', 'no_show', 'cancelled');
create type availability_status as enum ('available', 'held', 'committed', 'closed');
  -- generic inventory states; vertical labels (Blocked/Booked/Sold) come from
  -- catalog_item_types.availability_labels
create type campaign_status     as enum ('draft', 'scheduled', 'sending', 'sent', 'cancelled');
create type recipient_status    as enum ('queued', 'sent', 'delivered', 'read', 'replied', 'failed', 'opted_out');
create type invoice_status      as enum ('draft', 'issued', 'paid', 'void');
create type connector_status    as enum ('connected', 'token_expiring', 'error', 'disconnected');
create type meeting_kind        as enum ('in_person', 'video', 'phone');
create type kb_status           as enum ('draft', 'in_review', 'approved', 'archived');
create type field_entity        as enum ('contact', 'deal', 'catalog_item', 'conversation');
create type data_scope          as enum ('own', 'team', 'tenant');
create type run_status          as enum ('ok', 'error', 'guardrail_blocked');

-- ============================================================================
-- §2 · Platform registry (shared across all tenants, no tenant_id)
-- ============================================================================

-- Communication channels. A reference table (not an enum) so new channels
-- (telegram, instagram…) are a row + a connector implementation, not a migration.
create table channels (
  key         text primary key,          -- 'whatsapp' | 'sms' | 'email' | 'call' | 'web' | …
  label       text not null,
  supports_ai boolean not null default true
);

insert into channels (key, label) values
  ('whatsapp', 'WhatsApp'), ('sms', 'SMS'), ('email', 'Email'),
  ('call', 'Call'), ('web', 'Web chat');

-- Industry packs are versioned SQL scripts under db/seeds/ (one per vertical),
-- run at tenant onboarding to fill the config tables. Deliberately NOT a
-- table: one mechanism, reviewed and versioned in git. Revisit only when
-- self-serve onboarding UI needs packs as data.

-- ============================================================================
-- §3 · Tenancy & identity
-- ============================================================================

create table tenants (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  region         text,                                  -- e.g. 'Hyderabad'
  industry_key   text,                                  -- vertical pack label: 'real-estate' / 'education' / …
  plan           text not null default 'growth',        -- Growth / Scale / Enterprise
  currency       char(3) not null default 'INR',
  locale         text not null default 'en-IN',
  timezone       text not null default 'Asia/Kolkata',
  autonomy_level smallint not null default 1
                 check (autonomy_level between 0 and 4), -- L0 answer-only … L4 autopilot
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Free-form per-tenant settings: terminology overrides ("contact"→"Buyer"),
-- business hours (drives the overnight window / morning brief), SLA defaults,
-- per-surface autonomy overrides, feature flags.
create table tenant_settings (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

-- Global identity, linked 1:1 to Firebase Authentication. Firebase owns
-- credentials/MFA/OAuth — there are deliberately NO password or session tables.
-- Postgres owns authorization: the API verifies the Firebase ID token, then
-- resolves memberships/roles here (authoritative, instant revocation; custom
-- claims are used for client-side nav hints only). email is mirrored from the
-- verified token and refreshed on login.
create table users (
  id                uuid primary key default gen_random_uuid(),
  firebase_uid      text unique,                        -- Firebase UID (string, ≤128 chars); set at first sign-in
  email             citext not null unique,
  email_verified    boolean not null default false,
  name              text not null,
  phone             text,
  photo_url         text,
  avatar_hue        smallint,
  is_platform_admin boolean not null default false,     -- the super-admin flag
  last_login_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Roles are tenant config (instantiated from the industry template), so a
-- tenant can rename/add roles and re-scope nav without a deploy.
create table roles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  key         text not null,                            -- 'manager' | 'agent' | 'telecaller' | …
  label       text not null,
  data_scope  data_scope not null default 'own',        -- own book / team / whole tenant
  nav_items   text[] not null default '{}',             -- sidebar gating (route keys)
  permissions jsonb  not null default '{}',             -- fine-grained action grants
  sort_order  smallint not null default 0,
  unique (tenant_id, key)
);

create table teams (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  name            text not null,
  manager_user_id uuid references users(id),
  created_at      timestamptz not null default now()
);

-- A user's seat in a tenant. All ownership FKs point here (not at users),
-- so ownership is always tenant-consistent.
create table memberships (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  role_id        uuid not null references roles(id),
  team_id        uuid references teams(id),
  title          text,                                  -- 'Sales Head' / 'Senior Agent' / …
  monthly_target numeric(14,2),                         -- booking quota (nullable)
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- Invite-first provisioning (JIT against Firebase): a manager invites an email
-- with a role; on first Firebase sign-in the verified email matches the invite,
-- the users row gets its firebase_uid, and the membership is created.
create table invitations (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references tenants(id) on delete cascade,
  email                    citext not null,
  role_id                  uuid not null references roles(id),
  team_id                  uuid references teams(id),
  invited_by_membership_id uuid references memberships(id),
  status                   text not null default 'pending'
                           check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at               timestamptz not null,
  accepted_membership_id   uuid references memberships(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create unique index invitations_one_pending on invitations (tenant_id, email) where status = 'pending';

-- ============================================================================
-- §4 · Tenant configuration layer (the vertical lives HERE, as rows)
-- ============================================================================

-- Where leads come from. Real estate: 99acres, MagicBricks… · Education: fairs,
-- Google Ads… Pure config.
create table lead_sources (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  key        text not null,
  label      text not null,
  kind       text not null default 'other'
             check (kind in ('portal', 'channel', 'ads', 'event', 'manual', 'referral', 'other')),
  sort_order smallint not null default 0,
  active     boolean not null default true,
  unique (tenant_id, key)
);

-- A live integration: either a lead-source sync (portal scraper/API) or a
-- messaging channel account (WhatsApp Business number, mailbox…).
create table connectors (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  provider      text,                                   -- 'meta-cloud-api', 'twilio', …
  source_id     uuid references lead_sources(id),
  channel_key   text references channels(key),
  status        connector_status not null default 'disconnected',
  status_detail text,
  config        jsonb not null default '{}',            -- non-secret settings; secrets live in a vault
  last_sync_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (source_id is not null or channel_key is not null)
);

-- Pipelines are per-entity ('contact' lifecycle or 'deal' journey) and fully
-- tenant-defined. "Custom stages" in the UI = rows in pipeline_stages.
create table pipelines (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  entity     field_entity not null default 'deal' check (entity in ('contact', 'deal')),
  key        text not null,
  name       text not null,
  is_default boolean not null default false,
  sort_order smallint not null default 0,
  unique (tenant_id, key)
);

-- Stage semantics travel as TAGS, so code never hardcodes stage names.
-- Real estate tags: 'visit' (site visit lined up), 'booked' (token paid …),
-- 'won', 'lost', 'milestone' (shown on the Buyer-360 milestone tracker).
create table pipeline_stages (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  pipeline_id           uuid not null references pipelines(id) on delete cascade,
  key                   text not null,
  label                 text not null,
  sort_order            smallint not null default 0,
  probability           smallint check (probability between 0 and 100),
  tags                  text[] not null default '{}',
  require_note_on_entry boolean not null default false, -- mandatory remark on drag
  sla_hours             int,                            -- max healthy dwell time (staleness)
  is_terminal           boolean not null default false,
  unique (pipeline_id, key)
);

-- Catalog shape per vertical: real estate = project → unit; education =
-- university → program; insurance = product line → plan. Self-referencing type
-- hierarchy; item attributes are defined in field_definitions below.
create table catalog_item_types (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  key                 text not null,
  label_singular      text not null,
  label_plural        text not null,
  parent_type_id      uuid references catalog_item_types(id),
  availability_labels jsonb,   -- {"available":"Available","held":"Blocked","committed":"Booked","closed":"Sold"}
  sort_order          smallint not null default 0,
  unique (tenant_id, key)
);

-- THE central config table. Every vertical-specific attribute of a contact,
-- deal, catalog item or conversation is a field definition + a value row —
-- never a column. Powers: profile chips, AI extraction targets ("what to
-- qualify"), buyer intel, inventory attributes, matching, merge tags.
create table field_definitions (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  entity               field_entity not null,
  catalog_item_type_id uuid references catalog_item_types(id),  -- narrows catalog fields to one type
  key                  text not null,
  label                text not null,
  description          text,
  data_type            text not null check (data_type in
                        ('text','number','money','boolean','date','datetime',
                         'select','multiselect','phone','email','url','json')),
  options              jsonb,                       -- select choices: [{"value","label"}]
  unit                 text,                        -- 'sqft', 'years', …
  required             boolean not null default false,
  is_qualifying        boolean not null default false, -- AI must capture before stage 'qualified'
  ai_capture           boolean not null default true,  -- AI may extract it from conversations
  use_in_matching      boolean not null default false,
  match_against        text,                        -- catalog field key this matches (contact side)
  show_in_profile      boolean not null default true,
  is_merge_tag         boolean not null default true,  -- usable as {Token} in broadcasts
  sort_order           smallint not null default 0,
  active               boolean not null default true,
  unique (tenant_id, entity, key)
);

-- Scoring is a versioned, per-tenant model: which signals, their default
-- weights, and how the score maps to temperature bands (Hot/Warm/Cold…) and
-- lifecycle classifications (New / Interested / Not Interested rules).
create table scoring_models (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  entity               field_entity not null default 'contact' check (entity in ('contact', 'deal')),
  name                 text not null,
  version              int not null default 1,
  active               boolean not null default true,
  temperature_bands    jsonb not null default '[]',  -- [{"label":"Hot","min":75},…] high→low
  classification_rules jsonb not null default '{}',  -- rules for derived states (new/stalled/engaged)
  config               jsonb not null default '{}',
  created_at           timestamptz not null default now()
);

-- The signal categories (real estate: Budget fit, Config & locality match,
-- Engagement, Site-visit intent, Loan readiness). Weighted-average score =
-- Σ(value·weight)/Σ(weight); per-contact weight overrides live on the values.
create table signal_definitions (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  model_id       uuid not null references scoring_models(id) on delete cascade,
  key            text not null,
  label          text not null,
  description    text,
  default_weight numeric(5,2) not null default 1.0,
  sort_order     smallint not null default 0,
  unique (model_id, key)
);

-- Persona classification (Investor / Luxury / First home / End-user) → drives
-- best-script and playbook suggestions. Rules are declarative filters.
create table personas (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  key         text not null,
  label       text not null,
  description text,
  rules       jsonb not null default '{}',
  sort_order  smallint not null default 0,
  unique (tenant_id, key)
);

-- Recommended play per situation (Buyer-360 "playbook"): ordered steps the AI
-- proposes (call within X, send matches, book visit…).
create table playbooks (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  key         text not null,
  name        text not null,
  description text,
  persona_id  uuid references personas(id),
  conditions  jsonb not null default '{}',   -- when this playbook applies
  steps       jsonb not null default '[]',   -- [{"kind":"call","within_minutes":15,"label":…},…]
  active      boolean not null default true,
  unique (tenant_id, key)
);

-- Why deals die — feeds win/loss + lost-reason root-cause analytics.
create table lost_reasons (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  key        text not null,
  label      text not null,
  sort_order smallint not null default 0,
  active     boolean not null default true,
  unique (tenant_id, key)
);

-- SLA policy: which contacts it applies to (declarative filter) and the
-- response/follow-up clocks. Drives worklist "overdue" flags.
create table sla_policies (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references tenants(id) on delete cascade,
  name                   text not null,
  applies                jsonb not null default '{}',  -- e.g. {"temperature":"Hot"} / {"source":"whatsapp"}
  first_response_minutes int,
  follow_up_hours        int,
  sort_order             smallint not null default 0,  -- first match wins
  active                 boolean not null default true
);

-- Guardian's rulebook: tenant-defined compliance constraints the AI must
-- respect in every outbound draft and live call — pricing bounds, forbidden
-- claims, mandatory disclosures, discount limits. Every Guardian verdict
-- (ai_runs, interaction_analyses.policy_flags) cites a rule key + version,
-- so compliance decisions are auditable, not prompt folklore.
create table policy_rules (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  key         text not null,
  label       text not null,
  description text,
  category    text not null default 'conduct'
              check (category in ('pricing', 'claims', 'disclosure', 'discount', 'conduct', 'data')),
  definition  jsonb not null default '{}',   -- machine-evaluable rule spec
  severity    text not null default 'warn' check (severity in ('block', 'warn', 'flag')),
  version     int not null default 1,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, key)
);

-- Field-ops resource kinds (real estate: cab; education: counselling room…).
-- The whole movement board is config: status_flow is the ordered state machine
-- (Assigned → Pickup → En route → At site → Completed).
create table resource_types (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  key         text not null,
  label       text not null,
  status_flow jsonb not null default '[]',   -- [{"key":"assigned","label":"Assigned"},…]
  sort_order  smallint not null default 0,
  unique (tenant_id, key)
);

-- Kinds of scheduled interactions (site visit / counselling session / demo…).
create table appointment_types (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  key                  text not null,
  label                text not null,
  default_duration_min int not null default 60,
  requires_resource    boolean not null default false,
  resource_type_id     uuid references resource_types(id),
  sort_order           smallint not null default 0,
  unique (tenant_id, key)
);

-- Pluggable checks (real estate: home-loan eligibility; education: scholarship
-- eligibility; insurance: underwriting pre-check).
create table assessment_types (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  key          text not null,
  label        text not null,
  description  text,
  input_schema jsonb not null default '{}',
  active       boolean not null default true,
  unique (tenant_id, key)
);

-- Knowledge-base taxonomy (real estate: Home Loans, RERA…; education: Visas…).
create table kb_categories (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  key        text not null,
  label      text not null,
  sort_order smallint not null default 0,
  active     boolean not null default true,
  unique (tenant_id, key)
);

-- ============================================================================
-- §5 · Catalog (inventory) — projects/units, programs, plans… one table
-- ============================================================================

create table catalog_items (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  type_id      uuid not null references catalog_item_types(id),
  parent_id    uuid references catalog_items(id),      -- unit → project
  name         text not null,
  code         text,                                   -- unit no. / SKU / program code
  list_price   numeric(14,2),
  currency     char(3),
  availability availability_status not null default 'available',
  attributes   jsonb not null default '{}',            -- per field_definitions(entity='catalog_item')
  embedding    vector(1536),                           -- semantic matching / search
  search       tsvector generated always as
               (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(code,''))) stored,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ============================================================================
-- §6 · Contacts — the generic party ("Buyer" / "Student" / "Policyholder")
-- ============================================================================
-- Universal columns only; every vertical attribute is a contact_field_value.
-- budget_min/max are promoted because ranking + matching hit them constantly.

create table contacts (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  display_name        text not null,
  phone               text,
  email               citext,
  source_id           uuid references lead_sources(id),
  owner_membership_id uuid references memberships(id), -- the agent who owns this book entry
  pipeline_id         uuid references pipelines(id),
  stage_id            uuid references pipeline_stages(id),
  stage_entered_at    timestamptz,
  persona_id          uuid references personas(id),

  -- denormalized scoring outputs (history lives in contact_scores)
  score               numeric(5,2) not null default 0,
  score_updated_at    timestamptz,
  temperature         text,                            -- label from scoring_models.temperature_bands
  stalled             boolean not null default false,

  budget_min          numeric(14,2),
  budget_max          numeric(14,2),
  currency            char(3),
  requirement_summary text,                            -- AI one-liner: "3BHK · Kokapet · ₹1.3–1.4 Cr"

  next_follow_up_at   timestamptz,                     -- SLA clock → worklist overdue flag
  last_touch_at       timestamptz,

  captured_by         actor_kind not null default 'human',   -- 'ai' = overnight/concierge capture
  review_status       capture_review not null default 'accepted', -- 'pending' = awaiting the human nod

  attributes          jsonb not null default '{}',     -- denormalized current field values (fast reads)
  embedding           vector(1536),                    -- requirement embedding (matching, dedupe)
  search              tsvector generated always as
                      (to_tsvector('simple', coalesce(display_name,'') || ' ' ||
                        coalesce(phone,'') || ' ' || coalesce(email::text,''))) stored,

  merged_into_id      uuid references contacts(id),    -- set when deduped away
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

-- ============================================================================
-- §7 · Conversations & messages (omni-channel, AI-first)
-- ============================================================================

-- A thread with one contact on one channel. The Concierge inbox = open
-- conversations with handled_by='ai'; takeover flips state to 'handed_off'.
create table conversations (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references tenants(id) on delete cascade,
  contact_id             uuid not null references contacts(id) on delete cascade,
  channel_key            text not null references channels(key),
  state                  conversation_state not null default 'open',
  handled_by             actor_kind not null default 'ai',
  ai_journey             text,                         -- config-driven funnel label: qualifying/matched/visit_booked…
  assigned_membership_id uuid references memberships(id),
  intent_summary         text,                         -- "3BHK · Kokapet · ₹1.3–1.4 Cr"
  started_at             timestamptz not null default now(),
  last_message_at        timestamptz,
  closed_at              timestamptz,
  updated_at             timestamptz not null default now()
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  channel_key     text not null references channels(key),
  direction       msg_direction not null,
  handled_by      actor_kind not null default 'human', -- who authored the outbound / handled the inbound
  subject         text,
  body            text not null default '',
  summary         text,                                -- AI one-line summary (timeline view)
  duration_sec    int,                                 -- calls
  delivery_status text,                                -- provider status: sent/delivered/read/failed
  external_id     text,                                -- provider message id (idempotency)
  meta            jsonb not null default '{}',
  embedding       vector(1536),
  sent_at         timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- Units/programs the AI offered inside a conversation.
create table conversation_catalog_items (
  tenant_id       uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  catalog_item_id uuid not null references catalog_items(id) on delete cascade,
  offered_at      timestamptz not null default now(),
  primary key (conversation_id, catalog_item_id)
);

-- Consent ledger (DPDP Act / WhatsApp Business opt-in), append-only: one row
-- per grant/revoke event with evidence. Current state = latest row per
-- (contact, channel). Campaign sends and AI outbound filter on this.
create table contact_consents (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  contact_id          uuid not null references contacts(id) on delete cascade,
  channel_key         text not null references channels(key),
  kind                text not null check (kind in ('granted', 'revoked')),
  source              text not null,                    -- 'inbound_message' / 'web_form' / 'agent_confirmed' / 'opt_out_keyword'
  evidence_message_id uuid references messages(id),
  note                text,
  occurred_at         timestamptz not null default now()
);

-- ============================================================================
-- §8 · Contact intelligence (profile, scores, evidence, matches, enrichment)
-- ============================================================================

-- The crystallized profile: one row per captured fact, versioned (superseded_at)
-- with provenance — which message, which quote, how confident. The demo's
-- "budget evolution" chart = the history of the budget field. Current values
-- are mirrored into contacts.attributes for cheap reads.
create table contact_field_values (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  contact_id        uuid not null references contacts(id) on delete cascade,
  field_id          uuid not null references field_definitions(id),
  value             jsonb not null,
  confidence        numeric(4,3),                      -- 0–1 (AI extraction confidence)
  captured_by       actor_kind not null default 'human',
  source_message_id uuid references messages(id),
  source_quote      text,
  superseded_at     timestamptz,
  superseded_by     uuid references contact_field_values(id),
  created_at        timestamptz not null default now()
);
create unique index contact_field_values_current
  on contact_field_values (contact_id, field_id) where superseded_at is null;

-- Live signal values (0–100) per contact + optional per-contact weight override
-- (the Buyer-360 weight sliders re-tune one buyer without touching the model).
create table contact_signal_values (
  tenant_id       uuid not null references tenants(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  signal_id       uuid not null references signal_definitions(id) on delete cascade,
  value           numeric(5,2) not null default 0 check (value between 0 and 100),
  weight_override numeric(5,2),
  updated_at      timestamptz not null default now(),
  primary key (contact_id, signal_id)
);

-- Append-only score history (sparkline, prev-score delta, re-rank animations).
create table contact_scores (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  contact_id  uuid not null references contacts(id) on delete cascade,
  model_id    uuid not null references scoring_models(id),
  score       numeric(5,2) not null,
  cause       text,                                    -- 'message.received' / 'weights.changed' / …
  computed_at timestamptz not null default now()
);

-- Explainability: the cited reasons behind a score ("mentioned pre-approved
-- loan" + the exact quote + the message it came from).
create table score_evidence (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  contact_id        uuid not null references contacts(id) on delete cascade,
  signal_id         uuid references signal_definitions(id),
  polarity          text not null check (polarity in ('positive', 'negative')),
  weight            numeric(5,2) not null default 1,
  reason            text not null,
  source_message_id uuid references messages(id),
  source_quote      text,
  superseded_at     timestamptz,
  created_at        timestamptz not null default now()
);

-- Ranked contact ↔ catalog matches (worklist "matched units", match-for-buyer).
create table contact_catalog_matches (
  tenant_id       uuid not null references tenants(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  catalog_item_id uuid not null references catalog_items(id) on delete cascade,
  score           numeric(5,2) not null default 0,
  reasons         jsonb not null default '[]',
  computed_at     timestamptz not null default now(),
  primary key (contact_id, catalog_item_id)
);

-- Sourced external intel (LinkedIn / company / news) shown on Buyer 360.
create table enrichment_records (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  provider   text not null,
  kind       text not null,          -- 'linkedin' / 'company' / 'news' / 'web'
  title      text,
  url        text,
  payload    jsonb not null default '{}',
  fetched_at timestamptz not null default now()
);

-- Config-driven checks: loan eligibility, scholarship eligibility, …
create table assessments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  contact_id  uuid not null references contacts(id) on delete cascade,
  type_id     uuid not null references assessment_types(id),
  inputs      jsonb not null default '{}',
  outputs     jsonb not null default '{}',
  verdict     text,                                    -- 'eligible' / '₹1.28 Cr @ 8.6%' / …
  status      text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  assessed_at timestamptz not null default now()
);

-- Dedupe pipeline: detected pairs await a human nod (Approvals), then merge.
create table duplicate_candidates (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references tenants(id) on delete cascade,
  primary_contact_id       uuid not null references contacts(id) on delete cascade,
  duplicate_contact_id     uuid not null references contacts(id) on delete cascade,
  confidence               numeric(4,3) not null,
  evidence                 jsonb not null default '{}', -- {"same_phone":true,"name_similarity":0.92,…}
  status                   text not null default 'pending'
                           check (status in ('pending', 'merged', 'dismissed')),
  resolved_by_membership_id uuid references memberships(id),
  resolved_at              timestamptz,
  created_at               timestamptz not null default now(),
  check (primary_contact_id <> duplicate_contact_id)
);

-- ============================================================================
-- §9 · Deals & money
-- ============================================================================

create table deals (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  contact_id          uuid not null references contacts(id),
  title               text,
  pipeline_id         uuid not null references pipelines(id),
  stage_id            uuid not null references pipeline_stages(id),
  stage_entered_at    timestamptz not null default now(),
  catalog_item_id     uuid references catalog_items(id),   -- the selected unit/program
  value               numeric(14,2),
  currency            char(3),
  owner_membership_id uuid references memberships(id),
  expected_close_at   date,
  won_at              timestamptz,
  lost_at             timestamptz,
  lost_reason_id      uuid references lost_reasons(id),
  lost_note           text,
  stalled             boolean not null default false,
  attributes          jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

-- One audit trail for contact-lifecycle AND deal-stage moves; carries the
-- mandatory remark and whether the AI suggested it. Feeds velocity analytics.
create table stage_events (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references tenants(id) on delete cascade,
  contact_id             uuid references contacts(id) on delete cascade,
  deal_id                uuid references deals(id) on delete cascade,
  from_stage_id          uuid references pipeline_stages(id),
  to_stage_id            uuid not null references pipeline_stages(id),
  note                   text,                        -- the required remark
  moved_by               actor_kind not null default 'human',
  moved_by_membership_id uuid references memberships(id),
  suggested_by_ai        boolean not null default false,
  occurred_at            timestamptz not null default now(),
  check (num_nonnulls(contact_id, deal_id) = 1)
);

-- Token / installment tracking ("Booking Amount Paid" is a payment row).
create table payments (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  deal_id    uuid not null references deals(id) on delete cascade,
  kind       text not null check (kind in ('token', 'installment', 'final', 'refund')),
  amount     numeric(14,2) not null,
  currency   char(3),
  method     text,
  reference  text,
  paid_at    timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table invoices (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  deal_id     uuid not null references deals(id) on delete cascade,
  number      text not null,
  status      invoice_status not null default 'draft',
  amount      numeric(14,2) not null,
  currency    char(3),
  line_items  jsonb not null default '[]',
  issued_at   timestamptz,
  due_at      timestamptz,
  paid_at     timestamptz,
  pdf_url     text,
  created_by_membership_id uuid references memberships(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, number)
);

-- ============================================================================
-- §10 · Scheduling & field operations (site visits, cabs → generic resources)
-- ============================================================================

-- First-class appointments (the demo's buyer.siteVisitDue / deal.noShow live
-- here). appointment type is config; no-show feeds re-engagement automations.
create table appointments (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references tenants(id) on delete cascade,
  contact_id             uuid not null references contacts(id) on delete cascade,
  deal_id                uuid references deals(id),
  type_id                uuid not null references appointment_types(id),
  catalog_item_id        uuid references catalog_items(id),  -- the project/site being visited
  assigned_membership_id uuid references memberships(id),
  scheduled_at           timestamptz not null,
  duration_min           int,
  status                 appointment_status not null default 'scheduled',
  location               text,
  notes                  text,
  created_by             actor_kind not null default 'human', -- 'ai' = concierge-booked
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Drivers, counsellors-for-hire, … people who operate resources but aren't users.
create table resource_operators (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  name       text not null,
  phone      text,
  rating     numeric(2,1),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- The fleet: cabs, rooms, demo kits. current_status values come from the
-- resource type's configured status_flow (validated in the app layer).
create table resources (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  type_id        uuid not null references resource_types(id),
  name           text not null,                       -- 'Maruti Ertiga'
  code           text,                                -- 'TS 09 EA 4321'
  capacity       int,
  operator_id    uuid references resource_operators(id),
  current_status text not null default 'idle',
  attributes     jsonb not null default '{}',
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- A resource serving an appointment (the cab run). status walks the configured
-- flow; each transition emits a domain event → ETA / arrival alerts.
create table resource_bookings (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  resource_id    uuid not null references resources(id),
  appointment_id uuid references appointments(id),
  contact_id     uuid not null references contacts(id),
  origin         text,                                -- pickup point
  destination    text,
  scheduled_at   timestamptz not null,
  status         text not null,                       -- from resource_types.status_flow
  eta_minutes    int,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================================
-- §11 · Tasks & the activity feed
-- ============================================================================

create table tasks (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references tenants(id) on delete cascade,
  contact_id             uuid references contacts(id) on delete cascade,
  deal_id                uuid references deals(id) on delete cascade,
  assignee_membership_id uuid references memberships(id),
  title                  text not null,
  description            text,
  due_at                 timestamptz,
  priority               task_priority not null default 'medium',
  status                 task_status not null default 'open',
  origin_kind            text not null default 'manual',  -- 'manual'/'meeting'/'ai'/'automation'/'playbook'
  origin_id              uuid,                            -- id in the origin table (no FK: polymorphic)
  completed_at           timestamptz,
  created_by             actor_kind not null default 'human',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- The live "what the AI is doing" stream + per-record timelines. Presentation-
-- level; the systemic source of truth is domain_events (§15).
create table activities (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  kind                text not null,                   -- 'enquiry'/'call'/'whatsapp'/'site_visit'/'booking'/'score'/'lead'/…
  actor               actor_kind not null default 'ai',
  actor_membership_id uuid references memberships(id),
  contact_id          uuid references contacts(id) on delete cascade,
  deal_id             uuid references deals(id) on delete cascade,
  body                text not null,
  meta                jsonb not null default '{}',
  occurred_at         timestamptz not null default now()
);

-- ============================================================================
-- §12 · Meetings, transcripts, action items
-- ============================================================================

create table meetings (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references tenants(id) on delete cascade,
  contact_id              uuid references contacts(id),
  deal_id                 uuid references deals(id),
  appointment_id          uuid references appointments(id),
  organizer_membership_id uuid references memberships(id),
  kind                    meeting_kind not null default 'in_person',
  title                   text not null,
  scheduled_at            timestamptz,
  duration_min            int,
  recording_url           text,
  summary                 text,                        -- AI summary
  moments                 jsonb not null default '[]', -- key moments [{"t":"12:40","label":…}]
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- One transcript per call-message OR meeting (also backs the Live Call
-- Copilot: segments stream in while status='processing').
create table transcripts (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  message_id uuid unique references messages(id) on delete cascade,
  meeting_id uuid unique references meetings(id) on delete cascade,
  status     text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  language   text,
  engine     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(message_id, meeting_id) = 1)
);

create table transcript_segments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  transcript_id uuid not null references transcripts(id) on delete cascade,
  seq           int not null,
  speaker_role  text not null check (speaker_role in ('agent', 'contact', 'ai')),
  speaker_name  text,
  offset_sec    numeric(8,2),
  body          text not null,
  unique (transcript_id, seq)
);

-- Extracted action items; "Add to Tasks" promotes one into a real task.
create table meeting_action_items (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  meeting_id         uuid not null references meetings(id) on delete cascade,
  description        text not null,
  owner_hint         text,
  due_hint           text,
  suggested_priority task_priority not null default 'medium',
  task_id            uuid references tasks(id),
  created_at         timestamptz not null default now()
);

-- ============================================================================
-- §13 · Approvals — every AI action awaiting a human nod, one queue
-- ============================================================================
-- Kinds (extensible registry, not an enum): 'outbound', 'new_lead', 'sequence',
-- 'stage_move', 'field_update', 'duplicate', … Inline suggestions (the pipeline
-- card "move to Booking?") are approvals surfaced in place.

create table approvals (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references tenants(id) on delete cascade,
  kind                     text not null,
  status                   approval_status not null default 'pending',
  title                    text not null,
  rationale                text,                       -- why the AI proposes this
  draft_body               text,                       -- the drafted message / extracted detail
  proposed_action          jsonb not null default '{}',-- executable payload: {"action":"send_message",…}
  confidence               smallint check (confidence between 0 and 100),
  autonomy_level           smallint,                   -- the L-level this was drafted under
  cta_label                text,                       -- 'Approve & send'
  contact_id               uuid references contacts(id) on delete cascade,
  deal_id                  uuid references deals(id) on delete cascade,
  conversation_id          uuid references conversations(id),
  duplicate_candidate_id   uuid references duplicate_candidates(id),
  assigned_membership_id   uuid references memberships(id),  -- whose nod is needed
  requested_by             actor_kind not null default 'ai',
  decided_by_membership_id uuid references memberships(id),
  decided_at               timestamptz,
  expires_at               timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ============================================================================
-- §14 · Outreach (broadcast campaigns)
-- ============================================================================

create table campaigns (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references tenants(id) on delete cascade,
  name                     text not null,
  channel_key              text not null references channels(key),
  template_body            text not null,              -- '{Name}', '{Config}' … merge tags = field keys
  segment_filter           jsonb not null default '{}',-- declarative contact filter
  status                   campaign_status not null default 'draft',
  scheduled_at             timestamptz,
  sent_at                  timestamptz,
  created_by_membership_id uuid references memberships(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table campaign_recipients (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  contact_id    uuid not null references contacts(id) on delete cascade,
  rendered_body text,
  status        recipient_status not null default 'queued',
  message_id    uuid references messages(id),          -- the actual sent message
  error         text,
  updated_at    timestamptz not null default now(),
  unique (campaign_id, contact_id)
);

-- ============================================================================
-- §15 · Domain events & automations (the "self-driving" backbone)
-- ============================================================================

-- Transactional outbox: everything that happens emits an event; consumers are
-- the scoring engine, automations, realtime pushers, and the activity feed.
-- bigint identity → cheap, strictly ordered per insert.
create table domain_events (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references tenants(id) on delete cascade,
  event_key    text not null,       -- 'message.received' / 'contact.created' / 'stage.changed'
                                    -- / 'appointment.no_show' / 'resource.status_changed' / …
  subject_kind text,                -- 'contact' / 'deal' / 'appointment' / …
  subject_id   uuid,
  payload      jsonb not null default '{}',
  occurred_at  timestamptz not null default now(),
  processed_at timestamptz
);

-- NL-authored workflows. nl_source keeps the plain-English sentence the tenant
-- typed; trigger/conditions/actions are the structured compilation of it.
create table automations (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references tenants(id) on delete cascade,
  name                     text not null,
  nl_source                text,
  trigger_event            text not null,              -- key into the event registry
  trigger_filters          jsonb not null default '{}',
  conditions               jsonb not null default '[]',
  actions                  jsonb not null default '[]',-- ordered [{"kind":"send_message","channel":"whatsapp",…}]
  active                   boolean not null default true,
  run_count                int not null default 0,
  last_run_at              timestamptz,
  created_by_membership_id uuid references memberships(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table automation_runs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  automation_id uuid not null references automations(id) on delete cascade,
  event_id      bigint references domain_events(id),
  status        text not null default 'ok'
                check (status in ('ok', 'partial', 'failed', 'awaiting_approval')),
  log           jsonb not null default '[]',
  approval_id   uuid references approvals(id),         -- when an action needed a nod
  fired_at      timestamptz not null default now()
);

-- ============================================================================
-- §16 · Knowledge base (grounding for AI answers)
-- ============================================================================

create table kb_articles (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  category_id          uuid not null references kb_categories(id),
  title                text not null,
  summary              text not null default '',       -- the one-line answer
  body                 text not null default '',
  tags                 text[] not null default '{}',
  status               kb_status not null default 'draft',
  used_by_ai           boolean not null default true,  -- may be quoted in autonomous replies
  author_membership_id uuid references memberships(id),
  view_count           int not null default 0,
  embedding            vector(1536),                   -- RAG retrieval
  search               tsvector generated always as
                       (to_tsvector('simple', coalesce(title,'') || ' ' ||
                         coalesce(summary,'') || ' ' || coalesce(body,''))) stored,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

-- ============================================================================
-- §17 · AI infrastructure (tracing, briefs, internal copilot)
-- ============================================================================

-- Every model call, traced and costed (the AI-gateway ledger). grounding
-- records what the answer cited (kb articles, messages) — no fabricated facts.
create table ai_runs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  kind          text not null,      -- 'qualify'/'score'/'draft_reply'/'summarize'/'extract_fields'
                                    -- /'generate_workflow'/'copilot'/'brief'/'match'/'live_hint'/…
  model         text,
  provider      text,
  subject_kind  text,
  subject_id    uuid,
  input_tokens  int,
  output_tokens int,
  cost_usd      numeric(10,6),
  latency_ms    int,
  trace_id      text,
  grounding     jsonb not null default '[]',
  status        run_status not null default 'ok',
  error         text,
  created_at    timestamptz not null default now()
);

-- Auditor AI / Guardian output: one row per analyzed interaction (call or
-- meeting). Captures quality scores (talk-ratio, objection handling), policy
-- compliance verdicts (citing policy_rules keys), which pitch angle was used
-- and how it ended — the raw material for "Investor-first won 8/11 similar,
-- +26% faster close" script auto-optimization (derived by joining outcomes
-- to deals; no separate stats table needed).
create table interaction_analyses (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  contact_id   uuid not null references contacts(id) on delete cascade,
  message_id   uuid unique references messages(id) on delete cascade,   -- the call
  meeting_id   uuid unique references meetings(id) on delete cascade,
  kind         text not null default 'call_audit',
  scores       jsonb not null default '{}',   -- {"overall":92,"talk_ratio":38,"objection_handling":"strong"}
  policy_flags jsonb not null default '[]',   -- Guardian verdicts: [{"rule":"all-in-pricing","version":1,"result":"pass"}]
  summary      text,
  playbook_id  uuid references playbooks(id),
  approach_key text,                          -- pitch angle used: 'investor-first' / …
  outcome      text,                          -- 'next_step_locked' / 'objection_pending' / 'no_answer' / …
  visibility   text not null default 'agent_and_manager'
               check (visibility in ('agent_and_manager', 'manager_only', 'tenant')),
  created_at   timestamptz not null default now(),
  check (num_nonnulls(message_id, meeting_id) = 1)
);

-- Generated narratives: the Morning Brief (overnight window) and the weekly
-- executive brief on Analytics. stats holds the counted facts, narrative the prose.
create table ai_briefs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  kind         text not null,                          -- 'morning' / 'weekly_exec'
  period_start timestamptz not null,
  period_end   timestamptz not null,
  stats        jsonb not null default '{}',
  narrative    text,
  created_at   timestamptz not null default now(),
  unique (tenant_id, kind, period_start)
);

-- The internal Agent Copilot (⌘L) — persisted so answers/actions are auditable.
create table assistant_threads (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  membership_id uuid not null references memberships(id),
  title         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table assistant_messages (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  thread_id  uuid not null references assistant_threads(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant', 'tool')),
  content    text not null,
  actions    jsonb not null default '[]',              -- records the copilot created/changed
  created_at timestamptz not null default now()
);

-- ============================================================================
-- §18 · Files, audit & imports
-- ============================================================================

-- Every stored file (call/meeting recordings, invoice PDFs, brochures sent in
-- chat, uploaded spreadsheets) is a row pointing at object storage — nothing
-- dangles as a bare URL. Polymorphic owner (no FK) — indexed lookup.
create table attachments (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references tenants(id) on delete cascade,
  owner_kind               text not null,      -- 'message' / 'meeting' / 'invoice' / 'kb_article' / 'import_job' / …
  owner_id                 uuid not null,
  filename                 text not null,
  mime_type                text,
  bytes                    bigint,
  storage_key              text not null,      -- object-storage path (S3/GCS)
  uploaded_by              actor_kind not null default 'human',
  uploaded_by_membership_id uuid references memberships(id),
  created_at               timestamptz not null default now()
);

-- Append-only audit trail: every mutation that matters, traced to the actual
-- authenticated Firebase session. Immutability is enforced by trigger below.
-- tenant_id is nullable: platform-level actions (tenant created, template
-- edited) audit with tenant_id = null — invisible to tenant RLS sessions,
-- visible to the platform role.
create table audit_log (
  id                  bigint generated always as identity primary key,
  tenant_id           uuid references tenants(id) on delete set null,
  actor_kind          actor_kind not null default 'human',
  actor_user_id       uuid references users(id),
  actor_membership_id uuid references memberships(id),
  firebase_uid        text,                    -- from the verified ID token (forensics)
  action              text not null,           -- 'create' / 'update' / 'delete' / 'approve' / 'merge' / 'config_change' / …
  entity_kind         text not null,
  entity_id           uuid,
  before              jsonb,
  after               jsonb,
  auth_context        jsonb not null default '{}',  -- {"ip":…,"user_agent":…,"token_iat":…}
  occurred_at         timestamptz not null default now()
);

create function forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;

create trigger trg_audit_log_immutable
  before update or delete on audit_log
  for each row execute function forbid_mutation();

-- Audit trail for bulk loads (the inventory Excel upload).
create table import_jobs (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references tenants(id) on delete cascade,
  kind                     text not null,              -- 'catalog_items' / 'contacts' / …
  filename                 text,
  status                   text not null default 'completed'
                           check (status in ('processing', 'completed', 'failed')),
  stats                    jsonb not null default '{}',-- {"added":142,"projects_created":3,"skipped":6}
  created_by_membership_id uuid references memberships(id),
  created_at               timestamptz not null default now()
);

-- (No custom-object escape hatch: even the oddest module — cab logistics —
-- fit the generic core. Add one the day a real vertical proves the need.)

-- ============================================================================
-- §19 · Indexes (hot paths from the front-end)
-- ============================================================================

-- Worklist: rank my/tenant contacts by score; SLA overdue scans
create index contacts_worklist        on contacts (tenant_id, score desc) where deleted_at is null;
create index contacts_owner_worklist  on contacts (tenant_id, owner_membership_id, score desc) where deleted_at is null;
create index contacts_follow_up       on contacts (tenant_id, next_follow_up_at) where deleted_at is null;
create index contacts_stage           on contacts (tenant_id, stage_id);
create index contacts_review_pending  on contacts (tenant_id, created_at desc) where review_status = 'pending';
create index contacts_attrs_gin       on contacts using gin (attributes);
create index contacts_search_gin      on contacts using gin (search);
create index contacts_name_trgm       on contacts using gin (display_name gin_trgm_ops);
create index contacts_phone_trgm      on contacts using gin (phone gin_trgm_ops);

-- Timelines & inboxes
create index messages_by_conversation on messages (conversation_id, sent_at);
create index messages_by_contact      on messages (contact_id, sent_at);
create index conversations_inbox      on conversations (tenant_id, state, last_message_at desc);

-- Profile / scoring reads
create index cfv_by_contact           on contact_field_values (contact_id) where superseded_at is null;
create index scores_by_contact        on contact_scores (contact_id, computed_at desc);
create index evidence_by_contact      on score_evidence (contact_id) where superseded_at is null;

-- Pipeline & analytics
create index deals_by_stage           on deals (tenant_id, stage_id) where deleted_at is null;
create index deals_by_owner           on deals (tenant_id, owner_membership_id) where deleted_at is null;
create index stage_events_by_deal     on stage_events (deal_id, occurred_at);
create index stage_events_by_contact  on stage_events (contact_id, occurred_at);

-- Work queues
create index tasks_queue              on tasks (tenant_id, assignee_membership_id, status, due_at);
create index approvals_pending        on approvals (tenant_id, created_at desc) where status = 'pending';
create index appointments_upcoming    on appointments (tenant_id, scheduled_at) where status in ('scheduled', 'confirmed');
create index activities_feed          on activities (tenant_id, occurred_at desc);

-- Event backbone
create index events_unprocessed       on domain_events (tenant_id, id) where processed_at is null;
create index events_by_key            on domain_events (tenant_id, event_key, occurred_at desc);

-- Production layer: consent, audit, files, analyses
create index consents_current         on contact_consents (contact_id, channel_key, occurred_at desc);
create index audit_by_entity          on audit_log (entity_kind, entity_id, occurred_at desc);
create index audit_by_tenant          on audit_log (tenant_id, occurred_at desc);
create index attachments_by_owner     on attachments (owner_kind, owner_id);
create index analyses_by_contact      on interaction_analyses (contact_id, created_at desc);
create index analyses_by_approach     on interaction_analyses (tenant_id, approach_key, outcome);

-- Catalog & knowledge
create index catalog_by_type          on catalog_items (tenant_id, type_id, availability) where deleted_at is null;
create index catalog_by_parent        on catalog_items (parent_id);
create index catalog_attrs_gin        on catalog_items using gin (attributes);
create index catalog_search_gin       on catalog_items using gin (search);
create index kb_search_gin            on kb_articles using gin (search);

-- Semantic (pgvector ≥ 0.5; tune lists/m per corpus size)
create index catalog_embedding_hnsw   on catalog_items using hnsw (embedding vector_cosine_ops);
create index contacts_embedding_hnsw  on contacts using hnsw (embedding vector_cosine_ops);
create index kb_embedding_hnsw        on kb_articles using hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- §20 · updated_at maintenance
-- ============================================================================

create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $auto$
declare r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'updated_at'
      and t.table_type = 'BASE TABLE'
  loop
    execute format(
      'create trigger trg_%s_updated_at before update on %I for each row execute function set_updated_at()',
      r.table_name, r.table_name);
  end loop;
end $auto$;

-- ============================================================================
-- §21 · Row-level security — tenant isolation on every tenant-owned table
-- ============================================================================
-- Two-role connection pattern (the auth bootstrap can't read RLS-locked
-- tables before the tenant is known):
--   · relos_auth — narrow SELECT on users/memberships/roles/tenants, exempt
--     from RLS (BYPASSRLS or granted before policies). Used ONLY to resolve
--     a verified Firebase token → user → membership → tenant_id + role.
--   · relos_app  — all tenant work; RLS-bound. Per transaction:
--       set local app.tenant_id = '<tenant uuid>';
-- Policies use nullif(...) so an unset OR empty GUC denies instead of erroring.
-- Role-based data scoping (agent = own book, manager = tenant) is enforced in
-- the query layer via roles.data_scope; RLS guarantees the tenant boundary.

do $rls$
declare r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'tenant_id'
      and t.table_type = 'BASE TABLE'
  loop
    execute format('alter table %I enable row level security', r.table_name);
    execute format(
      'create policy tenant_isolation on %I '
      || 'using (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) '
      || 'with check (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      r.table_name);
  end loop;
end $rls$;

-- The tenants table has no tenant_id column (its id IS the tenant), so the
-- loop skips it — without this, a tenant session could list other customers.
alter table tenants enable row level security;
create policy tenant_self on tenants
  using (id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ============================================================================
-- §22 · Example analytics views (refreshed on a schedule / after events)
-- ============================================================================

-- Funnel: deals per stage (the Analytics funnel + Pipeline headers)
create materialized view mv_pipeline_funnel as
select d.tenant_id, d.pipeline_id, s.key as stage_key, s.label as stage_label,
       s.sort_order, count(*) as deal_count, coalesce(sum(d.value), 0) as pipeline_value
from deals d
join pipeline_stages s on s.id = d.stage_id
where d.deleted_at is null
group by d.tenant_id, d.pipeline_id, s.key, s.label, s.sort_order;

-- Source ROI: enquiries vs. won deals per lead source
create materialized view mv_source_performance as
with won as (
  select distinct contact_id from deals where won_at is not null and deleted_at is null
)
select c.tenant_id, c.source_id,
       count(*) as enquiries,
       count(w.contact_id) as bookings,
       round(100.0 * count(w.contact_id) / greatest(count(*), 1), 1) as conversion_pct
from contacts c
left join won w on w.contact_id = c.id
where c.deleted_at is null
group by c.tenant_id, c.source_id;

-- Stage velocity: average dwell time per stage (pipeline-velocity analytics)
create materialized view mv_stage_velocity as
select e.tenant_id, e.to_stage_id as stage_id,
       count(*) as entries,
       avg(next.occurred_at - e.occurred_at) as avg_dwell
from stage_events e
join lateral (
  select occurred_at from stage_events n
  where n.deal_id = e.deal_id and n.occurred_at > e.occurred_at
  order by n.occurred_at limit 1
) next on true
where e.deal_id is not null
group by e.tenant_id, e.to_stage_id;

-- Unique indexes so the views can be refreshed CONCURRENTLY (no read locks)
create unique index mv_funnel_key   on mv_pipeline_funnel (tenant_id, pipeline_id, stage_key);
create unique index mv_source_key   on mv_source_performance (tenant_id, source_id);
create unique index mv_velocity_key on mv_stage_velocity (tenant_id, stage_id);
