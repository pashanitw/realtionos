# RelationOS™ — Front-End Design & Demo

The screen layer for a self-driving, omni-channel, explainable CRM. This is a
**front-end experience demo with mocked data** — the interface is
production-shaped; only the data source is simulated. Every data call sits
behind one `DataSource` seam, so the real RelationOS API drops in later without
a screen rewrite.

Built per the *RelationOS Front-End Design & Demo Plan* (`docs/`).

## Run it

```bash
npm run dev      # http://localhost:3000  (opens on the Worklist)
npm run build    # production build
npm run start    # serve the production build
```

## The demo in 30 seconds

- **⌘K** — talk to the CRM: type a sentence and watch it crystallize into a
  structured record (`writing… → saved · postgres · verified`), or search/navigate.
- **⌘J** — the **Demo Conductor**: fire scripted "live" events (an incoming
  call logs, summarizes, re-scores a lead, and the worklist re-ranks itself).
- Open a lead → the **Conversation Canvas**: one timeline across every channel.
  Hover any score reason or extracted field → its exact source line highlights.
- **Autonomy** (`/settings/autonomy`): drag the dial L0→L4 and watch the
  review-queue badge shrink as more actions go silent.
- **Lead score deep-dive** (`/scoring/[id]`): retune a category weight → the
  score recomputes instantly and the signal radar reshapes.

## Stack

Next.js 16 (App Router, TS) · Tailwind CSS v4 · Framer Motion · Zustand ·
cmdk · Sonner · lucide-react · @faker-js/faker. Type system Bricolage Grotesque
(display) / Hanken Grotesk (body) / JetBrains Mono (data). Dark mode default.

## Architecture — the swap seam

```
lib/
  data/
    types.ts      domain model (Lead, Message, Deal, ReviewItem, …)
    seed.ts       deterministic faker-seeded dataset (cross-referenced provenance)
    scoring.ts    weighted-average score math (shared by seed + deep-dive)
    source.ts     DataSource interface  ← the one file the real API re-implements
  store.ts        Zustand store (live demo state + actions)
  conductor.ts    Demo Conductor — scripted "live" beats
  theme.tsx       no-flash theme provider
components/        app shell, command palette, conductor dock, shared primitives
app/(workspace)/  the 9 routed screens; app/onboarding is the full-screen first run
```

All screens read through `mockDataSource` / the Zustand store. Replace the
`DataSource` implementation with REST/LiteLLM calls and the screens are untouched.

> Honest framing: the "live" events are scripted and the scores are seeded —
> there's no model or database behind it yet. We demo the experience; the
> intelligence engine is the next build.
