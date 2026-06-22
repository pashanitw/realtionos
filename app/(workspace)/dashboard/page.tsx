"use client";

import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  Layers,
  Send,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PageContainer, PageHeader } from "@/components/ui/page";
import {
  AnimatedNumber,
  Sparkline,
  Label,
  Avatar,
  Pill,
} from "@/components/ui/primitives";
import { SOURCE_LABEL, type Source } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const EASE = [0.34, 1.4, 0.5, 1] as const;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/* Color stop along the accent→positive funnel gradient (0..1). */
function funnelColor(t: number): string {
  // mix accent (teal) into positive (green) across the funnel
  return `color-mix(in oklab, var(--positive) ${Math.round(t * 100)}%, var(--accent))`;
}

export default function DashboardPage() {
  const analytics = useStore((s) => s.analytics);
  const { funnel, sourceROI, agents, health, bookingTrend } = analytics;

  const enquiries = funnel[0]?.count ?? 0;
  const booked = funnel.find((f) => f.stage === "Booked")?.count ?? 0;
  const bookRate = enquiries ? Math.round((booked / enquiries) * 1000) / 10 : 0;

  const bookingPoints = useMemo(
    () => (bookingTrend.length ? bookingTrend.map((b) => b.bookings) : [3, 4, 5, 6, 7, 8]),
    [bookingTrend],
  );
  const visitPoints = useMemo(
    () => (bookingTrend.length ? bookingTrend.map((b) => b.visits) : [18, 22, 26, 30, 34, 38]),
    [bookingTrend],
  );

  const kpis = [
    {
      label: "Enquiries (90d)",
      value: enquiries,
      suffix: "",
      points: bookingTrend.length ? bookingTrend.map((b) => b.visits + b.bookings) : visitPoints,
      color: "var(--accent)",
      trend: "+18%",
      up: true,
      sub: "across 6 portals",
    },
    {
      label: "Bookings",
      value: booked,
      suffix: "",
      points: bookingPoints,
      color: "var(--positive)",
      trend: "+12%",
      up: true,
      sub: "flats blocked w/ token",
    },
    {
      label: "Booking rate",
      value: bookRate,
      suffix: "%",
      points: bookingPoints,
      color: "var(--positive)",
      trend: "+0.4pt",
      up: true,
      sub: "Booked ÷ Enquiry",
    },
    {
      label: "AI-handled share",
      value: health.aiHandledShare,
      suffix: "%",
      points: visitPoints,
      color: "var(--live)",
      trend: "+9pt",
      up: true,
      sub: "convos w/o an agent",
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        kicker="Super-admin analytics"
        title="Owner dashboard"
        description="Proof it's working — which marketing spend actually books flats, not just which sends leads."
      />

      <NLQueryBox sourceROI={sourceROI} />

      {/* ---------------- KPI strip ---------------- */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <KpiCard key={k.label} {...k} index={i} />
        ))}
      </div>

      {/* ---------------- Funnel + Source ROI ---------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <FunnelCard funnel={funnel} />
        <SourceROICard sourceROI={sourceROI} />
      </div>

      {/* ---------------- Agents + Health ---------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <AgentLeaderboard agents={agents} />
        <HealthCard health={health} />
      </div>
    </PageContainer>
  );
}

/* ============================================================
   Card shell
   ============================================================ */
function Card({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT, delay }}
      className={cn(
        "rounded-[14px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)] md:p-5",
        className,
      )}
    >
      {children}
    </motion.section>
  );
}

function CardHead({
  icon,
  title,
  caption,
  right,
}: {
  icon?: React.ReactNode;
  title: string;
  caption?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon}
          <Label>{title}</Label>
        </div>
        {caption && (
          <p className="mt-1.5 text-sm leading-snug text-text-muted">{caption}</p>
        )}
      </div>
      {right}
    </div>
  );
}

/* ============================================================
   NL Query box — type a question → live chart renders
   ============================================================ */
type QueryResult = { title: string; bars: { label: string; value: number }[] };

