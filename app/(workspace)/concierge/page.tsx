"use client";

import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Phone,
  Building2,
  CalendarCheck,
  Sparkles,
  CheckCircle2,
  Headset,
  ArrowDown,
  Radio,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { conductConciergeLead } from "@/lib/conductor";
import { toast } from "sonner";
import { PageContainer, PageHeader } from "@/components/ui/page";
import {
  Avatar,
  Pill,
  ScoreBadge,
  StatusDot,
  Label,
} from "@/components/ui/primitives";
import {
  SOURCE_LABEL,
  type ConciergeChat,
  type ConciergeStatus,
  type Unit,
  type Project,
} from "@/lib/data/types";
import { cn, rupees, perSqft } from "@/lib/utils";

const SPRING = { type: "spring" as const, stiffness: 360, damping: 30 };

/* ---------------- Status → visual config ---------------- */
type StatusMeta = {
  label: string;
  pill: "live" | "accent" | "positive" | "neutral";
  dot: string;
  pulse: boolean;
};

const STATUS_META: Record<ConciergeStatus, StatusMeta> = {
  qualifying: { label: "Qualifying", pill: "live", dot: "var(--live)", pulse: true },
  matched: { label: "Units matched", pill: "accent", dot: "var(--accent)", pulse: false },
  "visit-booked": { label: "Visit booked", pill: "positive", dot: "var(--positive)", pulse: false },
  "handed-off": { label: "Handed off", pill: "neutral", dot: "var(--text-faint)", pulse: false },
};

const STAT_ORDER: { status: ConciergeStatus; short: string }[] = [
  { status: "qualifying", short: "Qualifying" },
  { status: "matched", short: "Matched" },
  { status: "visit-booked", short: "Visit booked" },
  { status: "handed-off", short: "Handed off" },
];

