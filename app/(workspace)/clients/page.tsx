"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Building, Users, ArrowRight, TrendingUp, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Avatar, Pill, Meter, AnimatedNumber, Label } from "@/components/ui/primitives";
import { rupees, cn } from "@/lib/utils";

const BOOKED = ["Booking Amount Paid", "Booking Confirmed", "Agreement Signed", "Loan Sanction", "Registration", "Handover"];

export default function ClientsPage() {
  const router = useRouter();
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const buyers = useStore((s) => s.buyers);
  const analyticsByClient = useStore((s) => s.analyticsByClient);
  const setActiveClient = useStore((s) => s.setActiveClient);

  const rows = useMemo(() => clients.map((c) => {
    const cBuyers = buyers.filter((b) => b.clientId === c.id);
    const agents = users.filter((u) => u.clientId === c.id && u.role === "agent");
    const manager = users.find((u) => u.clientId === c.id && u.role === "manager");
    const value = cBuyers.reduce((s, b) => s + b.budgetMax, 0);
    const bookings = cBuyers.filter((b) => BOOKED.includes(b.stage)).length;
    const health = analyticsByClient[c.id]?.health;
    return { c, cBuyers, agents, manager, value, bookings, health };
  }), [clients, buyers, users, analyticsByClient]);

  const totalAgents = users.filter((u) => u.role === "agent").length;
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalBookings = rows.reduce((s, r) => s + r.bookings, 0);

  const enter = (id: string, name: string) => {
    setActiveClient(id);
    toast(`Entered ${name}`, { description: "every screen now shows this client's data" });
    router.push("/worklist");
  };

  return (
    <PageContainer>
      <PageHeader kicker="Platform · super-admin" title="Clients" description="Every real-estate company on RelationOS. Monitor each tenant, then drop into one to see its worklist, pipeline and approvals." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Client companies" value={clients.length} sub="active tenants" />
        <Kpi label="Agents" value={totalAgents} sub="across all clients" />
        <Kpi label="Contracts in flight" value={buyers.length} sub="buyers platform-wide" />
        <Kpi label="Pipeline value" valueText={rupees(totalValue)} sub={`${totalBookings} bookings`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map(({ c, cBuyers, agents, manager, value, bookings, health }, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
            className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-[var(--shadow-soft)]"
          >
            <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, hsl(${c.hue} 60% 45%), hsl(${(c.hue + 40) % 360} 55% 40%))` }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-[12px] text-white" style={{ background: `linear-gradient(140deg, hsl(${c.hue} 55% 44%), hsl(${(c.hue + 40) % 360} 60% 34%))` }}><Building size={20} /></span>
                  <div>
                    <h2 className="font-display text-lg font-bold leading-none">{c.name}</h2>
                    <p className="mt-1 text-xs text-text-muted">{c.city} · {agents.length} agents</p>
                  </div>
                </div>
                <Pill variant="accent">{c.plan}</Pill>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <Stat label="Contracts" value={cBuyers.length} />
                <Stat label="Pipeline" valueText={rupees(value)} />
                <Stat label="Bookings" value={bookings} />
              </div>

              {health && (
                <div className="mt-4 space-y-2 border-t border-border pt-3">
                  <HealthRow label="Capture precision" value={health.capturePrecision} />
                  <HealthRow label="AI-handled share" value={health.aiHandledShare} />
                  <HealthRow label="Dedupe rate" value={health.dedupeRate} />
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  {manager && <Avatar name={manager.name} hue={manager.hue} size={22} />}
                  <span>{manager?.name} · <span className="text-text-faint">Manager</span></span>
                </div>
                <button onClick={() => enter(c.id, c.name)} className="group inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-accent px-3.5 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95">
                  Enter client <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </PageContainer>
  );
}

function Kpi({ label, value, valueText, sub }: { label: string; value?: number; valueText?: string; sub: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
      <Label>{label}</Label>
      <div className="mt-2 font-display text-2xl font-bold leading-none text-text md:text-[28px]">{valueText ?? <AnimatedNumber value={value ?? 0} />}</div>
      <p className="mt-1.5 text-xs text-text-faint">{sub}</p>
    </div>
  );
}

function Stat({ label, value, valueText }: { label: string; value?: number; valueText?: string }) {
  return (
    <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
      <div className="font-display text-lg font-bold leading-none text-text tabular">{valueText ?? <AnimatedNumber value={value ?? 0} />}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-text-faint">{label}</div>
    </div>
  );
}

function HealthRow({ label, value }: { label: string; value: number }) {
  const color = value >= 90 ? "var(--positive)" : value >= 75 ? "var(--accent)" : "var(--live)";
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-xs text-text-muted">{label}</span>
      <Meter value={value} color={color} height={5} />
      <span className="w-9 shrink-0 text-right font-mono text-xs font-semibold tabular" style={{ color }}>{value}%</span>
    </div>
  );
}
