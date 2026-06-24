"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListTodo, ClipboardCheck, CheckSquare, CheckCircle2, Circle, CircleDot,
  Clock, Phone, MessageCircle, CalendarCheck, Sparkles, TriangleAlert,
  ArrowRight, ChevronRight, Zap, Video, type LucideIcon,
} from "lucide-react";
import { useScopedBuyers, useScopedTasks } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Label, AnimatedNumber, Avatar, Pill } from "@/components/ui/primitives";
import { cn, SEED_NOW } from "@/lib/utils";
import { toast } from "sonner";
import type { Buyer } from "@/lib/data/types";

const DAY = 86_400_000;
const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** Tiny deterministic string hash (no Math.random / Date.now). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

type Priority = "High" | "Medium" | "Low";
type Source = { label: string; icon: LucideIcon };

const PRIORITY_PILL: Record<Priority, "negative" | "live" | "neutral"> = {
  High: "negative", Medium: "live", Low: "neutral",
};

const SOURCES: Source[] = [
  { label: "Auto-created after a call", icon: Phone },
  { label: "Auto-created after a WhatsApp reply", icon: MessageCircle },
  { label: "Auto-created from follow-up SLA", icon: Clock },
  { label: "Auto-created after a site visit", icon: CalendarCheck },
];

/** Action title derived deterministically from the buyer's stage. */
function actionFor(b: Buyer): string {
  const config = b.config;
  const locality = b.localityPrefs[0] ?? "the area";
  switch (b.stage) {
    case "New Enquiry": return `Share ${config} options in ${locality}`;
    case "Qualified": return `Book a site visit`;
    case "Site Visit Scheduled": return `Confirm site visit`;
    case "Site Visit Completed": return `Send floor-rise pricing for ${config}`;
    case "Unit Selected": return `Send booking payment link`;
    case "Booking Amount Paid": return `Confirm booking · hold the unit`;
    case "Booking Confirmed": return `Send agreement for signing`;
    case "Agreement Signed": return `Chase loan documents`;
    case "Loan Sanction": return `Schedule registration`;
    case "Registration": return `Schedule handover & key collection`;
    case "Handover": return `Request feedback & a referral`;
    default: return `Call ${b.name} — follow-up`;
  }
}

interface Task {
  id: string;
  buyer: Buyer;
  title: string;
  priority: Priority;
  source: Source;
  due: number;
  overdue: boolean;
  kind: "derived" | "crm";
  done?: boolean; // for store-backed (crm) tasks
}

function buildTask(b: Buyer): Task {
  const h = hash(b.id);
  // Deterministic due time anchored on the buyer's own follow-up / visit when present,
  // otherwise spread across overdue / today / upcoming buckets via the id hash.
  let due: number;
  if (b.followUpAt != null) {
    due = b.followUpAt;
  } else if (b.siteVisitDue != null) {
    due = b.siteVisitDue;
  } else {
    const bucket = h % 3;
    if (bucket === 0) {
      // overdue: 1–4 days ago
      due = SEED_NOW - (1 + (h % 4)) * DAY;
    } else if (bucket === 1) {
      // today
      due = startOfDay(SEED_NOW) + (9 + (h % 8)) * 3_600_000;
    } else {
      // upcoming: 1–5 days out
      due = SEED_NOW + (1 + (h % 5)) * DAY;
    }
  }
  // Buyers already past their follow-up SLA lean overdue regardless.
  if (b.stalled) {
    due = Math.min(due, SEED_NOW - (1 + (h % 3)) * DAY);
  }
  const overdue = due < startOfDay(SEED_NOW);
  // Priority from score + overdue, deterministic.
  const priority: Priority =
    overdue || b.score >= 78 ? "High" : b.score >= 55 ? "Medium" : "Low";
  return {
    id: `T-${b.id}`,
    buyer: b,
    title: actionFor(b),
    priority,
    source: SOURCES[h % SOURCES.length],
    due,
    overdue,
    kind: "derived",
  };
}

type Filter = "All" | "Overdue" | "Today" | "Upcoming" | "Done";
const FILTERS: { key: Filter; icon: LucideIcon }[] = [
  { key: "All", icon: ListTodo },
  { key: "Overdue", icon: TriangleAlert },
  { key: "Today", icon: CircleDot },
  { key: "Upcoming", icon: Clock },
  { key: "Done", icon: CheckCircle2 },
];

function dueLabel(t: Task): { text: string; tone: "negative" | "live" | "muted" } {
  const dayStart = startOfDay(SEED_NOW);
  if (t.overdue) {
    const days = Math.max(1, Math.round((dayStart - startOfDay(t.due)) / DAY));
    return { text: `Overdue ${days}d`, tone: "negative" };
  }
  if (t.due >= dayStart && t.due < dayStart + DAY) {
    return { text: "Today", tone: "live" };
  }
  const days = Math.max(1, Math.round((startOfDay(t.due) - dayStart) / DAY));
  return { text: `in ${days}d`, tone: "muted" };
}

