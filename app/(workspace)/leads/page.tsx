"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Sparkles, Moon, Sunrise, Volume2, Check, X, ArrowUpRight, CalendarCheck,
  Bot, ShieldCheck, UserPlus, RefreshCw, ArrowRight, Send,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useScopedOvernightLeads, useScopedReviewItems, useClientMorningBrief } from "@/lib/roles";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { useConfirm } from "@/components/ui/confirm";
import { ScoreBadge, Avatar, ChannelIcon, Pill, AnimatedNumber, Label } from "@/components/ui/primitives";
import { SOURCE_LABEL, type OvernightLead, type ReviewItem, type MorningBrief } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export default function LeadsPage() {
  const leads = useScopedOvernightLeads();
  const brief = useClientMorningBrief();

  return (
    <PageContainer>
      <PageHeader
        kicker="Captured while you were away"
        title="Overnight leads"
        description="Leads never sleep — but your team does. Between 10 PM and 9 AM the AI captures every WhatsApp, portal enquiry and missed call, qualifies them, and lines up exactly what needs your nod this morning."
      />

      {brief && <MorningBrief brief={brief} count={leads.length} />}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <Label>While you slept · {leads.length} captured</Label>
            <span className="font-mono text-[11px] text-text-faint">ranked by intent</span>
          </div>
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {leads.map((lead) => (<OvernightCard key={lead.id} lead={lead} />))}
            </AnimatePresence>
          </div>
          {leads.length === 0 && (
            <div className="grid place-items-center rounded-[16px] border border-dashed border-border py-16 text-center">
              <Sunrise size={26} className="mb-2 text-accent" />
              <p className="text-sm font-medium text-text">All caught up.</p>
              <p className="text-sm text-text-muted">Every overnight lead has been triaged. Have a good morning.</p>
            </div>
          )}
        </div>

        <div className="min-w-0 lg:order-last">
          <NeedsYourNod />
        </div>
      </div>
    </PageContainer>
  );
}

