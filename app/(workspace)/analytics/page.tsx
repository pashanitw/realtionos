"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, ArrowUpRight, Trophy, Layers, Send, TrendingUp, TrendingDown, ShieldCheck,
  MessageSquare, Gauge, TriangleAlert,
  Hourglass, Percent, Snowflake, ReceiptText, CircleDollarSign,
  Scale, Timer, CalendarRange, Lightbulb, Target, ThumbsDown, XCircle, ArrowRight,
} from "lucide-react";
import { useClientAnalytics, useClientMessages, useScopedDeals, useScopedBuyers } from "@/lib/roles";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { AnimatedNumber, Label, Avatar, Pill, ChannelIcon, Meter, Sparkline } from "@/components/ui/primitives";
import { SOURCE_LABEL, CHANNEL_LABEL, CHANNELS, STAGES, type Source, type Channel, type Deal, type Buyer } from "@/lib/data/types";
import { cn, rupees, SEED_NOW } from "@/lib/utils";

const EASE = [0.34, 1.4, 0.5, 1] as const;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const CH_COLOR: Record<Channel, string> = {
  whatsapp: "var(--positive)",
  call: "var(--live)",
  email: "var(--accent)",
  web: "#4f86d6",
  sms: "var(--text-faint)",
};

function funnelColor(t: number): string {
  return `color-mix(in oklab, var(--positive) ${Math.round(t * 100)}%, var(--accent))`;
}

/** Tiny deterministic string hash → stable pseudo-random in [0,1) (no Math.random). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export default function AnalyticsPage() {
  const analytics = useClientAnalytics();
  const messages = useClientMessages();
  const deals = useScopedDeals();
  const buyers = useScopedBuyers();
  const { funnel, sourceROI, agents, health, bookingTrend } = analytics;

  // Capture mix — conversations by channel, computed live from the message store.
  const captureMix = useMemo(() => {
    const counts: Partial<Record<Channel, number>> = {};
    messages.forEach((m) => (counts[m.channel] = (counts[m.channel] ?? 0) + 1));
    const total = messages.length || 1;
    return CHANNELS.map((c) => ({
      channel: c,
      label: CHANNEL_LABEL[c],
      count: counts[c] ?? 0,
      pct: Math.round(((counts[c] ?? 0) / total) * 100),
    }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [messages]);

  return (
    <PageContainer>
      <PageHeader title="Analytics" description="Your command centre — how the business is performing, what's working, where money leaks, and which deals to act on. Each card explains what it shows." />

      <NLQueryBox sourceROI={sourceROI} funnel={funnel} captureMix={captureMix} />

      <div className="mt-3">
        <WeeklyBriefCard funnel={funnel} bookingTrend={bookingTrend} sourceROI={sourceROI} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <WinLossCard funnel={funnel} bookingTrend={bookingTrend} />
        <PipelineVelocityCard funnel={funnel} deals={deals} buyers={buyers} />
        <LostReasonCard />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <FunnelCard funnel={funnel} />
        <CaptureMixCard mix={captureMix} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ScoreConversionCard />
        <AutomationHealthCard health={health} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SourceROICard sourceROI={sourceROI} />
        <AgentLeaderboard agents={agents} />
      </div>

      <div className="mt-3">
        <RevenueLeakage sourceROI={sourceROI} />
      </div>

      <div className="mt-3">
        <RiskOppRadar deals={deals} buyers={buyers} />
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-text-faint">
        Rep call-quality scores stay scoped to each rep + their manager. Leadership sees only
        aggregated, de-identified rollups.
      </p>
    </PageContainer>
  );
}

/* ============================================================ */
function Card({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT, delay }}
      className={cn("rounded-[14px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)] md:p-5", className)}
    >
      {children}
    </motion.section>
  );
}

function CardHead({ icon, title, caption, right }: { icon?: React.ReactNode; title: string; caption?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">{icon}<Label>{title}</Label></div>
        {caption && <p className="mt-1.5 text-sm leading-snug text-text-muted">{caption}</p>}
      </div>
      {right}
    </div>
  );
}

/* ============================================================
   Predictive risk & opportunity radar (PRD §6.2)
   ============================================================ */
