# RelationOS — Real-Estate Edition (Front-End Demo)

A **chat-first, self-driving CRM for an Indian real-estate company.** The AI captures
and qualifies every lead 24×7, ranks who to call, drafts the next action, and runs the
routine work — while humans stay in the loop for the important moves.

This is a **front-end experience demo with mocked data** — the interface is
production-shaped; only the data/engine is simulated. Every data call sits behind one
`DataSource` seam + a Zustand store, so the real API drops in later without a screen rewrite.

Demo tenant: **Aurum Realty** (Hyderabad). Multi-tenant under the hood (every record carries
a `clientId`), currently running single-client.

## Run it

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
```

You land on the **landing page → sign in** (`/login`). Pick a demo account
(Manager / Agent / Telecaller) — what you can see and do is scoped to that role.

## Roles & access (RBAC, enforced 3 ways)

| Role | Does | Sees |
|---|---|---|
| **Manager** | Oversight, pipeline monitoring | Everything for the client + **Team**, **Analytics**, **Settings** |
| **Sales Agent** | Lead movement, closing | **Only their own** buyers/deals; Pipeline, Inventory, Concierge, Copilot |
| **Telecaller** | Lead handling, cab booking | Worklist, Leads, Concierge, **Logistics** only |

1. **Nav gating** — the sidebar shows only the items a role may use.
2. **Data scoping** — agents see their own book; manager/telecaller see client-level (`lib/roles.ts`).
3. **Route guard** — deep-linking a forbidden URL bounces to `/home` (`lib/access.ts` + `components/route-guard.tsx`).

## The modules

**Daily driver**
- **Home** (`/home`) — a per-role dashboard: Manager *command center*, Agent *"my day"*, Telecaller *their day*.
- **Worklist** (`/worklist`) — buyers ranked by AI **intent score**; filter by agent / source / date-range / config; SLA follow-up time + overdue flag.
- **Leads** (`/leads`) — leads the AI captured **overnight** + a morning brief + "needs your nod."
- **Tasks** (`/tasks`) — predictive next-actions; meeting action-items land here as real tasks.

**Customer & conversations**
- **Concierge** (`/concierge`) — the AI handling **WhatsApp** chats (qualify / quote / book a visit); take over in one tap. Agent-scoped.
- **Buyer 360** (`/buyers/[id]`) — one page per buyer: unified cross-channel timeline, AI summaries, intent score (with cited sources), **enrichment** (LinkedIn/company/news), **loan eligibility**, milestone tracker, recommended **playbook**, drafted next message.
- **Meetings** (`/meetings`) — recordings auto-**transcribed + summarized**; **action items become Tasks**.

**Deal & operations**
- **Pipeline** (`/pipeline`) — the full journey **New Enquiry → Handover**; drag to move (mandatory remark), **Interest** filter (Hot/Warm/Cold…), **custom stages**, **invoice** on booked deals, AI stage-move suggestions.
- **Inventory** (`/inventory`) — projects/units, config filter, **match-for-buyer**.
- **Logistics** (`/logistics`) — cab tracking for site visits: manage fleet/drivers, book a cab, movement board (Pickup→En route→At site→Drop-off), **auto ETA/arrival alerts**.

**Outreach & automation**
- **Broadcast** (`/broadcast`) — bulk **WhatsApp** campaigns with personalization (`{Name}`, `{Config}`, `{Offer}`) + live preview + history.
- **Automations** (`/settings/automations`) — describe a workflow in **plain English** → Trigger → Conditions → Actions; active workflows **fire** into the Activity feed + Approvals.

**Oversight & intelligence**
- **Approvals** (`/approvals`) — AI-drafted actions awaiting a human nod (Audit-AI governance).
- **Team** (`/team`) — Manager monitors each agent and their contracts.
- **Analytics** (`/analytics`) — weekly exec brief, funnel, win/loss, pipeline velocity, lost-reason root-cause, source ROI, agent leaderboard, **revenue leakage**, **risk & opportunity radar**.
- **Settings** — **Sources** (connectors) · **Autonomy** (L0–L4 dial for how far the AI acts alone).

**Always-there helpers**
- **⌘K** — talk to the CRM (search / commit a record in plain language).
- **⌘L** — **Agent Copilot**: ask about *your* book ("what's my pipeline worth?", "why are we losing deals?", "show my hot buyers") or act ("add a buyer", "book a visit") — answers from scoped data, actions actually persist.
- **Activity feed** — live stream of what the AI is doing (captures, moves, automation runs, cab alerts).
- **⌘J** — the **Conductor**: fire scripted "live" events (a buyer replies, a missed call) and watch the worklist re-rank itself.

## Stack

Next.js 16 (App Router, TS) · Tailwind CSS v4 · Framer Motion · Zustand · cmdk ·
Sonner · lucide-react · @faker-js/faker. Dark mode default; deterministic seed (`SEED_NOW`).

## Architecture — the swap seam

```
lib/
  data/
    types.ts      domain model (Buyer, Deal, Project/Unit, Cab, Workflow, CrmTask, OrgUser, …)
    seed.ts       deterministic faker-seeded dataset, per-client (id-prefixed, cross-referenced)
    scoring.ts    weighted-average intent-score math (shared by seed + deep-dive)
    source.ts     DataSource interface  ← the one file the real API re-implements
  store.ts        Zustand store — live demo state + every action
  roles.ts        identity + role-scoped selectors (agent → own, manager → client)
  access.ts       route-level RBAC policy (single source of truth)
  workflows.ts    NL-workflow generator (pure, keyword-based)
  conductor.ts    Demo Conductor — scripted "live" beats
  theme.tsx       no-flash theme provider
