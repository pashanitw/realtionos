"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight, ChevronRight, Phone, CalendarCheck, Clock,
  TriangleAlert, Sparkles, TrendingUp, Users, Car, ShieldCheck, Inbox,
  Trophy, KeyRound, Target, Wallet, CircleDot, Zap,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  useCurrentUser, useActiveClient, useScopedBuyers, useScopedDeals,
  useScopedReviewItems, useScopedOvernightLeads, useClientCabBookings,
} from "@/lib/roles";
import { PageContainer } from "@/components/ui/page";
import { Label, AnimatedNumber, Avatar, Pill, Meter, ScoreBadge } from "@/components/ui/primitives";
import { STAGES, isBooked } from "@/lib/data/types";
import { cn, rupees, rupeeRange, relativeTime, SEED_NOW } from "@/lib/utils";

const DAY = 86_400_000;

/* ---------------- tone helpers ---------------- */
type Tone = "default" | "accent" | "positive" | "negative" | "live";
const TONE_VAR: Record<Tone, string> = {
  default: "var(--text)",
  accent: "var(--accent)",
  positive: "var(--positive)",
  negative: "var(--negative)",
  live: "var(--live)",
};

/* ---------------- reusable cards ---------------- */
function KpiCard({
  label, value, hint, tone = "default", href, icon: Icon, index = 0,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  href?: string;
  icon?: typeof Inbox;
  index?: number;
}) {
  const body = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      className={cn(
        "group relative h-full rounded-[14px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]",
        href && "transition-colors hover:border-border-strong",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {Icon && <Icon size={14} className="shrink-0 text-text-faint" />}
      </div>
      <div
        className="mt-1.5 font-display text-[26px] font-bold leading-none"
        style={{ color: TONE_VAR[tone] }}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1 flex items-center gap-1 font-mono text-[11px] text-text-faint">
          {hint}
          {href && <ArrowUpRight size={11} className="opacity-0 transition-opacity group-hover:opacity-100" />}
        </div>
      )}
    </motion.div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

function SectionCard({
  label, icon: Icon, viewAllHref, viewAllLabel = "View all", children, index = 0, className,
}: {
  label: string;
  icon?: typeof Inbox;
  viewAllHref?: string;
  viewAllLabel?: string;
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className={cn("rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]", className)}
    >
      <div className="mb-4 flex items-center gap-2">
        {Icon && <Icon size={15} className="text-accent" />}
        <Label>{label}</Label>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="ml-auto flex items-center gap-0.5 font-mono text-[11px] text-text-muted transition-colors hover:text-accent"
          >
            {viewAllLabel} <ChevronRight size={12} />
          </Link>
        )}
      </div>
      {children}
    </motion.section>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[72px] place-items-center rounded-[12px] border border-dashed border-border px-4 text-center text-sm text-text-faint">
      {children}
    </div>
  );
}

function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-[12px] border border-transparent px-2.5 py-2.5 transition-colors hover:border-border hover:bg-surface-2"
    >
      {children}
      <ChevronRight size={15} className="shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-text-muted" />
    </Link>
  );
}

/* short clock for a timestamp */
function clock(t: number) {
  return new Date(t).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: true });
}

/* ---------------- greeting ---------------- */
function useGreeting() {
  const user = useCurrentUser();
  const client = useActiveClient();
  const hr = new Date(SEED_NOW).getHours();
  const part = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const firstName = user.name.split(" ")[0];
  return { greeting: `${part}, ${firstName}`, user, client };
}

