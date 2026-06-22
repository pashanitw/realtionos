"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Plug,
  SlidersHorizontal,
  ArrowRight,
  ShieldCheck,
  Gauge,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { AnimatedNumber, Meter, Label, Pill } from "@/components/ui/primitives";
import {
  AUTONOMY_LEVELS,
  SIGNAL_CATEGORIES,
  type SignalCategory,
} from "@/lib/data/types";
import { DEFAULT_WEIGHTS } from "@/lib/data/scoring";
import { cn, clamp } from "@/lib/utils";
import { toast } from "sonner";

const SPRING = { type: "spring" as const, stiffness: 320, damping: 30 };
const MAX_LEVEL = AUTONOMY_LEVELS.length - 1; // 4
const L0_BASELINE = 9; // L0 review-queue baseline used by the queue meter

/* ============================================================
   Autonomy — governs how far the Customer AI Concierge can act.
   ============================================================ */
export default function AutonomyPage() {
  const autonomy = useStore((s) => s.autonomy);
  const setAutonomy = useStore((s) => s.setAutonomy);
  const reviewQueueCount = useStore((s) => s.reviewQueueCount);

  // Scoring-weight tuner — LOCAL org-defaults only (never touches buyer state).
  const [weights, setWeights] = useState<Record<SignalCategory, number>>(() =>
    Object.fromEntries(
      SIGNAL_CATEGORIES.map((c) => [c, Math.round(DEFAULT_WEIGHTS[c] * 100)]),
    ) as Record<SignalCategory, number>,
  );
  const isDefaultWeights = SIGNAL_CATEGORIES.every(
    (c) => weights[c] === Math.round(DEFAULT_WEIGHTS[c] * 100),
  );

  const current = AUTONOMY_LEVELS[autonomy];
  // Live: share of buyer chats handled with no human in the loop.
  const unattendedShare = Math.min(88, autonomy * 22);
  const queueFullness = Math.min(100, (reviewQueueCount / L0_BASELINE) * 100);

  const commitAutonomy = useCallback(
    (next: number) => {
      const n = clamp(Math.round(next), 0, MAX_LEVEL);
      if (n === autonomy) return;
      setAutonomy(n);
      const lvl = AUTONOMY_LEVELS[n];
      toast.success(`Autonomy set to L${n} · ${lvl.label}`, {
        description: lvl.blurb,
      });
    },
    [autonomy, setAutonomy],
  );

  return (
    <PageContainer>
      <PageHeader
        kicker="Settings with teeth"
        title="Autonomy"
        description="Autonomy governs how far the Customer AI can act — answer only, qualify, or qualify + book site visits unattended. One control trades safety for speed."
      />

      <SettingsNav />

      {/* Dial + Review-queue card */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <AutonomyDial
          level={autonomy}
          current={current}
          onCommit={commitAutonomy}
        />
        <ReviewQueueCard
          count={reviewQueueCount}
          fullness={queueFullness}
          level={autonomy}
          unattendedShare={unattendedShare}
        />
      </div>

      <WeightTuner
        weights={weights}
        setWeights={setWeights}
        isDefault={isDefaultWeights}
      />
    </PageContainer>
  );
}

/* ---------------- Segmented settings nav (animated indicator) ---------------- */
function SettingsNav() {
  const tabs = [
    { href: "/settings/sources", label: "Sources", icon: Plug, active: false },
    {
      href: "/settings/autonomy",
      label: "Autonomy",
      icon: SlidersHorizontal,
      active: true,
    },
  ];
  return (
    <LayoutGroup id="settings-nav">
      <nav className="mb-5 inline-flex rounded-pill border border-border bg-surface p-1 shadow-[var(--shadow-soft)]">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "relative flex h-9 items-center gap-2 rounded-pill px-4 text-sm font-medium transition-colors",
                t.active ? "text-accent-contrast" : "text-text-muted hover:text-text",
              )}
            >
              {t.active && (
                <motion.span
                  layoutId="settings-nav-pill"
                  transition={SPRING}
                  className="absolute inset-0 rounded-pill bg-accent shadow-[0_0_20px_-6px_var(--accent)]"
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon size={15} strokeWidth={2.2} />
                {t.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}

/* ---------------- The Autonomy Dial (hero) ---------------- */
function AutonomyDial({
  level,
  current,
  onCommit,
}: {
  level: number;
  current: (typeof AUTONOMY_LEVELS)[number];
  onCommit: (n: number) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const fillPct = (level / MAX_LEVEL) * 100;

  // Map a clientX onto the nearest stop and commit.
  const commitFromClientX = useCallback(
    (clientX: number) => {
      const rail = railRef.current;
      if (!rail) return;
      const rect = rail.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      onCommit(ratio * MAX_LEVEL);
    },
    [onCommit],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onCommit(level + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onCommit(level - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      onCommit(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onCommit(MAX_LEVEL);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-[14px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-6">
      {/* ambient glow that intensifies with trust */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl"
        style={{ background: "var(--accent)" }}
        animate={{ opacity: 0.04 + level * 0.035 }}
        transition={{ duration: 0.5 }}
      />

      <div className="relative flex items-center justify-between gap-3">
        <Label>Concierge autonomy</Label>
        <Pill variant="accent" mono>
          <Gauge size={12} /> L{level} / L{MAX_LEVEL}
        </Pill>
      </div>

      {/* Big current state, cross-fading on change */}
      <div className="relative mt-4 min-h-[78px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={level}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.28 }}
          >
            <h2 className="font-display text-[28px] font-bold leading-none tracking-tight text-text sm:text-[34px]">
              <span className="text-accent">L{level}</span> · {current.label}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">
              {current.blurb}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* The track */}
      <div className="relative mt-8 px-1.5 pb-1 sm:px-3">
        <div
          ref={railRef}
          role="slider"
          tabIndex={0}
          aria-label="Customer AI Concierge autonomy level"
          aria-valuemin={0}
          aria-valuemax={MAX_LEVEL}
          aria-valuenow={level}
          aria-valuetext={`L${level} ${current.label}: ${current.blurb}`}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            setDragging(true);
            commitFromClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (dragging) commitFromClientX(e.clientX);
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          className="group relative h-9 cursor-pointer touch-none select-none outline-none"
        >
          {/* rail */}
          <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-pill bg-surface-inset" />
          {/* accent fill */}
          <motion.div
            className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-pill bg-accent"
            style={{ boxShadow: "0 0 18px -4px var(--accent)" }}
            initial={false}
            animate={{ width: `${fillPct}%` }}
            transition={SPRING}
          />
          {/* clickable stops */}
          {AUTONOMY_LEVELS.map((lvl) => {
            const pct = (lvl.level / MAX_LEVEL) * 100;
            const passed = lvl.level <= level;
            return (
              <button
                key={lvl.level}
                type="button"
                tabIndex={-1}
                aria-label={`L${lvl.level} ${lvl.label}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onCommit(lvl.level)}
                className="absolute top-1/2 z-10 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
                style={{ left: `${pct}%` }}
              >
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full ring-2 transition-colors",
                    passed
                      ? "bg-accent ring-surface"
                      : "bg-surface-inset ring-border",
                  )}
                />
              </button>
            );
          })}
          {/* draggable handle */}
          <motion.div
            className="absolute top-1/2 z-20 -translate-y-1/2"
            initial={false}
            animate={{ left: `${fillPct}%` }}
            transition={SPRING}
          >
            <motion.div
              className="-translate-x-1/2 rounded-full border-2 border-accent bg-surface shadow-[var(--shadow-soft)]"
              animate={{
                scale: dragging ? 1.18 : 1,
                boxShadow: dragging
                  ? "0 0 0 6px var(--accent-soft), 0 0 22px -4px var(--accent)"
                  : "0 0 0 0px var(--accent-soft)",
              }}
              transition={{ duration: 0.18 }}
              style={{ width: 22, height: 22 }}
            />
          </motion.div>
        </div>

        {/* labels under each stop, reflow on mobile */}
        <div className="relative mt-3 h-10 sm:h-7">
          {AUTONOMY_LEVELS.map((lvl) => {
            const pct = (lvl.level / MAX_LEVEL) * 100;
            const active = lvl.level === level;
            return (
              <button
                key={lvl.level}
                type="button"
                onClick={() => onCommit(lvl.level)}
                className="absolute top-0 -translate-x-1/2 px-0.5 text-center"
                style={{ left: `${pct}%` }}
              >
                <span
                  className={cn(
                    "block font-mono text-[10px] tabular transition-colors",
                    active ? "text-accent" : "text-text-faint",
                  )}
                >
                  L{lvl.level}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block max-w-[58px] text-[10px] leading-tight transition-colors sm:max-w-[80px] sm:text-[11px]",
                    active
                      ? "font-semibold text-text"
                      : "text-text-faint group-hover:text-text-muted",
                  )}
                >
                  {lvl.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-text-muted">
        <ShieldCheck size={14} className="mt-px shrink-0 text-text-faint" />
        Drag the dial, click a stop, or use the arrow keys. Lower keeps a human
        in the loop; higher lets the AI act on its own.
      </p>
    </section>
  );
}

/* ---------------- THE MIND-BLOW · live review queue ---------------- */
function ReviewQueueCard({
  count,
  fullness,
  level,
  unattendedShare,
}: {
  count: number;
  fullness: number;
  level: number;
  unattendedShare: number;
}) {
  const meterColor =
    fullness > 66 ? "var(--negative)" : fullness > 33 ? "var(--live)" : "var(--positive)";

  return (
    <section className="relative flex flex-col overflow-hidden rounded-[14px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Label>Review queue</Label>
        <Pill variant={fullness > 33 ? "live" : "positive"} mono>
          <Sparkles size={12} /> live
        </Pill>
      </div>

      {/* big shrinking number */}
      <div className="mt-4 flex items-end gap-2">
        <AnimatedNumber
          value={count}
          className="font-display text-[56px] font-bold leading-none tracking-tight text-text sm:text-[64px]"
        />
        <span className="mb-1.5 text-sm text-text-muted">buyers to review</span>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
          <span>Queue fullness</span>
          <span className="tabular">{Math.round(fullness)}%</span>
        </div>
        <Meter value={fullness} color={meterColor} height={8} />
      </div>

      {/* unattended share, derived from level */}
      <div className="mt-5 rounded-[10px] border border-border bg-surface-2 p-3.5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-2xl font-bold tabular text-accent">
            ≈<AnimatedNumber value={unattendedShare} className="ml-0.5" />%
          </span>
          <span className="text-sm text-text-muted">
            of buyer chats now handled unattended
          </span>
        </div>
        <div className="mt-2.5">
          <Meter value={unattendedShare} color="var(--accent)" height={6} />
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-text-muted">
        Watch the review-queue shrink as the AI is trusted to book visits on its
        own.
      </p>

      <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-text-faint">
        <span
          className={cn(
            "rounded px-1.5 py-0.5",
            level === 0 ? "bg-accent-soft text-accent" : "bg-surface-inset",
          )}
        >
          L0 · you confirm everything
        </span>
        <ArrowRight size={12} />
        <span
          className={cn(
            "rounded px-1.5 py-0.5",
            level === MAX_LEVEL ? "bg-accent-soft text-accent" : "bg-surface-inset",
          )}
        >
          L4 · books visits unattended
        </span>
      </div>

      <Link
        href="/review"
        className="group mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-accent"
      >
        Open the review queue
        <ArrowRight
          size={15}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </section>
  );
}

/* ---------------- Scoring-weight tuner (secondary, local only) ---------------- */
function WeightTuner({
  weights,
  setWeights,
  isDefault,
}: {
  weights: Record<SignalCategory, number>;
  setWeights: React.Dispatch<React.SetStateAction<Record<SignalCategory, number>>>;
  isDefault: boolean;
}) {
  const reset = () => {
    setWeights(
      Object.fromEntries(
        SIGNAL_CATEGORIES.map((c) => [c, Math.round(DEFAULT_WEIGHTS[c] * 100)]),
      ) as Record<SignalCategory, number>,
    );
    toast.success("Scoring weights reset to defaults");
  };

  return (
    <section className="mt-4 rounded-[14px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Label>Scoring weights · org defaults</Label>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-text-muted">
            These weights define what &ldquo;a ready buyer&rdquo; means org-wide.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={isDefault}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border px-3.5 text-sm font-medium transition-colors",
            isDefault
              ? "cursor-not-allowed border-border text-text-faint"
              : "border-border-strong text-text-muted hover:text-text",
          )}
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
        {SIGNAL_CATEGORIES.map((cat) => (
          <div key={cat}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-text">{cat}</span>
              <span className="font-mono text-xs tabular text-text-muted">
                {weights[cat]}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={weights[cat]}
              aria-label={`${cat} weight`}
              onChange={(e) =>
                setWeights((w) => ({ ...w, [cat]: Number(e.target.value) }))
              }
              style={{ accentColor: "var(--accent)" }}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-pill bg-surface-inset"
            />
            <div className="mt-2">
              <Meter value={weights[cat]} color="var(--accent)" height={5} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
