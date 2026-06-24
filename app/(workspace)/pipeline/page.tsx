"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Sparkles, ArrowRight, Check, CalendarX, Trophy, KeyRound, GripVertical,
  FileText, X, ReceiptText, Flame, Snowflake, Plus, SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { useScopedDeals } from "@/lib/roles";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Avatar, Pill, Label } from "@/components/ui/primitives";
import { STAGES, isBooked, interestOf, INTERESTS, type Interest, type Stage, type Deal } from "@/lib/data/types";
import { cn, rupees, SEED_NOW } from "@/lib/utils";

const DAY = 86_400_000;
const CARD_SPRING = { type: "spring" as const, stiffness: 360, damping: 32 };

type PillVariant = "neutral" | "accent" | "live" | "positive" | "negative" | "outline";

/* Lead temperature / interest (PRD §2.1) layered over the journey stages. */
const INTEREST_META: Record<Interest, { variant: PillVariant; icon: typeof Flame }> = {
  New: { variant: "accent", icon: Sparkles },
  Hot: { variant: "negative", icon: Flame },
  Warm: { variant: "live", icon: Flame },
  Cold: { variant: "neutral", icon: Snowflake },
  Interested: { variant: "positive", icon: Check },
  "Not Interested": { variant: "outline", icon: X },
};

/* Progressive accent across the journey: faint enquiry → positive handover. */
const STAGE_ACCENT: Record<Stage, string> = {
  "New Enquiry": "var(--text-faint)",
  Qualified: "var(--text-muted)",
  "Site Visit Scheduled": "var(--accent)",
  "Site Visit Completed": "var(--accent)",
  "Unit Selected": "var(--accent)",
  "Booking Amount Paid": "var(--live)",
  "Booking Confirmed": "var(--positive)",
  "Agreement Signed": "var(--positive)",
  "Loan Sanction": "var(--positive)",
  Registration: "var(--positive)",
  Handover: "var(--positive)",
};

const STAGE_ICON: Partial<Record<Stage, typeof KeyRound>> = {
  "Booking Confirmed": KeyRound,
  Registration: Trophy,
  Handover: Trophy,
};

