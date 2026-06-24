"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Mic, Check, X, Pencil, Sparkles, ShieldCheck, GitMerge, Paperclip, Zap, ChevronDown,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useScopedReviewItems } from "@/lib/roles";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { useConfirm } from "@/components/ui/confirm";
import { Avatar, Pill, Meter, ChannelIcon } from "@/components/ui/primitives";
import { SOURCE_LABEL, type ReviewItem, type ReviewKind } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const KIND_META: Record<ReviewKind, { label: string; variant: "accent" | "neutral" | "live" }> = {
  outbound: { label: "Outbound", variant: "live" },
  "new-lead": { label: "New lead", variant: "accent" },
  sequence: { label: "Sequence", variant: "neutral" },
  "stage-move": { label: "Stage move", variant: "accent" },
  "field-update": { label: "Field update", variant: "neutral" },
  duplicate: { label: "Duplicate", variant: "live" },
};
const KIND_ORDER: ReviewKind[] = ["outbound", "new-lead", "sequence", "stage-move", "field-update", "duplicate"];

function confidenceColor(n: number): string {
  if (n >= 90) return "var(--positive)";
  if (n >= 75) return "var(--accent)";
  return "var(--live)";
}
const isSafe = (i: ReviewItem) => i.confidence >= 90 && i.kind !== "duplicate";

export default function ApprovalsPage() {
  const items = useScopedReviewItems();
  const approveReview = useStore((s) => s.approveReview);
  const dismissReview = useStore((s) => s.dismissReview);
  const mergeDuplicate = useStore((s) => s.mergeDuplicate);
  const confirm = useConfirm();
  const [filter, setFilter] = useState<ReviewKind | "all">("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    items.forEach((i) => (c[i.kind] = (c[i.kind] ?? 0) + 1));
    return c;
  }, [items]);

  const filtered = filter === "all" ? items : items.filter((i) => i.kind === filter);
  const safeCount = items.filter(isSafe).length;

  async function handleApprove(item: ReviewItem) {
    if (item.kind === "duplicate") {
      const ok = await confirm({ title: `Merge ${item.buyerName} into one buyer?`, description: "Two enquiries collapse into a single buyer with a combined timeline. Reversible.", confirmLabel: "Merge buyers", tone: "accent" });
      if (ok) { mergeDuplicate(item.id); toast.success("Merged — one buyer, one timeline"); }
      return;
    }
    const ok = await confirm({ title: `${item.cta}: ${item.title}?`, description: "This commits the AI-drafted action to the live record.", confirmLabel: item.cta, tone: "accent" });
    if (ok) { approveReview(item.id); toast.success(`${item.cta} — done`, { description: item.buyerName }); }
  }

  function handleDismiss(item: ReviewItem) {
    dismissReview(item.id);
    toast("Got it — I'll learn from that", { description: item.buyerName });
  }

  async function approveAllSafe() {
    const safe = items.filter(isSafe);
    if (!safe.length) return;
    const ok = await confirm({ title: `Send all ${safe.length} safe actions?`, description: "Approves every high-confidence action (≥90%) at once. Duplicates and low-confidence items are left for you.", confirmLabel: `Approve ${safe.length}`, tone: "accent" });
    if (!ok) return;
    safe.forEach((i) => approveReview(i.id));
    toast.success(`Approved ${safe.length} actions`, { description: "the safe queue is clear" });
  }

  // keyboard: A approve · X dismiss (acts on the first item in view)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const first = filtered[0];
      if (!first) return;
      if (e.key.toLowerCase() === "a") { e.preventDefault(); handleApprove(first); }
      if (e.key.toLowerCase() === "x") { e.preventDefault(); handleDismiss(first); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  return (
    <PageContainer className="max-w-[1120px]">
      <PageHeader title="Approvals" description="RelationOS did the work — you just say the word." />

      <SpeakBanner count={items.length} />

      {/* tabs + approve all */}
      <div className="mb-4 mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex h-9 w-full items-center rounded-[10px] border border-border bg-surface sm:w-auto">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ReviewKind | "all")}
            className="h-full w-full cursor-pointer appearance-none bg-transparent pl-3 pr-9 text-sm font-medium text-text outline-none"
          >
            <option value="all">All approvals ({counts.all})</option>
            {KIND_ORDER.filter((k) => counts[k]).map((k) => (
              <option key={k} value={k}>{KIND_META[k].label} ({counts[k]})</option>
            ))}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-2.5 text-text-faint" />
        </div>
        <button
          onClick={approveAllSafe}
          disabled={safeCount === 0}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3.5 text-sm font-medium text-text transition-colors hover:border-border-strong disabled:opacity-40"
        >
          <Zap size={14} className="text-accent" /> Approve all safe
          {safeCount > 0 && <span className="font-mono text-xs text-text-faint">({safeCount})</span>}
        </button>
      </div>

      <div className="space-y-4">
        <AnimatePresence initial={false} mode="popLayout">
          {filtered.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 60 }}
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
            >
              <ApprovalCard item={item} onApprove={() => handleApprove(item)} onDismiss={() => handleDismiss(item)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && <EmptyState all={items.length === 0} />}
    </PageContainer>
  );
}

