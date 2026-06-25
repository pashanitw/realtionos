"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Sparkles, ArrowRight, Check, CalendarX, Trophy, KeyRound, GripVertical,
  FileText, X, ReceiptText, Flame, Snowflake, Plus, SlidersHorizontal,
  LayoutGrid, Table2, Download, ChevronUp, ChevronDown, Wallet, TrendingUp, Columns3,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { useScopedDeals } from "@/lib/roles";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Avatar, Pill, Label } from "@/components/ui/primitives";
import { STAGES, isBooked, interestOf, INTERESTS, type Interest, type Stage, type Deal, type Buyer } from "@/lib/data/types";
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
  const [view, setView] = useState<"board" | "table">("board");

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

  const summary = useMemo(() => {
    let value = 0, bookedValue = 0, bookedCount = 0;
    for (const d of visible) {
      value += d.valueInr;
      if (isBooked(d.stage)) { bookedValue += d.valueInr; bookedCount += 1; }
    }
    return { count: visible.length, value, bookedValue, bookedCount, avg: visible.length ? Math.round(value / visible.length) : 0 };
  }, [visible]);

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

      {/* Filters & view toggle */}
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
        {view === "board" && (
          <>
            <span className="mx-1 h-5 w-px bg-border" />
            <button
              onClick={addCustomStage}
              className="flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 text-sm font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text"
            >
              <Plus size={15} /> Custom stage
            </button>
          </>
        )}
        {view === "table" && (
          <button
            onClick={() => exportDealsCsv(visible, buyerById, colOf, interestForDeal)}
            className="flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 text-sm font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text"
          >
            <Download size={15} /> Export CSV
          </button>
        )}
        <div className="ml-auto flex items-center gap-0.5 rounded-[10px] border border-border bg-surface p-0.5">
          <ViewToggleBtn active={view === "board"} onClick={() => setView("board")} icon={<LayoutGrid size={15} />} label="Board" />
          <ViewToggleBtn active={view === "table"} onClick={() => setView("table")} icon={<Table2 size={15} />} label="Table" />
        </div>
      </div>

      {/* Pipeline summary */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PipeStat icon={<Columns3 size={15} />} tone="accent" label="Open deals" value={`${summary.count}`} />
        <PipeStat icon={<Wallet size={15} />} tone="accent" label="Pipeline value" value={rupees(summary.value)} />
        <PipeStat icon={<KeyRound size={15} />} tone="positive" label="Booked" value={`${summary.bookedCount} · ${rupees(summary.bookedValue)}`} />
        <PipeStat icon={<TrendingUp size={15} />} tone="live" label="Avg deal" value={rupees(summary.avg)} />
      </div>

      <ValueFlow deals={visible} />

      {view === "board" ? (
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
      ) : (
        <DealTable deals={visible} buyerById={buyerById} colOf={colOf} interestForDeal={interestForDeal} onInvoice={setInvoiceDeal} />
      )}

      <AnimatePresence>
        {pending && (
          <RemarksModal deal={pending.deal} toCol={pending.toCol} onClose={() => setPending(null)} onConfirm={confirmMove} />
        )}
        {invoiceDeal && <InvoiceModal deal={invoiceDeal} onClose={() => setInvoiceDeal(null)} />}
      </AnimatePresence>
    </PageContainer>
  );
}

/* ---------------- View toggle + summary tile ---------------- */
function ViewToggleBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-sm font-medium transition-colors",
        active ? "bg-accent text-accent-contrast" : "text-text-muted hover:text-text",
      )}
    >
      {icon} {label}
    </button>
  );
}

function PipeStat({ icon, tone, label, value }: { icon: React.ReactNode; tone: "accent" | "positive" | "live"; label: string; value: string }) {
  const fg = tone === "positive" ? "text-positive" : tone === "live" ? "text-live" : "text-accent";
  const bg = tone === "positive" ? "bg-positive-soft" : tone === "live" ? "bg-live-soft" : "bg-accent-soft";
  return (
    <div className="rounded-[12px] border border-border bg-surface p-3.5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", bg, fg)}>{icon}</span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">{label}</span>
      </div>
      <div className="tabular mt-2 font-display text-lg font-bold text-text">{value}</div>
    </div>
  );
}