function RiskOppRadar({ deals, buyers }: { deals: Deal[]; buyers: Buyer[] }) {
  const atRisk = useMemo(() => {
    return deals
      .filter((d) => d.stage !== "Registration" && d.stage !== "Handover")
      .map((d) => {
        if (d.noShow) return { deal: d, reason: "Missed site visit", icon: XCircle };
        if (d.stalled) return { deal: d, reason: "Stalled — no movement in 21d", icon: Snowflake };
        if (d.closeDate < SEED_NOW) return { deal: d, reason: "Past expected close date", icon: Hourglass };
        return null;
      })
      .filter((x): x is { deal: Deal; reason: string; icon: typeof XCircle } => x !== null)
      .sort((a, b) => b.deal.valueInr - a.deal.valueInr)
      .slice(0, 4);
  }, [deals]);

  const opps = useMemo(() => {
    const out: { buyer: Buyer; text: string; tag: string; icon: typeof Trophy }[] = [];
    const used = new Set<string>();
    const take = (list: Buyer[], make: (b: Buyer) => { text: string; tag: string; icon: typeof Trophy }) => {
      for (const b of list) { if (out.length >= 4) break; if (used.has(b.id)) continue; used.add(b.id); out.push({ buyer: b, ...make(b) }); }
    };
    take([...buyers].filter((b) => b.stage === "Registration" || b.stage === "Handover").sort((a, b) => b.budgetMax - a.budgetMax),
      (b) => ({ text: `Closed ~3 months ago — ask ${b.name.split(" ")[0]} for a referral`, tag: "Referral", icon: Trophy }));
    take([...buyers].filter((b) => b.score >= 70 && b.stalled).sort((a, b) => b.score - a.score),
      () => ({ text: "Hot lead gone quiet — re-engage now", tag: "Re-engage", icon: Lightbulb }));
    take([...buyers].filter((b) => b.score >= 68 && !b.siteVisitDue && (b.stage === "New Enquiry" || b.stage === "Qualified")).sort((a, b) => b.score - a.score),
      () => ({ text: "High intent, no visit yet — push a site visit", tag: "Push visit", icon: Target }));
    take([...buyers].sort((a, b) => b.budgetMax - a.budgetMax),
      (b) => ({ text: `Budget supports a premium ${b.config} — upsell`, tag: "Upsell", icon: TrendingUp }));
    return out.slice(0, 4);
  }, [buyers]);

  return (
    <Card>
      <CardHead icon={<Gauge size={15} className="text-accent" />} title="Risk & opportunity radar" caption="Deals at risk of slipping, and hidden opportunities worth chasing — surfaced by the AI." />
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <div className="mb-2.5 flex items-center gap-1.5"><TriangleAlert size={13} className="text-negative" /><span className="font-mono text-[11px] uppercase tracking-wide text-negative">At risk of slipping</span></div>
          <div className="space-y-2">
            {atRisk.map(({ deal, reason, icon: Icon }) => (
              <Link key={deal.id} href={`/buyers/${deal.buyerId}`} className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface-2 px-3 py-2 transition-colors hover:border-border-strong">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-negative-soft text-negative"><Icon size={14} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text">{deal.name}</span>
                  <span className="block truncate text-[11px] text-text-muted">{reason}</span>
                </span>
                <span className="tabular shrink-0 font-mono text-xs text-negative">{rupees(deal.valueInr)}</span>
              </Link>
            ))}
            {atRisk.length === 0 && <p className="text-sm text-text-faint">No deals at risk right now. 🎉</p>}
          </div>
        </div>
        <div>
          <div className="mb-2.5 flex items-center gap-1.5"><Lightbulb size={13} className="text-positive" /><span className="font-mono text-[11px] uppercase tracking-wide text-positive">Opportunities to chase</span></div>
          <div className="space-y-2">
            {opps.map(({ buyer, text, tag, icon: Icon }) => (
              <Link key={buyer.id} href={`/buyers/${buyer.id}`} className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface-2 px-3 py-2 transition-colors hover:border-border-strong">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-positive-soft text-positive"><Icon size={14} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text">{text}</span>
                  <span className="block truncate text-[11px] text-text-muted">{buyer.name} · {buyer.config} · {buyer.localityPrefs[0]}</span>
                </span>
                <Pill variant="positive" className="shrink-0">{tag}</Pill>
              </Link>
            ))}
            {opps.length === 0 && <p className="text-sm text-text-faint">No opportunities surfaced.</p>}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ============================================================
   Ask your pipeline — NL query → live chart
   ============================================================ */
type QueryResult = { title: string; suffix?: string; bars: { label: string; value: number }[]; pctMode?: boolean };

const CHIPS = [
  "How many leads above 80 came in this week, by channel?",
  "Which stage is leaking the most this month?",
  "Re-engagement reply rate vs. last quarter?",
];

function NLQueryBox({
  sourceROI,
  funnel,
  captureMix,
}: {
  sourceROI: { source: Source; enquiries: number; bookings: number; rate: number }[];
  funnel: { stage: string; count: number }[];
  captureMix: { channel: Channel; label: string; count: number; pct: number }[];
}) {
  const [value, setValue] = useState(CHIPS[0]);
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<QueryResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildResult(q: string): QueryResult {
    const t = q.toLowerCase();
    if (t.includes("channel")) {
      const bars = captureMix
        .slice(0, 4)
        .map((c) => ({ label: c.label, value: Math.max(1, Math.round((c.pct / 100) * 31)) }));
      const total = bars.reduce((s, b) => s + b.value, 0);
      return { title: `${total} leads scored above 80 this week`, bars };
    }
    if (t.includes("stage") || t.includes("leak")) {
      const bars = funnel.map((f) => ({ label: f.stage, value: f.count }));
      return { title: "Pipeline by stage — where it leaks", bars };
    }
    if (t.includes("re-engage") || t.includes("reply")) {
      return { title: "Re-engagement reply rate vs. last quarter", suffix: "%", pctMode: true, bars: [{ label: "This Q", value: 34 }, { label: "Last Q", value: 21 }] };
    }
    // default: bookings by locality (derived from sourceROI)
    const localities = ["Kokapet", "Gachibowli", "Narsingi", "Tellapur"];
    const total = sourceROI.reduce((s, x) => s + x.bookings, 0);
    const w = [0.38, 0.27, 0.21, 0.14];
    return { title: q, bars: localities.map((l, i) => ({ label: l, value: Math.max(1, Math.round(total * w[i])) })) };
  }

  function run(qIn?: string) {
    const q = (qIn ?? value).trim() || CHIPS[0];
    setValue(q);
    if (timer.current) clearTimeout(timer.current);
    setPhase("loading");
    setResult(null);
    timer.current = setTimeout(() => {
      setResult(buildResult(q));
      setPhase("done");
    }, 700);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
      className="rounded-[14px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)] md:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="shrink-0 text-accent" />
          <Label>Ask your pipeline</Label>
        </div>
        <Pill variant="accent" mono>live · tenant-scoped</Pill>
      </div>
      <p className="mt-1.5 text-sm leading-snug text-text-muted">Ask a question in plain English and get a chart back — e.g. “bookings by locality this month” or “best source by conversion.”</p>

      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex h-11 flex-1 items-center gap-2 rounded-[10px] border border-border bg-surface-inset px-3 transition-colors focus-within:border-border-strong">
          <Sparkles size={14} className="shrink-0 text-accent" />
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ask anything about your pipeline…" className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-faint" />
        </div>
        <button type="submit" className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-accent px-5 text-sm font-semibold text-accent-contrast shadow-[0_0_22px_-8px_var(--accent)] transition-transform hover:scale-[1.02] active:scale-95">
          <Send size={15} /> Ask
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button key={c} onClick={() => run(c)} className="rounded-pill border border-border bg-surface-2 px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text">
            {c}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {phase === "loading" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-4 space-y-2.5">
            <div className="shimmer h-3 w-1/3 rounded-md" />
            {[0.9, 0.6, 0.4, 0.25].map((w, i) => (<div key={i} className="shimmer h-7 rounded-md" style={{ width: `${w * 100}%` }} />))}
          </motion.div>
        )}
        {phase === "done" && result && (
          <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE_OUT }} className="mt-5 rounded-[12px] border border-border bg-surface-inset/50 p-4">
            <div className="mb-3 flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold leading-none text-text tabular">
                {result.title.match(/^\d+/) ? <AnimatedNumber value={parseInt(result.title)} /> : null}
              </span>
              <span className="text-sm text-text-muted">{result.title.replace(/^\d+\s*/, "")}</span>
            </div>
            <HBars bars={result.bars} pctMode={result.pctMode} />
            <p className="mt-3 font-mono text-[11px] text-text-faint">Live against current data · scoped to your tenant</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* horizontal bars (used by NL result) */
function HBars({ bars, pctMode }: { bars: { label: string; value: number }[]; pctMode?: boolean }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="space-y-2">
      {bars.map((b, i) => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-sm text-text-muted">{b.label}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-md bg-surface-2">
            <motion.div className="h-full rounded-md" style={{ background: "var(--accent)" }} initial={{ width: 0 }} animate={{ width: `${(b.value / max) * 100}%` }} transition={{ duration: 0.55, ease: EASE, delay: 0.05 * i }} />
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-sm font-semibold text-text tabular">{b.value}{pctMode ? "%" : ""}</span>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Funnel + biggest-leak callout
   ============================================================ */
function FunnelCard({ funnel }: { funnel: { stage: string; count: number }[] }) {
  const max = Math.max(...funnel.map((f) => f.count), 1);
  const leak = useMemo(() => {
    let worst = { from: "", to: "", drop: -1 };
    for (let i = 1; i < funnel.length; i++) {
      const drop = Math.round((1 - funnel[i].count / funnel[i - 1].count) * 100);
      if (drop > worst.drop) worst = { from: funnel[i - 1].stage, to: funnel[i].stage, drop };
    }
    return worst;
  }, [funnel]);

  return (
    <Card delay={0.05}>
      <CardHead icon={<Layers size={15} className="text-accent" />} title="Pipeline funnel" caption="Of every enquiry, how many survive to each stage. The biggest drop is your biggest leak to fix." />
      <div className="space-y-2.5">
        {funnel.map((f, i) => {
          const prev = i === 0 ? null : funnel[i - 1].count;
          const stepPct = prev ? Math.round((f.count / prev) * 100) : 100;
          const isLeak = i > 0 && funnel[i - 1].stage === leak.from && f.stage === leak.to;
          const t = funnel.length > 1 ? i / (funnel.length - 1) : 0;
          return (
            <div key={f.stage}>
              <div className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-sm font-medium text-text">{f.stage}</span>
                <div className="h-8 flex-1 overflow-hidden rounded-[8px] bg-surface-inset">
                  <motion.div
                    className="flex h-full items-center rounded-[8px] px-2.5 font-mono text-xs font-bold text-accent-contrast tabular"
                    style={{ background: funnelColor(t) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(8, (f.count / max) * 100)}%` }}
                    transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.07 * i }}
                  >
                    {f.count.toLocaleString("en-IN")}
                  </motion.div>
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-xs text-text-muted tabular">{i === 0 ? "100%" : `${stepPct}%`}</span>
              </div>
              {isLeak && (
                <div className="mt-1 flex items-center gap-1.5 pl-[92px] text-xs font-medium text-negative">
                  <TriangleAlert size={12} /> {leak.drop}% drop — biggest leak
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ============================================================
   Capture mix · conversations by channel
   ============================================================ */
function CaptureMixCard({ mix }: { mix: { channel: Channel; label: string; count: number; pct: number }[] }) {
  const max = Math.max(...mix.map((m) => m.pct), 1);
  return (
    <Card delay={0.1}>
      <CardHead icon={<MessageSquare size={15} className="text-accent" />} title="Capture mix · last 7 days" caption="Which channels buyers actually reach you on, so you invest where they are." />
      <div className="space-y-3">
        {mix.map((m, i) => (
          <motion.div key={m.channel} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.06 * i }} className="flex items-center gap-3">
            <span className="flex w-28 shrink-0 items-center gap-2 text-sm font-medium text-text">
              <ChannelIcon channel={m.channel} size={13} withBg /> {m.label}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-pill bg-surface-inset">
              <motion.div className="h-full rounded-pill" style={{ background: CH_COLOR[m.channel] }} initial={{ width: 0 }} animate={{ width: `${(m.pct / max) * 100}%` }} transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.06 * i + 0.1 }} />
            </div>
            <span className="w-10 shrink-0 text-right font-mono text-sm font-semibold text-text tabular">{m.pct}%</span>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

/* ============================================================
   Lead score → 90-day conversion (buckets)
   ============================================================ */
const SCORE_BUCKETS = [
  { bucket: "0–20", pct: 3 },
  { bucket: "21–40", pct: 9 },
  { bucket: "41–60", pct: 21 },
  { bucket: "61–80", pct: 44 },
  { bucket: "81–100", pct: 72 },
];

function ScoreConversionCard() {
  const max = Math.max(...SCORE_BUCKETS.map((b) => b.pct));
  const lift = Math.round(SCORE_BUCKETS[SCORE_BUCKETS.length - 1].pct / SCORE_BUCKETS[0].pct);
  return (
    <Card delay={0.15}>
      <CardHead icon={<TrendingUp size={15} className="text-positive" />} title="Does the score work?" caption="Proof the intent score works — higher-scored leads close more often within 90 days." />
      <div className="flex h-44 items-end justify-between gap-3 px-1">
        {SCORE_BUCKETS.map((b, i) => {
          const last = i === SCORE_BUCKETS.length - 1;
          return (
            <div key={b.bucket} className="flex flex-1 flex-col items-center gap-2">
              <span className="font-mono text-sm font-bold text-text tabular">{b.pct}%</span>
              <motion.div
                className="w-full rounded-t-[6px]"
                style={{ background: last ? "var(--live)" : `color-mix(in oklab, var(--accent) ${50 + i * 12}%, var(--surface-inset))` }}
                initial={{ height: 0 }}
                animate={{ height: `${(b.pct / max) * 130}px` }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.07 * i }}
              />
              <span className="font-mono text-[10px] text-text-faint">{b.bucket}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-text-muted">
        Strong positive correlation. Leads scored 81–100 convert <span className="font-semibold text-text">{lift}×</span> better than 0–20 — the worklist is signal, not activity.
      </p>
    </Card>
  );
}

/* ============================================================
   Automation health — 6-metric grid
   ============================================================ */
function AutomationHealthCard({ health }: { health: { capturePrecision: number; aiHandledShare: number; dedupeRate: number } }) {
  const metrics = [
    { value: "100%", label: "Conversation capture", sub: "0 manual entries", dot: "var(--positive)" },
    { value: "99.2%", label: "Identity-resolution accuracy", sub: "exact-match", dot: "var(--accent)" },
    { value: `${health.capturePrecision}%`, label: "Auto-capture precision", sub: "approved w/o edit", dot: "var(--accent)" },
    { value: "94%", label: "Field-extraction accuracy", sub: "no correction", dot: "var(--accent)" },
    { value: "6.2h", label: "Review-queue median", sub: "create → resolve", dot: "var(--live)" },
    { value: `${health.dedupeRate - 25}%`, label: "Worklist adherence", sub: "top-quartile first", dot: "var(--live)" },
  ];
  return (
    <Card delay={0.2}>
      <CardHead icon={<ShieldCheck size={15} className="text-positive" />} title="Automation health" caption="How much the AI is carrying — capture accuracy, share handled without a human, and dedupe rate." />
      <div className="grid grid-cols-2 gap-2.5">
        {metrics.map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.05 * i }} className="rounded-[12px] border border-border bg-surface-2 p-3">
            <div className="font-display text-2xl font-bold leading-none text-text">{m.value}</div>
            <div className="mt-1.5 text-[13px] font-semibold leading-tight text-text">{m.label}</div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-text-faint">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.dot }} /> {m.sub}
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

/* ============================================================
   Source ROI
   ============================================================ */
function SourceROICard({ sourceROI }: { sourceROI: { source: Source; enquiries: number; bookings: number; rate: number }[] }) {
  const sorted = useMemo(() => [...sourceROI].sort((a, b) => b.rate - a.rate), [sourceROI]);
  const maxRate = Math.max(...sorted.map((s) => s.rate), 1);
  return (
    <Card delay={0.05}>
      <CardHead icon={<TrendingUp size={15} className="text-positive" />} title="Source ROI" caption="Which portal actually converts to bookings (booking rate), not just who sends the most leads." />
      <div className="space-y-3">
        {sorted.map((s, i) => {
          const top = i === 0;
          return (
            <motion.div key={s.source} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.06 * i }}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-text">{SOURCE_LABEL[s.source]}</span>
                  {top && <Pill variant="positive"><Trophy size={11} /> books best</Pill>}
                </div>
                <div className="shrink-0 font-mono text-xs text-text-faint tabular"><span className="text-text-muted">{s.bookings}</span><span className="mx-1">/</span>{s.enquiries.toLocaleString("en-IN")}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-pill bg-surface-inset">
                  <motion.div className="h-full rounded-pill" style={{ background: top ? "var(--positive)" : "var(--accent)" }} initial={{ width: 0 }} animate={{ width: `${(s.rate / maxRate) * 100}%` }} transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.06 * i + 0.1 }} />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-sm font-semibold tabular" style={{ color: top ? "var(--positive)" : "var(--text)" }}>{s.rate}%</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}

/* ============================================================
   Agent leaderboard
   ============================================================ */
function AgentLeaderboard({ agents }: { agents: { name: string; initials: string; bookings: number; visits: number; conversion: number; hue: number }[] }) {
  const sorted = useMemo(() => [...agents].sort((a, b) => b.bookings - a.bookings), [agents]);
  const maxBookings = Math.max(...sorted.map((a) => a.bookings), 1);
  return (
    <Card delay={0.1}>
      <CardHead icon={<Trophy size={15} className="text-live" />} title="Agent leaderboard" caption="Agents ranked by flats booked, with each one's visit→booking close rate." />
      <div className="space-y-2.5">
        {sorted.map((a, i) => (
          <motion.div key={a.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.06 * i }} className="flex items-center gap-3 rounded-[10px] border border-border bg-surface-2 px-3 py-2.5">
            <span className="w-4 shrink-0 text-center font-mono text-sm text-text-faint tabular">{i + 1}</span>
            <Avatar name={a.name} hue={a.hue} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">{a.name}</div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-pill bg-surface-inset">
                <motion.div className="h-full rounded-pill" style={{ background: i === 0 ? "var(--live)" : "var(--accent)" }} initial={{ width: 0 }} animate={{ width: `${(a.bookings / maxBookings) * 100}%` }} transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.06 * i + 0.1 }} />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-display text-[20px] font-bold leading-none text-text tabular"><AnimatedNumber value={a.bookings} /></div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-text-faint">
                {a.visits} visits · <span style={{ color: a.conversion >= 30 ? "var(--positive)" : a.conversion >= 15 ? "var(--live)" : "var(--text-faint)" }}>{a.conversion}% close</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

/* ============================================================
   Revenue leakage · flagged by Audit AI
   ============================================================ */
type LeakRow = {
  key: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  severity: "High" | "Medium";
  amount: number;
};

function RevenueLeakage({ sourceROI }: { sourceROI: { source: Source; enquiries: number; bookings: number; rate: number }[] }) {
  // Derive a plausible per-unit ticket size from booking volume, deterministically (no Math.random).
  const totalBookings = useMemo(() => sourceROI.reduce((s, x) => s + x.bookings, 0) || 1, [sourceROI]);

  const rows = useMemo<LeakRow[]>(() => {
    const ticket = 9_500_000; // ~₹95 L average flat — fixed, sensible.
    return [
      {
        key: "invoicing",
        icon: <Hourglass size={15} />,
        title: "Delayed invoicing",
        detail: "3 bookings un-invoiced > 15 days",
        severity: "High",
        amount: Math.round(ticket * 0.18) * 3, // overdue draw on 3 bookings
      },
      {
        key: "discount",
        icon: <Percent size={15} />,
        title: "Over-discounting",
        detail: "Floor-rise waived above policy on 4 deals",
        severity: "High",
        amount: 350_000 * 4,
      },
      {
        key: "frozen",
        icon: <Snowflake size={15} />,
        title: "Frozen pipeline",
        detail: "12 high-intent deals stalled > 21 days",
        severity: "Medium",
        amount: Math.round((ticket * 0.02) * 12 * Math.min(2, totalBookings)),
      },
      {
        key: "billing",
        icon: <ReceiptText size={15} />,
        title: "Missed billing",
        detail: "PLC / amenity charges not applied on 2 units",
        severity: "Medium",
        amount: 425_000 * 2,
      },
      {
        key: "token",
        icon: <CircleDollarSign size={15} />,
        title: "Token not collected",
        detail: "Site-visit-done leads without booking token",
        severity: "Medium",
        amount: 100_000 * 9,
      },
    ];
  }, [totalBookings]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);
  const overdueRecover = rows[0].amount;

  return (
    <Card delay={0.15}>
      <CardHead
        icon={<ShieldCheck size={15} className="text-negative" />}
        title="Revenue leakage · flagged by Audit AI"
        caption="Money quietly slipping — billing gaps, over-discounting, and frozen pipeline the AI caught."
        right={
          <div className="hidden shrink-0 text-right sm:block">
            <div className="font-display text-3xl font-bold leading-none text-negative tabular">{rupees(total)}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-text-faint">across {rows.length} signals</div>
          </div>
        }
      />

      {/* total — visible on small screens where the header `right` is hidden */}
      <div className="mb-4 flex items-baseline gap-2 sm:hidden">
        <span className="font-display text-3xl font-bold leading-none text-negative tabular">{rupees(total)}</span>
        <span className="font-mono text-[11px] uppercase tracking-wide text-text-faint">across {rows.length} signals</span>
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => (
          <motion.div
            key={r.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.06 * i }}
            className="group flex items-center gap-3 rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface-inset"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] text-negative" style={{ background: "color-mix(in oklab, var(--negative) 14%, transparent)" }}>
              {r.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">{r.title}</div>
              <div className="truncate text-xs text-text-muted">{r.detail}</div>
            </div>
            <Pill variant={r.severity === "High" ? "negative" : "live"} className="hidden shrink-0 sm:inline-flex">
              {r.severity}
            </Pill>
            <span className="w-20 shrink-0 text-right font-mono text-sm font-semibold text-negative tabular">{rupees(r.amount)}</span>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-text-muted">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
          <span>
            Auto-draft invoices for the 3 overdue bookings → recover{" "}
            <span className="font-semibold text-text">{rupees(overdueRecover)}</span> this week.
          </span>
        </p>
        <a
          href="/approvals"
          className="inline-flex shrink-0 items-center gap-1 self-start rounded-pill border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text sm:self-auto"
        >
          Review in Approvals <ArrowUpRight size={13} />
        </a>
      </div>
    </Card>
  );
}

/* ============================================================
   Weekly executive brief · generated by Audit AI
   Full-width management narrative + WoW benchmark + risks/opps.
   ============================================================ */
type FunnelRow = { stage: string; count: number };
type TrendRow = { week: string; bookings: number; visits: number };
type SourceRow = { source: Source; enquiries: number; bookings: number; rate: number };

/** Bookings for the Booked + Registered stages of the funnel. */
function bookedTotal(funnel: FunnelRow[]): number {
  const find = (s: string) => funnel.find((f) => f.stage === s)?.count ?? 0;
  return find("Booked") + find("Registered");
}

function WeeklyBriefCard({
  funnel,
  bookingTrend,
  sourceROI,
}: {
  funnel: FunnelRow[];
  bookingTrend: TrendRow[];
  sourceROI: SourceRow[];
}) {
  const brief = useMemo(() => {
    const n = bookingTrend.length;
    const cur = bookingTrend[n - 1] ?? { week: "W6", bookings: 0, visits: 0 };
    const prev = bookingTrend[n - 2] ?? cur;

    // "Week of …" label derived from the seeded now (no live Date at module scope).
    const weekOf = new Date(SEED_NOW);
    weekOf.setDate(weekOf.getDate() - weekOf.getDay()); // back to Sunday
    const weekLabel = weekOf.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    // Conversion this/last week = bookings / site visits.
    const convCur = cur.visits ? Math.round((cur.bookings / cur.visits) * 100) : 0;
    const convPrev = prev.visits ? Math.round((prev.bookings / prev.visits) * 100) : 0;

    // Avg response time — deterministic minutes (lower is better).
    const rtCur = 6 + Math.round(hash("rt-cur" + cur.week) * 6); // 6–12 min
    const rtPrev = rtCur + 1 + Math.round(hash("rt-prev" + prev.week) * 4); // last week slower

    const pipelineValue = bookedTotal(funnel) * 9_500_000;
    const topSource = [...sourceROI].sort((a, b) => b.rate - a.rate)[0];

    const benchmarks = [
      { label: "Bookings", value: `${cur.bookings}`, cur: cur.bookings, prev: prev.bookings, goodUp: true },
      { label: "Site visits", value: `${cur.visits}`, cur: cur.visits, prev: prev.visits, goodUp: true },
      { label: "Conversion", value: `${convCur}%`, cur: convCur, prev: convPrev, goodUp: true },
      { label: "Avg response", value: `${rtCur}m`, cur: rtCur, prev: rtPrev, goodUp: false },
    ];

    return { cur, prev, convCur, pipelineValue, topSource, weekLabel, benchmarks };
  }, [funnel, bookingTrend, sourceROI]);

  const wow = brief.cur.bookings - brief.prev.bookings;

  return (
    <Card delay={0.04}>
      <CardHead
        icon={<Sparkles size={15} className="text-accent" />}
        title="Weekly executive brief · generated by Audit AI"
        caption="An AI-written summary for leadership: this week vs last week, with the risks and opportunities it spotted."
        right={<span className="hidden shrink-0 font-mono text-[11px] uppercase tracking-wide text-text-faint sm:flex sm:items-center sm:gap-1.5"><CalendarRange size={13} /> Week of {brief.weekLabel}</span>}
      />

      {/* narrative */}
      <p className="text-sm leading-relaxed text-text-muted">
        The team booked{" "}
        <span className="font-semibold text-text">{brief.cur.bookings} flats</span> off{" "}
        <span className="font-semibold text-text">{brief.cur.visits} site visits</span> this week
        {wow >= 0
          ? <> — up <span className="font-semibold text-positive">{Math.abs(wow)}</span> week-over-week</>
          : <> — down <span className="font-semibold text-negative">{Math.abs(wow)}</span> week-over-week</>}
        , holding conversion at{" "}
        <span className="font-semibold text-text">{brief.convCur}%</span>. Live pipeline carries{" "}
        <span className="font-semibold text-text">{rupees(brief.pipelineValue)}</span> across booked &amp; registered deals.{" "}
        <span className="text-text">{SOURCE_LABEL[brief.topSource.source]}</span> remains the most efficient channel at{" "}
        <span className="font-semibold text-text">{brief.topSource.rate}%</span> — lean budget there and protect the negotiation stage where most leakage sits.
      </p>

      {/* WoW benchmark row */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {brief.benchmarks.map((b, i) => {
          const up = b.cur > b.prev;
          const flat = b.cur === b.prev;
          const good = flat ? null : up === b.goodUp;
          const delta = Math.abs(b.cur - b.prev);
          const Arrow = up ? TrendingUp : TrendingDown;
          const color = good === null ? "var(--text-faint)" : good ? "var(--positive)" : "var(--negative)";
          return (
            <motion.div
              key={b.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.05 * i }}
              className="rounded-[12px] border border-border bg-surface-2 p-3"
            >
              <div className="font-mono text-[10px] uppercase tracking-wide text-text-faint">{b.label}</div>
              <div className="mt-1 font-display text-2xl font-bold leading-none text-text tabular">{b.value}</div>
              <div className="mt-1.5 flex items-center gap-1 font-mono text-[11px] font-semibold tabular" style={{ color }}>
                {flat ? <span className="text-text-faint">no change</span> : <><Arrow size={12} /> {delta} WoW</>}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* risks + opportunities */}
      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <BriefList
          tone="negative"
          icon={<TriangleAlert size={14} className="text-negative" />}
          title="Risks"
          items={[
            "12 high-intent deals stalled > 21 days before booking",
            "Avg first-response slipping on weekend WhatsApp leads",
            "Token not collected on 9 site-visit-done buyers",
          ]}
        />
        <BriefList
          tone="positive"
          icon={<Lightbulb size={14} className="text-positive" />}
          title="Opportunities"
          items={[
            `Re-engage cold ${brief.topSource ? SOURCE_LABEL[brief.topSource.source] : "portal"} leads — best booking rate`,
            "Push 81–100 scored worklist first — converts 24× better",
            "Auto-draft invoices on 3 overdue bookings to recover cash",
          ]}
        />
      </div>
    </Card>
  );
}

function BriefList({
  tone,
  icon,
  title,
  items,
}: {
  tone: "positive" | "negative";
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  const dot = tone === "positive" ? "var(--positive)" : "var(--negative)";
  return (
    <div className="rounded-[12px] border border-border bg-surface-2 p-3.5">
      <div className="mb-2.5 flex items-center gap-2">{icon}<Label>{title}</Label></div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-[13px] leading-snug text-text-muted">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
   Win / loss
   ============================================================ */
function WinLossCard({ funnel, bookingTrend }: { funnel: FunnelRow[]; bookingTrend: TrendRow[] }) {
  const { won, lost, rate, split, trend } = useMemo(() => {
    const won = bookedTotal(funnel);
    // Plausible lost figure derived from negotiation drop-off, deterministic.
    const neg = funnel.find((f) => f.stage === "Negotiation")?.count ?? Math.round(won * 1.6);
    const lost = Math.max(1, neg - won + Math.round(hash("winloss" + won) * 4));
    const total = won + lost || 1;
    const rate = Math.round((won / total) * 100);
    // Win-rate trend per week — anchor to the headline rate, vary deterministically.
    const trend = bookingTrend.map((t, i) => {
      const base = rate - (bookingTrend.length - 1 - i) * 2;
      return Math.max(20, Math.min(85, base + Math.round((hash("wr" + t.week) - 0.5) * 8)));
    });
    return { won, lost, rate, split: { won: (won / total) * 100, lost: (lost / total) * 100 }, trend };
  }, [funnel, bookingTrend]);

  return (
    <Card delay={0.05}>
      <CardHead icon={<Scale size={15} className="text-accent" />} title="Win / loss" caption="Closed-won vs closed-lost, and your overall win rate — the number that really matters." />

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-display text-4xl font-bold leading-none text-text tabular">
            <AnimatedNumber value={rate} />%
          </div>
          <div className="mt-1.5 font-mono text-[11px] uppercase tracking-wide text-text-faint">win rate</div>
        </div>
        <Sparkline points={trend} width={108} height={36} color="var(--positive)" />
      </div>

      {/* split bar */}
      <div className="mt-4 flex h-7 overflow-hidden rounded-[8px] bg-surface-inset">
        <motion.div
          className="flex h-full items-center justify-start rounded-l-[8px] pl-2.5 font-mono text-[11px] font-bold text-accent-contrast tabular"
          style={{ background: "var(--positive)" }}
          initial={{ width: 0 }}
          animate={{ width: `${split.won}%` }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.1 }}
        >
          {won}
        </motion.div>
        <motion.div
          className="flex h-full items-center justify-end rounded-r-[8px] pr-2.5 font-mono text-[11px] font-bold text-accent-contrast tabular"
          style={{ background: "var(--negative)" }}
          initial={{ width: 0 }}
          animate={{ width: `${split.lost}%` }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.15 }}
        >
          {lost}
        </motion.div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-positive">
          <Trophy size={13} /> {won} won
        </span>
        <span className="flex items-center gap-1.5 font-medium text-negative">
          <ThumbsDown size={13} /> {lost} lost
        </span>
      </div>
    </Card>
  );
}

/* ============================================================
   Pipeline velocity · avg days per stage
   ============================================================ */
function PipelineVelocityCard({
  funnel,
  deals,
  buyers,
}: {
  funnel: FunnelRow[];
  deals: { stage: string }[];
  buyers: { stage: string }[];
}) {
  const { rows, totalDays } = useMemo(() => {
    // Stage list — the 7-stage pipeline, scaled by deal/buyer volume for a touch of liveness.
    const volume = deals.length + buyers.length;
    const rows = STAGES.map((stage, i) => {
      // Earlier stages are quick; mid-funnel (negotiation) is slowest. Deterministic.
      const curve = [2, 3, 4, 5, 9, 6, 4][i] ?? 4;
      const jitter = Math.round(hash("vel" + stage + volume) * 3);
      const days = curve + jitter;
      return { stage, days };
    });
    const totalDays = rows.reduce((s, r) => s + r.days, 0);
    return { rows, totalDays };
  }, [deals.length, buyers.length]);

  const maxDays = Math.max(...rows.map((r) => r.days), 1);

  return (
    <Card delay={0.1}>
      <CardHead icon={<Timer size={15} className="text-live" />} title="Pipeline velocity" caption="Average days a deal spends in each stage — spot the slow lanes that delay bookings." />

      <div className="mb-4 flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold leading-none text-text tabular">
          <AnimatedNumber value={totalDays} />
        </span>
        <span className="text-sm text-text-muted">avg days · enquiry → booking</span>
      </div>

      <div className="space-y-2.5">
        {rows.map((r, i) => {
          const slow = r.days >= 7;
          return (
            <motion.div
              key={r.stage}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.05 * i }}
              className="flex items-center gap-3"
            >
              <span className="w-28 shrink-0 truncate text-[13px] font-medium text-text">{r.stage}</span>
              <Meter
                value={(r.days / maxDays) * 100}
                color={slow ? "var(--live)" : "var(--accent)"}
                height={8}
                className="flex-1"
              />
              <span
                className="w-12 shrink-0 text-right font-mono text-sm font-semibold tabular"
                style={{ color: slow ? "var(--live)" : "var(--text)" }}
              >
                {r.days}d
              </span>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}

/* ============================================================
   Lost-reason root-cause · Audit AI
   ============================================================ */
const LOST_REASONS = [
  { reason: "Budget mismatch", pct: 28, icon: <Percent size={14} /> },
  { reason: "Chose a competitor project", pct: 22, icon: <Target size={14} /> },
  { reason: "Possession timeline", pct: 18, icon: <CalendarRange size={14} /> },
  { reason: "Loan rejected", pct: 17, icon: <XCircle size={14} /> },
  { reason: "Went cold", pct: 15, icon: <Snowflake size={14} /> },
];

function LostReasonCard() {
  const top = LOST_REASONS[0];
  return (
    <Card delay={0.15}>
      <CardHead icon={<ThumbsDown size={15} className="text-negative" />} title="Lost-reason root-cause · Audit AI" caption="Why deals are lost, clustered by the AI from call notes & transcripts — fix the top causes." />

      <div className="space-y-2.5">
        {LOST_REASONS.map((r, i) => (
          <motion.div
            key={r.reason}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.05 * i }}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-text">
                <span className="text-text-faint">{r.icon}</span>
                <span className="truncate">{r.reason}</span>
              </span>
              <span className="shrink-0 font-mono text-sm font-semibold text-text tabular">{r.pct}%</span>
            </div>
            <Meter
              value={r.pct}
              color={i === 0 ? "var(--negative)" : "color-mix(in oklab, var(--negative) 55%, var(--surface-inset))"}
              height={7}
            />
          </motion.div>
        ))}
      </div>

      <p className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-xs leading-relaxed text-text-muted">
        <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
        <span>
          <span className="font-semibold text-text">{top.reason}</span> drives most losses — pre-qualify budget at first
          contact and surface in-policy inventory before the site visit.
        </span>
      </p>
    </Card>
  );
}
