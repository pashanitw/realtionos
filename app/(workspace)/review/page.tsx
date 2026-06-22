"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Check, X, ShieldCheck, Sparkles, GitMerge, ArrowRight, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Avatar, Pill, Meter } from "@/components/ui/primitives";
import { SOURCE_LABEL, type ReviewItem, type ReviewKind } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring" as const, stiffness: 320, damping: 30 };

const KIND_PILL: Record<
  ReviewKind,
  { variant: "accent" | "neutral" | "live"; label: string }
> = {
  "new-lead": { variant: "accent", label: "New buyer" },
  "field-update": { variant: "neutral", label: "Field update" },
  "auto-action": { variant: "live", label: "Auto-action" },
  duplicate: { variant: "live", label: "Possible duplicate" },
};

function confidenceColor(n: number): string {
  if (n >= 90) return "var(--positive)";
  if (n >= 75) return "var(--accent)";
  return "var(--live)";
}

export default function ReviewPage() {
  const reviewItems = useStore((s) => s.reviewItems);

  return (
    <PageContainer>
      <PageHeader
        kicker="Approve / dismiss · de-dupe"
        title="Review queue"
        description="Auto-created buyers and proposed updates — each with its source and a confidence meter. The automation is powerful and on a leash."
        actions={
          <div className="flex flex-col items-end">
            <span className="font-display text-2xl font-bold leading-none text-text tabular">
              {reviewItems.length}
            </span>
            <span className="label mt-1">pending</span>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[760px]">
        <LayoutGroup>
          <AnimatePresence initial={false} mode="popLayout">
            {reviewItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                className="mb-4 last:mb-0"
                transition={{ layout: SPRING }}
              >
                <ReviewCard item={item} />
              </motion.div>
            ))}
          </AnimatePresence>
        </LayoutGroup>

        {reviewItems.length === 0 && <EmptyState />}
      </div>
    </PageContainer>
  );
}

/* ---------------- Review card (router) ---------------- */
function ReviewCard({ item }: { item: ReviewItem }) {
  const approveReview = useStore((s) => s.approveReview);
  const dismissReview = useStore((s) => s.dismissReview);
  const mergeDuplicate = useStore((s) => s.mergeDuplicate);

  // "exit" = slide out + fade (approve / merge). "dismissed" = quiet acknowledgement.
  const [phase, setPhase] = useState<"idle" | "approving" | "dismissed">("idle");

  function handleApprove() {
    if (phase !== "idle") return;
    setPhase("approving");
    toast.success("Approved — flows into the record live");
    setTimeout(() => approveReview(item.id), 280);
  }

  function handleMerge() {
    if (phase !== "idle") return;
    setPhase("approving");
    toast.success("Merged — two enquiries, one buyer, one timeline");
    setTimeout(() => mergeDuplicate(item.id), 280);
  }

  function handleDismiss() {
    if (phase !== "idle") return;
    setPhase("dismissed");
    setTimeout(() => dismissReview(item.id), 900);
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {phase === "dismissed" ? (
        <motion.div
          key="dismissed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-3 rounded-[14px] border border-border bg-surface px-5 py-6 text-sm text-text-muted shadow-[var(--shadow-soft)]"
        >
          <Sparkles size={16} className="text-text-faint" />
          Got it — I&apos;ll learn from that.
        </motion.div>
      ) : (
        <motion.div
          key="card"
          animate={
            phase === "approving"
              ? { opacity: 0, x: 64 }
              : { opacity: 1, x: 0 }
          }
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.34, 1.4, 0.5, 1] }}
        >
          {item.kind === "duplicate" ? (
            <DuplicateCard
              item={item}
              onMerge={handleMerge}
              onDismiss={handleDismiss}
            />
          ) : (
            <NormalCard
              item={item}
              onApprove={handleApprove}
              onDismiss={handleDismiss}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Source excerpt evidence block ---------------- */
function SourceExcerpt({ item }: { item: ReviewItem }) {
  return (
    <div className="rounded-[10px] border-l-2 border-accent bg-surface-inset px-3.5 py-2.5">
      <p className="text-sm italic leading-relaxed text-text-muted">
        &ldquo;{item.sourceExcerpt}&rdquo;
      </p>
      <p className="label mt-1.5">from {SOURCE_LABEL[item.source]}</p>
    </div>
  );
}

/* ---------------- Confidence meter row ---------------- */
function ConfidenceRow({ value }: { value: number }) {
  const color = confidenceColor(value);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label">Confidence</span>
        <span className="font-mono text-xs font-medium tabular" style={{ color }}>
          {value}%
        </span>
      </div>
      <Meter value={value} color={color} height={6} />
    </div>
  );
}

/* ---------------- Action buttons ---------------- */
function ApproveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-contrast shadow-[0_0_22px_-8px_var(--accent)] transition-transform hover:scale-[1.015] active:scale-95"
    >
      <Check size={16} strokeWidth={2.4} /> Approve
    </button>
  );
}

function DismissButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 items-center justify-center gap-2 rounded-[10px] border border-border-strong px-4 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
    >
      <X size={15} strokeWidth={2.2} /> {children ?? "Dismiss"}
    </button>
  );
}

/* ---------------- Normal card ---------------- */
function NormalCard({
  item,
  onApprove,
  onDismiss,
}: {
  item: ReviewItem;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const kind = KIND_PILL[item.kind];

  return (
    <div className="flex flex-col gap-4 rounded-[14px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar name={item.buyerName} hue={item.hue} size={40} />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Pill variant={kind.variant}>{kind.label}</Pill>
            <span className="font-mono text-[11px] uppercase tracking-wide text-text-faint">
              {SOURCE_LABEL[item.source]}
            </span>
          </div>
          <p className="font-medium leading-snug text-text">{item.title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-text-muted">{item.detail}</p>
        </div>
      </div>

      <SourceExcerpt item={item} />
      <ConfidenceRow value={item.confidence} />

      <div className="flex items-center gap-2.5">
        <ApproveButton onClick={onApprove} />
        <DismissButton onClick={onDismiss} />
      </div>
    </div>
  );
}

/* ---------------- Duplicate / merge card ---------------- */
function MergeRecord({
  source,
  label,
}: {
  source: ReviewItem["source"];
  label: string;
}) {
  return (
    <div className="flex-1 rounded-[10px] border border-border bg-surface-2 px-3.5 py-3">
      <p className="font-mono text-[11px] uppercase tracking-wide text-live">
        {SOURCE_LABEL[source]}
      </p>
      <p className="mt-1 text-sm leading-snug text-text">{label}</p>
    </div>
  );
}

function DuplicateCard({
  item,
  onMerge,
  onDismiss,
}: {
  item: ReviewItem;
  onMerge: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="relative flex flex-col gap-4 overflow-hidden rounded-[14px] border border-live/60 bg-surface p-4 shadow-[var(--shadow-soft)] sm:p-5">
      {/* amber wash to distinguish the real-estate-specific win */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--live), transparent)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-0 opacity-[0.5]"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, var(--live-soft), transparent 60%)",
        }}
      />

      <div className="relative flex flex-wrap items-center gap-2">
        <Pill variant="live">
          <GitMerge size={11} /> {KIND_PILL.duplicate.label}
        </Pill>
        <span className="font-mono text-[11px] uppercase tracking-wide text-text-faint">
          Same person · two enquiries
        </span>
      </div>

      <div className="relative flex items-start gap-3">
        <Avatar name={item.buyerName} hue={item.hue} size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug text-text">{item.title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-text-muted">{item.detail}</p>
        </div>
      </div>

      {/* the two records, side by side */}
      <div className="relative flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <MergeRecord
          source={item.mergeFrom?.source ?? item.source}
          label={item.mergeFrom?.label ?? item.buyerName}
        />
        <div className="flex shrink-0 items-center justify-center sm:flex-col">
          <span className="grid size-8 place-items-center rounded-full border border-live/50 bg-live-soft text-live">
            <ArrowRight size={15} className="sm:hidden" />
            <GitMerge size={15} className="hidden sm:block" />
          </span>
        </div>
        <MergeRecord
          source={item.mergeInto?.source ?? item.source}
          label={item.mergeInto?.label ?? item.buyerName}
        />
      </div>

      <div className="relative rounded-[10px] border-l-2 border-live bg-surface-inset px-3.5 py-2.5">
        <p className="text-sm font-medium text-text">
          {item.buyerName}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">Same phone, same requirement</p>
      </div>

      <div className="relative">
        <ConfidenceRow value={item.confidence} />
      </div>

      <div className="relative flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <button
          onClick={onMerge}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] bg-live px-4 text-sm font-semibold text-[#1b1205] shadow-[0_0_22px_-8px_var(--live)] transition-transform hover:scale-[1.015] active:scale-95"
        >
          <GitMerge size={16} strokeWidth={2.4} /> Merge into one buyer
        </button>
        <DismissButton onClick={onDismiss}>Not a match</DismissButton>
      </div>
    </div>
  );
}

/* ---------------- Empty state ---------------- */
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: 0.05 }}
      className="flex flex-col items-center gap-4 rounded-[14px] border border-border bg-surface px-6 py-16 text-center shadow-[var(--shadow-soft)]"
    >
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...SPRING, delay: 0.1 }}
        className="grid size-16 place-items-center rounded-full bg-positive-soft text-positive"
      >
        <ShieldCheck size={32} strokeWidth={2} />
      </motion.span>
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-text">
          Queue clear — the automation is keeping up
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
          Every auto-created buyer and proposed update has been reviewed. Higher
          Autonomy means fewer items ever reach here — the AI handles more on its own.
        </p>
      </div>
      <Link
        href="/settings/autonomy"
        className="group flex items-center gap-1.5 rounded-pill border border-border-strong px-4 py-2 text-sm font-medium text-text transition-colors hover:border-accent hover:text-accent"
      >
        Tune Autonomy
        <ArrowUpRight
          size={15}
          className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </Link>
    </motion.div>
  );
}