export default function TasksPage() {
  const buyers = useScopedBuyers();
  const crmTasks = useScopedTasks();
  const toggleStoreTask = useStore((s) => s.toggleTask);
  const [filter, setFilter] = useState<Filter>("All");
  const [done, setDone] = useState<Record<string, boolean>>({});

  const buyerById = useMemo(() => new Map(buyers.map((b) => [b.id, b])), [buyers]);

  // Real tasks created from meeting action items (store-backed), newest first.
  const crmMapped = useMemo(
    () => crmTasks.map((ct): Task | null => {
      const b = buyerById.get(ct.buyerId);
      if (!b) return null;
      return {
        id: ct.id, buyer: b, title: ct.title, priority: ct.priority,
        source: { label: ct.source, icon: Video }, due: ct.dueAt,
        overdue: ct.dueAt < startOfDay(SEED_NOW), kind: "crm", done: ct.done,
      };
    }).filter((t): t is Task => t !== null),
    [crmTasks, buyerById],
  );

  // ~12–16 buyers → one predictive task each, deterministic order by id.
  const derived = useMemo(() => {
    const pool = [...buyers].sort((a, b) => a.id.localeCompare(b.id)).slice(0, 16);
    return pool.map(buildTask);
  }, [buyers]);

  const tasks = useMemo(() => [...crmMapped, ...derived], [crmMapped, derived]);

  const isDone = (t: Task) => (t.kind === "crm" ? !!t.done : !!done[t.id]);

  const toggle = (t: Task) => {
    if (t.kind === "crm") {
      if (!t.done) toast.success(`Done · ${t.title}`);
      toggleStoreTask(t.id);
      return;
    }
    setDone((prev) => {
      const next = { ...prev, [t.id]: !prev[t.id] };
      if (next[t.id]) toast.success(`Done · ${t.title}`);
      return next;
    });
  };

  const counts = useMemo(() => {
    const dayStart = startOfDay(SEED_NOW);
    let open = 0, overdue = 0, today = 0;
    for (const t of tasks) {
      if (isDone(t)) continue;
      open++;
      if (t.overdue) overdue++;
      else if (t.due >= dayStart && t.due < dayStart + DAY) today++;
    }
    return { open, overdue, today, auto: tasks.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, done]);

  const visible = useMemo(() => {
    const dayStart = startOfDay(SEED_NOW);
    const inToday = (t: Task) => !t.overdue && t.due >= dayStart && t.due < dayStart + DAY;
    const inUpcoming = (t: Task) => !t.overdue && t.due >= dayStart + DAY;

    let list = tasks.filter((t) => {
      const d = isDone(t);
      switch (filter) {
        case "Done": return d;
        case "Overdue": return !d && t.overdue;
        case "Today": return !d && inToday(t);
        case "Upcoming": return !d && inUpcoming(t);
        case "All":
        default: return true;
      }
    });

    // overdue first → due ascending → done sinks to the bottom.
    list = list.sort((a, b) => {
      const da = isDone(a), db = isDone(b);
      if (da !== db) return da ? 1 : -1;
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.due - b.due;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, filter, done]);

  const kpis = [
    { label: "Open", value: counts.open, hint: "to action", tone: "text" as const },
    { label: "Overdue", value: counts.overdue, hint: "past SLA", tone: "negative" as const },
    { label: "Due today", value: counts.today, hint: "by tonight", tone: "live" as const },
    { label: "Auto-created", value: counts.auto, hint: "by the AI", tone: "accent" as const },
  ];

  const tabCount = (key: Filter): number => {
    const dayStart = startOfDay(SEED_NOW);
    const inToday = (t: Task) => !t.overdue && t.due >= dayStart && t.due < dayStart + DAY;
    const inUpcoming = (t: Task) => !t.overdue && t.due >= dayStart + DAY;
    switch (key) {
      case "All": return tasks.length;
      case "Overdue": return tasks.filter((t) => !isDone(t) && t.overdue).length;
      case "Today": return tasks.filter((t) => !isDone(t) && inToday(t)).length;
      case "Upcoming": return tasks.filter((t) => !isDone(t) && inUpcoming(t)).length;
      case "Done": return tasks.filter((t) => isDone(t)).length;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        kicker="Predictive task triggers"
        title="Tasks"
        description="The AI turns every call, reply and visit into the next action — so nothing slips."
      />

      {/* AI banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 flex items-center gap-3 rounded-[16px] border border-border bg-accent-soft px-5 py-4"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-accent text-accent-contrast">
          <Sparkles size={18} strokeWidth={2.2} />
        </span>
        <p className="text-sm font-medium text-text">
          <Sparkles size={13} className="-mt-0.5 mr-1 inline text-accent" />
          AI created <span className="font-semibold text-accent">{tasks.length} tasks</span> from last night&apos;s activity
        </p>
        <span className="ml-auto hidden items-center gap-1.5 font-mono text-[11px] text-text-muted sm:flex">
          <Zap size={12} className="text-accent" /> predictive triggers
        </span>
      </motion.div>

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
            className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]"
          >
            <Label>{k.label}</Label>
            <div
              className="mt-1.5 font-display text-[26px] font-bold leading-none"
              style={{
                color:
                  k.tone === "negative" ? "var(--negative)"
                  : k.tone === "live" ? "var(--live)"
                  : k.tone === "accent" ? "var(--accent)"
                  : "var(--text)",
              }}
            >
              <AnimatedNumber value={k.value} />
            </div>
            <div className="mt-1 font-mono text-[11px] text-text-faint">{k.hint}</div>
          </motion.div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map(({ key, icon: Icon }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-transparent bg-accent text-accent-contrast"
                  : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text",
              )}
            >
              <Icon size={13} strokeWidth={2.2} />
              {key}
              <span
                className={cn(
                  "tabular rounded-pill px-1.5 py-px font-mono text-[10px]",
                  active ? "bg-accent-contrast/20 text-accent-contrast" : "bg-surface-2 text-text-faint",
                )}
              >
                {tabCount(key)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-2.5">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((t, i) => {
            const d = isDone(t);
            const due = dueLabel(t);
            const SourceIcon = t.source.icon;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.025 }}
              >
                <Link
                  href={`/buyers/${t.buyer.id}`}
                  className={cn(
                    "group flex items-start gap-3.5 rounded-[16px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)] transition-colors hover:border-border-strong sm:items-center sm:p-5",
                    d && "opacity-60",
                  )}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    aria-label={d ? "Mark as not done" : "Mark as done"}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(t); }}
                    className={cn(
                      "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[8px] border transition-colors sm:mt-0",
                      d
                        ? "border-positive bg-positive-soft text-positive"
                        : "border-border-strong text-text-faint hover:border-accent hover:text-accent",
                    )}
                  >
                    {d ? <CheckSquare size={16} strokeWidth={2.4} /> : <Circle size={15} strokeWidth={2} />}
                  </button>

                  {/* Body */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={cn(
                          "font-display text-[15px] font-semibold leading-tight text-text",
                          d && "text-text-muted line-through",
                        )}
                      >
                        {t.title}
                      </span>
                      <Pill variant={PRIORITY_PILL[t.priority]} className="shrink-0">
                        {t.priority}
                      </Pill>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-text-muted">
                      <span className="flex items-center gap-1.5">
                        <Avatar name={t.buyer.name} hue={t.buyer.hue} size={18} />
                        <span className="truncate font-medium text-text-muted">{t.buyer.name}</span>
                      </span>
                      <span className="text-text-faint">·</span>
                      <span className="tabular truncate font-mono text-[11px] text-text-faint">
                        {t.buyer.config} · {t.buyer.localityPrefs[0] ?? "—"}
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-text-faint">
                      <SourceIcon size={11} className="text-accent" />
                      <span className="truncate">
                        <Sparkles size={9} className="-mt-0.5 mr-0.5 inline text-accent" />
                        {t.source.label}
                      </span>
                    </div>
                  </div>

                  {/* Due + chevron */}
                  <div className="flex shrink-0 items-center gap-2 self-center">
                    <span
                      className={cn(
                        "tabular flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11px] font-semibold leading-none",
                        due.tone === "negative" && "bg-negative-soft text-negative",
                        due.tone === "live" && "bg-live-soft text-live",
                        due.tone === "muted" && "bg-surface-2 text-text-muted",
                        d && "opacity-60",
                      )}
                    >
                      {due.tone === "negative" ? <TriangleAlert size={11} /> : <Clock size={11} />}
                      {due.text}
                    </span>
                    <ChevronRight
                      size={16}
                      className="hidden text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-text-muted sm:block"
                    />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {visible.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid place-items-center gap-2 rounded-[16px] border border-dashed border-border bg-surface px-6 py-14 text-center"
          >
            <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-surface-2 text-text-faint">
              {filter === "Done" ? <ClipboardCheck size={20} /> : <CheckCircle2 size={20} />}
            </span>
            <p className="text-sm font-medium text-text">
              {filter === "Overdue" ? "Nothing overdue — you're on top of it."
                : filter === "Today" ? "No tasks left for today."
                : filter === "Upcoming" ? "Nothing scheduled ahead."
                : filter === "Done" ? "No completed tasks yet."
                : "No tasks — the AI will queue the next action."}
            </p>
            <p className="max-w-sm text-[12px] text-text-muted">
              {filter === "Done"
                ? "Tick a task off and it lands here."
                : "Every call, reply and visit becomes the next task automatically."}
            </p>
          </motion.div>
        )}
      </div>

      {/* Footer note */}
      {visible.length > 0 && (
        <p className="mt-5 flex items-center gap-1.5 font-mono text-[11px] text-text-faint">
          <ArrowRight size={11} className="text-accent" />
          Overdue first, then by due date — completed tasks sink to the bottom.
        </p>
      )}
    </PageContainer>
  );
}
