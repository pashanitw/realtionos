"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Check,
  TriangleAlert,
  CalendarX,
  Trophy,
  KeyRound,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Avatar, Pill } from "@/components/ui/primitives";
import { STAGES, type Stage, type Deal } from "@/lib/data/types";
import { cn, rupees, SEED_NOW } from "@/lib/utils";
import { toast } from "sonner";

const DAY = 86_400_000;
const CARD_SPRING = { type: "spring" as const, stiffness: 360, damping: 32 };

/* Progressive accent across the 7 stages: faint enquiry → positive registered. */
const STAGE_ACCENT: Record<Stage, string> = {
  "New Enquiry": "var(--text-faint)",
  Qualified: "var(--text-muted)",
  "Site Visit Scheduled": "var(--accent)",
  Visited: "var(--accent)",
  Negotiation: "var(--live)",
  Booked: "var(--positive)",
  Registered: "var(--positive)",
};

const STAGE_ICON: Partial<Record<Stage, typeof KeyRound>> = {
  Booked: KeyRound,
  Registered: Trophy,
};

export default function PipelinePage() {
  const deals = useStore((s) => s.deals);
  const acceptSuggestion = useStore((s) => s.acceptSuggestion);

  const suggestionCount = useMemo(
    () => deals.filter((d) => d.suggestion).length,
    [deals],
  );

  /** Bucket deals into their stage column, preserving store order. */
  const byStage = useMemo(() => {
    const map = new Map<Stage, Deal[]>();
    for (const stage of STAGES) map.set(stage, []);
    for (const deal of deals) map.get(deal.stage)?.push(deal);
    return map;
  }, [deals]);

  return (
    <PageContainer>
      <PageHeader
        kicker="Site-visit-centric stages"
        title="Pipeline"
        description="The board maintains itself. Conversations move buyers from enquiry to booking — and it asks permission before each move."
        actions={
          suggestionCount > 0 ? (
            <Pill variant="live" className="h-9 px-3.5 text-[13px]">
              <span className="live-dot relative mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-live" />
              <Sparkles size={13} />
              {suggestionCount} suggestion{suggestionCount === 1 ? "" : "s"} waiting
            </Pill>
          ) : undefined
        }
      />

      <LayoutGroup>
        <div className="flex gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
          {STAGES.map((stage, i) => (
            <StageColumn
              key={stage}
              stage={stage}
              index={i}
              deals={byStage.get(stage) ?? []}
              onAccept={acceptSuggestion}
            />
          ))}
        </div>
      </LayoutGroup>
    </PageContainer>
  );
}

/* ---------------- Stage column ---------------- */
function StageColumn({
  stage,
  index,
  deals,
  onAccept,
}: {
  stage: Stage;
  index: number;
  deals: Deal[];
  onAccept: (dealId: string) => void;
}) {
  const accent = STAGE_ACCENT[stage];
  const Icon = STAGE_ICON[stage];
  const total = useMemo(
    () => deals.reduce((sum, d) => sum + d.valueInr, 0),
    [deals],
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      className="flex w-[300px] shrink-0 flex-col"
    >
      {/* Thin progressive top accent */}
      <div
        className="h-[3px] w-full rounded-pill"
        style={{ background: accent, opacity: 0.85 }}
      />

      {/* Column header */}
      <div className="mb-3 mt-3 px-1">
        <div className="flex items-center gap-2">
          {Icon && (
            <span
              className="grid h-5 w-5 place-items-center rounded-md"
              style={{
                background: "color-mix(in oklab, var(--positive) 16%, transparent)",
                color: "var(--positive)",
              }}
            >
              <Icon size={13} strokeWidth={2.2} />
            </span>
          )}
          <h2 className="font-display text-[15px] font-bold tracking-tight text-text">
            {stage}
          </h2>
          <span className="tabular ml-auto rounded-pill bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-muted">
            {deals.length}
          </span>
        </div>
        <div className="tabular mt-1 font-mono text-[11px] text-text-faint">
          {rupees(total)}
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-3 rounded-[14px]">
        <AnimatePresence initial={false}>
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onAccept={onAccept} />
          ))}
        </AnimatePresence>

        {deals.length === 0 && (
          <div className="grid min-h-[88px] place-items-center rounded-[14px] border border-dashed border-border text-xs text-text-faint">
            No deals
          </div>
        )}
      </div>
    </motion.section>
  );
}

/* ---------------- Deal card ---------------- */
function DealCard({
  deal,
  onAccept,
}: {
  deal: Deal;
  onAccept: (dealId: string) => void;
}) {
  const days = Math.round((deal.closeDate - SEED_NOW) / DAY);
  const closeLabel = days <= 0 ? "today" : `in ${days}d`;

  const handleAccept = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Capture before the store clears the suggestion.
    const toStage = deal.suggestion?.toStage;
    onAccept(deal.id);
    if (toStage) toast.success(`${deal.name} → ${toStage}`);
  };

  return (
    <motion.div
      layout
      layoutId={deal.id}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ layout: CARD_SPRING, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}
      className="group"
    >
      <Link
        href={`/buyers/${deal.buyerId}`}
        className={cn(
          "block rounded-[14px] border border-border bg-surface p-3.5 shadow-[var(--shadow-soft)]",
          "transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong",
        )}
      >
        {/* Buyer name + agent avatar */}
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate font-semibold leading-tight text-text">
            {deal.name}
          </span>
          <Avatar name={deal.agentInitials} hue={deal.hue} size={24} />
        </div>

        {/* Project + unit */}
        <div className="mt-1 truncate text-sm text-text-muted">
          {deal.project} · {deal.unitLabel}
        </div>

        {/* Value + close date */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="tabular font-display text-[15px] font-semibold text-text">
            {rupees(deal.valueInr)}
          </span>
          <span className="tabular font-mono text-[11px] text-text-faint">
            closes {closeLabel}
          </span>
        </div>

        {/* Flags + token */}
        {(deal.tokenInr || deal.stalled || deal.noShow) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {deal.tokenInr ? (
              <Pill variant="positive">Token {rupees(deal.tokenInr)}</Pill>
            ) : null}
            {deal.stalled && <Pill variant="negative">Stalled</Pill>}
            {deal.noShow && (
              <Pill variant="negative">
                <CalendarX size={11} /> No-show
              </Pill>
            )}
          </div>
        )}

        {/* AI suggestion chip */}
        <AnimatePresence>
          {deal.suggestion && (
            <motion.div
              key="suggestion"
              initial={{ opacity: 0, height: 0, y: -4 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -4 }}
              transition={{ duration: 0.3, ease: [0.34, 1.4, 0.5, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-[10px] bg-live-soft p-2.5 text-live">
                <div className="flex items-start gap-1.5 text-[12px] leading-snug">
                  <Sparkles size={13} className="mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <ArrowRight size={12} /> {deal.suggestion.toStage}?
                    </span>{" "}
                    <span className="text-live/90">{deal.suggestion.reason}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAccept}
                  className={cn(
                    "mt-2 flex w-full items-center justify-center gap-1.5 rounded-[8px] bg-live px-3 py-1.5",
                    "text-[12px] font-semibold text-accent-contrast",
                    "transition-transform hover:scale-[1.01] active:scale-95",
                  )}
                >
                  <Check size={13} strokeWidth={2.6} /> Accept move
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Link>
    </motion.div>
  );
}