/* ---------------- speak banner ---------------- */
function SpeakBanner({ count }: { count: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[16px] border border-chrome-border p-5 text-white shadow-[var(--shadow-lift)]"
      style={{ background: "linear-gradient(125deg, #0c4a45 0%, #082c27 55%, #0a0d11 100%)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(520px 220px at 90% -20%, color-mix(in oklab, var(--live) 28%, transparent), transparent 70%)" }} />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[rgba(255,255,255,0.1)] text-[#43c9b8]"><Mic size={18} /></span>
          <div>
            <h2 className="font-display text-lg font-bold">Clear the queue by speaking</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/75">
              RelationOS did the work. You just say the word — “approve the payment link,” “hold the stage move,” “send them all.”
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <span className="rounded-pill bg-[rgba(255,255,255,0.12)] px-3 py-1 font-mono text-[12px] font-semibold text-[#f0b271]">
            {count} awaiting your nod
          </span>
          <span className="font-mono text-[11px] text-white/55">
            or press <Kbd>A</Kbd> approve · <Kbd>X</Kbd> dismiss
          </span>
        </div>
      </div>
    </motion.div>
  );
}
function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-white/20 bg-white/10 px-1 font-mono text-[10px]">{children}</kbd>;
}

/* ---------------- approval card ---------------- */
function ApprovalCard({ item, onApprove, onDismiss }: { item: ReviewItem; onApprove: () => void; onDismiss: () => void }) {
  const meta = KIND_META[item.kind];
  const cColor = confidenceColor(item.confidence);
  const isDup = item.kind === "duplicate";

  return (
    <div className={cn("rounded-[14px] border bg-surface p-4 shadow-[var(--shadow-soft)] sm:p-5", isDup ? "border-live/50" : "border-border")}>
      {/* head */}
      <div className="flex items-center gap-2.5">
        {item.channel ? <ChannelIcon channel={item.channel} size={14} withBg /> : <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent"><Sparkles size={14} /></span>}
        <Pill variant={meta.variant}>{meta.label}</Pill>
        <span className="truncate font-mono text-[11px] text-text-faint">{item.leadId} · {item.buyerName}</span>
      </div>

      <h3 className="mt-2.5 font-semibold leading-snug text-text">{item.title}</h3>

      {/* why */}
      <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-relaxed text-text-muted">
        <Sparkles size={13} className="mt-0.5 shrink-0 text-accent" />
        <span><span className="font-semibold text-text">Why:</span> {item.why}</span>
      </p>

      {/* body */}
      <div className="mt-3 rounded-[10px] border border-border bg-surface-inset px-3.5 py-2.5 text-sm leading-relaxed text-text-muted">
        {item.body}
      </div>

      {/* duplicate: the two records */}
      {isDup && item.mergeFrom && item.mergeInto && (
        <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <MergeRecord source={item.mergeFrom.source} label={item.mergeFrom.label} />
          <span className="grid size-8 shrink-0 place-items-center self-center rounded-full border border-live/50 bg-live-soft text-live"><GitMerge size={15} /></span>
          <MergeRecord source={item.mergeInto.source} label={item.mergeInto.label} />
        </div>
      )}

      {/* footer: attachment · confidence · autonomy */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
        {item.attachment && (
          <span className="flex items-center gap-1.5 text-text-faint"><Paperclip size={12} /> {item.attachment}</span>
        )}
        <span className="flex flex-1 items-center justify-end gap-2">
          <span className="label">confidence</span>
          <span className="w-20"><Meter value={item.confidence} color={cColor} height={5} /></span>
          <span className="font-mono font-semibold tabular" style={{ color: cColor }}>{item.confidence}%</span>
        </span>
        <span className="w-full rounded-md bg-surface-2 px-2 py-1 text-center font-mono text-[10px] text-text-muted sm:w-auto">{item.autonomyLabel}</span>
      </div>

      {/* actions */}
      <div className="mt-4 flex items-center gap-2.5">
        <button
          onClick={onApprove}
          className={cn(
            "flex h-10 items-center justify-center gap-1.5 rounded-[10px] px-5 text-sm font-semibold shadow-[0_0_22px_-8px_var(--accent)] transition-transform hover:scale-[1.015] active:scale-95",
            isDup ? "bg-live text-[#1b1205]" : "bg-accent text-accent-contrast",
          )}
        >
          {isDup ? <GitMerge size={15} strokeWidth={2.4} /> : <Check size={15} strokeWidth={2.4} />} {item.cta}
        </button>
        {!isDup && (
          <button onClick={() => toast("Opening the draft to edit…", { description: item.title })} className="flex h-10 items-center gap-1.5 rounded-[10px] border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2">
            <Pencil size={14} /> Edit first
          </button>
        )}
        <button onClick={onDismiss} className="ml-auto flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium text-text-faint transition-colors hover:text-negative">
          {isDup ? "Not a match" : "Dismiss"}
        </button>
      </div>
    </div>
  );
}

function MergeRecord({ source, label }: { source: ReviewItem["source"]; label: string }) {
  return (
    <div className="flex-1 rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5">
      <p className="font-mono text-[11px] uppercase tracking-wide text-live">{SOURCE_LABEL[source]}</p>
      <p className="mt-0.5 text-sm leading-snug text-text">{label}</p>
    </div>
  );
}

/* ---------------- empty ---------------- */
function EmptyState({ all }: { all: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 rounded-[14px] border border-border bg-surface px-6 py-16 text-center shadow-[var(--shadow-soft)]"
    >
      <span className="grid size-16 place-items-center rounded-full bg-positive-soft text-positive"><ShieldCheck size={32} strokeWidth={2} /></span>
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-text">
          {all ? "Queue clear — the automation is keeping up" : "Nothing here in this filter"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
          Every AI-drafted action has been approved or dismissed — the automation is keeping the queue clear.
        </p>
      </div>
    </motion.div>
  );
}
