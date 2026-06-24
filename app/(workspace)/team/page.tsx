"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Users, ChevronDown, ArrowUpRight, Eye, TriangleAlert, Target } from "lucide-react";
import { useStore } from "@/lib/store";
import { useActiveClient, useScopedBuyers } from "@/lib/roles";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Avatar, Pill, Meter, AnimatedNumber, Label, ScoreBadge } from "@/components/ui/primitives";
import { rupees, cn } from "@/lib/utils";
import type { Buyer, OrgUser } from "@/lib/data/types";

const BOOKED = ["Booking Amount Paid", "Booking Confirmed", "Agreement Signed", "Loan Sanction", "Registration", "Handover"];
const VISITED = ["Site Visit Scheduled", "Site Visit Completed", "Unit Selected", "Booking Amount Paid", "Booking Confirmed", "Agreement Signed", "Loan Sanction", "Registration", "Handover"];

function agentStats(agent: OrgUser, buyers: Buyer[]) {
  const mine = buyers.filter((b) => b.agentId === agent.id);
  const value = mine.reduce((s, b) => s + b.budgetMax, 0);
  const bookings = mine.filter((b) => BOOKED.includes(b.stage)).length;
  const visits = mine.filter((b) => VISITED.includes(b.stage)).length;
  const hot = mine.filter((b) => b.score >= 75).length;
  const warm = mine.filter((b) => b.score >= 50 && b.score < 75).length;
  const cool = mine.length - hot - warm;
  const stalled = mine.filter((b) => b.stalled).length;
  const avg = mine.length ? Math.round(mine.reduce((s, b) => s + b.score, 0) / mine.length) : 0;
  return { mine, value, bookings, visits, hot, warm, cool, stalled, avg, target: agent.target ?? 6 };
}

export default function TeamPage() {
  const client = useActiveClient();
  const buyers = useScopedBuyers();
  const teams = useStore((s) => s.teams);
  const users = useStore((s) => s.users);

  const clientTeams = useMemo(() => teams.filter((t) => t.clientId === client?.id), [teams, client]);
  const agents = useMemo(() => users.filter((u) => u.clientId === client?.id && u.role === "agent"), [users, client]);

  const totalValue = buyers.reduce((s, b) => s + b.budgetMax, 0);
  const totalBookings = buyers.filter((b) => BOOKED.includes(b.stage)).length;

  return (
    <PageContainer>
      <PageHeader
        kicker={`${client?.name} · ${agents.length} agents`}
        title="Team"
        description="Monitor your teams and the contracts each agent is handling — workload, pipeline value and conversion at a glance."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Agents" value={agents.length} sub={`${clientTeams.length} teams`} />
        <Kpi label="Contracts in flight" value={buyers.length} sub="assigned buyers" />
        <Kpi label="Pipeline value" valueText={rupees(totalValue)} sub="across all agents" />
        <Kpi label="Bookings" value={totalBookings} sub="this quarter" />
      </div>

      <div className="space-y-5">
        {clientTeams.map((team) => {
          const teamAgents = agents.filter((a) => a.teamId === team.id);
          return (
            <section key={team.id} className="rounded-[16px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)] md:p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent"><Users size={16} /></span>
                <div>
                  <h2 className="font-display text-lg font-bold leading-none">{team.name}</h2>
                  <p className="mt-1 text-xs text-text-muted">{teamAgents.length} agents · {teamAgents.reduce((s, a) => s + buyers.filter((b) => b.agentId === a.id).length, 0)} contracts</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {teamAgents.map((a) => (<AgentRow key={a.id} agent={a} buyers={buyers} />))}
              </div>
            </section>
          );
        })}
      </div>
    </PageContainer>
  );
}

function Kpi({ label, value, valueText, sub }: { label: string; value?: number; valueText?: string; sub: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
      <Label>{label}</Label>
      <div className="mt-2 font-display text-2xl font-bold leading-none text-text md:text-[28px]">
        {valueText ?? <AnimatedNumber value={value ?? 0} />}
      </div>
      <p className="mt-1.5 text-xs text-text-faint">{sub}</p>
    </div>
  );
}

function AgentRow({ agent, buyers }: { agent: OrgUser; buyers: Buyer[] }) {
  const [open, setOpen] = useState(false);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const st = agentStats(agent, buyers);
  const targetPct = Math.min(100, Math.round((st.bookings / st.target) * 100));

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-surface-2">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-inset/50">
        <Avatar name={agent.name} hue={agent.hue} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-text">{agent.name}</span>
            {st.stalled > 0 && <Pill variant="negative"><TriangleAlert size={11} /> {st.stalled} stalled</Pill>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
            <span><span className="font-semibold text-text">{st.mine.length}</span> contracts</span>
            <span className="text-positive">{st.hot} hot</span>
            <span className="text-live">{st.warm} warm</span>
            <span className="text-text-faint">{st.cool} cool</span>
          </div>
        </div>
        <div className="hidden text-right sm:block">
          <div className="text-sm font-semibold text-text tabular">{rupees(st.value)}</div>
          <div className="font-mono text-[10px] uppercase tracking-wide text-text-faint">pipeline</div>
        </div>
        <div className="hidden w-24 sm:block">
          <div className="mb-1 flex items-center justify-between text-[10px]"><span className="font-mono uppercase text-text-faint">target</span><span className="font-mono font-semibold text-text">{st.bookings}/{st.target}</span></div>
          <Meter value={targetPct} color={targetPct >= 100 ? "var(--positive)" : "var(--accent)"} height={5} />
        </div>
        <ChevronDown size={16} className={cn("shrink-0 text-text-faint transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-border">
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs text-text-muted"><Target size={13} className="text-accent" /> {st.visits} visits · avg score {st.avg}</span>
              <button
                onClick={() => { setCurrentUser(agent.id); toast(`Viewing as ${agent.name}`, { description: "the app is now scoped to their contracts" }); }}
                className="inline-flex items-center gap-1.5 rounded-pill border border-accent/40 bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft/70"
              >
                <Eye size={12} /> View as agent
              </button>
            </div>
            <div className="space-y-1 px-3 pb-3">
              <Label className="mb-1 block">Contracts handled</Label>
              {st.mine.length === 0 && <p className="py-2 text-sm text-text-faint">No contracts assigned.</p>}
              {st.mine.slice(0, 8).map((b) => (
                <Link key={b.id} href={`/buyers/${b.id}`} className="flex items-center gap-3 rounded-[8px] px-2 py-1.5 transition-colors hover:bg-surface-inset/60">
                  <ScoreBadge score={b.score} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text">{b.name}</div>
                    <div className="truncate text-xs text-text-muted">{b.config} · {b.localityPrefs[0]} · {rupees(b.budgetMax)}</div>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">{b.stage}</span>
                  <ArrowUpRight size={13} className="text-text-faint" />
                </Link>
              ))}
              {st.mine.length > 8 && <p className="px-2 pt-1 text-xs text-text-faint">+{st.mine.length - 8} more</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