export default function PipelinePage() {
  const deals = useScopedDeals();
  const buyers = useStore((s) => s.buyers);
  const moveDeal = useStore((s) => s.moveDeal);
  const pushActivity = useStore((s) => s.pushActivity);

  const [dragDeal, setDragDeal] = useState<Deal | null>(null);
  const [pending, setPending] = useState<{ deal: Deal; toCol: string } | null>(null);
  const [invoiceDeal, setInvoiceDeal] = useState<Deal | null>(null);
  const [interest, setInterest] = useState<Interest | "all">("all");
  const [customStages, setCustomStages] = useState<string[]>([]);
  const [customAssign, setCustomAssign] = useState<Record<string, string>>({});

  const buyerById = useMemo(() => new Map(buyers.map((b) => [b.id, b])), [buyers]);
  const interestForDeal = (d: Deal): Interest => {
    const b = buyerById.get(d.buyerId);
    return b ? interestOf(b) : "Warm";
  };
  /** Which column a deal currently lives in (a custom override, else its real stage). */
  const colOf = (d: Deal): string => {
    const c = customAssign[d.id];
    return c && customStages.includes(c) ? c : d.stage;
  };

  const visible = useMemo(
    () => (interest === "all" ? deals : deals.filter((d) => interestForDeal(d) === interest)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deals, interest, buyerById],
  );
  const columns = useMemo(() => [...STAGES, ...customStages], [customStages]);
  const byCol = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const c of columns) map.set(c, []);
    for (const d of visible) (map.get(colOf(d)) ?? map.get(d.stage))?.push(d);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, columns, customAssign]);

  const suggestionCount = useMemo(() => deals.filter((d) => d.suggestion).length, [deals]);

  const handleDrop = (toCol: string) => {
    if (dragDeal && colOf(dragDeal) !== toCol) setPending({ deal: dragDeal, toCol });
    setDragDeal(null);
  };

  const confirmMove = (remarks: string) => {
    if (!pending) return;
    const { deal, toCol } = pending;
    if ((STAGES as string[]).includes(toCol)) {
      moveDeal(deal.id, toCol as Stage, remarks);
      setCustomAssign((m) => { const n = { ...m }; delete n[deal.id]; return n; });
    } else {
      setCustomAssign((m) => ({ ...m, [deal.id]: toCol }));
      pushActivity({ kind: "lead", text: `${deal.name} → ${toCol}`, meta: remarks });
    }
    toast.success(`${deal.name} → ${toCol}`);
    setPending(null);
  };

  const addCustomStage = () => setCustomStages((s) => [...s, `Custom ${s.length + 1}`]);

  return (
    <PageContainer>
      <PageHeader
        kicker="New enquiry → handover"
        title="Pipeline"
        description="Drag a card to move it between stages — a remark is required before every move. Filter by interest, and add your own custom stages."
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

      {/* Filters & views */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-text-faint"><SlidersHorizontal size={13} /> Interest</span>
        <select
          value={interest}
          onChange={(e) => setInterest(e.target.value as Interest | "all")}
          className="h-9 rounded-[10px] border border-border bg-surface px-2.5 text-sm text-text outline-none"
        >
          <option value="all">All interest</option>
          {INTERESTS.map((it) => (<option key={it} value={it}>{it}</option>))}
        </select>
        {interest !== "all" && (
          <button onClick={() => setInterest("all")} className="text-xs font-medium text-accent">Clear</button>
        )}
        <span className="mx-1 h-5 w-px bg-border" />
        <button
          onClick={addCustomStage}
          className="flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 text-sm font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text"
        >
          <Plus size={15} /> Custom stage
        </button>
      </div>

      <LayoutGroup>
        <div className="flex gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
          {columns.map((col, i) => {
            const isCustom = !(STAGES as string[]).includes(col);
            return (
              <StageColumn
                key={col}
                col={col}
                index={i}
                isCustom={isCustom}
                accent={isCustom ? "var(--text-muted)" : STAGE_ACCENT[col as Stage]}
                Icon={isCustom ? undefined : STAGE_ICON[col as Stage]}
                deals={byCol.get(col) ?? []}
                interestForDeal={interestForDeal}
                onAccept={(deal) => deal.suggestion && setPending({ deal, toCol: deal.suggestion.toStage })}
                onDragStartDeal={setDragDeal}
                onDragEndDeal={() => setDragDeal(null)}
                onDrop={() => handleDrop(col)}
                onInvoice={setInvoiceDeal}
                canDrop={!!dragDeal && colOf(dragDeal) !== col}
              />
            );
          })}
        </div>
      </LayoutGroup>

      <AnimatePresence>
        {pending && (
          <RemarksModal deal={pending.deal} toCol={pending.toCol} onClose={() => setPending(null)} onConfirm={confirmMove} />
        )}
        {invoiceDeal && <InvoiceModal deal={invoiceDeal} onClose={() => setInvoiceDeal(null)} />}
      </AnimatePresence>
    </PageContainer>
  );
}

