"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  MessageCircle,
  PhoneIncoming,
  Globe,
  Mail,
  Check,
  ArrowRight,
  Sparkles,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { AnimatedNumber, StatusDot } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Motion presets                                                     */
/* ------------------------------------------------------------------ */
const SPRING = { type: "spring" as const, stiffness: 380, damping: 28 };
const SOFT_SPRING = { type: "spring" as const, stiffness: 220, damping: 24 };

type SourceState = "idle" | "connecting" | "connected";

/* ------------------------------------------------------------------ */
/*  Source catalogue — increments distributed to land on the totals:  */
/*  1,860 enquiries · 540 buyers · 73 new hot leads                    */
/* ------------------------------------------------------------------ */
type SourceDef = {
  id: string;
  name: string;
  blurb: string;
  icon: LucideIcon;
  tint: string;
  enquiries: number;
  buyers: number;
  hot: number;
};

const SOURCES: SourceDef[] = [
  {
    id: "99acres",
    name: "99acres",
    blurb: "Portal enquiry feed",
    icon: Building2,
    tint: "var(--accent)",
    enquiries: 540,
    buyers: 152,
    hot: 19,
  },
  {
    id: "magicbricks",
    name: "MagicBricks",
    blurb: "Portal enquiry feed",
    icon: Building2,
    tint: "var(--accent)",
    enquiries: 470,
    buyers: 138,
    hot: 17,
  },
  {
    id: "housing",
    name: "Housing.com",
    blurb: "Portal enquiry feed",
    icon: Building2,
    tint: "var(--accent)",
    enquiries: 330,
    buyers: 96,
    hot: 12,
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    blurb: "Two-way chat history",
    icon: MessageCircle,
    tint: "var(--positive)",
    enquiries: 290,
    buyers: 84,
    hot: 15,
  },
  {
    id: "ivr",
    name: "IVR / Missed-call",
    blurb: "Inbound call logs",
    icon: PhoneIncoming,
    tint: "var(--live)",
    enquiries: 150,
    buyers: 44,
    hot: 7,
  },
  {
    id: "website",
    name: "Website + email",
    blurb: "Forms & inbox",
    icon: Globe,
    tint: "var(--text-muted)",
    enquiries: 80,
    buyers: 26,
    hot: 3,
  },
];

// Sanity (totals): 540+470+330+290+150+80 = 1860 · 152+138+96+84+44+26 = 540 · 19+17+12+15+7+3 = 73

