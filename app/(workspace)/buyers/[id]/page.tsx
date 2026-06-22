"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronDown, Play, Sparkles, TrendingUp, ScanSearch, ArrowUpRight, Bot, Building2, CheckCircle2, Phone,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PageContainer } from "@/components/ui/page";
import { Avatar, ChannelIcon, ScoreBadge, Pill, Sparkline, Label } from "@/components/ui/primitives";
import { CHANNEL_LABEL, SOURCE_LABEL, POSSESSION_LABEL, type Message, type Buyer } from "@/lib/data/types";
import { rupees, rupeeRange, perSqft, relativeTime, cn } from "@/lib/utils";

type Prov = { msgId: string | null; quote: string | null };
const ProvenanceCtx = createContext<{ active: Prov; set: (p: Prov) => void }>({ active: { msgId: null, quote: null }, set: () => {} });

export default function BuyerCanvasPage() {
  const { id } = useParams<{ id: string }>();
  const buyer = useStore((s) => s.buyers.find((b) => b.id === id));
  const allMessages = useStore((s) => s.messages);
  const messages = useMemo(
    () => allMessages.filter((m) => m.buyerId === id).sort((a, b) => a.timestamp - b.timestamp),
    [allMessages, id],
  );
  const [active, setActive] = useState<Prov>({ msgId: null, quote: null });

  if (!buyer) {
    return (
      <PageContainer>
        <div className="grid place-items-center py-24 text-center">
          <p className="text-text-muted">That buyer isn&apos;t here.</p>
          <Link href="/worklist" className="mt-3 text-sm font-medium text-accent">Back to the worklist</Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <ProvenanceCtx.Provider value={{ active, set: setActive }}>
      <PageContainer className="max-w-[1320px]">
        <BuyerHeader buyer={buyer} />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0"><Timeline messages={messages} /></div>
          <div className="min-w-0 lg:order-last"><BuyerPanel buyer={buyer} /></div>
        </div>
      </PageContainer>
    </ProvenanceCtx.Provider>
  );
}

function BuyerHeader({ buyer }: { buyer: Buyer }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
      <Link href="/worklist" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text">
        <ArrowLeft size={15} /> Worklist
      </Link>
      <div className="flex flex-col gap-4 rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center">
        <Avatar name={buyer.name} hue={buyer.hue} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold leading-none tracking-tight">{buyer.name}</h1>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-text-muted">
            <Phone size={13} /> {buyer.phone} · {buyer.agent}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Pill variant="accent">{buyer.config}</Pill>
            <Pill variant="neutral">{buyer.localityPrefs.join(" / ")}</Pill>
            <Pill variant="outline">{rupeeRange(buyer.budgetMin, buyer.budgetMax)}</Pill>
            <Pill variant="neutral">{buyer.stage}</Pill>
            <span className="font-mono text-[11px] text-text-faint">via {SOURCE_LABEL[buyer.source]}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:flex-col sm:items-end">
          <ScoreBadge score={buyer.score} size={62} />
          <Link href={`/buyers/${buyer.id}/score`} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
            Score deep-dive <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function Timeline({ messages }: { messages: Message[] }) {
  return (
    <div>
      <div className="mb-3"><Label>Unified timeline · every channel, one thread</Label></div>
      <div className="relative space-y-3">
        <span className="absolute bottom-2 left-[19px] top-2 w-px bg-border" aria-hidden />
        <AnimatePresence initial={false}>
          {messages.map((m) => (<MessageCard key={m.id} message={m} />))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MessageCard({ message }: { message: Message }) {
  const { active } = useContext(ProvenanceCtx);
  const ref = useRef<HTMLDivElement>(null);
  const isTarget = active.msgId === message.id;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isTarget && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      if (message.transcript) setOpen(true);
    }
  }, [isTarget, message.transcript]);

  return (
    <motion.div
      ref={ref}
      layout
      initial={message.isLive ? { opacity: 0, y: 14, scale: 0.98 } : { opacity: 0 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
      className="relative flex gap-3 pl-1"
    >
      <div className="relative z-10 mt-1 shrink-0"><ChannelIcon channel={message.channel} size={15} withBg /></div>

      <div className={cn(
        "min-w-0 flex-1 rounded-[14px] border bg-surface p-4 transition-all duration-300",
        isTarget ? "border-accent shadow-[0_0_0_3px_var(--accent-soft)]" : "border-border",
        message.isLive && "ring-1 ring-live/40",
      )}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text">
              {message.direction === "inbound" ? "Inbound" : "Outbound"} · {CHANNEL_LABEL[message.channel]}
            </span>
            {message.handledBy === "ai" && <Pill variant="accent"><Bot size={11} /> AI</Pill>}
            {message.isLive && <Pill variant="live"><Sparkles size={11} /> live</Pill>}
          </div>
          <span className="font-mono text-[11px] text-text-faint" suppressHydrationWarning>{relativeTime(message.timestamp)}</span>
        </div>

        {message.subject && <div className="mb-1 text-sm font-medium text-text">{message.subject}</div>}

        {message.summary && message.channel === "call" && (
          <div className="mb-2 flex items-start gap-2 rounded-[10px] bg-accent-soft px-3 py-2 text-sm text-accent">
            <Sparkles size={13} className="mt-0.5 shrink-0" /><span>{message.summary}</span>
          </div>
        )}

        {message.channel === "call" && (
          <button onClick={() => setOpen((o) => !o)} className="mb-1 flex w-full items-center gap-3 rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-left">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-live text-white"><Play size={13} className="ml-0.5" fill="currentColor" /></span>
            <div className="flex-1"><Waveform /></div>
            <span className="font-mono text-[11px] text-text-muted">
              {Math.floor((message.durationSec ?? 0) / 60)}:{String((message.durationSec ?? 0) % 60).padStart(2, "0")}
            </span>
            <ChevronDown size={15} className={cn("text-text-faint transition-transform", open && "rotate-180")} />
          </button>
        )}

        {message.channel !== "call" && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-text-muted">
            <Highlighted text={message.body} quote={isTarget ? active.quote : null} />
          </p>
        )}

        <AnimatePresence>
          {message.transcript && open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 space-y-1.5 overflow-hidden border-t border-border pt-3">
              {message.transcript.map((line) => {
                const lit = isTarget && active.quote === line.text;
                return (
                  <div key={line.id} className={cn("flex gap-2 rounded-md px-2 py-1 text-sm transition-colors", lit && "bg-accent-soft")}>
                    <span className="w-9 shrink-0 font-mono text-[11px] text-text-faint">{line.t}</span>
                    <span className={cn("font-semibold", line.speaker === "agent" ? "text-text-faint" : "text-accent")}>
                      {line.speaker === "agent" ? "Agent" : line.speaker === "ai" ? "AI" : "Buyer"}
                    </span>
                    <span className={cn("flex-1", lit ? "text-text" : "text-text-muted")}>{line.text}</span>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Highlighted({ text, quote }: { text: string; quote: string | null }) {
  if (!quote || !text.includes(quote)) return <>{text}</>;
  const [before, after] = text.split(quote);
  return (<>{before}<mark className="rounded bg-accent-soft px-0.5 text-accent">{quote}</mark>{after}</>);
}

function Waveform() {
  const bars = [6, 11, 7, 14, 9, 17, 8, 12, 6, 15, 10, 7, 13, 9, 5, 11, 8, 14, 6, 10];
  return (
    <div className="flex h-5 items-center gap-[3px]">
      {bars.map((h, i) => (<span key={i} className="w-[3px] rounded-full bg-live/50" style={{ height: h }} />))}
    </div>
  );
}

function BuyerPanel({ buyer }: { buyer: Buyer }) {
  const { set } = useContext(ProvenanceCtx);
  const units = useStore((s) => s.units);
  const projects = useStore((s) => s.projects);
  const diff = buyer.score - buyer.prevScore;
  const matched = buyer.matchedUnitIds.map((uid) => units.find((u) => u.id === uid)).filter(Boolean).slice(0, 3);

  return (
    <div className="space-y-4 lg:sticky lg:top-20">
      <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <Label>Intent score</Label>
          {diff !== 0 && (
            <span className={cn("flex items-center gap-1 font-mono text-xs font-semibold", diff > 0 ? "text-positive" : "text-negative")}>
              <TrendingUp size={13} className={cn(diff < 0 && "rotate-180")} />{diff > 0 ? "+" : ""}{diff} this week
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-4">
          <ScoreBadge score={buyer.score} size={72} />
          <div>
            <Sparkline points={buyer.scoreHistory.map((p) => p.score)} width={150} height={40} />
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-text-faint">8-week trend</p>
          </div>
        </div>
      </div>

      {/* matched units from inventory */}
      <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex items-center gap-2"><Building2 size={14} className="text-accent" /><Label>Matched units · live inventory</Label></div>
        <div className="space-y-2">
          {matched.map((u) => {
            const p = projects.find((pp) => pp.id === u!.projectId);
            return (
              <Link key={u!.id} href="/inventory" className="block rounded-[12px] border border-accent/30 bg-accent-soft/40 p-3 transition-colors hover:border-accent/60">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text">{p?.name}</span>
                  <span className="font-mono text-sm font-semibold text-accent">{rupees(u!.priceInr)}</span>
                </div>
                <div className="mt-0.5 text-xs text-text-muted">
                  {u!.tower} · {u!.config} · {u!.carpetAreaSqft.toLocaleString("en-IN")} sq.ft · {u!.facing}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-positive">
                  <CheckCircle2 size={12} /> Matches budget + {buyer.localityPrefs[0]} · {perSqft(u!.priceInr, u!.carpetAreaSqft)}
                </div>
              </Link>
            );
          })}
          {matched.length === 0 && <p className="py-1 text-sm text-text-faint">No live units match yet — widen budget or locality.</p>}
        </div>
      </div>

      {/* cited reasons */}
      <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex items-center gap-2"><ScanSearch size={14} className="text-accent" /><Label>Why — hover to see the source</Label></div>
        <div className="space-y-1">
          {buyer.scoreReasons.map((r) => (
            <button
              key={r.id}
              onMouseEnter={() => set({ msgId: r.sourceMessageId, quote: r.sourceQuote })}
              onMouseLeave={() => set({ msgId: null, quote: null })}
              onFocus={() => set({ msgId: r.sourceMessageId, quote: r.sourceQuote })}
              onBlur={() => set({ msgId: null, quote: null })}
              className="group flex w-full items-start gap-2.5 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-surface-2"
            >
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: r.polarity === "positive" ? "var(--positive)" : "var(--negative)" }} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-snug text-text">{r.text}</span>
                <span className="mt-0.5 block truncate font-mono text-[11px] italic text-text-faint">“{r.sourceQuote}”</span>
              </span>
              <span className={cn("shrink-0 font-mono text-xs font-semibold", r.polarity === "positive" ? "text-positive" : "text-negative")}>
                {r.weight > 0 ? "+" : ""}{r.weight}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* extracted profile */}
      <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <Label className="mb-3 block">Buyer profile · auto-extracted</Label>
        <div className="space-y-2">
          <ProfileRow label="Possession" value={POSSESSION_LABEL[buyer.possession]} />
          <ProfileRow label="Loan" value={buyer.loanStatus} />
          <AnimatePresence initial={false}>
            {buyer.profile.map((f) => (
              <motion.button
                key={f.id}
                layout
                initial={f.justCrystallized ? { opacity: 0, y: -8 } : false}
                animate={{ opacity: 1, y: 0 }}
                onMouseEnter={() => set({ msgId: f.sourceMessageId, quote: f.sourceQuote })}
                onMouseLeave={() => set({ msgId: null, quote: null })}
                className={cn("flex w-full items-center justify-between gap-3 rounded-[10px] border px-3 py-2 text-left transition-colors hover:bg-surface-2", f.justCrystallized ? "border-positive/40" : "border-border")}
              >
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-wide text-text-faint">{f.label}</div>
                  <div className="truncate text-sm font-medium text-text">{f.value}</div>
                </div>
                <ArrowUpRight size={14} className="shrink-0 text-text-faint" />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2">
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-wide text-text-faint">{label}</div>
        <div className="truncate text-sm font-medium capitalize text-text">{value}</div>
      </div>
    </div>
  );
}
