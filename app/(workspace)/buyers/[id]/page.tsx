"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronDown, Play, Sparkles, TrendingUp, ScanSearch, ArrowUpRight, Bot,
  CheckCircle2, Circle, CircleDot, Phone, Mail, MessageCircle, ShieldCheck, Headphones,
  Gauge, Check, Pencil, X, Building2, Link2, Newspaper, ExternalLink, BadgeCheck,
  Wallet, Landmark, BookOpen, Lightbulb, Trophy, ArrowRight, Zap,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PageContainer } from "@/components/ui/page";
import { useConfirm } from "@/components/ui/confirm";
import { Avatar, ChannelIcon, ScoreBadge, Sparkline, Label, Pill, Meter } from "@/components/ui/primitives";
import { CHANNEL_LABEL, type Message, type Buyer, type Stage } from "@/lib/data/types";
import { rupees, relativeTime, cn } from "@/lib/utils";

/* provenance: hover a score reason / field → its source message highlights */
type Prov = { msgId: string | null; quote: string | null };
const ProvenanceCtx = createContext<{ active: Prov; set: (p: Prov) => void }>({ active: { msgId: null, quote: null }, set: () => {} });

/* ---------------- derivation helpers ---------------- */
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
const conf = (s: string) => 86 + (hash(s) % 12); // 86–97
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);
const shortDate = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const NEXT_BY_STAGE: Record<Stage, string> = {
  "New Enquiry": "Qualify · share matching units",
  Qualified: "Book a site visit",
  "Site Visit Scheduled": "Confirm the visit · share location",
  "Site Visit Completed": "Help shortlist a unit",
  "Unit Selected": "Collect the booking amount",
  "Booking Amount Paid": "Confirm the booking",
  "Booking Confirmed": "Send agreement for signing",
  "Agreement Signed": "Kick off the loan sanction",
  "Loan Sanction": "Schedule registration",
  Registration: "Schedule handover",
  Handover: "Collect feedback · ask for referrals",
};

type Chip = { label: string; value: string; confidence: number };
type Capture = { said: string; agreed: string; nextStep: string; chips: Chip[] } | null;

function deriveCapture(msg: Message, buyer: Buyer, isLatestInbound: boolean): Capture {
  const reasons = buyer.scoreReasons.filter((r) => r.sourceMessageId === msg.id);
  const fields = buyer.profile.filter((f) => f.sourceMessageId === msg.id);
  const chips: Chip[] = [
    ...fields.map((f) => ({ label: f.label, value: f.value, confidence: conf(f.id) })),
    ...reasons
      .filter((r) => !fields.some((f) => f.sourceQuote === r.sourceQuote))
      .map((r) => ({ label: r.category, value: truncate(r.text, 40), confidence: conf(r.id) })),
  ].slice(0, 3);
  if (isLatestInbound) chips.unshift({ label: "Next step", value: NEXT_BY_STAGE[buyer.stage], confidence: 94 + (hash(buyer.id) % 4) });
  if (!chips.length && !msg.summary) return null;
  const positive = reasons.find((r) => r.polarity === "positive");
  return {
    said: msg.channel === "call" ? msg.summary ?? "Call captured" : truncate(msg.body.replace(/\n+/g, " "), 90),
    agreed: positive ? positive.text : "—",
    nextStep: NEXT_BY_STAGE[buyer.stage],
    chips: chips.slice(0, 3),
  };
}

/* real-estate milestone pack */
const MILESTONES = [
  "Site Visit Scheduled", "Site Visit Completed", "Unit Selected", "Booking Amount Paid",
  "Booking Confirmed", "Agreement Signed", "Loan Sanction", "Registration", "Handover",
];
const STAGE_DONE: Record<Stage, number> = {
  "New Enquiry": 0, Qualified: 0, "Site Visit Scheduled": 1, "Site Visit Completed": 2, "Unit Selected": 3,
  "Booking Amount Paid": 4, "Booking Confirmed": 5, "Agreement Signed": 6, "Loan Sanction": 7, Registration: 8, Handover: 9,
};

