"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { PageContainer } from "@/components/ui/page";
import {
  ScoreBadge,
  Sparkline,
  Pill,
  Label,
  AnimatedNumber,
  Avatar,
} from "@/components/ui/primitives";
import {
  SIGNAL_CATEGORIES,
  type SignalCategory,
  type Buyer,
} from "@/lib/data/types";
import { DEFAULT_WEIGHTS, computeScore } from "@/lib/data/scoring";
import { cn, rupeeRange } from "@/lib/utils";

/* Short axis labels so the radar never clips at 375px. */
const SHORT_LABEL: Record<SignalCategory, string> = {
  "Budget fit": "Budget",
  "Config & locality match": "Match",
  Engagement: "Engage",
  "Site-visit intent": "Visit",
  "Loan readiness": "Loan",
};

const EASE = [0.34, 1.4, 0.5, 1] as const;
const SPRING = { type: "spring" as const, stiffness: 170, damping: 22 };

export default function BuyerScorePage() {
  const id = useParams<{ id: string }>().id;
  const buyer = useStore((s) => s.buyers.find((b) => b.id === id));

  if (!buyer) {
    return (
      <PageContainer>
        <div className="grid place-items-center py-24 text-center">
          <p className="text-text-muted">That buyer isn&apos;t here.</p>
          <Link href="/worklist" className="mt-3 text-sm font-medium text-accent">
            Back to the worklist
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ScoreHeader buyer={buyer} />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <SignalRadar buyer={buyer} />
          <SignalChips buyer={buyer} />
          <ScoreHistoryCard buyer={buyer} />
        </div>
        <div className="min-w-0">
          <WeightTuner buyer={buyer} />
        </div>
      </div>
    </PageContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */
function ScoreHeader({ buyer }: { buyer: Buyer }) {
  const delta = buyer.score - buyer.prevScore;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-5"
    >
      <Link
        href={`/buyers/${buyer.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
      >
        <span aria-hidden className="text-base leading-none">&larr;</span>
        Back to {buyer.name.split(" ")[0]}
      </Link>
      <div className="flex flex-col gap-4 rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center">
        <Avatar name={buyer.name} hue={buyer.hue} size={52} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
            Buyer score · deep-dive
          </div>
          <h1 className="font-display text-[26px] font-bold leading-none tracking-tight text-text md:text-[30px]">
            {buyer.name}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {buyer.config} · {buyer.localityPrefs[0]} ·{" "}
            <span className="tabular">
              {rupeeRange(buyer.budgetMin, buyer.budgetMax)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-4 sm:flex-col sm:items-end">
          <ScoreBadge score={buyer.score} size={76} />
          {delta !== 0 && (
            <span
              className={cn(
                "flex items-center gap-1 font-mono text-xs font-semibold",
                delta > 0 ? "text-positive" : "text-negative",
              )}
            >
              {delta > 0 ? "+" : ""}
              {delta} this week
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Signal radar — custom SVG pentagon                                  */
/* ------------------------------------------------------------------ */
function SignalRadar({ buyer }: { buyer: Buyer }) {
  const SIZE = 300;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 96; // max value radius — leaves room for axis labels

  // 5 axis unit vectors, starting from top, 72° apart.
  const axes = useMemo(
    () =>
      SIGNAL_CATEGORIES.map((cat, i) => {
        const angle = -Math.PI / 2 + i * ((2 * Math.PI) / 5);
        return { cat, cos: Math.cos(angle), sin: Math.sin(angle) };
      }),
    [],
  );

  const point = (i: number, frac: number) => {
    const a = axes[i];
    return [CX + a.cos * R * frac, CY + a.sin * R * frac] as const;
  };

  const polygonAt = (frac: number) =>
    axes
      .map((_, i) => {
        const [x, y] = point(i, frac);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  // Live value polygon (signals scaled 0–100 → 0–1).
  const valuePoints = axes
    .map((a, i) => {
      const v = (buyer.signals[a.cat] ?? 0) / 100;
      const [x, y] = point(i, v);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <section className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <Label>Signal radar · five real-estate dimensions</Label>
        <Pill variant="accent">live</Pill>
      </div>
      <p className="mb-4 text-sm text-text-muted">
        Every score is a shape, not a black box.
      </p>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="mx-auto w-full max-w-[320px]">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="h-auto w-full overflow-visible"
            role="img"
            aria-label={`Signal radar for ${buyer.name}`}
          >
            {/* gridline pentagons */}
            {rings.map((frac) => (
              <polygon
                key={frac}
                points={polygonAt(frac)}
                fill="none"
                stroke="var(--border)"
                strokeWidth={1}
              />
            ))}

            {/* spokes */}
            {axes.map((_, i) => {
              const [x, y] = point(i, 1);
              return (
                <line
                  key={i}
                  x1={CX}
                  y1={CY}
                  x2={x}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
              );
            })}

            {/* animated value polygon */}
            <motion.polygon
              points={valuePoints}
              initial={false}
              animate={{ points: valuePoints }}
              transition={SPRING}
              fill="var(--accent)"
              fillOpacity={0.18}
              stroke="var(--accent)"
              strokeWidth={2}
              strokeLinejoin="round"
            />

            {/* vertex dots */}
            {axes.map((a, i) => {
              const v = (buyer.signals[a.cat] ?? 0) / 100;
              const [x, y] = point(i, v);
              return (
                <motion.circle
                  key={a.cat}
                  initial={false}
                  animate={{ cx: x, cy: y }}
                  transition={SPRING}
                  r={3.5}
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth={1.5}
                />
              );
            })}

            {/* axis labels — opacity tied to weight */}
            {axes.map((a, i) => {
              const [lx, ly] = point(i, 1.18);
              const w = buyer.weights[a.cat] ?? 0;
              const anchor =
                Math.abs(lx - CX) < 6
                  ? "middle"
                  : lx > CX
                    ? "start"
                    : "end";
              return (
                <text
                  key={a.cat}
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill="var(--text-faint)"
                  opacity={0.45 + w * 0.55}
                  className="font-mono"
                >
                  {SHORT_LABEL[a.cat]}
                </text>
              );
            })}
          </svg>
        </div>

        {/* per-axis readout */}
        <div className="w-full max-w-[320px] space-y-1.5 sm:max-w-none sm:flex-1">
          {SIGNAL_CATEGORIES.map((cat) => (
            <div
              key={cat}
              className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-surface-2 px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm text-text">{cat}</span>
              <span className="shrink-0 tabular font-mono text-sm font-semibold text-accent">
                {Math.round(buyer.signals[cat] ?? 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Signal chips — provenance from scoreReasons                         */
/* ------------------------------------------------------------------ */
function SignalChips({ buyer }: { buyer: Buyer }) {
  const positives = buyer.scoreReasons.filter((r) => r.polarity === "positive");
  const negatives = buyer.scoreReasons.filter((r) => r.polarity === "negative");

  return (
    <section className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <Label className="mb-3 block">Signal chips · full provenance</Label>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChipColumn
          title="Lifting the score"
          tone="positive"
          reasons={positives}
        />
        <ChipColumn
          title="Holding it back"
          tone="negative"
          reasons={negatives}
        />
      </div>
    </section>
  );
}

function ChipColumn({
  title,
  tone,
  reasons,
}: {
  title: string;
  tone: "positive" | "negative";
  reasons: Buyer["scoreReasons"];
}) {
  const color = tone === "positive" ? "var(--positive)" : "var(--negative)";
  return (
    <div>
      <div
        className="mb-2 flex items-center gap-2 text-xs font-semibold"
        style={{ color }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: color }}
        />
        {title}
        <span className="ml-auto font-mono text-text-faint">
          {reasons.length}
        </span>
      </div>
      <div className="space-y-2">
        {reasons.length === 0 && (
          <p className="rounded-[10px] border border-dashed border-border px-3 py-2 text-xs text-text-faint">
            Nothing here yet.
          </p>
        )}
        {reasons.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="rounded-[12px] border border-border bg-surface-2 p-3"
          >
            <div className="flex items-start gap-2.5">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: color }}
              />
              <span className="min-w-0 flex-1 text-sm leading-snug text-text">
                {r.text}
              </span>
              <span
                className="shrink-0 tabular font-mono text-xs font-semibold"
                style={{ color }}
              >
                {r.weight > 0 ? "+" : ""}
                {r.weight}
              </span>
            </div>
            {r.sourceQuote && (
              <p className="mt-1.5 pl-[18px] font-mono text-[11px] italic leading-relaxed text-text-faint">
                &ldquo;{r.sourceQuote}&rdquo;
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Score history                                                       */
/* ------------------------------------------------------------------ */
function ScoreHistoryCard({ buyer }: { buyer: Buyer }) {
  const points = buyer.scoreHistory.map((p) => p.score);
  const first = points[0] ?? 0;
  const last = points[points.length - 1] ?? 0;
  const trend = last - first;

  return (
    <section className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Label>Score history</Label>
        {points.length > 1 && (
          <span
            className={cn(
              "font-mono text-xs font-semibold",
              trend >= 0 ? "text-positive" : "text-negative",
            )}
          >
            {trend >= 0 ? "+" : ""}
            {trend} over {points.length} weeks
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-4">
        <Sparkline
          points={points.length > 1 ? points : [last, last]}
          width={240}
          height={56}
          color="var(--accent)"
          className="w-full"
        />
        <span className="shrink-0 tabular font-display text-3xl font-bold text-text">
          {last}
        </span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Weight tuner — the mind-blow                                        */
/* ------------------------------------------------------------------ */
function WeightTuner({ buyer }: { buyer: Buyer }) {
  const setBuyerWeight = useStore((s) => s.setBuyerWeight);

  // Live preview straight from the store buyer's weights + signals.
  const liveScore = useMemo(
    () => computeScore(buyer.signals, buyer.weights),
    [buyer.signals, buyer.weights],
  );

  const isDefault = SIGNAL_CATEGORIES.every(
    (c) => Math.round((buyer.weights[c] ?? 0) * 100) === Math.round(DEFAULT_WEIGHTS[c] * 100),
  );

  const reset = () => {
    for (const c of SIGNAL_CATEGORIES) {
      setBuyerWeight(buyer.id, c, DEFAULT_WEIGHTS[c]);
    }
  };

  return (
    <div className="lg:sticky lg:top-20">
      <section className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <Label className="mb-1 block">Weight tuner</Label>
        <p className="mb-4 text-sm text-text-muted">
          You decide what a ready buyer means.
        </p>

        <div className="mb-5 flex items-end gap-3 rounded-[12px] border border-accent/30 bg-accent-soft px-4 py-3">
          <AnimatedNumber
            value={liveScore}
            className="font-display text-5xl font-bold leading-none text-accent"
          />
          <span className="pb-1 text-xs leading-snug text-text-muted">
            live score
            <br />
            recomputed
          </span>
        </div>

        <div className="space-y-4">
          {SIGNAL_CATEGORIES.map((cat) => {
            const weightPct = Math.round((buyer.weights[cat] ?? 0) * 100);
            const signal = Math.round(buyer.signals[cat] ?? 0);
            return (
              <div key={cat}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-text">
                    {cat}
                  </span>
                  <span className="shrink-0 tabular font-mono text-xs font-semibold text-accent">
                    {weightPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={weightPct}
                  onChange={(e) =>
                    setBuyerWeight(buyer.id, cat, Number(e.target.value) / 100)
                  }
                  aria-label={`Weight for ${cat}`}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-pill bg-surface-inset"
                  style={{ accentColor: "var(--accent)" }}
                />
                <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-text-faint">
                  signal {signal} · weight {weightPct}%
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={reset}
          disabled={isDefault}
          className={cn(
            "mt-5 w-full rounded-[10px] border px-3 py-2 text-sm font-semibold transition-colors",
            isDefault
              ? "cursor-default border-border text-text-faint"
              : "border-border-strong text-text hover:bg-surface-2",
          )}
        >
          {isDefault ? "At default weights" : "Reset to defaults"}
        </button>

        <p className="mt-3 text-center font-mono text-[10px] leading-relaxed text-text-faint">
          Drag a weight: the score and the radar reshape live —
          <br />
          and the worklist re-ranks too.
        </p>
      </section>
    </div>
  );
}