const CONNECT_MS = 700;

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */
export default function OnboardingPage() {
  const router = useRouter();
  const [states, setStates] = useState<Record<string, SourceState>>(
    () => Object.fromEntries(SOURCES.map((s) => [s.id, "idle"])),
  );

  const connectedIds = useMemo(
    () => SOURCES.filter((s) => states[s.id] === "connected").map((s) => s.id),
    [states],
  );
  const connectedCount = connectedIds.length;
  const allConnected = connectedCount === SOURCES.length;
  const anyConnected = connectedCount > 0;

  // Running totals: sum increments for every connected source.
  const totals = useMemo(() => {
    return SOURCES.reduce(
      (acc, s) => {
        if (states[s.id] === "connected") {
          acc.enquiries += s.enquiries;
          acc.buyers += s.buyers;
          acc.hot += s.hot;
        }
        return acc;
      },
      { enquiries: 0, buyers: 0, hot: 0 },
    );
  }, [states]);

  function connect(id: string) {
    setStates((prev) => {
      if (prev[id] !== "idle") return prev;
      return { ...prev, [id]: "connecting" };
    });
    window.setTimeout(() => {
      setStates((prev) => ({ ...prev, [id]: "connected" }));
    }, CONNECT_MS);
  }

  function connectAll() {
    const idle = SOURCES.filter((s) => states[s.id] === "idle");
    idle.forEach((s, i) => {
      // small cascade so the counters stream up rather than jump
      window.setTimeout(() => connect(s.id), i * 160);
    });
  }

  return (
    <div className="dark relative min-h-screen overflow-hidden bg-bg text-text">
      {/* ---- ambient background: gradient + faint drifting grid ---- */}
      <BackgroundFX />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
        {/* ---------------- Top: brand + kicker ---------------- */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SOFT_SPRING }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[12px] bg-accent-soft text-accent shadow-[var(--shadow-soft)] ring-1 ring-inset ring-[var(--border)]">
              <Sparkles size={18} strokeWidth={2.2} />
            </span>
            <div className="leading-tight">
              <div className="font-display text-xl font-700 tracking-tight">
                RelationOS
              </div>
              <div className="font-mono text-[11px] tracking-wide text-text-faint">
                thevertical.ai · real estate
              </div>
            </div>
          </div>

          <span className="glass inline-flex w-fit items-center gap-2 rounded-pill border border-border-strong px-3 py-1.5 text-xs font-medium text-text-muted">
            <span className="relative flex">
              <StatusDot color="var(--live)" pulse size={7} />
            </span>
            <span className="font-mono text-[11px] tracking-wide uppercase">
              First run · omni-channel hub
            </span>
          </span>
        </motion.header>

        {/* ---------------- Headline ---------------- */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SOFT_SPRING, delay: 0.08 }}
          className="mt-12 sm:mt-16"
        >
          <h1 className="font-display text-4xl font-700 leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl">
            Connect your sources.
          </h1>
          <p className="mt-4 max-w-xl text-base text-text-muted sm:text-lg">
            One click each. Watch the CRM back-fill from your portals and
            WhatsApp — before you&apos;ve done anything.
          </p>
        </motion.div>

        {/* ---------------- Live counter strip (the mind-blow) ---------------- */}
        <LiveCounter
          totals={totals}
          allConnected={allConnected}
          anyConnected={anyConnected}
        />

        {/* ---------------- Source tiles ---------------- */}
        <div className="mt-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="label">
              Sources · {connectedCount}/{SOURCES.length} connected
            </span>
            <button
              onClick={connectAll}
              disabled={allConnected}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-xs font-semibold transition-colors",
                allConnected
                  ? "cursor-default border-border bg-surface-2 text-text-faint"
                  : "border-accent/60 bg-accent-soft text-accent hover:bg-accent-soft/80",
              )}
            >
              {allConnected ? (
                <>
                  <Check size={13} strokeWidth={2.5} /> All connected
                </>
              ) : (
                <>
                  <Sparkles size={13} /> Connect all
                </>
              )}
            </button>
          </div>

          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.06, delayChildren: 0.16 } },
            }}
            className="grid grid-cols-2 gap-3 md:grid-cols-3"
          >
            {SOURCES.map((s) => (
              <SourceTile
                key={s.id}
                def={s}
                state={states[s.id]}
                onConnect={() => connect(s.id)}
              />
            ))}
          </motion.div>
        </div>

        {/* ---------------- Bottom CTA ---------------- */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-auto flex flex-col items-start gap-4 pt-10 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <button
              onClick={() => router.push("/worklist")}
              disabled={!anyConnected}
              className={cn(
                "group inline-flex h-12 items-center gap-2 rounded-[14px] px-6 text-sm font-semibold transition-all",
                anyConnected
                  ? "bg-accent text-accent-contrast shadow-[0_0_28px_-6px_var(--accent)] hover:scale-[1.02] active:scale-95"
                  : "cursor-not-allowed bg-surface-2 text-text-faint",
              )}
            >
              Enter RelationOS
              <ArrowRight
                size={17}
                strokeWidth={2.4}
                className={cn(
                  "transition-transform",
                  anyConnected && "group-hover:translate-x-0.5",
                )}
              />
            </button>
            <AnimatePresence>
              {!anyConnected && (
                <motion.span
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="pl-1 text-xs text-text-faint"
                >
                  Connect at least one source to continue.
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => router.push("/worklist")}
            className="text-sm font-medium text-text-faint underline-offset-4 transition-colors hover:text-text-muted hover:underline"
          >
            Skip for now
          </button>
        </motion.div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Background FX                                                       */
/* ================================================================== */
function BackgroundFX() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* base gradient using bg-grad tokens */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 18% 0%, var(--bg-grad-a) 0%, var(--bg-grad-b) 58%, var(--bg) 100%)",
        }}
      />
      {/* accent glow */}
      <div
        className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-[0.18] blur-[120px]"
        style={{ background: "var(--accent)" }}
      />
      {/* faint drifting grid */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage:
            "radial-gradient(110% 80% at 50% 0%, #000 30%, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(110% 80% at 50% 0%, #000 30%, transparent 85%)",
          animation: "gridDrift 14s linear infinite",
        }}
      />
    </div>
  );
}