const ACTION_BY_STAGE: Record<Stage, { cta: string; body: (b: Buyer, unit: string) => string }> = {
  "New Enquiry": { cta: "Share matching units", body: (b) => `Hi ${b.name.split(" ")[0]} — sharing a few ${b.config} options that fit your budget in ${b.localityPrefs[0]}. Want me to set up a site visit this weekend? — ${b.agent}` },
  Qualified: { cta: "Book a site visit", body: (b, u) => `Hi ${b.name.split(" ")[0]} — ${u} looks like a strong fit. I have Sat 11 AM or Sun 4 PM open for a visit. Which works? — ${b.agent}` },
  "Site Visit Scheduled": { cta: "Confirm site visit", body: (b, u) => `Hi ${b.name.split(" ")[0]} — confirming your site visit at ${u}, Sat 11 AM. Sharing the location pin + brochure now. See you there! — ${b.agent}` },
  "Site Visit Completed": { cta: "Send floor-rise pricing", body: (b, u) => `Hi ${b.name.split(" ")[0]} — here's the higher-floor pricing for ${u} you asked about, with the floor-rise breakdown. Shall I help you shortlist a unit? — ${b.agent}` },
  "Unit Selected": { cta: "Send booking payment link (₹5L)", body: (b, u) => `Hi ${b.name.split(" ")[0]} — here's the secure link for the ₹5,00,000 booking amount on ${u}. Once received we'll hold the unit and share the agreement for signing. — ${b.agent}, RelationOS` },
  "Booking Amount Paid": { cta: "Confirm the booking", body: (b, u) => `Hi ${b.name.split(" ")[0]} — booking amount received for ${u}, the unit is now held for you. Confirming your booking and sharing the agreement next. — ${b.agent}` },
  "Booking Confirmed": { cta: "Send agreement for signing", body: (b, u) => `Hi ${b.name.split(" ")[0]} — congratulations on booking ${u}! Sharing the agreement for e-signing. Our team will guide you through the loan + registration next. — ${b.agent}` },
  "Agreement Signed": { cta: "Kick off loan sanction", body: (b, u) => `Hi ${b.name.split(" ")[0]} — agreement signed for ${u}. Let's get your home loan moving — sharing the document checklist for the sanction now. — ${b.agent}` },
  "Loan Sanction": { cta: "Schedule registration", body: (b, u) => `Hi ${b.name.split(" ")[0]} — loan sanctioned for ${u}! Let's lock a registration slot. Which day next week suits you? — ${b.agent}` },
  Registration: { cta: "Schedule handover", body: (b, u) => `Hi ${b.name.split(" ")[0]} — registration is complete for ${u}. Let's schedule your handover and key collection. — ${b.agent}` },
  Handover: { cta: "Request feedback & referrals", body: (b, u) => `Hi ${b.name.split(" ")[0]} — welcome home! 🎉 Keys handed over for ${u}. We'd love your feedback — and an intro to anyone else house-hunting. — ${b.agent}` },
};

export default function BuyerCanvasPage() {
  const { id } = useParams<{ id: string }>();
  const buyer = useStore((s) => s.buyers.find((b) => b.id === id));
  const allMessages = useStore((s) => s.messages);
  const units = useStore((s) => s.units);
  const projects = useStore((s) => s.projects);
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

  const unit = units.find((u) => u.id === buyer.matchedUnitIds[0]);
  const project = unit ? projects.find((p) => p.id === unit.projectId) : projects[0];
  const unitLabel = unit ? `${project?.name} · ${unit.unitNo}` : project?.name ?? "—";
  const done = STAGE_DONE[buyer.stage];

  return (
    <ProvenanceCtx.Provider value={{ active, set: setActive }}>
      <PageContainer className="max-w-[1320px]">
        <BuyerHeader buyer={buyer} unitLabel={unitLabel} project={project?.name ?? ""} progress={done / MILESTONES.length} />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div className="mb-3"><Label>Unified timeline · every channel, one history</Label></div>
            <div className="relative space-y-3">
              <span className="absolute bottom-2 left-[19px] top-2 w-px bg-border" aria-hidden />
              <AnimatePresence initial={false}>
                {messages.map((m, i) => (
                  <MessageCard key={m.id} message={m} buyer={buyer} isLatestInbound={m.direction === "inbound" && i === messages.length - 1} />
                ))}
              </AnimatePresence>
            </div>
          </div>
          <div className="min-w-0 space-y-4 lg:order-last">
            <LeadScore buyer={buyer} messages={messages} />
            <DraftedAction buyer={buyer} unitLabel={unitLabel} />
            <AutoFilledFields buyer={buyer} unit={unit} />
            <Milestones buyer={buyer} done={done} messages={messages} />
            <Enrichment buyer={buyer} />
            <LoanEligibility buyer={buyer} />
            <SalesPlaybook buyer={buyer} />
          </div>
        </div>
      </PageContainer>
    </ProvenanceCtx.Provider>
  );
}

