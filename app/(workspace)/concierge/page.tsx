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
  Target,
  Gauge,
  Layers,
  ChevronRight,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useScopedConcierge, useClientUnits, useClientProjects } from "@/lib/roles";
import { conductConciergeLead } from "@/lib/conductor";
import { toast } from "sonner";
import { PageContainer, PageHeader } from "@/components/ui/page";
import {
  Avatar,
  Pill,
  ScoreBadge,
  StatusDot,
  Label,
  ChannelIcon,
  AnimatedNumber,
} from "@/components/ui/primitives";
import {
  SOURCE_LABEL,
  CHANNEL_LABEL,
  type Channel,
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
  const chats = useScopedConcierge();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const detailRef = useRef<HTMLDivElement>(null);

  const channels = useMemo(() => Array.from(new Set(chats.map((c) => c.channel))), [chats]);
  const visible = useMemo(
    () => (channelFilter === "all" ? chats : chats.filter((c) => c.channel === channelFilter)),
    [chats, channelFilter],
  );
  // Keep a valid selection even as the filter / list changes.
  const selected = useMemo(
    () => visible.find((c) => c.id === selectedId) ?? visible[0],
    [visible, selectedId],
  );

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
        title="AI Inbox"
        description="A live view of every buyer conversation the AI is handling — across WhatsApp, calls and email — qualifying, quoting units and booking visits. Jump into any one in a tap."
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

      <InboxMetrics chats={chats} />

      {/* Omni-channel filter */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ChannelChip active={channelFilter === "all"} onClick={() => setChannelFilter("all")} label="All channels" count={chats.length} />
        {channels.map((ch) => (
          <ChannelChip
            key={ch}
            active={channelFilter === ch}
            onClick={() => setChannelFilter(ch)}
            label={CHANNEL_LABEL[ch]}
            count={chats.filter((c) => c.channel === ch).length}
            icon={<ChannelIcon channel={ch} size={13} />}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* LEFT — live conversation list */}
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <Radio size={14} className="text-live" />
            <Label>Live conversations</Label>
          </div>
          <div className="space-y-2.5 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto lg:pr-1">
            <AnimatePresence initial={false}>
              {visible.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  selected={chat.id === selected?.id}
                  onSelect={() => handleSelect(chat.id)}
                />
              ))}
            </AnimatePresence>
            {visible.length === 0 && (
              <div className="rounded-[14px] border border-dashed border-border p-6 text-center text-sm text-text-faint">
                No conversations on this channel.
              </div>
            )}
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
function InboxMetrics({ chats }: { chats: ConciergeChat[] }) {
  const m = useMemo(() => {
    const by: Record<ConciergeStatus, number> = { qualifying: 0, matched: 0, "visit-booked": 0, "handed-off": 0 };
    const chMix: Partial<Record<Channel, number>> = {};
    let booked = 0, scoreSum = 0, scoreN = 0, unitsOffered = 0, aiMsgs = 0, allMsgs = 0;
    for (const c of chats) {
      by[c.status] += 1;
      if (c.siteVisitAt) booked += 1;
      if (typeof c.score === "number") { scoreSum += c.score; scoreN += 1; }
      unitsOffered += c.offeredUnitIds.length;
      for (const msg of c.messages) { allMsgs += 1; if (msg.from === "ai") aiMsgs += 1; }
      chMix[c.channel] = (chMix[c.channel] ?? 0) + 1;
    }
    const total = chats.length;
    return {
      total, by, booked, scoreN, unitsOffered,
      conversion: total ? Math.round((by["visit-booked"] / total) * 100) : 0,
      avgScore: scoreN ? Math.round(scoreSum / scoreN) : 0,
      aiShare: allMsgs ? Math.round((aiMsgs / allMsgs) * 100) : 0,
      chMix,
    };
  }, [chats]);

  const channelsPresent = (Object.keys(m.chMix) as Channel[]).sort((a, b) => (m.chMix[b] ?? 0) - (m.chMix[a] ?? 0));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-[16px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)] sm:p-5"
    >
      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile icon={<Radio size={15} />} tone="accent" label="Live conversations" value={<AnimatedNumber value={m.total} />} hint="the AI is handling now" />
        <KpiTile icon={<Target size={15} />} tone="positive" label="Conversion rate" value={`${m.conversion}%`} hint="conversation → site visit" />
        <KpiTile icon={<CalendarCheck size={15} />} tone="live" label="Visits booked" value={<AnimatedNumber value={m.booked} />} hint="no agent touched them" />
        <KpiTile icon={<Gauge size={15} />} tone="accent" label="Avg lead score" value={<AnimatedNumber value={m.avgScore} />} hint={`${m.scoreN} scored leads`} />
      </div>

      {/* Funnel + channel mix */}
      <div className="mt-4 grid gap-5 border-t border-border pt-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0">
          <Label className="mb-2.5 block">Conversation funnel</Label>
          <div className="flex items-stretch gap-1.5">
            {STAT_ORDER.map(({ status, short }, i) => (
              <FunnelSeg key={status} meta={STATUS_META[status]} short={short} count={m.by[status]} last={i === STAT_ORDER.length - 1} />
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-text-muted">
            <Layers size={12} className="shrink-0 text-accent" />
            <span><span className="font-semibold text-text">{m.unitsOffered}</span> units quoted · <span className="font-semibold text-text">{m.aiShare}%</span> of messages sent by the AI</span>
          </div>
        </div>

        <div className="min-w-0">
          <Label className="mb-2.5 block">By channel</Label>
          <div className="space-y-2">
            {channelsPresent.map((ch) => {
              const n = m.chMix[ch] ?? 0;
              return (
                <div key={ch} className="flex items-center gap-2">
                  <ChannelIcon channel={ch} size={13} />
                  <span className="w-16 shrink-0 truncate text-xs text-text-muted">{CHANNEL_LABEL[ch]}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-inset">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${m.total ? Math.round((n / m.total) * 100) : 0}%` }} transition={{ duration: 0.6, ease: "easeOut" }} className="h-full rounded-full bg-accent" />
                  </div>
                  <span className="tabular w-5 shrink-0 text-right font-mono text-xs text-text-faint">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- Metric tile + funnel segment ---------------- */
function KpiTile({ icon, tone, label, value, hint }: { icon: React.ReactNode; tone: "accent" | "positive" | "live"; label: string; value: React.ReactNode; hint: string }) {
  const fg = tone === "positive" ? "text-positive" : tone === "live" ? "text-live" : "text-accent";
  const bg = tone === "positive" ? "bg-positive-soft" : tone === "live" ? "bg-live-soft" : "bg-accent-soft";
  return (
    <div className="rounded-[12px] border border-border bg-surface-inset/50 p-3.5">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", bg, fg)}>{icon}</span>
        <span className="font-mono text-[10px] uppercase leading-tight tracking-wide text-text-faint">{label}</span>
      </div>
      <div className="tabular mt-2.5 font-display text-2xl font-bold text-text">{value}</div>
      <div className="mt-0.5 text-[11px] text-text-muted">{hint}</div>
    </div>
  );
}

function FunnelSeg({ meta, short, count, last }: { meta: StatusMeta; short: string; count: number; last: boolean }) {
  return (
    <>
      <div className="min-w-0 flex-1 rounded-[10px] border border-border bg-surface-inset/40 px-1.5 py-2 text-center">
        <div className="tabular font-display text-lg font-bold leading-none text-text">{count}</div>
        <div className="mt-1 flex items-center justify-center gap-1 font-mono text-[9px] uppercase tracking-wide text-text-faint">
          <StatusDot color={meta.dot} pulse={meta.pulse} size={5} /> <span className="truncate">{short}</span>
        </div>
      </div>
      {!last && <ChevronRight size={14} className="shrink-0 self-center text-text-faint" />}
    </>
  );
}

/* ---------------- Channel filter chip ---------------- */
function ChannelChip({
  active, onClick, label, count, icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-pill border px-3 text-xs font-medium transition-colors",
        active ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text",
      )}
    >
      {icon}
      {label}
      <span className={cn("tabular rounded-pill px-1.5 text-[10px]", active ? "bg-accent/15 text-accent" : "bg-surface-2 text-text-faint")}>{count}</span>
    </button>
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
            <span className="flex min-w-0 items-center gap-1.5">
              <ChannelIcon channel={chat.channel} size={13} />
              <span className="truncate text-sm font-semibold text-text">{chat.buyerName}</span>
            </span>
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
  const units = useClientUnits();
  const projects = useClientProjects();
  const meta = STATUS_META[chat.status];
  const handedOff = chat.status === "handed-off";
  const takeLabel = handedOff ? "Handed off to you" : chat.channel === "call" ? "Join the call" : chat.channel === "email" ? "Reply" : "Take over";

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
                <span className="inline-flex items-center gap-1 font-medium text-text-muted">
                  <ChannelIcon channel={chat.channel} size={12} /> {CHANNEL_LABEL[chat.channel]}
                </span>
                <span className="text-text-faint">·</span>
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
            {chat.channel === "call" ? <Phone size={15} /> : <Headset size={15} />}
            {takeLabel}
          </button>
        </div>

        {/* Conversation — rendered per channel */}
        <div className="space-y-3 bg-surface-inset/40 p-4 sm:p-5">
          <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-text-faint">
            <ChannelIcon channel={chat.channel} size={11} />
            {chat.channel === "call" ? "AI voice call · transcript" : chat.channel === "email" ? "Email thread" : `${CHANNEL_LABEL[chat.channel]} conversation`}
          </div>
          <AnimatePresence initial={false}>
            {chat.messages.map((m, i) => (
              <Bubble key={`${chat.id}-${i}`} from={m.from} text={m.text} index={i} />
            ))}
          </AnimatePresence>
          {chat.status === "qualifying" && (chat.channel === "whatsapp" || chat.channel === "sms") && <TypingIndicator />}
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
