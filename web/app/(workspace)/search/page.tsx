"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, ChevronDown, UserSearch, Phone, X, SlidersHorizontal, TrendingUp } from "lucide-react";
import { useScopedBuyers, useCurrentUser, useActiveClientId } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Avatar, ScoreBadge, Pill } from "@/components/ui/primitives";
import { SOURCE_LABEL, SOURCES, STAGES, interestOf, personaOf, type Buyer, type Interest } from "@/lib/data/types";
import { cn, rupeeRange, bookingProbability } from "@/lib/utils";

const SPRING = { type: "spring" as const, stiffness: 380, damping: 32 };

type PillVariant = "neutral" | "accent" | "live" | "positive" | "negative" | "outline";
const INTEREST_VARIANT: Record<Interest, PillVariant> = {
  New: "accent", Hot: "negative", Warm: "live", Cold: "neutral", Interested: "positive", "Not Interested": "outline",
};

/* ---- lead status (coarse) — used by the Status filter ---- */
const LEAD_STATUSES = ["New", "Qualified", "Active", "Booked", "Stalled"] as const;
type LeadStatus = (typeof LEAD_STATUSES)[number];
const BOOKED_STAGES = ["Booking Amount Paid", "Booking Confirmed", "Agreement Signed", "Loan Sanction", "Registration", "Handover"];
function statusOf(b: Buyer): LeadStatus {
  if (b.stalled) return "Stalled";
  if (BOOKED_STAGES.includes(b.stage)) return "Booked";
  if (b.stage === "New Enquiry") return "New";
  if (b.stage === "Qualified") return "Qualified";
  return "Active";
}