/* ---------------- header ---------------- */
function BackButton() {
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/worklist");
  };
  return (
    <button onClick={goBack} className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text">
      <ArrowLeft size={15} /> Back
    </button>
  );
}

function BuyerHeader({ buyer, unitLabel, project, progress }: { buyer: Buyer; unitLabel: string; project: string; progress: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
      <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px] text-text-faint">
        <Link href="/pipeline" className="hover:text-text">Pipeline</Link>
        <span>/</span><span>{project}</span><span>/</span>
        <span className="text-text-muted">{buyer.name}</span>
      </div>
      <BackButton />

      <div className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-[var(--shadow-soft)]">
        <div className="h-1.5 w-full bg-surface-inset">
          <motion.div className="h-full" style={{ background: "linear-gradient(90deg, var(--accent), var(--live))" }} initial={{ width: 0 }} animate={{ width: `${Math.round(progress * 100)}%` }} transition={{ duration: 0.8, ease: [0.34, 1.4, 0.5, 1] }} />
        </div>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
          <Avatar name={buyer.name} hue={buyer.hue} size={52} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-bold leading-none tracking-tight">{buyer.name}</h1>
              <span className="rounded-pill bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">{buyer.stage}</span>
            </div>
            <p className="mt-1.5 text-sm text-text-muted">
              {buyer.config} buyer · <span className="font-semibold text-text">{unitLabel}</span> · <span className="font-semibold text-text">{rupees(buyer.budgetMax)}</span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              {buyer.channelsUsed.map((c) => (<ChannelIcon key={c} channel={c} size={14} withBg />))}
              <span className="ml-1 font-mono text-[11px] text-text-faint" suppressHydrationWarning>last touch {relativeTime(buyer.lastTouch)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => toast("Dialing via Vocalis…", { description: buyer.name })} className="flex h-10 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-contrast shadow-[0_0_22px_-7px_var(--accent)] transition-transform hover:scale-[1.02] active:scale-95">
              <Phone size={15} /> Call via Vocalis
            </button>
            <button onClick={() => toast("Opening WhatsApp…")} className="flex h-10 items-center gap-2 rounded-[10px] border border-border bg-surface px-3.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"><MessageCircle size={15} className="text-positive" /> WhatsApp</button>
            <button onClick={() => toast("Composing email…")} className="flex h-10 items-center gap-2 rounded-[10px] border border-border bg-surface px-3.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"><Mail size={15} className="text-accent" /> Email</button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- timeline message ---------------- */
function MessageCard({ message, buyer, isLatestInbound }: { message: Message; buyer: Buyer; isLatestInbound: boolean }) {
  const { active } = useContext(ProvenanceCtx);
  const ref = useRef<HTMLDivElement>(null);
  const isTarget = active.msgId === message.id;
  const [open, setOpen] = useState(false);
  const capture = deriveCapture(message, buyer, isLatestInbound);
  const auditor = message.channel === "call" ? { score: Math.max(72, Math.min(96, buyer.score - 4)), talk: 38 + (hash(message.id) % 12) } : null;

  useEffect(() => {
    if (isTarget && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      if (message.transcript) setOpen(true);
    }
  }, [isTarget, message.transcript]);

  return (
    <motion.div ref={ref} layout initial={message.isLive ? { opacity: 0, y: 14 } : { opacity: 0 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 360, damping: 30 }} className="relative flex gap-3 pl-1">
      <div className="relative z-10 mt-1 shrink-0"><ChannelIcon channel={message.channel} size={15} withBg /></div>

      <div className={cn("min-w-0 flex-1 rounded-[14px] border bg-surface p-4 transition-all duration-300", isTarget ? "border-accent shadow-[0_0_0_3px_var(--accent-soft)]" : "border-border", message.isLive && "ring-1 ring-live/40")}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-text">
              {message.direction === "outbound" ? `${buyer.agent.split(" ")[0]} ▸ ${buyer.name.split(" ")[0]}` : buyer.name}
            </span>
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-muted">
              {CHANNEL_LABEL[message.channel]} · {message.direction}
            </span>
            {message.durationSec ? <span className="font-mono text-[10px] text-text-faint">⏱ {Math.floor(message.durationSec / 60)}:{String(message.durationSec % 60).padStart(2, "0")}</span> : null}
            {message.isLive && <span className="rounded-pill bg-live-soft px-2 py-0.5 text-[10px] font-semibold text-live">live</span>}
          </div>
          <span className="font-mono text-[11px] text-text-faint" suppressHydrationWarning>{shortDate(message.timestamp)}</span>
        </div>

        {message.channel === "call" ? (
          <button onClick={() => setOpen((o) => !o)} className="mb-2 flex w-full items-center gap-2.5 rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-left">
            <Headphones size={15} className="text-text-muted" />
            <span className="flex-1 text-sm text-text-muted">Call recording · speaker-diarised transcript</span>
            <ChevronDown size={15} className={cn("text-text-faint transition-transform", open && "rotate-180")} />
          </button>
        ) : (
          <p className="mb-2 whitespace-pre-line text-sm leading-relaxed text-text">
            <Highlighted text={message.body} quote={isTarget ? active.quote : null} />
          </p>
        )}

        <AnimatePresence>
          {message.transcript && open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-2 space-y-1.5 overflow-hidden rounded-[10px] border border-border bg-surface-inset p-3">
              {message.transcript.map((line) => {
                const lit = isTarget && active.quote === line.text;
                return (
                  <div key={line.id} className={cn("flex gap-2 rounded-md px-2 py-1 text-sm transition-colors", lit && "bg-accent-soft")}>
                    <span className="w-9 shrink-0 font-mono text-[11px] text-text-faint">{line.t}</span>
                    <span className={cn("font-semibold", line.speaker === "agent" ? "text-text-faint" : "text-accent")}>{line.speaker === "agent" ? "Agent" : line.speaker === "ai" ? "AI" : "Buyer"}</span>
                    <span className={cn("flex-1", lit ? "text-text" : "text-text-muted")}>{line.text}</span>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI summary */}
        {capture && <CaptureBox capture={capture} />}

        {/* auditor on calls */}
        {auditor && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] bg-surface-inset px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-text"><Gauge size={13} className="text-accent" /> Auditor AI <span className="font-mono text-accent">{auditor.score}/100</span></span>
            <span className="text-text-muted">Strong objection handling · talk-ratio {auditor.talk}%</span>
            <span className="font-mono text-[10px] text-text-faint">visible to you + manager</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function CaptureBox({ capture }: { capture: NonNullable<Capture> }) {
  return (
    <div className="rounded-[12px] border border-accent/15 bg-accent-soft/40 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-accent"><Sparkles size={13} /> AI summary</div>
      <dl className="space-y-1 text-sm">
        <Row k="Said" v={capture.said} />
        <Row k="Agreed" v={capture.agreed} />
        <Row k="Next step" v={capture.nextStep} />
      </dl>
      {capture.chips.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {capture.chips.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-2 rounded-[8px] border border-border bg-surface px-2.5 py-1 text-xs">
              <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">{c.label}</span>
              <span className="font-medium text-text">{c.value}</span>
              <ConfBar v={c.confidence} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wide text-accent/80">{k}</dt>
      <dd className="flex-1 text-text">{v}</dd>
    </div>
  );
}
function ConfBar({ v }: { v: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1 w-7 overflow-hidden rounded-full bg-border-strong"><span className="block h-full rounded-full bg-accent" style={{ width: `${v}%` }} /></span>
      <span className="font-mono text-[10px] text-text-faint">{v}%</span>
    </span>
  );
}

function Highlighted({ text, quote }: { text: string; quote: string | null }) {
  if (!quote || !text.includes(quote)) return <>{text}</>;
  const [before, after] = text.split(quote);
  return (<>{before}<mark className="rounded bg-accent-soft px-0.5 text-accent">{quote}</mark>{after}</>);
}

/* ---------------- right rail ---------------- */
function LeadScore({ buyer, messages }: { buyer: Buyer; messages: Message[] }) {
  const { set } = useContext(ProvenanceCtx);
  const diff = buyer.score - buyer.prevScore;
  const tone = buyer.score >= 75 ? "Hot" : buyer.score >= 50 ? "Warm" : "Cool";
  const srcLabel = (mid: string) => { const m = messages.find((x) => x.id === mid); return m ? `${CHANNEL_LABEL[m.channel]} · ${shortDate(m.timestamp)}` : "captured"; };

  return (
    <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-4">
        <ScoreBadge score={buyer.score} size={64} />
        <div>
          <Label>Lead score</Label>
          <div className="mt-0.5 flex items-center gap-2">
            <span className={cn("text-lg font-bold", tone === "Hot" ? "text-accent" : tone === "Warm" ? "text-live" : "text-text-faint")}>{tone}</span>
            {diff !== 0 && <span className={cn("flex items-center gap-0.5 font-mono text-xs font-semibold", diff > 0 ? "text-positive" : "text-negative")}><TrendingUp size={12} className={cn(diff < 0 && "rotate-180")} />{diff > 0 ? "+" : ""}{diff}</span>}
          </div>
          <p className="font-mono text-[10px] text-text-faint" suppressHydrationWarning>re-scored {relativeTime(buyer.lastTouch)}</p>
        </div>
      </div>
      <div className="mt-3"><Sparkline points={buyer.scoreHistory.map((p) => p.score)} width={300} height={32} /></div>
      <div className="mt-3 space-y-2 border-t border-border pt-3">
        {buyer.scoreReasons.map((r) => (
          <button key={r.id} onMouseEnter={() => set({ msgId: r.sourceMessageId, quote: r.sourceQuote })} onMouseLeave={() => set({ msgId: null, quote: null })} className="flex w-full items-start gap-2 rounded-[8px] px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2">
            <TrendingUp size={13} className={cn("mt-0.5 shrink-0", r.polarity === "positive" ? "text-positive" : "rotate-180 text-negative")} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-snug text-text">{r.text}</span>
              <span className="font-mono text-[10px] text-text-faint">✦ {srcLabel(r.sourceMessageId)}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 border-t border-border pt-3 text-xs text-text-faint">Every score cites its source. No black boxes.</p>
    </div>
  );
}

function DraftedAction({ buyer, unitLabel }: { buyer: Buyer; unitLabel: string }) {
  const [dismissed, setDismissed] = useState(false);
  const confirm = useConfirm();
  if (dismissed) return null;
  const a = ACTION_BY_STAGE[buyer.stage];
  const send = async () => {
    const ok = await confirm({
      title: a.cta + "?",
      description: `This sends the message to ${buyer.name} on their preferred channel and logs it to the timeline.`,
      confirmLabel: "Approve & send",
      tone: "accent",
    });
    if (!ok) return;
    toast.success("Sent", { description: a.cta });
    setDismissed(true);
  };
  return (
    <div className="overflow-hidden rounded-[16px] border border-live/30 bg-live-soft/40 p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-live"><Sparkles size={14} /> AI drafted</span>
        <span className="inline-flex items-center gap-1 rounded-pill bg-surface px-2 py-0.5 font-mono text-[10px] text-text-muted"><ShieldCheck size={11} className="text-positive" /> Guardian-cleared · needs your nod</span>
      </div>
      <div className="text-sm font-semibold text-text">{a.cta}</div>
      <p className="mt-2 rounded-[10px] border border-border bg-surface p-3 text-sm leading-relaxed text-text-muted">{a.body(buyer, unitLabel)}</p>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={send} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-accent text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95"><Check size={15} /> Approve &amp; send</button>
        <button onClick={() => toast("Editing draft…")} className="flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-surface-2"><Pencil size={14} /> Edit</button>
        <button onClick={() => setDismissed(true)} className="grid h-9 w-9 place-items-center rounded-[10px] border border-border text-text-faint hover:text-negative" aria-label="Dismiss"><X size={15} /></button>
      </div>
    </div>
  );
}

function AutoFilledFields({ buyer, unit }: { buyer: Buyer; unit?: ReturnType<typeof useStore.getState>["units"][number] }) {
  const raw = [
    ...buyer.profile.map((f) => ({ label: f.label, value: f.value, confidence: conf(f.id), manual: false })),
    { label: "Unit of interest", value: unit ? `${unit.unitNo} · ${unit.config} · ${unit.floor}th` : `${buyer.config}`, confidence: 95, manual: false },
    { label: "Possession", value: buyer.possession, confidence: conf(buyer.id + "p"), manual: false },
    { label: "Owner", value: buyer.agent, confidence: 0, manual: true },
  ];
  const seen = new Set<string>();
  const rows = raw.filter((r) => (seen.has(r.label) ? false : (seen.add(r.label), true)));
  return (
    <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center justify-between">
        <Label>Auto-filled fields</Label>
        <span className="inline-flex items-center gap-1 rounded-pill bg-positive-soft px-2 py-0.5 font-mono text-[10px] text-positive"><Sparkles size={10} /> no manual entry</span>
      </div>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-text-faint">{r.label}</span>
            <span className="flex-1 truncate text-sm font-medium capitalize text-text">{r.value}</span>
            {r.manual ? (
              <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-faint">manual</span>
            ) : (
              <ConfBar v={r.confidence} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Milestones({ buyer, done, messages }: { buyer: Buyer; done: number; messages: Message[] }) {
  const firstWa = messages.find((m) => m.channel === "whatsapp");
  return (
    <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-2 flex items-center justify-between">
        <Label>Milestones · real estate pack</Label>
        <span className="font-mono text-xs font-semibold text-text">{done}/{MILESTONES.length}</span>
      </div>
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-inset">
        <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${(done / MILESTONES.length) * 100}%` }} transition={{ duration: 0.8 }} />
      </div>
      <div className="space-y-2.5">
        {MILESTONES.map((m, i) => {
          const state = i < done ? "done" : i === done ? "now" : "todo";
          return (
            <div key={m}>
              <div className="flex items-center gap-2.5">
                {state === "done" ? <CheckCircle2 size={16} className="shrink-0 text-accent" />
                  : state === "now" ? <CircleDot size={16} className="shrink-0 text-live" />
                  : <Circle size={16} className="shrink-0 text-text-faint/50" />}
                <span className={cn("flex-1 text-sm", state === "todo" ? "text-text-faint" : "font-medium text-text")}>{m}</span>
                {state === "done" && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-faint">+auto</span>}
                {state === "now" && <span className="rounded-pill bg-live-soft px-2 py-0.5 font-mono text-[10px] font-semibold text-live">now</span>}
              </div>
              {m === "Loan Sanction" && state !== "done" && (
                <div className="ml-[26px] mt-1 space-y-1">
                  {["Application Submitted", "Sanction Letter Received"].map((s) => (
                    <div key={s} className="flex items-center gap-2 font-mono text-[11px] text-text-faint"><Circle size={9} /> {s}</div>
                  ))}
                </div>
              )}
              {i < done && firstWa && i === 1 && (
                <div className="ml-[26px] font-mono text-[10px] text-text-faint" suppressHydrationWarning>✦ WhatsApp · {shortDate(firstWa.timestamp)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- enrichment (sourced intel) ---------------- */
const ENRICH_TITLES = ["VP of Engineering", "Head of Product", "Director of Sales", "Senior Manager", "Founder & CEO", "VP of Operations", "Principal Architect", "Chief of Staff"];
const ENRICH_COMPANIES = ["Helix Cloud", "Northstar Labs", "Vega Systems", "Brightwave", "Orbital Tech", "Lumen Analytics", "Riverstone Soft", "Cadence Digital"];
const ENRICH_INDUSTRIES = ["SaaS", "Fintech", "Healthtech", "E-commerce", "Cloud infra", "AI / ML"];
const ENRICH_SIZES = ["50–200 employees", "200–500 employees", "500–1,000 employees", "1,000–5,000 employees"];
const ENRICH_NEWS = ["Company raised Series B last month", "Just hired a Head of Sales", "Opened a new office in Bengaluru", "Announced a major product launch", "Closed a strategic acquisition"];

function Enrichment({ buyer }: { buyer: Buyer }) {
  const h = hash(buyer.name);
  const title = ENRICH_TITLES[h % ENRICH_TITLES.length];
  const company = ENRICH_COMPANIES[(h >>> 3) % ENRICH_COMPANIES.length];
  const industry = ENRICH_INDUSTRIES[(h >>> 5) % ENRICH_INDUSTRIES.length];
  const size = ENRICH_SIZES[(h >>> 7) % ENRICH_SIZES.length];
  const news = ENRICH_NEWS[(h >>> 9) % ENRICH_NEWS.length];
  const locality = buyer.localityPrefs[0] ?? "the area";

  return (
    <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center justify-between">
        <Label>Enrichment · sourced</Label>
        <Pill variant="positive" mono><BadgeCheck size={11} /> verified</Pill>
      </div>
      <div className="space-y-2.5">
        <a href="#" onClick={(e) => e.preventDefault()} className="group flex items-start gap-2.5 rounded-[10px] border border-border bg-surface-2 px-3 py-2 transition-colors hover:border-border-strong">
          <Link2 size={15} className="mt-0.5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-sm font-medium text-text">{title} · {company} <ExternalLink size={11} className="text-text-faint transition-colors group-hover:text-accent" /></span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">LinkedIn</span>
          </span>
        </a>
        <div className="flex items-start gap-2.5 rounded-[10px] border border-border bg-surface-2 px-3 py-2">
          <Building2 size={15} className="mt-0.5 shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-text">{industry} · {size}</span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">Company · web</span>
          </span>
          <span className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-faint">source</span>
        </div>
        <div className="flex items-start gap-2.5 rounded-[10px] border border-border bg-surface-2 px-3 py-2">
          <Newspaper size={15} className="mt-0.5 shrink-0 text-live" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-text">{news}</span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">News · signal</span>
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-accent/15 bg-accent-soft/40 p-3">
        <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
        <p className="text-sm leading-relaxed text-text">
          {news.includes("Sales") ? "They just hired a Head of Sales" : "Their company just hit a growth milestone"} — a good moment to re-engage on the {buyer.config} in {locality}.
        </p>
      </div>
      <p className="mt-3 font-mono text-[10px] text-text-faint">✦ enriched · just now</p>
    </div>
  );
}

/* ---------------- loan eligibility ---------------- */
const LOAN_STATUS_PILL: Record<Buyer["loanStatus"], { label: string; variant: "positive" | "live" | "accent" | "neutral" }> = {
  "pre-approved": { label: "Pre-approved", variant: "positive" },
  "in process": { label: "In process", variant: "live" },
  "needs help": { label: "Needs help", variant: "accent" },
  "not needed": { label: "No loan needed", variant: "neutral" },
};

function emi(principal: number, annualRate: number, years: number) {
  const r = annualRate / 12 / 100;
  const n = years * 12;
  if (r === 0) return Math.round(principal / n);
  const f = Math.pow(1 + r, n);
  return Math.round((principal * r * f) / (f - 1));
}

function LoanEligibility({ buyer }: { buyer: Buyer }) {
  const value = buyer.budgetMax;
  const downPayment = Math.round(value * 0.2);
  const loanNeeded = value - downPayment; // 80%
  const monthlyIncome = Math.round(value / 220);
  const eligible = Math.min(Math.round(monthlyIncome * 60), Math.round(value * 0.95));
  const monthlyEmi = emi(loanNeeded, 8.5, 20);
  const coverage = Math.min(100, Math.round((eligible / loanNeeded) * 100));
  const covered = eligible >= loanNeeded;
  const status = LOAN_STATUS_PILL[buyer.loanStatus];

  return (
    <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Label>Loan eligibility</Label>
        <Pill variant={status.variant}><Landmark size={11} /> {status.label}</Pill>
      </div>
      <div className="space-y-2.5">
        <LoanRow k="Property value" v={rupees(value)} />
        <LoanRow k="Down payment · 20%" v={rupees(downPayment)} />
        <LoanRow k="Loan needed · 80%" v={rupees(loanNeeded)} strong />
        <LoanRow k="Est. EMI / month" v={`${rupees(monthlyEmi)}`} hint="8.5% · 20 yr" />
      </div>
      <div className="mt-3 rounded-[12px] border border-border bg-surface-2 p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text"><Wallet size={14} className="text-accent" /> Eligible amount</span>
          <span className="tabular text-sm font-bold text-text">{rupees(eligible)}</span>
        </div>
        <Meter value={coverage} color={covered ? "var(--positive)" : "var(--live)"} />
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-[10px] text-text-faint">{coverage}% of loan needed</span>
          {covered
            ? <Pill variant="positive" mono><Check size={11} /> Eligible</Pill>
            : <Pill variant="live" mono>Shortfall {rupees(loanNeeded - eligible)}</Pill>}
        </div>
      </div>
      <p className="mt-3 font-mono text-[10px] text-text-faint">DSA rules · indicative</p>
    </div>
  );
}

function LoanRow({ k, v, strong, hint }: { k: string; v: string; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 text-xs text-text-faint">{k}</span>
      {hint && <span className="font-mono text-[10px] text-text-faint">{hint}</span>}
      <span className={cn("tabular text-sm", strong ? "font-bold text-text" : "font-medium text-text")}>{v}</span>
    </div>
  );
}

/* ---------------- sales playbook (what wins deals like this) ---------------- */
const PLAYBOOKS = [
  "Fast-track site visit",
  "Loan-assist close",
  "Floor-rise upsell",
  "Weekend-visit nudge",
  "Price-lock urgency",
] as const;

/* deterministic 3-4 plays per playbook, tailored at render with buyer.config/stage */
const PLAYS: Record<(typeof PLAYBOOKS)[number], (b: Buyer) => string[]> = {
  "Fast-track site visit": (b) => [
    `Confirm ${b.config} shortlist in ${b.localityPrefs[0] ?? "the area"}`,
    "Lock a weekend site-visit slot within 48h",
    "Send location pin + brochure the night before",
    "Walk the model unit, then quote on the spot",
  ],
  "Loan-assist close": (b) => [
    `Pre-qualify EMI on ${rupees(b.budgetMax)} with the DSA desk`,
    "Share sanction-letter checklist on WhatsApp",
    "Hold the unit against a token while loan clears",
    "Co-sign the agreement once sanction lands",
  ],
  "Floor-rise upsell": (b) => [
    `Anchor on the base ${b.config}, then show higher floors`,
    "Break down floor-rise vs. resale upside",
    "Offer a limited higher-floor hold for 72h",
    "Close on the view premium with a price freeze",
  ],
  "Weekend-visit nudge": (b) => [
    `Re-engage with 2 fresh ${b.config} options`,
    "Propose Sat 11 AM or Sun 4 PM — pick one",
    "Confirm + send the location pin",
    "Debrief after the visit, send pricing same day",
  ],
  "Price-lock urgency": (b) => [
    `Flag the next price revision on ${b.localityPrefs[0] ?? "this tower"}`,
    "Share a 7-day price-lock on the shortlisted unit",
    "Send the booking payment link before the lock expires",
    "Confirm receipt and move to agreement",
  ],
};

/* lightweight stage rank to mark plays done/upcoming */
const STAGE_RANK: Record<Stage, number> = {
  "New Enquiry": 0, Qualified: 1, "Site Visit Scheduled": 1, "Site Visit Completed": 2, "Unit Selected": 3,
  "Booking Amount Paid": 4, "Booking Confirmed": 4, "Agreement Signed": 4, "Loan Sanction": 4, Registration: 4, Handover: 4,
};

function SalesPlaybook({ buyer }: { buyer: Buyer }) {
  const h = hash(buyer.id);
  const match = 86 + (h % 11); // 86–96%
  const book = PLAYBOOKS[(h >>> 4) % PLAYBOOKS.length];
  const plays = PLAYS[book](buyer);
  const locality = buyer.localityPrefs[0] ?? "the area";

  /* evidence stats — plausible, deterministic */
  const wonCount = 8 + ((h >>> 7) % 12); // 8–19
  const fasterPct = 26 + ((h >>> 11) % 18); // 26–43%

  /* how many of the first plays are done, from stage progression */
  const done = Math.min(plays.length - 1, Math.max(1, Math.min(2, STAGE_RANK[buyer.stage])));
  const total = plays.length;
  const nextPlay = plays[done] ?? plays[plays.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <Label>Playbook · what wins deals like this</Label>
        <Pill variant="accent" mono><Zap size={11} /> {match}% match</Pill>
      </div>

      {/* recommended playbook */}
      <div className="flex items-start gap-2.5 rounded-[12px] border border-accent/15 bg-accent-soft/40 p-3">
        <Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-bold text-text">
            <BookOpen size={13} className="text-accent" /> {book}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Won <span className="font-semibold text-text">{wonCount}</span> similar {buyer.config} buyers in {locality} ·{" "}
            <span className="font-semibold text-positive">{fasterPct}% faster</span> close
          </p>
        </div>
      </div>

      {/* ordered plays */}
      <div className="mt-3 space-y-2">
        {plays.map((p, i) => {
          const isDone = i < done;
          const isNow = i === done;
          return (
            <div key={i} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[10px] font-semibold",
                  isDone
                    ? "bg-positive-soft text-positive"
                    : isNow
                      ? "bg-accent-soft text-accent"
                      : "bg-surface-2 text-text-faint",
                )}
              >
                {isDone ? <Check size={11} /> : i + 1}
              </span>
              <span className={cn("flex-1 text-sm leading-snug", isDone ? "text-text-faint line-through" : "text-text")}>
                {p}
              </span>
              {isNow && <Pill variant="accent" mono>now</Pill>}
            </div>
          );
        })}
      </div>

      {/* progress caption */}
      <div className="mt-3 flex items-center gap-2.5">
        <Meter value={Math.round((done / total) * 100)} color="var(--accent)" className="flex-1" />
        <span className="shrink-0 font-mono text-[10px] text-text-faint">step {done}/{total}</span>
      </div>

      {/* footer CTA */}
      <div className="mt-3 flex items-start gap-1.5 border-t border-border pt-3 text-xs text-text">
        <Trophy size={13} className="mt-0.5 shrink-0 text-accent" />
        <span className="flex-1">
          <span className="font-semibold text-text-muted">Next best play</span>
          <ArrowRight size={12} className="mx-1 inline text-accent" />
          {nextPlay}
        </span>
      </div>
    </motion.div>
  );
}