/* ---------------- Stage column ---------------- */
function StageColumn({
  col, index, isCustom, accent, Icon, deals, interestForDeal, onAccept, onDragStartDeal, onDragEndDeal, onDrop, onInvoice, canDrop,
}: {
  col: string;
  index: number;
  isCustom: boolean;
  accent: string;
  Icon?: typeof KeyRound;
  deals: Deal[];
  interestForDeal: (d: Deal) => Interest;
  onAccept: (deal: Deal) => void;
  onDragStartDeal: (deal: Deal) => void;
  onDragEndDeal: () => void;
  onDrop: () => void;
  onInvoice: (deal: Deal) => void;
  canDrop: boolean;
}) {
  const [over, setOver] = useState(false);
  const total = useMemo(() => deals.reduce((sum, d) => sum + d.valueInr, 0), [deals]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04 }}
      onDragOver={(e) => { if (canDrop) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(); }}
      className="flex w-[300px] shrink-0 flex-col"
    >
      <div className="h-[3px] w-full rounded-pill" style={{ background: accent, opacity: 0.85 }} />

      <div className="mb-3 mt-3 px-1">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className="grid h-5 w-5 place-items-center rounded-md" style={{ background: "color-mix(in oklab, var(--positive) 16%, transparent)", color: "var(--positive)" }}>
              <Icon size={13} strokeWidth={2.2} />
            </span>
          )}
          <h2 className="font-display text-[15px] font-bold tracking-tight text-text">{col}</h2>
          {isCustom && <span className="rounded-pill border border-border-strong px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-text-faint">custom</span>}
          <span className="tabular ml-auto rounded-pill bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-muted">{deals.length}</span>
        </div>
        <div className="tabular mt-1 font-mono text-[11px] text-text-faint">{rupees(total)}</div>
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col gap-3 rounded-[14px] transition-colors",
          canDrop && "outline-dashed outline-1 outline-offset-2 outline-border",
          over && "bg-accent-soft/40 outline-accent",
        )}
      >
        <AnimatePresence initial={false}>
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} interest={interestForDeal(deal)} onAccept={onAccept} onDragStartDeal={onDragStartDeal} onDragEndDeal={onDragEndDeal} onInvoice={onInvoice} />
          ))}
        </AnimatePresence>

        {deals.length === 0 && (
          <div className="grid min-h-[88px] place-items-center rounded-[14px] border border-dashed border-border text-xs text-text-faint">
            {over ? "Drop to move here" : isCustom ? "Drag deals here" : "No deals"}
          </div>
        )}
      </div>
    </motion.section>
  );
}

/* ---------------- Deal card ---------------- */
function DealCard({
  deal, interest, onAccept, onDragStartDeal, onDragEndDeal, onInvoice,
}: {
  deal: Deal;
  interest: Interest;
  onAccept: (deal: Deal) => void;
  onDragStartDeal: (deal: Deal) => void;
  onDragEndDeal: () => void;
  onInvoice: (deal: Deal) => void;
}) {
  const meta = INTEREST_META[interest];
  const InterestIcon = meta.icon;
  const days = Math.round((deal.closeDate - SEED_NOW) / DAY);
  const closeLabel = days <= 0 ? "today" : `in ${days}d`;
  const billable = isBooked(deal.stage);

  const handleAccept = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!deal.suggestion?.toStage) return;
    onAccept(deal); // opens the Remarks modal — a "why" is required before the move commits
  };

  return (
    <motion.div
      layout
      layoutId={deal.id}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ layout: CARD_SPRING, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}
      draggable
      onDragStart={() => onDragStartDeal(deal)}
      onDragEnd={onDragEndDeal}
      className="group cursor-grab active:cursor-grabbing"
    >
      <Link
        href={`/buyers/${deal.buyerId}`}
        draggable={false}
        className={cn(
          "block rounded-[14px] border border-border bg-surface p-3.5 shadow-[var(--shadow-soft)]",
          "transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1 font-semibold leading-tight text-text">
            <GripVertical size={13} className="-ml-1 shrink-0 text-text-faint opacity-0 transition-opacity group-hover:opacity-100" />
            <span className="truncate">{deal.name}</span>
          </span>
          <Avatar name={deal.agentInitials} hue={deal.hue} size={24} />
        </div>

        <div className="mt-1 truncate text-sm text-text-muted">{deal.project} · {deal.unitLabel}</div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="tabular font-display text-[15px] font-semibold text-text">{rupees(deal.valueInr)}</span>
          <span className="tabular font-mono text-[11px] text-text-faint">closes {closeLabel}</span>
        </div>

        {/* Interest + flags + token */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Pill variant={meta.variant}><InterestIcon size={11} /> {interest}</Pill>
          {deal.tokenInr ? <Pill variant="positive">Token {rupees(deal.tokenInr)}</Pill> : null}
          {deal.stalled && <Pill variant="negative">Stalled</Pill>}
          {deal.noShow && <Pill variant="negative"><CalendarX size={11} /> No-show</Pill>}
        </div>

        {billable && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInvoice(deal); }}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[9px] border border-border bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-text transition-colors hover:border-border-strong hover:bg-surface-inset"
          >
            <FileText size={12} /> Generate invoice
          </button>
        )}

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
                    <span className="inline-flex items-center gap-1 font-semibold"><ArrowRight size={12} /> {deal.suggestion.toStage}?</span>{" "}
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