/* ---------------- Value-flow rail — where the pipeline value sits ---------------- */
function ValueFlow({ deals }: { deals: Deal[] }) {
  const flow = useMemo(() => {
    const m = new Map<Stage, number>();
    for (const s of STAGES) m.set(s, 0);
    let total = 0;
    for (const d of deals) { m.set(d.stage, (m.get(d.stage) ?? 0) + d.valueInr); total += d.valueInr; }
    const arr = STAGES.map((s) => ({ stage: s, value: m.get(s) ?? 0 })).filter((x) => x.value > 0);
    const top = arr.reduce<{ stage: Stage; value: number } | null>((a, b) => (!a || b.value > a.value ? b : a), null);
    return { arr, total: total || 1, top };
  }, [deals]);

  if (!flow.arr.length) return null;
  const legend = [...flow.arr].sort((a, b) => b.value - a.value).slice(0, 6);

  return (
    <div className="mb-4 rounded-[14px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <Label>Where the value sits</Label>
        {flow.top && <span className="text-xs text-text-muted">Biggest pool · <span className="font-semibold text-text">{rupees(flow.top.value)}</span> in {flow.top.stage}</span>}
      </div>
      <div className="flex h-3.5 overflow-hidden rounded-pill bg-surface-inset">
        {flow.arr.map((x) => (
          <motion.div
            key={x.stage}
            initial={{ width: 0 }} animate={{ width: `${(x.value / flow.total) * 100}%` }} transition={{ duration: 0.6, ease: "easeOut" }}
            title={`${x.stage} · ${rupees(x.value)}`}
            style={{ background: STAGE_ACCENT[x.stage] }}
            className="h-full border-r-2 border-surface last:border-r-0"
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {legend.map((x) => (
          <span key={x.stage} className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: STAGE_ACCENT[x.stage] }} /> {x.stage} <span className="tabular font-mono text-text-faint">{rupees(x.value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Excel / table view ---------------- */
type SortKey = "name" | "stage" | "interest" | "score" | "value" | "close";

function DealTable({
  deals, buyerById, colOf, interestForDeal, onInvoice,
}: {
  deals: Deal[];
  buyerById: Map<string, Buyer>;
  colOf: (d: Deal) => string;
  interestForDeal: (d: Deal) => Interest;
  onInvoice: (deal: Deal) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "value", dir: -1 });

  const rows = useMemo(
    () => deals.map((d) => {
      const b = buyerById.get(d.buyerId);
      return { deal: d, stage: colOf(d), interest: interestForDeal(d), score: b?.score ?? 0, config: b?.config ?? "—", loc: b?.localityPrefs?.[0] ?? "—" };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deals],
  );

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    return [...rows].sort((a, b) => {
      switch (key) {
        case "name": return a.deal.name.localeCompare(b.deal.name) * dir;
        case "stage": return ((STAGES as string[]).indexOf(a.stage) - (STAGES as string[]).indexOf(b.stage)) * dir;
        case "interest": return (INTERESTS.indexOf(a.interest) - INTERESTS.indexOf(b.interest)) * dir;
        case "score": return (a.score - b.score) * dir;
        case "value": return (a.deal.valueInr - b.deal.valueInr) * dir;
        case "close": return (a.deal.closeDate - b.deal.closeDate) * dir;
        default: return 0;
      }
    });
  }, [rows, sort]);

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) } : { key, dir: key === "name" || key === "stage" ? 1 : -1 }));

  if (deals.length === 0) {
    return <div className="rounded-[14px] border border-dashed border-border p-10 text-center text-sm text-text-faint">No deals match this filter.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-border bg-surface shadow-[var(--shadow-soft)]">
      <table className="w-full min-w-[940px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/50">
            <Th onClick={() => toggle("name")} active={sort.key === "name"} dir={sort.dir} className="pl-4 text-left">Buyer · unit</Th>
            <Th className="text-left">Requirement</Th>
            <Th onClick={() => toggle("stage")} active={sort.key === "stage"} dir={sort.dir} className="text-left">Stage</Th>
            <Th onClick={() => toggle("interest")} active={sort.key === "interest"} dir={sort.dir} className="text-left">Interest</Th>
            <Th onClick={() => toggle("score")} active={sort.key === "score"} dir={sort.dir} className="text-right">Score</Th>
            <Th onClick={() => toggle("value")} active={sort.key === "value"} dir={sort.dir} className="text-right">Value</Th>
            <Th className="text-right">Token</Th>
            <Th className="text-left">Agent</Th>
            <Th onClick={() => toggle("close")} active={sort.key === "close"} dir={sort.dir} className="text-right">Close</Th>
            <Th className="pr-4 text-right">Invoice</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ deal, stage, interest, score, config, loc }, i) => {
            const meta = INTEREST_META[interest];
            const IntIcon = meta.icon;
            const days = Math.round((deal.closeDate - SEED_NOW) / DAY);
            const closeLbl = days < 0 ? "overdue" : days === 0 ? "today" : `${days}d`;
            return (
              <tr key={deal.id} className={cn("border-b border-border/60 transition-colors hover:bg-surface-2/40", i % 2 ? "bg-surface-inset/20" : "")}>
                <td className="py-2.5 pl-4 pr-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-text">{deal.name}</span>
                    {deal.stalled && <Pill variant="negative" className="px-1.5 py-0 text-[10px]">stalled</Pill>}
                    {deal.noShow && <Pill variant="negative" className="px-1.5 py-0 text-[10px]">no-show</Pill>}
                  </div>
                  <div className="text-xs text-text-faint">{deal.project} · {deal.unitLabel}</div>
                </td>
                <td className="whitespace-nowrap px-3 text-xs text-text-muted">{config} · {loc}</td>
                <td className="whitespace-nowrap px-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-text">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: (STAGES as string[]).includes(stage) ? STAGE_ACCENT[stage as Stage] : "var(--text-muted)" }} />
                    {stage}
                  </span>
                </td>
                <td className="px-3"><Pill variant={meta.variant} className="text-[11px]"><IntIcon size={11} /> {interest}</Pill></td>
                <td className="tabular px-3 text-right font-mono text-text-muted">{score}</td>
                <td className="tabular px-3 text-right font-mono font-semibold text-text">{rupees(deal.valueInr)}</td>
                <td className="tabular px-3 text-right font-mono text-xs text-text-faint">{deal.tokenInr ? rupees(deal.tokenInr) : "—"}</td>
                <td className="px-3"><div className="flex items-center gap-1.5"><Avatar name={deal.name} hue={deal.hue} size={20} /><span className="font-mono text-xs text-text-muted">{deal.agentInitials}</span></div></td>
                <td className="tabular px-3 text-right font-mono text-xs text-text-muted">{closeLbl}</td>
                <td className="py-2.5 pl-3 pr-4 text-right">
                  {isBooked(deal.stage)
                    ? <button onClick={() => onInvoice(deal)} className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text"><ReceiptText size={12} /> Invoice</button>
                    : <span className="text-text-faint">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, onClick, active, dir, className }: { children: React.ReactNode; onClick?: () => void; active?: boolean; dir?: 1 | -1; className?: string }) {
  return (
    <th
      onClick={onClick}
      className={cn("whitespace-nowrap px-3 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-text-faint", onClick && "cursor-pointer select-none hover:text-text", className)}
    >
      <span className={cn("inline-flex items-center gap-1", className?.includes("text-right") && "justify-end")}>
        {children}
        {active && (dir === 1 ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </span>
    </th>
  );
}

function exportDealsCsv(deals: Deal[], buyerById: Map<string, Buyer>, colOf: (d: Deal) => string, interestForDeal: (d: Deal) => Interest) {
  const header = ["Buyer", "Project", "Unit", "Config", "Locality", "Stage", "Interest", "Score", "Value (INR)", "Token (INR)", "Agent", "Close date"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = deals.map((d) => {
    const b = buyerById.get(d.buyerId);
    return [d.name, d.project, d.unitLabel, b?.config ?? "", b?.localityPrefs?.[0] ?? "", colOf(d), interestForDeal(d), b?.score ?? "", d.valueInr, d.tokenInr ?? "", d.agentInitials, new Date(d.closeDate).toISOString().slice(0, 10)].map(esc).join(",");
  });
  const csv = [header.map(esc).join(","), ...lines].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = "pipeline.csv";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${deals.length} deals to CSV`);
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