export default function LeadSearchPage() {
  const buyers = useScopedBuyers();
  const user = useCurrentUser();
  const cid = useActiveClientId();
  const users = useStore((s) => s.users);
  const teams = useStore((s) => s.teams);

  const [q, setQ] = useState("");
  const [agentId, setAgentId] = useState("all");
  const [teamId, setTeamId] = useState("all");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const query = q.trim().toLowerCase();

  // Managers, super-admins and telecallers see the whole company book; agents see only their own.
  const seesWholeClient = user.role !== "agent";
  const scopeNote = seesWholeClient ? `all ${buyers.length} company leads` : `your ${buyers.length} leads`;

  const agents = useMemo(() => users.filter((u) => u.role === "agent" && u.clientId === cid), [users, cid]);
  const clientTeams = useMemo(() => teams.filter((t) => t.clientId === cid), [teams, cid]);
  const teamOfAgent = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a.teamId ?? ""])), [agents]);

  const activeFilters = [agentId, teamId, source, status].filter((v) => v !== "all").length;
  const clearFilters = () => { setAgentId("all"); setTeamId("all"); setSource("all"); setStatus("all"); };

  const results = useMemo(() => {
    let base = [...buyers].sort((a, b) => b.score - a.score);
    base = base.filter((b) => {
      if (agentId !== "all" && b.agentId !== agentId) return false;
      if (teamId !== "all" && teamOfAgent[b.agentId] !== teamId) return false;
      if (source !== "all" && b.source !== source) return false;
      if (status !== "all" && statusOf(b) !== status) return false;
      return true;
    });
    if (query) {
      base = base.filter((b) =>
        b.name.toLowerCase().includes(query) ||
        b.phone.toLowerCase().includes(query) ||
        b.config.toLowerCase().includes(query) ||
        b.localityPrefs.some((l) => l.toLowerCase().includes(query)) ||
        SOURCE_LABEL[b.source].toLowerCase().includes(query) ||
        b.stage.toLowerCase().includes(query) ||
        b.agent.toLowerCase().includes(query),
      );
    }
    return base.slice(0, 100);
  }, [buyers, query, agentId, teamId, source, status, teamOfAgent]);

  return (
    <PageContainer>
      <PageHeader
        kicker="Find any lead — no duplicates"
        title="Lead search"
        description={`Search ${scopeNote} by name, phone, locality or source — then narrow by agent, team, source and status.`}
      />

      {/* search box */}
      <div className="relative flex h-12 items-center gap-2.5 rounded-[6px] border border-border bg-surface px-4 shadow-[var(--shadow-soft)] transition-colors focus-within:border-border-strong">
        <Search size={18} className="shrink-0 text-text-faint" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, phone, locality, config…"
          className="w-full bg-transparent text-[15px] text-text outline-none placeholder:text-text-faint"
        />
        {q && (
          <button onClick={() => setQ("")} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-surface-2 hover:text-text" aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>

      {/* advanced filters */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-text-faint"><SlidersHorizontal size={13} /> Filters</span>
        {seesWholeClient && (
          <FilterSelect value={agentId} onChange={setAgentId} options={[{ value: "all", label: "All agents" }, ...agents.map((a) => ({ value: a.id, label: a.name }))]} />
        )}
        {seesWholeClient && (
          <FilterSelect value={teamId} onChange={setTeamId} options={[{ value: "all", label: "All teams" }, ...clientTeams.map((t) => ({ value: t.id, label: t.name }))]} />
        )}
        <FilterSelect value={source} onChange={setSource} options={[{ value: "all", label: "All sources" }, ...SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] }))]} />
        <FilterSelect value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, ...LEAD_STATUSES.map((s) => ({ value: s, label: s }))]} />
        {activeFilters > 0 && (
          <button onClick={clearFilters} className="inline-flex h-9 items-center gap-1 rounded-[5px] border border-border px-2.5 text-xs font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text">
            <X size={13} /> Clear{activeFilters > 0 ? ` (${activeFilters})` : ""}
          </button>
        )}
      </div>

      {/* result count */}
      {buyers.length > 0 && (
        <div className="mt-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-text-faint">
          <span className="tabular rounded-pill bg-surface-2 px-2 py-0.5 text-text-muted">{results.length}</span>
          {query || activeFilters > 0 ? <>leads match your filters</> : <>leads in your book · ranked by score</>}
        </div>
      )}

      {/* results / empty states */}
      <div className="mt-3 space-y-2">
        {buyers.length === 0 ? (
          <EmptyState
            icon={<UserSearch size={26} />}
            title="No leads in your book yet"
            body="As leads are captured and assigned to you, they'll appear here — searchable by name, phone, locality and more."
          />
        ) : results.length === 0 ? (
          <EmptyState
            muted
            icon={<Search size={26} />}
            title="No leads match"
            body="Nothing matches those filters. Try clearing a filter, or search by phone or locality — or this may be a brand-new lead worth capturing."
          />
        ) : (
          <AnimatePresence initial={false}>
            {results.map((b, i) => (
              <LeadRow key={b.id} buyer={b} index={i} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </PageContainer>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const active = value !== "all";
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-9 appearance-none rounded-[5px] border bg-surface py-0 pl-3 pr-8 text-sm outline-none transition-colors focus:border-border-strong", active ? "border-accent/60 font-medium text-text" : "border-border text-text-muted")}
      >
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-faint" />
    </div>
  );
}

/* ---------------- a single lead result → opens the Buyer 360 ---------------- */
function LeadRow({ buyer, index }: { buyer: Buyer; index: number }) {
  const interest = interestOf(buyer);
  const bp = bookingProbability(buyer.score, STAGES.indexOf(buyer.stage), STAGES.length);
  const bpVariant: PillVariant = bp >= 70 ? "positive" : bp >= 45 ? "live" : "neutral";
  const persona = personaOf(buyer);
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ ...SPRING, delay: Math.min(index * 0.02, 0.25) }}>
      <Link
        href={`/buyers/${buyer.id}`}
        className="group flex items-center gap-3.5 rounded-[6px] border border-border bg-surface p-3.5 shadow-[var(--shadow-soft)] transition-colors hover:border-border-strong hover:bg-surface-2"
      >
        <ScoreBadge score={buyer.score} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-text">{buyer.name}</span>
            <Pill variant={INTEREST_VARIANT[interest]} className="shrink-0">{interest}</Pill>
            <Pill variant={bpVariant} className="shrink-0"><TrendingUp size={11} /> {bp}% book</Pill>
            <span className="shrink-0 rounded-[4px] bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-muted">{persona}</span>
          </div>
          <div className="mt-0.5 truncate text-xs text-text-muted">
            {buyer.config} · {buyer.localityPrefs[0]} · {rupeeRange(buyer.budgetMin, buyer.budgetMax)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-text-faint">
            <span className="inline-flex items-center gap-1"><Phone size={11} /> {buyer.phone}</span>
            <span>·</span>
            <span className="font-mono">via {SOURCE_LABEL[buyer.source]}</span>
            <span>·</span>
            <span>{buyer.stage}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="hidden items-center gap-1.5 sm:flex">
            <Avatar name={buyer.agent} hue={buyer.hue} size={22} />
            <span className="font-mono text-[11px] text-text-muted">{buyer.agentInitials}</span>
          </span>
          <ChevronRight size={18} className="text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-text" />
        </div>
      </Link>
    </motion.div>
  );
}

function EmptyState({ icon, title, body, muted }: { icon: React.ReactNode; title: string; body: string; muted?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid place-items-center rounded-[6px] border border-dashed border-border bg-surface px-6 py-16 text-center">
      <span className={cn("grid h-14 w-14 place-items-center rounded-full", muted ? "bg-surface-2 text-text-faint" : "bg-accent-soft text-accent")}>{icon}</span>
      <h3 className="mt-4 font-display text-lg font-bold text-text">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-text-muted">{body}</p>
    </motion.div>
  );
}
