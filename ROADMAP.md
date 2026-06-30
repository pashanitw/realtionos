# AI-Native CRM — 4-Week Build Roadmap

**What we're building.** A configurable, AI-native CRM platform that captures leads across every channel, qualifies and scores them automatically, and drives them to close — with a human always in the loop. The platform is **domain-agnostic**: entities, pipeline stages, scoring signals, channels, and copy are **configuration, not code**. This pilot is configured for **real-estate sales**, but the same engine runs any vertical CRM.

**The plan.** 4 people · 4 weeks · a live pilot at the end of Week 4. The product's front-end is already built; these four weeks add the real backend, AI, integrations, data layer, and hardening for launch.

---

## 1. Team

| | Role | Focus |
|---|---|---|
| 2 × | **AI Engineers** | AI gateway, conversational agents, scoring & matching, copilot, analytics intelligence, evaluations |
| 2 × | **Full-stack Engineers** | Backend & data platform, channel integrations, app wiring, security, deployment |

---

## 2. Technology approach (high level)

**AI models — closed (proprietary) LLMs behind a model-agnostic gateway.** We standardise on best-in-class **hosted, closed frontier models**, accessed through a gateway that routes each task to the right model tier and lets us **swap providers without code changes**. Every AI call is traced, cost-capped, and guardrailed (answers are grounded to real data — no fabricated facts or prices).

| Model tier | Used for |
|---|---|
| **High-volume tier** (fast, low-cost closed LLM) | Conversational qualifying, classification, extraction, scoring |
| **Reasoning tier** (frontier closed LLM) | Executive brief, root-cause analysis, natural-language → workflow & analytics |
| **Embeddings** (closed model) + vector store | Matching, de-duplication, semantic search, retrieval |
| **Speech** (closed STT/TTS) | Voice calls and meeting transcription |

**Platform (managed cloud).** Web app, API services, a relational database + vector store, cache, a background-job/queue layer for autonomy & automations, realtime updates, object storage, authentication with role-based access, and full observability.

**Channels (pluggable connectors).** WhatsApp · SMS · Email · Voice · Web/portal lead sources — each a configurable connector, monitored for health.

---

## 3. Timeline (4 weeks)

### 3a. Database design & validation track

The data layer is **designed and validated in Week 1**, then evolves additively as features land — no internal schema detail here, just the phases and their done-criteria.

| Phase | When | Outcome | Validated when |
|---|---|---|---|
| **Model design** | Week 1 · Days 1–2 | Entity-relationship model — a generic CRM core plus the real-estate configuration | Model reviewed & signed off |
| **Build** | Week 1 · Days 2–4 | Schema, migrations, and seed data | Live on the staging environment |
| **Validate** | Week 1 · Day 5 | Integrity & constraints, access-scoping by role, sample-data load, backup/restore | All data + access checks pass ✅ |
| **Evolve** | Weeks 2–4 | Additive, zero-downtime migrations as new features need them | Each change reviewed & reversible |

---

## 4. Week-by-week feature plan

*Every feature is listed under the week it ships. Sequence is dependency-driven — nothing reasons over data that isn't captured yet, and nothing aggregates before the data exists.* ★ = headline feature · ◇ = stretch (cut first if behind).

### Week 1 — Foundations & data
> **Outcome:** the app runs on real data; the data model is designed & validated.

- Platform & delivery — cloud scaffold (web app, API services), CI/CD, environments, deployment
- Authentication + **role-based access** (Manager · Sales Agent · Telecaller) + tenant scoping
- **Database: design → build → validate** — see §3a
- **AI gateway** — closed LLMs behind a model-agnostic router, with tracing, cost caps, grounding guardrails; evaluation harness
- ★ **Lead scoring engine + explainability** (across the configured signal categories) + adjustable signal weights
- ★ **Inventory/catalog matching** (embeddings + vector store)
- Realtime-updates layer
- Wire core screens to **live data, no mock data** — role-based **home dashboards**, worklist, pipeline, inventory/catalog

### Week 2 — Capture & the AI agent
> **Outcome:** the AI handles conversations end-to-end, on its own.

- **Omni-channel capture** — WhatsApp, Email, SMS, Web/portal lead sources (Voice/IVR ◇)
- ★ **Conversational qualifying agent** — multilingual; qualifies, scores, matches the right offering, and books the next step
- ★ **AI Inbox (live)** — omni-channel threads, status funnel, metrics, **real-time capture sidebar**
- **Human-in-the-loop takeover** of any conversation
- ★ **Natural-language command bar** — speak/type a sentence → structured record; plus global search & navigate
- **De-duplication + merge**
- **Enrichment / sourced intel** + eligibility checks
- **Live scoring from message signals** — re-score + re-rank on every new message
- **Overnight auto-capture + Morning Brief**

### Week 3 — Agent workflow
> **Outcome:** the full daily workflow works with AI assist.

- **Visual pipeline** — configurable stages, drag-and-drop, required remarks, stage automations, quote/invoice draft
- **AI next-step suggestions** (accept the recommended move)
- **Inventory/catalog management** — live availability (configurable entities)
- **AI-ranked worklist** — "why ranked", SLA/overdue, re-ranks live
- ★ **Unified customer 360** — one timeline across every channel; send-from-profile; explainable score view
- ★ **Agent copilot** — grounded in the rep's own book; answers *and* acts (create, book, search, root-cause)
- **AI-drafted next-best messages** (per stage)
- **Approvals (human-in-the-loop)** — all approval types (outbound, new-lead, sequence, stage-move, field-update, duplicate-merge)
- **Meetings** — transcription + sentiment + summary → tasks
- **Task management**
- **Team performance management** (for managers)
- Logistics / fulfilment movement ◇

### Week 4 — Intelligence, automation & launch
> **Outcome:** intelligence, automation, hardening, and go-live.

- ★ **Analytics suite** — full dashboards (funnel, velocity, win/loss, source ROI, leaderboard, capture mix, score-validation, automation health, revenue leakage)
- ★ **Executive brief** — auto-generated, week-over-week
- **Natural-language analytics queries** (guarded)
- **Lost-reason analysis** + **risk & opportunity signals**
- **AI sales playbook** (what wins deals)
- ★ **No-code automations** — natural-language → workflow, with run history
- **Broadcast** — audience segments + scheduling, human-approved
- **Source onboarding wizard** + connector health monitoring
- Usage & billing + **audit trail**
- **Hardening** — security, rate limits, PII handling, load test
- **AI evaluations & quality** — grounding (no fabricated facts)
- **UAT → production launch → monitoring + runbook**

---

## 5. Configurable for any CRM — not just real estate

The platform is vertical-agnostic. Standing up a new domain is **configuration, not a rebuild** — the same AI engine, data core, channels, and workflow serve any business. What changes per domain:

| Configuration | Real-estate example | Generic |
|---|---|---|
| Entities & fields | Buyers, projects, units | Contacts, products, accounts |
| Pipeline stages | Enquiry → site visit → booking → registration | Any defined sales/service stages |
| Scoring signals & weights | Budget fit, locality, visit intent, loan readiness | Any intent/fit signals |
| Channels & sources | Property portals + WhatsApp | Any lead sources & channels |
| Copy, prompts & playbooks | Real-estate tone & rules | Domain tone & rules |
| Roles | Manager / Sales Agent / Telecaller | Any role hierarchy |

Real estate is simply the launch configuration; the same product serves sales, services, education, healthcare, and more.