components/        app shell, command palette, agent copilot, auth gate, route guard, primitives
app/
  page.tsx                landing · login/ · onboarding/
  (workspace)/            the routed screens (gated by AuthGate + RouteGuard)
```

All screens read through `mockDataSource` / the Zustand store. Auth + saved workflows persist
to `localStorage`; everything else is in-memory and re-seeds on reload.

## Honest framing

The interface is the real product's front end — only the engine is simulated:
- the AI uses **keyword matching**, not a live LLM;
- data is **seeded**; "overnight" / "last night" framing is illustrative;
- messages, invoices and cab alerts post to the **in-app Activity feed + toasts**, not real WhatsApp/Twilio/SMTP.

The heavy backend — vector "business memory," live channel integrations, real scoring — is the next build.
We demo the experience; the intelligence engine drops in behind the same seam.

---

## Demo script (≈3 min)

1. **Sign in as Manager** (`rohan@aurum.in`) → land on the **command center**: pipeline value, team, approvals.
2. **Worklist** → "call these today," ranked by score. Toggle **Overdue**, filter by **agent**.
3. Open a buyer → **Buyer 360**: one timeline, AI summary, **loan eligibility**, **enrichment**, **playbook**.
4. **Pipeline** → drag a card to a new stage → a **remark is required**; on a booked deal, **Generate invoice**.
5. **Press ⌘L** → ask *"why are we losing deals?"* and *"add a buyer: Priya, 2BHK Narsingi, ₹85L"* → watch the worklist grow.
6. **Automations** → type *"welcome new leads on WhatsApp"* → **Generate** → **Save** → it runs (check the **Activity feed** + **Approvals**).
7. **Meetings** → "Add to Tasks" → see them on the **Tasks** page.
8. **Analytics** → weekly brief, win/loss, **revenue leakage**, **risk & opportunity radar**.
9. **Switch persona to an Agent** (top-bar avatar) → everything narrows to **their own** book; Team/Analytics/Settings vanish. Try typing `/analytics` → you're **bounced to Home**.
10. **Switch to the Telecaller** → just Worklist / Leads / Concierge / **Logistics**: book a cab, advance it, watch the **ETA/arrival alerts**.