function Greeting({ subtitle }: { subtitle: string }) {
  const { greeting, user } = useGreeting();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3.5">
        <Avatar name={user.name} hue={user.hue} size={48} />
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-bold leading-none tracking-tight text-text md:text-[30px]">
            {greeting}
          </h1>
          <p className="mt-1.5 text-sm text-text-muted">{subtitle}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================ */
/*  PAGE                                                        */
/* ============================================================ */
export default function HomePage() {
  const user = useCurrentUser();
  if (user.role === "manager" || user.role === "super-admin") return <ManagerHome />;
  if (user.role === "telecaller") return <TelecallerHome />;
  return <AgentHome />;
}

/* ============================================================ */
/*  MANAGER — Command center                                   */
/* ============================================================ */
function ManagerHome() {
  const client = useActiveClient();
  const buyers = useScopedBuyers();
  const deals = useScopedDeals();
  const reviews = useScopedReviewItems();
  const leads = useScopedOvernightLeads();
  const users = useStore((s) => s.users);
  const activeClientId = useStore((s) => s.activeClientId);

  const inFlight = useMemo(() => deals.filter((d) => d.stage !== "Registration" && d.stage !== "Handover"), [deals]);
  const pipelineValue = useMemo(() => inFlight.reduce((s, d) => s + d.valueInr, 0), [inFlight]);
  const bookings = useMemo(() => deals.filter((d) => isBooked(d.stage)), [deals]);

  // team rows
  const team = useMemo(() => {
    const agents = users.filter((u) => u.role === "agent" && u.clientId === activeClientId);
    const rows = agents.map((a) => {
      const myBuyers = buyers.filter((b) => b.agentId === a.id);
      const myDeals = deals.filter((d) => d.agentId === a.id);
      const pipeline = myDeals.reduce((s, d) => s + d.valueInr, 0);
      const bk = myDeals.filter((d) => isBooked(d.stage)).length;
      return { id: a.id, name: a.name, initials: a.initials, hue: a.hue, contracts: myBuyers.length, pipeline, bookings: bk };
    });
    return rows.sort((a, b) => b.pipeline - a.pipeline);
  }, [users, activeClientId, buyers, deals]);
  const teamMax = Math.max(1, ...team.map((t) => t.pipeline));

  // pipeline by stage
  const byStage = useMemo(
    () =>
      STAGES.map((stage) => {
        const ds = deals.filter((d) => d.stage === stage);
        return { stage, count: ds.length, value: ds.reduce((s, d) => s + d.valueInr, 0) };
      }),
    [deals],
  );
  const stageMax = Math.max(1, ...byStage.map((s) => s.count));

  const stalled = useMemo(() => deals.filter((d) => d.stalled).slice(0, 4), [deals]);

  return (
    <PageContainer>
      <Greeting subtitle={`Command center · ${client?.name ?? "All clients"}`} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard index={0} label="Pipeline value" value={rupees(pipelineValue)} hint="open contracts" icon={Wallet} tone="accent" />
        <KpiCard index={1} label="Contracts in flight" value={<AnimatedNumber value={inFlight.length} />} hint="not yet registered" icon={TrendingUp} />
        <KpiCard index={2} label="Bookings" value={<AnimatedNumber value={bookings.length} />} hint="booked + registered" icon={KeyRound} tone="positive" />
        <KpiCard index={3} label="Approvals waiting" value={<AnimatedNumber value={reviews.length} />} hint="needs your nod" icon={ShieldCheck} tone="live" href="/approvals" />
        <KpiCard index={4} label="Overnight leads" value={<AnimatedNumber value={leads.length} />} hint="captured by AI" icon={Sparkles} href="/leads" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Team performance */}
        <SectionCard index={0} label="Team performance" icon={Trophy} viewAllHref="/team" viewAllLabel="View team">
          {team.length === 0 ? (
            <EmptyRow>No agents on this team yet.</EmptyRow>
          ) : (
            <div className="space-y-3">
              {team.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <Avatar name={t.name} hue={t.hue} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold text-text">{t.name}</span>
                      <span className="tabular shrink-0 font-mono text-[13px] font-semibold text-text">{rupees(t.pipeline)}</span>
                    </div>
                    <div className="mt-1.5">
                      <Meter value={(t.pipeline / teamMax) * 100} color={`hsl(${t.hue} 55% 48%)`} height={5} />
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-text-faint">
                      {t.contracts} contracts · {t.bookings} bookings
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Pipeline by stage */}
        <SectionCard index={1} label="Pipeline by stage" icon={CircleDot} viewAllHref="/pipeline">
          <div className="space-y-2.5">
            {byStage.map((s) => (
              <div key={s.stage} className="flex items-center gap-3">
                <span className="w-[120px] shrink-0 truncate text-[13px] text-text-muted">{s.stage}</span>
                <div className="flex-1">
                  <Meter value={(s.count / stageMax) * 100} color="var(--accent)" height={8} />
                </div>
                <span className="tabular w-9 shrink-0 text-right font-mono text-[12px] font-semibold text-text">{s.count}</span>
                <span className="tabular w-[68px] shrink-0 text-right font-mono text-[11px] text-text-faint">{rupees(s.value)}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Needs attention */}
        <SectionCard index={2} label="Needs attention" icon={TriangleAlert} viewAllHref="/pipeline" className="lg:col-span-2">
          <div className="space-y-1">
            {stalled.map((d) => (
              <RowLink key={d.id} href={`/buyers/${d.buyerId}`}>
                <Avatar name={d.name} hue={d.hue} size={32} />
                <div className="min-w-0 flex-1">
                  <span className="truncate font-medium text-text">{d.name}</span>
                  <div className="font-mono text-[11px] text-text-faint">{d.project} · {d.stage}</div>
                </div>
                <span className="tabular shrink-0 font-mono text-[13px] font-semibold text-text">{rupees(d.valueInr)}</span>
                <Pill variant="negative">Stalled</Pill>
              </RowLink>
            ))}
            <RowLink href="/approvals">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-live-soft text-live">
                <ShieldCheck size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <span className="font-medium text-text">
                  {reviews.length} {reviews.length === 1 ? "approval" : "approvals"} waiting
                </span>
                <div className="font-mono text-[11px] text-text-faint">AI actions need your nod</div>
              </div>
              <Pill variant="live">Review</Pill>
            </RowLink>
            {stalled.length === 0 && reviews.length === 0 && <EmptyRow>Nothing needs attention. Nice.</EmptyRow>}
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}

/* ============================================================ */
/*  AGENT — Your day                                           */
/* ============================================================ */
function AgentHome() {
  const client = useActiveClient();
  const buyers = useScopedBuyers();
  const deals = useScopedDeals();
  const reviews = useScopedReviewItems();

  const myPipeline = useMemo(() => deals.reduce((s, d) => s + d.valueInr, 0), [deals]);
  const visitsToday = useMemo(
    () => buyers.filter((b) => b.siteVisitDue != null && b.siteVisitDue >= SEED_NOW && b.siteVisitDue <= SEED_NOW + DAY),
    [buyers],
  );
  const overdue = useMemo(
    () => buyers.filter((b) => b.followUpAt != null && b.followUpAt < SEED_NOW),
    [buyers],
  );

  const callFirst = useMemo(() => [...buyers].sort((a, b) => b.score - a.score).slice(0, 5), [buyers]);
  const visits = useMemo(
    () => buyers.filter((b) => b.siteVisitDue != null).sort((a, b) => (a.siteVisitDue ?? 0) - (b.siteVisitDue ?? 0)).slice(0, 5),
    [buyers],
  );
  const closing = useMemo(() => [...deals].sort((a, b) => a.closeDate - b.closeDate).slice(0, 4), [deals]);

  return (
    <PageContainer>
      <Greeting subtitle={`Your day · ${client?.name ?? ""}`} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard index={0} label="My contracts" value={<AnimatedNumber value={buyers.length} />} hint="active buyers" icon={Users} />
        <KpiCard index={1} label="My pipeline" value={rupees(myPipeline)} hint="open deal value" icon={Wallet} tone="accent" />
        <KpiCard index={2} label="Visits today" value={<AnimatedNumber value={visitsToday.length} />} hint="next 24 hours" icon={CalendarCheck} tone="live" />
        <KpiCard index={3} label="Overdue follow-ups" value={<AnimatedNumber value={overdue.length} />} hint="past due" icon={Clock} tone="negative" />
        <KpiCard index={4} label="My approvals" value={<AnimatedNumber value={reviews.length} />} hint="needs your nod" icon={ShieldCheck} href="/approvals" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Call these first */}
        <SectionCard index={0} label="Call these first" icon={Phone} viewAllHref="/worklist" viewAllLabel="Open worklist">
          {callFirst.length === 0 ? (
            <EmptyRow>No buyers assigned yet.</EmptyRow>
          ) : (
            <div className="space-y-1">
              {callFirst.map((b) => (
                <RowLink key={b.id} href={`/buyers/${b.id}`}>
                  <ScoreBadge score={b.score} size={38} />
                  <Avatar name={b.name} hue={b.hue} size={32} />
                  <div className="min-w-0 flex-1">
                    <span className="truncate font-medium text-text">{b.name}</span>
                    <div className="font-mono text-[11px] text-text-faint">
                      {b.config} · {b.localityPrefs[0]} · {rupeeRange(b.budgetMin, b.budgetMax)}
                    </div>
                  </div>
                </RowLink>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Today's site visits */}
        <SectionCard index={1} label="Today's site visits" icon={CalendarCheck} viewAllHref="/worklist">
          {visits.length === 0 ? (
            <EmptyRow>No site visits scheduled.</EmptyRow>
          ) : (
            <div className="space-y-1">
              {visits.map((b) => (
                <RowLink key={b.id} href={`/buyers/${b.id}`}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-live-soft text-live">
                    <CalendarCheck size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="truncate font-medium text-text">{b.name}</span>
                    <div className="font-mono text-[11px] text-text-faint">{b.config} · {b.localityPrefs[0]}</div>
                  </div>
                  <span className="tabular shrink-0 font-mono text-[11px] text-text-muted">
                    {(b.siteVisitDue ?? 0) >= SEED_NOW ? relativeTime(b.siteVisitDue ?? 0) : clock(b.siteVisitDue ?? 0)}
                  </span>
                </RowLink>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Closing soon */}
        <SectionCard index={2} label="Closing soon" icon={Target} viewAllHref="/pipeline" className="lg:col-span-2">
          {closing.length === 0 ? (
            <EmptyRow>No open deals.</EmptyRow>
          ) : (
            <div className="grid gap-1 sm:grid-cols-2">
              {closing.map((d) => {
                const days = Math.round((d.closeDate - SEED_NOW) / DAY);
                return (
                  <RowLink key={d.id} href={`/buyers/${d.buyerId}`}>
                    <Avatar name={d.name} hue={d.hue} size={32} />
                    <div className="min-w-0 flex-1">
                      <span className="truncate font-medium text-text">{d.name}</span>
                      <div className="font-mono text-[11px] text-text-faint">
                        {days <= 0 ? "closing now" : `closes in ${days}d`}
                      </div>
                    </div>
                    {d.tokenInr ? <Pill variant="positive" mono>token {rupees(d.tokenInr)}</Pill> : null}
                    <span className="tabular shrink-0 font-mono text-[13px] font-semibold text-text">{rupees(d.valueInr)}</span>
                  </RowLink>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}

/* ============================================================ */
/*  TELECALLER — Your day                                      */
/* ============================================================ */
function TelecallerHome() {
  const client = useActiveClient();
  const buyers = useScopedBuyers();
  const leads = useScopedOvernightLeads();
  const cabBookings = useClientCabBookings();

  const activeCabs = useMemo(() => cabBookings.filter((b) => b.status !== "completed"), [cabBookings]);
  const cabbedBuyerIds = useMemo(() => new Set(activeCabs.map((b) => b.buyerId)), [activeCabs]);

  const followUps = useMemo(
    () => buyers.filter((b) => b.followUpAt != null && b.followUpAt <= SEED_NOW).sort((a, b) => (a.followUpAt ?? 0) - (b.followUpAt ?? 0)),
    [buyers],
  );
  const needCab = useMemo(
    () =>
      buyers
        .filter((b) => b.siteVisitDue != null && !cabbedBuyerIds.has(b.id))
        .sort((a, b) => (a.siteVisitDue ?? 0) - (b.siteVisitDue ?? 0)),
    [buyers, cabbedBuyerIds],
  );

  return (
    <PageContainer>
      <Greeting subtitle={`Your day · ${client?.name ?? ""}`} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard index={0} label="Follow-ups due" value={<AnimatedNumber value={followUps.length} />} hint="to call back" icon={Phone} tone="negative" />
        <KpiCard index={1} label="Leads to qualify" value={<AnimatedNumber value={leads.length} />} hint="captured overnight" icon={Sparkles} href="/leads" />
        <KpiCard index={2} label="Visits to arrange" value={<AnimatedNumber value={needCab.length} />} hint="need a cab" icon={Car} href="/logistics" tone="live" />
        <KpiCard index={3} label="Active cabs" value={<AnimatedNumber value={activeCabs.length} />} hint="on the move" icon={Car} href="/logistics" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Follow-ups due */}
        <SectionCard index={0} label="Follow-ups due" icon={Phone} viewAllHref="/worklist">
          {followUps.length === 0 ? (
            <EmptyRow>All caught up on follow-ups.</EmptyRow>
          ) : (
            <div className="space-y-1">
              {followUps.slice(0, 6).map((b) => (
                <RowLink key={b.id} href={`/buyers/${b.id}`}>
                  <Avatar name={b.name} hue={b.hue} size={32} />
                  <div className="min-w-0 flex-1">
                    <span className="truncate font-medium text-text">{b.name}</span>
                    <div className="tabular flex items-center gap-1.5 font-mono text-[11px] text-text-faint">
                      <Phone size={10} /> {b.phone} · {b.localityPrefs[0]}
                    </div>
                  </div>
                  <Pill variant="negative">Overdue</Pill>
                </RowLink>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Site visits needing a cab */}
        <SectionCard index={1} label="Site visits needing a cab" icon={Car} viewAllHref="/logistics" viewAllLabel="Book a cab">
          {needCab.length === 0 ? (
            <EmptyRow>Every upcoming visit has a cab.</EmptyRow>
          ) : (
            <div className="space-y-1">
              {needCab.slice(0, 5).map((b) => (
                <RowLink key={b.id} href={`/logistics`}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent">
                    <Car size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="truncate font-medium text-text">{b.name}</span>
                    <div className="font-mono text-[11px] text-text-faint">{b.localityPrefs[0]}</div>
                  </div>
                  <span className="tabular shrink-0 font-mono text-[11px] text-text-muted">
                    {(b.siteVisitDue ?? 0) >= SEED_NOW ? relativeTime(b.siteVisitDue ?? 0) : clock(b.siteVisitDue ?? 0)}
                  </span>
                </RowLink>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Fresh overnight leads */}
        <SectionCard index={2} label="Fresh overnight leads" icon={Zap} viewAllHref="/leads" className="lg:col-span-2">
          {leads.length === 0 ? (
            <EmptyRow>No overnight leads captured.</EmptyRow>
          ) : (
            <div className="grid gap-1 sm:grid-cols-2">
              {leads.slice(0, 5).map((lead) => (
                <RowLink key={lead.id} href="/leads">
                  <Avatar name={lead.name} hue={lead.hue} size={32} />
                  <div className="min-w-0 flex-1">
                    <span className="truncate font-medium text-text">{lead.name}</span>
                    <div className="truncate font-mono text-[11px] text-text-faint">
                      {lead.requirement || "Captured by AI"}
                    </div>
                  </div>
                  <span className="tabular shrink-0 font-mono text-[11px] text-text-muted">{lead.capturedLabel}</span>
                </RowLink>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}
