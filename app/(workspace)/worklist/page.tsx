"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { ChevronRight, Zap, TriangleAlert, Search, CalendarCheck, Clock } from "lucide-react";
import { useStore } from "@/lib/store";
import { useScopedBuyers, useCurrentUser, useActiveClientId } from "@/lib/roles";
import { conductBuyerReply } from "@/lib/conductor";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { ScoreBadge, Avatar, ChannelIcon, Pill } from "@/components/ui/primitives";
import { CONFIGS, SOURCE_LABEL, type Config, type Source } from "@/lib/data/types";
import { rupeeRange, relativeTime, cn, SEED_NOW } from "@/lib/utils";

const DAY = 86_400_000;
type DateMode = "all" | "overdue" | "today" | "yesterday" | "week" | "custom";
const DATE_LABEL: Record<Exclude<DateMode, "custom">, string> = {
  all: "Any time", overdue: "Overdue", today: "Today", yesterday: "Yesterday", week: "Next 7 days",
};
const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export default function WorklistPage() {
  const buyers = useScopedBuyers();
  const recentlyRescored = useStore((s) => s.recentlyRescored);
  const sources = useMemo(() => Array.from(new Set(buyers.map((b) => b.source))), [buyers]);

  // Agent-wise filter (PRD §2.2) — managers/telecallers can narrow to one team member.
  const me = useCurrentUser();
  const activeClientId = useActiveClientId();
  const allUsers = useStore((s) => s.users);
  const teamAgents = useMemo(
    () => allUsers.filter((u) => u.role === "agent" && u.clientId === activeClientId),
    [allUsers, activeClientId],
  );
  const canFilterAgent = me.role !== "agent" && teamAgents.length > 0;

  const [query, setQuery] = useState("");
  const [source, setSource] = useState<Source | "all">("all");
  const [config, setConfig] = useState<Config | "all">("all");
  const [visitsOnly, setVisitsOnly] = useState(false);
  const [dateMode, setDateMode] = useState<DateMode>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");

  const overdueCount = useMemo(
    () => buyers.filter((b) => b.followUpAt != null && b.followUpAt < SEED_NOW).length,
    [buyers],
  );

  const matchesDate = (fu: number | undefined) => {
    if (dateMode === "all") return true;
    if (fu == null) return false;
    const dayStart = startOfDay(SEED_NOW);
    switch (dateMode) {
      case "overdue": return fu < SEED_NOW;
      case "today": return fu >= dayStart && fu < dayStart + DAY;
      case "yesterday": return fu >= dayStart - DAY && fu < dayStart;
      case "week": return fu >= SEED_NOW && fu < SEED_NOW + 7 * DAY;
      case "custom": {
        if (!customFrom && !customTo) return true;
        const from = customFrom ? startOfDay(new Date(`${customFrom}T00:00`).getTime()) : -Infinity;
        const to = customTo ? startOfDay(new Date(`${customTo}T00:00`).getTime()) + DAY : Infinity; // inclusive of the 'to' day
        return fu >= from && fu < to;
      }
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return buyers
      .filter((b) => (agentFilter === "all" ? true : b.agentId === agentFilter))
      .filter((b) => (source === "all" ? true : b.source === source))
      .filter((b) => (config === "all" ? true : b.config === config))
      .filter((b) => (visitsOnly ? !!b.siteVisitDue : true))
      .filter((b) => matchesDate(b.followUpAt))
      .filter((b) => (q ? b.name.toLowerCase().includes(q) || b.localityPrefs.join(" ").toLowerCase().includes(q) : true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyers, query, source, config, visitsOnly, dateMode, customFrom, customTo, agentFilter]);

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
        <div className="flex items-center gap-2">
          <FilterChip active={visitsOnly} onClick={() => setVisitsOnly((v) => !v)}>
            <CalendarCheck size={13} /> Visits due
          </FilterChip>
          <FilterChip active={dateMode === "overdue"} onClick={() => setDateMode((m) => (m === "overdue" ? "all" : "overdue"))}>
            <Clock size={13} /> Overdue
            {overdueCount > 0 && (
              <span className="tabular ml-0.5 rounded-pill bg-negative-soft px-1.5 text-[10px] font-semibold text-negative">{overdueCount}</span>
            )}
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
          {canFilterAgent && (
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="h-9 rounded-[10px] border border-border bg-surface px-2.5 text-sm text-text outline-none"
              title="Assigned agent"
            >
              <option value="all">All agents</option>
              {teamAgents.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
            </select>
          )}
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as Source | "all")}
            className="h-9 rounded-[10px] border border-border bg-surface px-2.5 text-sm text-text outline-none"
            title="Lead source"
          >
            <option value="all">All sources</option>
            {sources.map((s) => (<option key={s} value={s}>{SOURCE_LABEL[s]}</option>))}
          </select>
          <select
            value={dateMode === "custom" ? "custom" : dateMode}
            onChange={(e) => { const v = e.target.value as DateMode; setDateMode(v); if (v !== "custom") { setCustomFrom(""); setCustomTo(""); } }}
            className="h-9 rounded-[10px] border border-border bg-surface px-2.5 text-sm text-text outline-none"
            title="Follow-up date"
          >
            {(Object.keys(DATE_LABEL) as (keyof typeof DATE_LABEL)[]).map((k) => (
              <option key={k} value={k}>{DATE_LABEL[k]}</option>
            ))}
            <option value="custom">Custom range…</option>
          </select>
          {dateMode === "custom" && (
            <div className="flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-surface px-2.5">
              <input
                type="date" value={customFrom} max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-transparent text-sm text-text outline-none [color-scheme:inherit]" title="From"
              />
              <span className="text-text-faint">–</span>
              <input
                type="date" value={customTo} min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-transparent text-sm text-text outline-none [color-scheme:inherit]" title="To"
              />
            </div>
          )}
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
              onClick={() => { setQuery(""); setSource("all"); setConfig("all"); setVisitsOnly(false); setDateMode("all"); setCustomFrom(""); setCustomTo(""); setAgentFilter("all"); }}
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

  const fu = buyer.followUpAt;
  const overdue = fu != null && fu < SEED_NOW && !buyer.siteVisitDue;
  const slaH = fu != null ? Math.round(Math.abs(fu - SEED_NOW) / 3_600_000) : 0;
  const slaText = slaH < 24 ? `${slaH}h` : `${Math.round(slaH / 24)}d`;
  const fuClock = fu != null && !buyer.siteVisitDue
    ? new Date(fu).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: true })
    : null;
  const dueSoon = fu != null && !overdue && !buyer.siteVisitDue && fu - SEED_NOW < DAY;

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
              {overdue && (
                <Pill variant="negative"><Clock size={11} /> Overdue {slaText}</Pill>
              )}
              {dueSoon && (
                <Pill variant="live" className="hidden sm:inline-flex"><Clock size={11} /> Follow-up {slaText}</Pill>
              )}
              {buyer.stalled && !visitInDays && !overdue && (
                <Pill variant="negative" className="hidden sm:inline-flex"><TriangleAlert size={11} /> Stalled {stalledDays}d</Pill>
              )}
            </div>
            <div className="truncate text-sm text-text-muted">
              {buyer.config} · {buyer.localityPrefs[0]} · {rupeeRange(buyer.budgetMin, buyer.budgetMax)}
              <span className="ml-2 font-mono text-[11px] text-text-faint">{SOURCE_LABEL[buyer.source]}</span>
              {fuClock && (
                <span className={cn("ml-2 font-mono text-[11px]", overdue ? "text-negative" : "text-text-faint")}>· F/U {fuClock}</span>
              )}
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