function NLQueryBox({
  sourceROI,
}: {
  sourceROI: { source: Source; enquiries: number; bookings: number; rate: number }[];
}) {
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<QueryResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const placeholder = "Ask: bookings this month by locality…";

  function run() {
    const q = value.trim() || placeholder.replace(/^Ask:\s*/, "");
    if (timer.current) clearTimeout(timer.current);
    setPhase("loading");
    setResult(null);

    // Deterministic locality breakdown derived from sourceROI bookings, so the
    // same question always renders the same chart (no network, no randomness).
    const localities = ["Kokapet", "Gachibowli", "Narsingi", "Tellapur"];
    const totalBookings = sourceROI.reduce((sum, s) => sum + s.bookings, 0);
    // spread bookings across localities with a fixed, descending weighting
    const weights = [0.38, 0.27, 0.21, 0.14];
    const bars = localities.map((label, i) => ({
      label,
      value: Math.max(1, Math.round(totalBookings * weights[i])),
    }));

    timer.current = setTimeout(() => {
      setResult({ title: q, bars });
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
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="shrink-0 text-accent" />
        <Label>Ask the data</Label>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <div className="flex h-11 flex-1 items-center gap-2 rounded-[10px] border border-border bg-surface-inset px-3 transition-colors focus-within:border-border-strong">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-faint"
          />
        </div>
        <button
          type="submit"
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-contrast shadow-[0_0_22px_-8px_var(--accent)] transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Send size={15} /> Ask
        </button>
      </form>

      <AnimatePresence mode="wait">
        {phase === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-4 space-y-2.5"
          >
            <div className="shimmer h-3 w-1/3 rounded-md" />
            <div className="flex items-end gap-3 pt-1">
              {[0.55, 0.85, 0.65, 0.4].map((h, i) => (
                <div
                  key={i}
                  className="shimmer w-full rounded-t-md"
                  style={{ height: 90 * h }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {phase === "done" && result && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="mt-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <Pill variant="accent" mono>
                <Sparkles size={11} /> generated
              </Pill>
              <p className="truncate text-sm font-medium text-text">
                &ldquo;{result.title}&rdquo;
              </p>
            </div>
            <MiniBarChart bars={result.bars} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MiniBarChart({ bars }: { bars: { label: string; value: number }[] }) {
  const W = 520;
  const H = 150;
  const PAD_B = 26;
  const PAD_T = 18;
  const max = Math.max(...bars.map((b) => b.value), 1);
  const slot = W / bars.length;
  const barW = slot * 0.5;
  const chartH = H - PAD_B - PAD_T;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible" role="img">
      {/* baseline */}
      <line
        x1={0}
        y1={H - PAD_B}
        x2={W}
        y2={H - PAD_B}
        stroke="var(--border)"
        strokeWidth={1}
      />
      {bars.map((b, i) => {
        const barH = (b.value / max) * chartH;
        const x = i * slot + (slot - barW) / 2;
        const y = H - PAD_B - barH;
        return (
          <g key={b.label}>
            <motion.rect
              x={x}
              width={barW}
              rx={5}
              fill="var(--accent)"
              initial={{ height: 0, y: H - PAD_B }}
              animate={{ height: barH, y }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.05 * i }}
            />
            <motion.text
              x={x + barW / 2}
              y={y - 6}
              textAnchor="middle"
              className="tabular"
              fontSize={13}
              fontWeight={700}
              fill="var(--text)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05 * i + 0.3 }}
            >
              {b.value}
            </motion.text>
            <text
              x={x + barW / 2}
              y={H - PAD_B + 16}
              textAnchor="middle"
              fontSize={11}
              fill="var(--text-faint)"
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================
   KPI card
   ============================================================ */
function KpiCard({
  label,
  value,
  suffix,
  points,
  color,
  trend,
  up,
  sub,
  index,
}: {
  label: string;
  value: number;
  suffix: string;
  points: number[];
  color: string;
  trend: string;
  up: boolean;
  sub: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.05 * index }}
      className="flex flex-col justify-between rounded-[14px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]"
    >
      <div className="flex items-start justify-between gap-2">
        <Label className="leading-snug">{label}</Label>
        <Pill variant={up ? "positive" : "negative"}>
          {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
          {trend}
        </Pill>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="font-display text-[30px] font-bold leading-none text-text md:text-[34px]">
          <AnimatedNumber value={value} />
          {suffix && <span className="text-[20px] text-text-muted">{suffix}</span>}
        </div>
        <Sparkline points={points} width={84} height={30} color={color} />
      </div>
      <p className="mt-2 text-xs text-text-faint">{sub}</p>
    </motion.div>
  );
}

/* ============================================================
   Funnel (custom SVG, 7 horizontal bars)
   ============================================================ */
function FunnelCard({ funnel }: { funnel: { stage: string; count: number }[] }) {
  const max = Math.max(...funnel.map((f) => f.count), 1);
  const rowH = 40;
  const gap = 8;
  const W = 520;
  const labelW = 130;
  const valueW = 92;
  const trackX = labelW;
  const trackW = W - labelW - valueW;
  const H = funnel.length * (rowH + gap);

  return (
    <Card delay={0.05}>
      <CardHead
        icon={<Layers size={15} className="text-accent" />}
        title="Conversion funnel"
        caption="Enquiry → Registered. Each step shows what survives to the next."
      />
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible" role="img">
        {funnel.map((f, i) => {
          const prev = i === 0 ? null : funnel[i - 1].count;
          const stepPct = prev ? Math.round((f.count / prev) * 100) : 100;
          const barW = Math.max(6, (f.count / max) * trackW);
          const y = i * (rowH + gap);
          const t = funnel.length > 1 ? i / (funnel.length - 1) : 0;
          const fill = funnelColor(t);
          return (
            <g key={f.stage}>
              {/* stage label */}
              <text
                x={0}
                y={y + rowH / 2 + 4}
                fontSize={13}
                fontWeight={600}
                fill="var(--text)"
              >
                {f.stage}
              </text>
              {/* track */}
              <rect
                x={trackX}
                y={y}
                width={trackW}
                height={rowH}
                rx={7}
                fill="var(--surface-inset)"
              />
              {/* bar */}
              <motion.rect
                x={trackX}
                y={y}
                height={rowH}
                rx={7}
                fill={fill}
                initial={{ width: 0 }}
                animate={{ width: barW }}
                transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.08 * i }}
              />
              {/* count inside / beside the bar */}
              <motion.text
                x={trackX + 12}
                y={y + rowH / 2 + 4}
                fontSize={13}
                fontWeight={700}
                className="tabular"
                fill="var(--accent-contrast)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.08 * i + 0.35 }}
              >
                {f.count.toLocaleString("en-IN")}
              </motion.text>
              {/* step conversion */}
              <text
                x={W}
                y={y + rowH / 2 + 4}
                textAnchor="end"
                fontSize={12}
                className="tabular"
                fill={i === 0 ? "var(--text-faint)" : "var(--text-muted)"}
              >
                {i === 0 ? "—" : `${stepPct}%`}
              </text>
            </g>
          );
        })}
      </svg>
    </Card>
  );
}

/* ============================================================
   Source ROI — the key insight
   ============================================================ */
function SourceROICard({
  sourceROI,
}: {
  sourceROI: { source: Source; enquiries: number; bookings: number; rate: number }[];
}) {
  const sorted = useMemo(
    () => [...sourceROI].sort((a, b) => b.rate - a.rate),
    [sourceROI],
  );
  const maxRate = Math.max(...sorted.map((s) => s.rate), 1);

  return (
    <Card delay={0.1}>
      <CardHead
        icon={<TrendingUp size={15} className="text-positive" />}
        title="Source ROI"
        caption="Which portal actually books flats — booking rate, not lead volume."
      />
      <div className="space-y-3">
        {sorted.map((s, i) => {
          const top = i === 0;
          return (
            <motion.div
              key={s.source}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.06 * i }}
            >
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-text">
                    {SOURCE_LABEL[s.source]}
                  </span>
                  {top && (
                    <Pill variant="positive">
                      <Trophy size={11} /> books best
                    </Pill>
                  )}
                </div>
                <div className="shrink-0 font-mono text-xs text-text-faint tabular">
                  <span className="text-text-muted">{s.bookings}</span>
                  <span className="mx-1">/</span>
                  {s.enquiries.toLocaleString("en-IN")}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-pill bg-surface-inset">
                  <motion.div
                    className="h-full rounded-pill"
                    style={{ background: top ? "var(--positive)" : "var(--accent)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(s.rate / maxRate) * 100}%` }}
                    transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.06 * i + 0.1 }}
                  />
                </div>
                <span
                  className="w-12 shrink-0 text-right font-mono text-sm font-semibold tabular"
                  style={{ color: top ? "var(--positive)" : "var(--text)" }}
                >
                  {s.rate}%
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
      <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-text-muted">
        <span className="font-semibold text-text">{SOURCE_LABEL[sorted[0].source]}</span>{" "}
        sends fewer leads than the big portals but converts the most — spend follows
        bookings, not clicks.
      </p>
    </Card>
  );
}

/* ============================================================
   Agent leaderboard
   ============================================================ */
function AgentLeaderboard({
  agents,
}: {
  agents: { name: string; initials: string; bookings: number; visits: number; hue: number }[];
}) {
  const sorted = useMemo(
    () => [...agents].sort((a, b) => b.bookings - a.bookings),
    [agents],
  );
  const maxBookings = Math.max(...sorted.map((a) => a.bookings), 1);

  return (
    <Card delay={0.15}>
      <CardHead
        icon={<Trophy size={15} className="text-live" />}
        title="Agent leaderboard"
        caption="Ranked by flats booked. Visits in, bookings out."
      />
      <div className="space-y-2.5">
        {sorted.map((a, i) => (
          <motion.div
            key={a.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.06 * i }}
            className="flex items-center gap-3 rounded-[10px] border border-border bg-surface-2 px-3 py-2.5"
          >
            <span className="w-4 shrink-0 text-center font-mono text-sm text-text-faint tabular">
              {i + 1}
            </span>
            <Avatar name={a.name} hue={a.hue} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">{a.name}</div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-pill bg-surface-inset">
                <motion.div
                  className="h-full rounded-pill"
                  style={{ background: i === 0 ? "var(--live)" : "var(--accent)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(a.bookings / maxBookings) * 100}%` }}
                  transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.06 * i + 0.1 }}
                />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-display text-[20px] font-bold leading-none text-text tabular">
                <AnimatedNumber value={a.bookings} />
              </div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-text-faint">
                {a.visits} visits
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

/* ============================================================
   Automation health — three ring gauges
   ============================================================ */
function HealthCard({
  health,
}: {
  health: { capturePrecision: number; aiHandledShare: number; dedupeRate: number };
}) {
  const rings = [
    { label: "Capture precision", value: health.capturePrecision, color: "var(--accent)" },
    { label: "AI-handled share", value: health.aiHandledShare, color: "var(--live)" },
    { label: "Dedupe rate", value: health.dedupeRate, color: "var(--positive)" },
  ];

  return (
    <Card delay={0.2}>
      <CardHead
        icon={<ShieldCheck size={15} className="text-positive" />}
        title="Automation health"
        caption="The AI is earning its keep — clean capture, fewer hands, no duplicates."
      />
      <div className="grid grid-cols-3 gap-2">
        {rings.map((r, i) => (
          <RingGauge key={r.label} {...r} index={i} />
        ))}
      </div>
    </Card>
  );
}

function RingGauge({
  label,
  value,
  color,
  index,
}: {
  label: string;
  value: number;
  color: string;
  index: number;
}) {
  const size = 96;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--surface-inset)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: EASE_OUT, delay: 0.1 * index }}
          />
        </svg>
        <div
          className="absolute inset-0 grid place-items-center font-display text-[20px] font-bold tabular"
          style={{ color }}
        >
          <span>
            <AnimatedNumber value={value} />%
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] font-medium leading-tight text-text-muted">{label}</p>
    </div>
  );
}
