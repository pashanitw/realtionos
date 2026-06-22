"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { ChevronRight, Zap, TriangleAlert, Search, CalendarCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { conductBuyerReply } from "@/lib/conductor";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { ScoreBadge, Avatar, ChannelIcon, Pill } from "@/components/ui/primitives";
import { CONFIGS, SOURCE_LABEL, type Config, type Source } from "@/lib/data/types";
import { rupeeRange, relativeTime, cn, SEED_NOW } from "@/lib/utils";

export default function WorklistPage() {
  const buyers = useStore((s) => s.buyers);
  const recentlyRescored = useStore((s) => s.recentlyRescored);
  const sources = useMemo(() => Array.from(new Set(buyers.map((b) => b.source))), [buyers]);

  const [query, setQuery] = useState("");
  const [source, setSource] = useState<Source | "all">("all");
  const [config, setConfig] = useState<Config | "all">("all");
  const [visitsOnly, setVisitsOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return buyers
      .filter((b) => (source === "all" ? true : b.source === source))
      .filter((b) => (config === "all" ? true : b.config === config))
      .filter((b) => (visitsOnly ? !!b.siteVisitDue : true))
      .filter((b) => (q ? b.name.toLowerCase().includes(q) || b.localityPrefs.join(" ").toLowerCase().includes(q) : true));
  }, [buyers, query, source, config, visitsOnly]);

  return (
    <PageContainer>
      <PageHeader
        kicker="The product opens on an answer"
        title="Call these buyers today"
        description="Buyers ranked by intent score. The CRM tells you who to call — and re-ranks itself the moment a buyer replies or books a visit."
        actions={
          <button
            onClick={() => conductBuyerReply()}
            className="flex h-10 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-contrast shadow-[0_0_22px_-6px_var(--accent)] transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Zap size={16} /> Simulate a buyer reply
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <FilterChip active={source === "all"} onClick={() => setSource("all")}>All sources</FilterChip>
          {sources.map((s) => (
            <FilterChip key={s} active={source === s} onClick={() => setSource(s)}>{SOURCE_LABEL[s]}</FilterChip>
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          <FilterChip active={visitsOnly} onClick={() => setVisitsOnly((v) => !v)}>
            <CalendarCheck size={13} /> Visits due
          </FilterChip>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-9 items-center gap-2 rounded-[10px] border border-border bg-surface px-3">
            <Search size={14} className="text-text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search buyers, localities…"
              className="w-32 bg-transparent text-sm outline-none placeholder:text-text-faint sm:w-44"
            />
          </div>
          <select
            value={config}
            onChange={(e) => setConfig(e.target.value as Config | "all")}
            className="h-9 rounded-[10px] border border-border bg-surface px-2.5 text-sm text-text outline-none"
          >
            <option value="all">All configs</option>
            {CONFIGS.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-soft)]">
        <div className="hidden items-center gap-4 border-b border-border px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint md:flex">
          <span className="w-7 text-center">#</span>
          <span className="w-12">Score</span>
          <span className="flex-1">Buyer · requirement</span>
          <span className="hidden xl:block xl:w-[260px]">Why it&apos;s ranked here</span>
          <span className="w-24">Channels</span>
          <span className="w-28 text-right">Budget</span>
          <span className="w-5" />
        </div>

        <LayoutGroup>
          <AnimatePresence initial={false}>
            {filtered.map((buyer, i) => (
              <BuyerRow key={buyer.id} rank={i + 1} buyer={buyer} delta={recentlyRescored[buyer.id]} />
            ))}
          </AnimatePresence>
        </LayoutGroup>

        {filtered.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-text-muted">No buyers match these filters.</p>
            <button
              onClick={() => { setQuery(""); setSource("all"); setConfig("all"); setVisitsOnly(false); }}
              className="mt-2 text-sm font-medium text-accent"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-pill border px-3 text-xs font-medium transition-colors",
        active ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function BuyerRow({
  buyer,
  rank,
  delta,
}: {
  buyer: ReturnType<typeof useStore.getState>["buyers"][number];
  rank: number;
  delta?: number;
}) {
  const topReasons = buyer.scoreReasons.slice(0, 2);
  const stalledDays = Math.max(1, Math.round((SEED_NOW - buyer.lastTouch) / 86_400_000));
  const visitInDays = buyer.siteVisitDue ? Math.round((buyer.siteVisitDue - SEED_NOW) / 86_400_000) : null;

  return (
    <motion.div
      layout
      layoutId={buyer.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ layout: { type: "spring", stiffness: 420, damping: 36 }, opacity: { duration: 0.25 } }}
      className="relative border-b border-border last:border-0"
    >
      {delta ? (
        <motion.span initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 2 }} className="pointer-events-none absolute inset-0 bg-positive-soft" />
      ) : null}
      <Link href={`/buyers/${buyer.id}`} className="relative flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 md:flex-row md:items-center md:gap-4">
        <div className="flex items-center gap-4">
          <span className="w-7 text-center font-mono text-sm text-text-faint tabular">{rank}</span>
          <ScoreBadge score={buyer.score} delta={delta} size={46} />
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={buyer.name} hue={buyer.hue} size={38} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-semibold text-text">{buyer.name}</span>
              {buyer.isNew && <Pill variant="positive">New</Pill>}
              {visitInDays !== null && (
                <Pill variant="live"><CalendarCheck size={11} /> Visit {visitInDays <= 0 ? "today" : `in ${visitInDays}d`}</Pill>
              )}
              {buyer.stalled && !visitInDays && (
                <Pill variant="negative" className="hidden sm:inline-flex"><TriangleAlert size={11} /> Stalled {stalledDays}d</Pill>
              )}
            </div>
            <div className="truncate text-sm text-text-muted">
              {buyer.config} · {buyer.localityPrefs[0]} · {rupeeRange(buyer.budgetMin, buyer.budgetMax)}
              <span className="ml-2 font-mono text-[11px] text-text-faint">{SOURCE_LABEL[buyer.source]}</span>
            </div>
          </div>
        </div>

        <div className="hidden flex-col gap-1 xl:flex xl:w-[260px]">
          {topReasons.map((r) => (
            <span key={r.id} className="flex items-center gap-1.5 text-xs text-text-muted" title={r.sourceQuote}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.polarity === "positive" ? "var(--positive)" : "var(--negative)" }} />
              <span className="truncate">{r.text}</span>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1.5 md:w-24">
          {buyer.channelsUsed.map((c) => (<ChannelIcon key={c} channel={c} size={15} />))}
        </div>

        <div className="flex items-center justify-between md:w-28 md:justify-end">
          <div className="text-right">
            <div className="font-semibold text-text tabular">{rupeeRange(buyer.budgetMin, buyer.budgetMax)}</div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-text-faint">{buyer.stage}</div>
          </div>
        </div>

        <ChevronRight size={16} className="hidden shrink-0 text-text-faint md:block" />
      </Link>
    </motion.div>
  );
}