/* ---------------- Mandatory remarks modal (every move) ---------------- */
function RemarksModal({
  deal, toCol, onClose, onConfirm,
}: {
  deal: Deal;
  toCol: string;
  onClose: () => void;
  onConfirm: (remarks: string) => void;
}) {
  const aiSuggested = deal.suggestion?.toStage === toCol;
  const [remarks, setRemarks] = useState(aiSuggested ? deal.suggestion?.reason ?? "" : "");
  const QUICK = ["Spoke with buyer — confirmed", "Site visit done", "Payment discussed", "Awaiting documents", "Buyer needs time"];
  const valid = remarks.trim().length >= 3;

  return (
    <motion.div className="fixed inset-0 z-[110] flex items-center justify-center px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog" aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 440, damping: 30 }}
        className="relative w-full max-w-[440px] overflow-hidden rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-lift)]"
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <Label>Required · why this move?</Label>
            <h3 className="mt-1 font-display text-lg font-bold leading-tight">
              {deal.name} → <span className="text-accent">{toCol}</span>
            </h3>
            <p className="mt-1 text-sm text-text-muted">Moving from {deal.stage}. Add a remark so the timeline keeps the context.</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-faint hover:bg-surface-2 hover:text-text"><X size={16} /></button>
        </div>

        <textarea
          autoFocus
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          placeholder="e.g. Buyer confirmed booking on call, sending agreement next…"
          className="mt-4 w-full resize-none rounded-[12px] border border-border bg-surface-2 p-3 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => setRemarks(q)} className="rounded-pill border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-text-muted transition-colors hover:border-border-strong hover:text-text">{q}</button>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 rounded-[10px] border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2">Cancel</button>
          <button
            onClick={() => valid && onConfirm(remarks.trim())}
            disabled={!valid}
            className="h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          >
            Move with remark
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------------- Invoice generation ---------------- */
function InvoiceModal({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const base = deal.valueInr;
  const gst = Math.round(base * 0.05);
  const stamp = Math.round(base * 0.06);
  const total = base + gst + stamp;
  const invNo = `INV-${deal.id.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-6)}`;
  const row = (label: string, value: number, faint = false) => (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={faint ? "text-text-faint" : "text-text-muted"}>{label}</span>
      <span className="tabular font-medium text-text">{rupees(value)}</span>
    </div>
  );

  return (
    <motion.div className="fixed inset-0 z-[110] flex items-center justify-center px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog" aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 440, damping: 30 }}
        className="relative w-full max-w-[440px] overflow-hidden rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-lift)]"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-accent-soft text-accent"><ReceiptText size={19} /></span>
            <div>
              <h3 className="font-display text-lg font-bold leading-tight">Invoice draft</h3>
              <p className="tabular font-mono text-[12px] text-text-muted">{invNo} · auto-generated</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-text-faint hover:bg-surface-2 hover:text-text"><X size={16} /></button>
        </div>

        <div className="mt-4 rounded-[12px] border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-text">{deal.name}</span>
            <Pill variant="neutral">{deal.stage}</Pill>
          </div>
          <div className="mt-0.5 truncate text-sm text-text-muted">{deal.project} · {deal.unitLabel}</div>
          <div className="mt-3 border-t border-border pt-2">
            {row("Unit consideration", base)}
            {row("GST @ 5%", gst, true)}
            {row("Stamp duty & registration @ 6%", stamp, true)}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2.5">
              <span className="font-semibold text-text">Total payable</span>
              <span className="tabular font-display text-lg font-bold text-text">{rupees(total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 rounded-[10px] border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2">Cancel</button>
          <button
            onClick={() => { toast.success(`${invNo} sent to ${deal.name}`); onClose(); }}
            className="h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95"
          >
            Generate &amp; send
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