/* ================================================================== */
/*  Live counter strip                                                 */
/* ================================================================== */
function LiveCounter({
  totals,
  allConnected,
  anyConnected,
}: {
  totals: { enquiries: number; buyers: number; hot: number };
  allConnected: boolean;
  anyConnected: boolean;
}) {
  const stats = [
    { label: "enquiries imported", value: totals.enquiries, color: "var(--text)" },
    { label: "buyers", value: totals.buyers, color: "var(--text)" },
    { label: "new hot leads", value: totals.hot, color: "var(--live)" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SOFT_SPRING, delay: 0.14 }}
      className="glass mt-9 overflow-hidden rounded-[14px] border border-border shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <StatusDot
            color={anyConnected ? "var(--positive)" : "var(--text-faint)"}
            pulse={anyConnected && !allConnected}
            size={8}
          />
          <span className="label !text-text-muted">
            as the CRM back-fills from portal history
          </span>
        </div>
        <AnimatePresence>
          {allConnected && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
              className="inline-flex w-fit items-center gap-1.5 rounded-pill bg-positive-soft px-2.5 py-1 text-xs font-semibold text-positive"
            >
              <Check size={12} strokeWidth={3} /> Complete
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-3 divide-x divide-[var(--border)] border-t border-border">
        {stats.map((s) => (
          <div key={s.label} className="px-3 py-4 sm:px-6 sm:py-5">
            <div
              className="font-display text-2xl font-700 tabular leading-none sm:text-4xl lg:text-5xl"
              style={{ color: s.color }}
            >
              <AnimatedNumber value={s.value} />
            </div>
            <div className="mt-2 text-[11px] font-medium text-text-faint sm:text-xs">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ================================================================== */
/*  Source tile                                                        */
/* ================================================================== */
function SourceTile({
  def,
  state,
  onConnect,
}: {
  def: SourceDef;
  state: SourceState;
  onConnect: () => void;
}) {
  const Icon = def.icon;
  const connected = state === "connected";
  const connecting = state === "connecting";

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16, scale: 0.97 },
        show: { opacity: 1, y: 0, scale: 1, transition: SPRING },
      }}
      className={cn(
        "relative flex flex-col gap-3 rounded-[14px] border bg-surface/70 p-4 backdrop-blur-sm transition-colors",
        connected
          ? "border-accent shadow-[0_0_24px_-12px_var(--accent)]"
          : "border-border",
      )}
    >
      <div className="flex items-start justify-between">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-[12px]"
          style={{
            background: `color-mix(in oklab, ${def.tint} 16%, transparent)`,
            color: def.tint,
          }}
        >
          <Icon size={19} strokeWidth={2.1} />
        </span>

        {/* connected check chip top-right */}
        <AnimatePresence>
          {connected && (
            <motion.span
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={SPRING}
              className="grid size-5 place-items-center rounded-full bg-positive text-[var(--bg)]"
            >
              <Check size={12} strokeWidth={3.2} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="min-w-0">
        <div className="truncate font-semibold text-text">{def.name}</div>
        <div className="truncate text-xs text-text-faint">{def.blurb}</div>
      </div>

      {/* ---- status / action area ---- */}
      <div className="mt-auto h-9">
        <AnimatePresence mode="wait" initial={false}>
          {state === "idle" && (
            <motion.button
              key="connect"
              onClick={onConnect}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-border-strong bg-surface-2 text-xs font-semibold text-text transition-colors hover:border-accent/60 hover:text-accent active:scale-[0.98]"
            >
              Connect
            </motion.button>
          )}

          {connecting && (
            <motion.div
              key="connecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-surface-inset text-xs font-medium text-text-muted"
            >
              <Loader2 size={13} className="animate-spin" />
              Connecting…
            </motion.div>
          )}

          {connected && (
            <motion.div
              key="connected"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-[10px] bg-positive-soft text-xs font-semibold text-positive"
            >
              <StatusDot color="var(--positive)" pulse size={7} />
              Connected
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
