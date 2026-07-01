"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, UserSearch, Phone, X } from "lucide-react";
import { useScopedBuyers, useCurrentUser } from "@/lib/roles";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Avatar, ScoreBadge, Pill } from "@/components/ui/primitives";
import { SOURCE_LABEL, interestOf, type Buyer, type Interest } from "@/lib/data/types";
import { cn, rupeeRange } from "@/lib/utils";

const SPRING = { type: "spring" as const, stiffness: 380, damping: 32 };

type PillVariant = "neutral" | "accent" | "live" | "positive" | "negative" | "outline";
const INTEREST_VARIANT: Record<Interest, PillVariant> = {
  New: "accent", Hot: "negative", Warm: "live", Cold: "neutral", Interested: "positive", "Not Interested": "outline",
};

export default function LeadSearchPage() {
  const buyers = useScopedBuyers();
  const user = useCurrentUser();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  // Managers, super-admins and telecallers see the whole company book; agents see only their own.
  const seesWholeClient = user.role !== "agent";
  const scopeNote = seesWholeClient ? `all ${buyers.length} company leads` : `your ${buyers.length} leads`;

  // Always start from the full role-scoped book (whole client for manager/telecaller,
  // only their own for an agent), then filter as the user types.
  const results = useMemo(() => {
    const base = [...buyers].sort((a, b) => b.score - a.score);
    if (!query) return base.slice(0, 100);
    return base
      .filter((b) =>
        b.name.toLowerCase().includes(query) ||
        b.phone.toLowerCase().includes(query) ||
        b.config.toLowerCase().includes(query) ||
        b.localityPrefs.some((l) => l.toLowerCase().includes(query)) ||
        SOURCE_LABEL[b.source].toLowerCase().includes(query) ||
        b.stage.toLowerCase().includes(query) ||
        b.agent.toLowerCase().includes(query),
      )
      .slice(0, 100);
  }, [buyers, query]);

  return (
    <PageContainer>
      <PageHeader
        kicker="Find any lead — no duplicates"
        title="Lead search"
        description={`Search ${scopeNote} by name, phone, locality, configuration or source. Click a result to open the full lead.`}
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

      {/* result count */}
      {buyers.length > 0 && (
        <div className="mt-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-text-faint">
          <span className="tabular rounded-pill bg-surface-2 px-2 py-0.5 text-text-muted">{results.length}</span>
          {query ? <>leads matching “{q.trim()}”</> : <>leads in your book · ranked by score</>}
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
            title={`No leads match “${q.trim()}”`}
            body="Nothing in the book matches that. Check the spelling, try a phone number or locality — or this may be a brand-new lead worth capturing."
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

/* ---------------- a single lead result → opens the Buyer 360 ---------------- */
function LeadRow({ buyer, index }: { buyer: Buyer; index: number }) {
  const interest = interestOf(buyer);
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ ...SPRING, delay: Math.min(index * 0.02, 0.25) }}>
      <Link
        href={`/buyers/${buyer.id}`}
        className="group flex items-center gap-3.5 rounded-[6px] border border-border bg-surface p-3.5 shadow-[var(--shadow-soft)] transition-colors hover:border-border-strong hover:bg-surface-2"
      >
        <ScoreBadge score={buyer.score} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-text">{buyer.name}</span>
            <Pill variant={INTEREST_VARIANT[interest]} className="shrink-0">{interest}</Pill>
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