export default function ConciergePage() {
  const chats = useStore((s) => s.concierge);
  const [selectedId, setSelectedId] = useState<string | null>(chats[0]?.id ?? null);
  const detailRef = useRef<HTMLDivElement>(null);

  // Keep a valid selection even as new chats arrive / list changes.
  const selected = useMemo(
    () => chats.find((c) => c.id === selectedId) ?? chats[0],
    [chats, selectedId],
  );

  const counts = useMemo(() => {
    const base: Record<ConciergeStatus, number> = {
      qualifying: 0,
      matched: 0,
      "visit-booked": 0,
      "handed-off": 0,
    };
    for (const c of chats) base[c.status] += 1;
    return base;
  }, [chats]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    // On mobile the detail sits below the list — bring it into view.
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  return (
    <PageContainer>
      <PageHeader
        kicker="The AI-native moment"
        title="Customer AI Concierge"
        description="A live view of the buyer conversations the AI is handling on WhatsApp — qualifying, quoting units, booking site visits. Take over any chat in one tap."
        actions={
          <button
            onClick={() => conductConciergeLead()}
            className="inline-flex items-center gap-2 rounded-pill bg-accent px-4 py-2.5 text-sm font-semibold text-accent-contrast shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Sparkles size={15} />
            Simulate a live buyer
          </button>
        }
      />

      <StatStrip counts={counts} total={chats.length} />

      <div className="mt-5 grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* LEFT — live chat list */}
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <Radio size={14} className="text-live" />
            <Label>Live conversations</Label>
          </div>
          <div className="space-y-2.5 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto lg:pr-1">
            <AnimatePresence initial={false}>
              {chats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  selected={chat.id === selected?.id}
                  onSelect={() => handleSelect(chat.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT — selected chat detail */}
        <div ref={detailRef} className="min-w-0 scroll-mt-4">
          {selected ? (
            <ChatDetail chat={selected} />
          ) : (
            <div className="grid place-items-center rounded-[16px] border border-border bg-surface py-24 text-center text-text-muted">
              No live conversations right now.
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

/* ============================================================
   Top stat strip — control-room counters
   ============================================================ */
function StatStrip({
  counts,
  total,
}: {
  counts: Record<ConciergeStatus, number>;
  total: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-4 rounded-[16px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:items-center sm:gap-7">
        {STAT_ORDER.map(({ status, short }) => {
          const meta = STATUS_META[status];
          return (
            <div key={status} className="flex items-center gap-2.5">
              <StatusDot color={meta.dot} pulse={meta.pulse} size={9} />
              <div className="leading-none">
                <div className="tabular font-display text-xl font-bold text-text">
                  {counts[status]}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-text-faint">
                  {short}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 border-t border-border pt-3 text-sm text-text-muted sm:border-l sm:border-t-0 sm:pl-7 sm:pt-0">
        <Bot size={15} className="shrink-0 text-accent" />
        <span>
          <span className="tabular font-semibold text-text">{total}</span> chats — the CRM
          is selling while no one&apos;s watching.
        </span>
      </div>
    </motion.div>
  );
}

/* ============================================================
   LEFT — a single chat in the list
   ============================================================ */
function ChatListItem({
  chat,
  selected,
  onSelect,
}: {
  chat: ConciergeChat;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = STATUS_META[chat.status];
  const last = chat.messages[chat.messages.length - 1];

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={SPRING}
      onClick={onSelect}
      className={cn(
        "block w-full rounded-[14px] border p-3.5 text-left transition-colors",
        selected
          ? "border-accent bg-accent-soft shadow-[var(--shadow-soft)]"
          : "border-border bg-surface hover:border-border-strong hover:bg-surface-2",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={chat.buyerName} hue={chat.hue} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-text">{chat.buyerName}</span>
            <Pill variant={meta.pill} className="shrink-0">
              <StatusDot color={meta.dot} pulse={meta.pulse} size={6} />
              {meta.label}
            </Pill>
          </div>
          <div className="mt-0.5 truncate text-xs text-text-muted">{chat.intent}</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-text-faint">
            {last?.from === "ai" ? (
              <Bot size={12} className="shrink-0 text-accent" />
            ) : (
              <span className="shrink-0 font-medium text-text-muted">Buyer:</span>
            )}
            <span className="truncate">{last?.text}</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

/* ============================================================
   RIGHT — the WhatsApp-style detail for the selected chat
   ============================================================ */
function ChatDetail({ chat }: { chat: ConciergeChat }) {
  const takeOverChat = useStore((s) => s.takeOverChat);
  const units = useStore((s) => s.units);
  const projects = useStore((s) => s.projects);
  const meta = STATUS_META[chat.status];
  const handedOff = chat.status === "handed-off";

  const offered = useMemo(
    () =>
      chat.offeredUnitIds
        .map((id) => units.find((u) => u.id === id))
        .filter((u): u is Unit => Boolean(u)),
    [chat.offeredUnitIds, units],
  );

  const handleTakeOver = () => {
    if (handedOff) return;
    takeOverChat(chat.id);
    toast.success("You've taken over — chat history handed to you");
  };

  return (
    <motion.div
      key={chat.id}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start"
    >
      {/* Conversation column */}
      <div className="min-w-0 overflow-hidden rounded-[16px] border border-border bg-surface shadow-[var(--shadow-soft)]">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={chat.buyerName} hue={chat.hue} size={44} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate font-display text-lg font-bold leading-none text-text">
                  {chat.buyerName}
                </h2>
                <Pill variant={meta.pill} className="shrink-0">
                  <StatusDot color={meta.dot} pulse={meta.pulse} size={6} />
                  {meta.label}
                </Pill>
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
                <span className="inline-flex items-center gap-1">
                  <Phone size={12} /> {chat.phone}
                </span>
                <span className="text-text-faint">·</span>
                <span className="font-mono text-text-faint">via {SOURCE_LABEL[chat.source]}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleTakeOver}
            disabled={handedOff}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-2 rounded-pill px-4 py-2.5 text-sm font-semibold transition-all",
              handedOff
                ? "cursor-default border border-border bg-surface-2 text-text-muted"
                : "bg-accent text-accent-contrast shadow-[var(--shadow-soft)] hover:scale-[1.02] active:scale-95",
            )}
          >
            <Headset size={15} />
            {handedOff ? "Handed off to you" : "Take over"}
          </button>
        </div>

        {/* Conversation bubbles */}
        <div className="space-y-3 bg-surface-inset/40 p-4 sm:p-5">
          <AnimatePresence initial={false}>
            {chat.messages.map((m, i) => (
              <Bubble key={`${chat.id}-${i}`} from={m.from} text={m.text} index={i} />
            ))}
          </AnimatePresence>
          {chat.status === "qualifying" && <TypingIndicator />}
        </div>

        {/* Units the AI offered */}
        {offered.length > 0 && (
          <div className="border-t border-border p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Building2 size={14} className="text-accent" />
              <Label>Units the AI offered</Label>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {offered.map((u) => (
                <OfferedUnitCard
                  key={u.id}
                  unit={u}
                  project={projects.find((p) => p.id === u.projectId)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Site visit banner */}
        {chat.siteVisitAt && (
          <div className="border-t border-border p-4 sm:p-5">
            <div className="flex items-center gap-3 rounded-[12px] border border-positive/40 bg-positive-soft px-4 py-3">
              <CalendarCheck size={18} className="shrink-0 text-positive" />
              <p className="text-sm font-medium text-positive">
                Site visit booked · {chat.siteVisitAt} · with the sales lead
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Side column — the auto-created scored lead */}
      <div className="space-y-4 lg:sticky lg:top-20">
        {typeof chat.score === "number" ? (
          <LeadCard chat={chat} />
        ) : (
          <PendingLeadCard status={chat.status} />
        )}
      </div>
    </motion.div>
  );
}

/* ---------------- Chat bubble ---------------- */
function Bubble({
  from,
  text,
  index,
}: {
  from: "buyer" | "ai";
  text: string;
  index: number;
}) {
  const isBuyer = from === "buyer";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, x: isBuyer ? 8 : -8 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ ...SPRING, delay: Math.min(index * 0.04, 0.2) }}
      className={cn("flex", isBuyer ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "flex max-w-[85%] gap-2",
          isBuyer ? "flex-row-reverse" : "flex-row",
        )}
      >
        {!isBuyer && (
          <span className="mt-auto grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Bot size={13} />
          </span>
        )}
        <div
          className={cn(
            "px-3.5 py-2.5 text-sm leading-relaxed shadow-[var(--shadow-soft)]",
            isBuyer
              ? "rounded-[14px] rounded-br-[4px] bg-accent text-accent-contrast"
              : "rounded-[14px] rounded-bl-[4px] bg-surface-2 text-text",
          )}
        >
          {text}
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- AI typing indicator (the one allowed loop) ---------------- */
function TypingIndicator() {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Bot size={13} />
        </span>
        <div className="flex items-center gap-1.5 rounded-[14px] rounded-bl-[4px] bg-surface-2 px-3.5 py-3">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-text-faint"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
              transition={{
                duration: 1.1,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.18,
              }}
            />
          ))}
          <span className="ml-1 font-mono text-[11px] text-text-faint">AI is typing…</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- Offered unit card ---------------- */
function OfferedUnitCard({ unit, project }: { unit: Unit; project?: Project }) {
  const ready = project?.status === "ready";
  return (
    <div className="rounded-[12px] border border-accent/30 bg-accent-soft/40 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-text">
          {project?.name ?? "Unit"}
        </span>
        <span className="tabular shrink-0 font-mono text-sm font-semibold text-accent">
          {rupees(unit.priceInr)}
        </span>
      </div>
      <div className="mt-1 text-xs text-text-muted">
        {unit.tower} · {unit.config} · {unit.carpetAreaSqft.toLocaleString("en-IN")} sq.ft ·{" "}
        {unit.facing}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 text-positive">
          <CheckCircle2 size={12} />
          {ready ? "Ready to move" : `Possession ${project?.possessionDate ?? "soon"}`}
        </span>
        <span className="text-text-faint">·</span>
        <span className="tabular font-mono text-text-faint">
          {perSqft(unit.priceInr, unit.carpetAreaSqft)}
        </span>
      </div>
    </div>
  );
}

/* ---------------- The mind-blow: auto-created scored lead ---------------- */
function LeadCard({ chat }: { chat: ConciergeChat }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={SPRING}
      className="rounded-[16px] border border-positive/40 bg-surface p-5 shadow-[var(--shadow-lift)]"
    >
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-positive-soft text-positive">
          <Sparkles size={14} />
        </span>
        <Label className="text-positive">Scored lead created</Label>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <ScoreBadge score={chat.score!} size={64} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text">{chat.buyerName}</div>
          <div className="mt-0.5 truncate text-xs text-text-muted">{chat.intent}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-text-faint">
            via {SOURCE_LABEL[chat.source]}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-[12px] border border-border bg-surface-inset px-3 py-2.5">
        <ArrowDown size={14} className="mt-0.5 shrink-0 -rotate-90 text-accent" />
        <p className="text-xs leading-relaxed text-text-muted">
          On the worklist — no agent touched it.
        </p>
      </div>
    </motion.div>
  );
}

/* ---------------- Placeholder when no lead has crystallized yet ---------------- */
function PendingLeadCard({ status }: { status: ConciergeStatus }) {
  return (
    <div className="rounded-[16px] border border-dashed border-border bg-surface p-5">
      <Label>Lead forming…</Label>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">
        {status === "qualifying"
          ? "The AI is still qualifying. A scored lead is created automatically the moment intent is clear."
          : "No score yet — the AI will create a scored lead as soon as this buyer commits to a visit."}
      </p>
      <div className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-text-faint">
        <StatusDot color="var(--live)" pulse size={6} />
        Watching the conversation
      </div>
    </div>
  );
}