/* ---------------- morning brief banner ---------------- */
function MorningBrief({ brief, count }: { brief: MorningBrief; count: number }) {
  const stats = [
    { n: brief.conversations, label: "conversations captured", sub: `across ${brief.channels} channels` },
    { n: count, label: "leads auto-created", sub: `${brief.needNod} need your nod` },
    { n: brief.visitsBooked, label: "site visits booked", sub: "by the AI, unattended" },
    { n: brief.fieldsAutoFilled, label: "fields auto-filled", sub: "0 corrections" },
    { n: brief.actionsDrafted, label: "actions drafted", sub: "waiting for you" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[18px] border border-chrome-border p-6 text-white shadow-[var(--shadow-lift)] md:p-7"
      style={{ background: "linear-gradient(125deg, #0c4a45 0%, #082c27 52%, #0a0d11 100%)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(540px 240px at 88% -20%, color-mix(in oklab, var(--live) 30%, transparent), transparent 70%)" }} />
      <div className="relative">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[rgba(255,255,255,0.1)] text-[#ec9a3c]"><Moon size={19} /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold">Good morning, Maya</h2>
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-[rgba(255,255,255,0.12)] px-2.5 py-1 font-mono text-[11px] text-white/85">
                  <Moon size={11} /> {brief.window}
                </span>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/75">
                {count} new leads came in overnight across WhatsApp, 99acres and missed calls. The AI Inbox captured and
                qualified them while you were offline — here&apos;s what moved, and what needs your nod.
              </p>
            </div>
          </div>
          <button
            onClick={() => toast("Reading your morning brief…", { description: `${count} leads · ${brief.needNod} need your nod · ${brief.visitsBooked} visits booked` })}
            className="inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-[10px] bg-[rgba(255,255,255,0.12)] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.2)]"
          >
            <Volume2 size={15} /> Brief me out loud
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="font-display text-3xl font-bold leading-none tabular"><AnimatedNumber value={s.n} /></div>
              <div className="mt-1.5 text-[13px] font-medium text-white/85">{s.label}</div>
              <div className="font-mono text-[11px] text-[#f0b271]">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- overnight lead card ---------------- */
const STATUS_PILL: Record<OvernightLead["status"], { label: string; variant: "positive" | "accent" | "live" }> = {
  "visit-booked": { label: "Visit booked by AI", variant: "positive" },
  qualified: { label: "Qualified by AI", variant: "accent" },
  new: { label: "New lead", variant: "live" },
};

function OvernightCard({ lead }: { lead: OvernightLead }) {
  const accept = useStore((s) => s.acceptOvernightLead);
  const dismiss = useStore((s) => s.dismissOvernightLead);
  const confirm = useConfirm();
  const pill = STATUS_PILL[lead.status];

  const handleAccept = async () => {
    const ok = await confirm({
      title: `${lead.action}?`,
      description: `${lead.name} (${lead.requirement}) — captured ${lead.capturedLabel}. This adds the buyer to your ranked worklist.`,
      confirmLabel: lead.action,
      tone: "accent",
    });
    if (!ok) return;
    accept(lead.id);
    toast.success("Approved", { description: `${lead.name} · added to your worklist` });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="overflow-hidden rounded-[16px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2">
          <ScoreBadge score={lead.score} size={46} />
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-text-faint">
            <Moon size={11} /> {lead.capturedLabel}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Avatar name={lead.name} hue={lead.hue} size={26} />
            <span className="font-semibold text-text">{lead.name}</span>
            <Pill variant={pill.variant}>
              {lead.status === "visit-booked" && <CalendarCheck size={11} />}
              {pill.label}
            </Pill>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-text-faint">
              <ChannelIcon channel={lead.channel} size={12} /> {SOURCE_LABEL[lead.source]}
            </span>
          </div>

          <div className="mt-1 text-sm text-text-muted">{lead.requirement}</div>

          <div className="mt-2 flex items-start gap-2 rounded-[10px] bg-accent-soft px-3 py-2 text-sm text-accent">
            <Bot size={14} className="mt-0.5 shrink-0" />
            <span><span className="font-semibold">AI Inbox</span> · {lead.aiSummary}</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {lead.reasons.map((r, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-pill bg-surface-2 px-2.5 py-1 text-xs text-text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-positive" /> {r}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-52">
          <button
            onClick={handleAccept}
            className="flex min-h-9 items-center justify-center gap-1.5 rounded-[10px] bg-accent px-3 py-1.5 text-center text-sm font-semibold leading-tight text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Check size={15} className="shrink-0" /> {lead.action}
          </button>
          <Link
            href={`/buyers/${lead.buyerId}`}
            className="flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-border bg-surface text-sm font-medium text-text transition-colors hover:border-border-strong hover:bg-surface-2"
          >
            Open record <ArrowUpRight size={14} />
          </Link>
          <button
            onClick={() => dismiss(lead.id)}
            className="flex h-8 items-center justify-center gap-1.5 rounded-[10px] text-xs font-medium text-text-faint transition-colors hover:text-negative"
          >
            <X size={13} /> Dismiss
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- needs-your-nod rail ---------------- */
const REVIEW_ICON: Record<ReviewItem["kind"], typeof UserPlus> = {
  outbound: Send,
  "new-lead": UserPlus,
  sequence: RefreshCw,
  "stage-move": ArrowRight,
  "field-update": RefreshCw,
  duplicate: ShieldCheck,
};

function NeedsYourNod() {
  const items = useScopedReviewItems();
  const approve = useStore((s) => s.approveReview);
  const dismiss = useStore((s) => s.dismissReview);
  const confirm = useConfirm();
  const top = items.slice(0, 3);

  const handleApprove = async (item: ReviewItem) => {
    const ok = await confirm({
      title: `Approve: ${item.title}?`,
      description: "This commits the AI action to the live record.",
      confirmLabel: "Approve",
      tone: "accent",
    });
    if (!ok) return;
    approve(item.id);
    toast.success("Approved", { description: item.title });
  };

  return (
    <div className="space-y-4 lg:sticky lg:top-20">
      <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-1 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent"><Sparkles size={15} /></span>
          <Label>Just needs your nod</Label>
        </div>
        <p className="mb-3 text-sm font-semibold text-text">{items.length} AI actions queued</p>

        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {top.map((item) => {
              const Icon = REVIEW_ICON[item.kind];
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-[12px] border border-border bg-surface-2 p-3"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={14} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-text">{item.title}</div>
                      <div className="truncate text-xs text-text-faint">{item.buyerName} · {SOURCE_LABEL[item.source]}</div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(item)}
                      className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-accent text-xs font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95"
                    >
                      <Check size={13} /> Approve
                    </button>
                    <button
                      onClick={() => dismiss(item.id)}
                      className="grid h-8 w-8 place-items-center rounded-[8px] border border-border text-text-faint hover:text-negative"
                      aria-label="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {top.length === 0 && <p className="py-2 text-sm text-text-faint">Queue is clear.</p>}
        </div>

        <Link href="/approvals" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
          Open all approvals <ArrowRight size={14} />
        </Link>
      </div>

      {/* legend */}
      <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <Label className="mb-3 block">Worklist legend</Label>
        <div className="space-y-2.5">
          {[
            { c: "var(--accent)", t: "Hot · 80–100", s: "act today" },
            { c: "var(--live)", t: "Warm · 60–79", s: "keep moving" },
            { c: "var(--text-faint)", t: "Cool · < 60", s: "nurture" },
          ].map((r) => (
            <div key={r.t} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-text">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.c }} /> {r.t}
              </span>
              <span className="font-mono text-[11px] text-text-faint">{r.s}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-text-muted">
          Ranked live by buying-intent score. The AI Inbox re-ranks the moment a new conversation lands — even at 3 AM.
        </p>
      </div>
    </div>
  );
}
