"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Megaphone, SendHorizontal, Radio, Users, Filter, Eye, Plus,
  CheckCircle2, Clock, MessageCircle, Sparkles, Star, Zap, Trash2,
} from "lucide-react";
import { useScopedBuyers } from "@/lib/roles";
import { CONFIGS, type Config } from "@/lib/data/types";
import { PageContainer, PageHeader } from "@/components/ui/page";
import {
  Label, AnimatedNumber, Avatar, Pill, Meter, Sparkline, StatusDot,
} from "@/components/ui/primitives";
import { cn, rupeeRange, relativeTime, SEED_NOW } from "@/lib/utils";
import { toast } from "sonner";

/* ---------------- deterministic hash (no Math.random / Date.now) ---------------- */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}
/** Deterministic integer in [min, max] seeded from a string. */
function seededInt(seed: string, min: number, max: number): number {
  return min + (hash(seed) % (max - min + 1));
}
/** Deterministic sparkline of n points, trending toward `end`. */
function seededSpark(seed: string, n: number, end: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const wobble = (hash(`${seed}:${i}`) % 22) - 11;
    const base = end * (0.55 + (i / (n - 1)) * 0.45);
    return Math.max(2, Math.round(base + wobble));
  });
}

/* ---------------- personalization variables ---------------- */
const VARS = ["{Name}", "{Config}", "{Locality}", "{Budget}", "{Offer}"] as const;
const OFFER = "12:88 payment plan + zero floor-rise";

type SampleBuyer = {
  name: string; hue: number; config: string; locality: string; budget: string;
};

function substitute(msg: string, b: SampleBuyer | undefined): string {
  if (!b) return msg;
  const first = b.name.split(" ")[0];
  return msg
    .replaceAll("{Name}", first)
    .replaceAll("{Config}", b.config)
    .replaceAll("{Locality}", b.locality)
    .replaceAll("{Budget}", b.budget)
    .replaceAll("{Offer}", OFFER);
}

const DEFAULT_MSG =
  "Hi {Name}, namaste! 🙏 A few {Config} homes in {Locality} just opened up within your {Budget} range. " +
  "This week only: {Offer}. Reply YES and I'll block a site visit for you.";

/* ---------------- audience segments ---------------- */
type Seg = { id: string; label: string; match: (b: ReturnType<typeof useScopedBuyers>[number]) => boolean };

const BASE_SEGMENTS: Seg[] = [
  { id: "all", label: "All buyers", match: () => true },
  { id: "hot", label: "Hot leads", match: (b) => b.score >= 70 },
  { id: "visit", label: "Site-visit pending", match: (b) => !!b.siteVisitDue },
  { id: "stalled", label: "Stalled", match: (b) => b.stalled },
];

/* ---------------- past campaigns (deterministic seed) ---------------- */
type CampaignStatus = "Sent" | "Scheduled" | "Draft";
type Campaign = {
  id: string;
  name: string;
  audience: string;
  status: CampaignStatus;
  sent: number;
  delivered: number; // %
  read: number; // %
  reply: number; // %
  spark: number[];
  at: number; // ms epoch
};

const SEED_CAMPAIGNS: { name: string; audience: string; status: CampaignStatus }[] = [
  { name: "Diwali offer blast", audience: "All buyers", status: "Sent" },
  { name: "New launch · Aurum Skyline", audience: "Hot leads", status: "Sent" },
  { name: "Site-visit reminder", audience: "Site-visit pending", status: "Scheduled" },
  { name: "Price-revision alert", audience: "3BHK buyers", status: "Sent" },
  { name: "Re-engagement · cold leads", audience: "Stalled", status: "Draft" },
];

function seedCampaigns(): Campaign[] {
  return SEED_CAMPAIGNS.map((c, i) => {
    const sent = c.status === "Draft" ? 0 : seededInt(c.name + "sent", 48, 420);
    const delivered = c.status === "Sent" ? seededInt(c.name + "del", 92, 99) : 0;
    const read = c.status === "Sent" ? seededInt(c.name + "read", 58, 88) : 0;
    const reply = c.status === "Sent" ? seededInt(c.name + "rep", 6, 31) : 0;
    return {
      id: `seed-${i}`,
      name: c.name,
      audience: c.audience,
      status: c.status,
      sent,
      delivered,
      read,
      reply,
      spark: seededSpark(c.name, 12, Math.max(8, reply || seededInt(c.name + "sp", 12, 30))),
      at: SEED_NOW - i * 86400000,
    };
  });
}

const STATUS_PILL: Record<CampaignStatus, "positive" | "live" | "neutral"> = {
  Sent: "positive",
  Scheduled: "live",
  Draft: "neutral",
};
const STATUS_COLOR: Record<CampaignStatus, string> = {
  Sent: "var(--positive)",
  Scheduled: "var(--live)",
  Draft: "var(--text-faint)",
};

export default function BroadcastPage() {
  const buyers = useScopedBuyers();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // config chips that actually have buyers
  const configChips = useMemo<Config[]>(
    () => CONFIGS.filter((c) => buyers.some((b) => b.config === c)),
    [buyers],
  );
  const segments = useMemo<Seg[]>(
    () => [
      ...BASE_SEGMENTS,
      ...configChips.map((c) => ({
        id: `config:${c}`,
        label: `${c} buyers`,
        match: (b: ReturnType<typeof useScopedBuyers>[number]) => b.config === c,
      })),
    ],
    [configChips],
  );

  const [segId, setSegId] = useState("all");
  const [message, setMessage] = useState(DEFAULT_MSG);
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => seedCampaigns());

  const seg = segments.find((s) => s.id === segId) ?? segments[0];
  const recipients = useMemo(() => buyers.filter(seg.match), [buyers, seg]);
  const count = recipients.length;

  const sample = recipients[0];
  const sampleBuyer: SampleBuyer | undefined = sample
    ? {
        name: sample.name,
        hue: sample.hue,
        config: sample.config,
        locality: sample.localityPrefs[0] ?? "Kokapet",
        budget: rupeeRange(sample.budgetMin, sample.budgetMax),
      }
    : undefined;

  const preview = substitute(message.trim() || "…", sampleBuyer);

  function insertVar(token: string) {
    setMessage((m) => (m.endsWith(" ") || m.length === 0 ? m + token : m + " " + token));
    textareaRef.current?.focus();
  }

  function send() {
    if (count === 0) {
      toast.error("No recipients in this segment.");
      return;
    }
    const id = `live-${hash(message + seg.label + count)}-${campaigns.length}`;
    const next: Campaign = {
      id,
      name: message.split(/[.!?\n]/)[0].slice(0, 42).trim() || "Untitled broadcast",
      audience: seg.label,
      status: "Sent",
      sent: count,
      delivered: 100,
      read: 0,
      reply: 0,
      spark: seededSpark(message + count, 12, Math.max(8, count)),
      at: SEED_NOW + 1,
    };
    setCampaigns((c) => [next, ...c]);
    toast.success(`Broadcast sent to ${count} recipient${count === 1 ? "" : "s"}`, {
      description: `${seg.label} · WhatsApp`,
    });
  }

  function schedule() {
    if (count === 0) {
      toast.error("No recipients in this segment.");
      return;
    }
    toast.success(`Scheduled for ${count} recipient${count === 1 ? "" : "s"}`, {
      description: `${seg.label} · delivers tomorrow 10:00 AM`,
    });
  }

  function removeCampaign(id: string) {
    setCampaigns((c) => c.filter((x) => x.id !== id));
    toast.success("Campaign removed");
  }

  return (
    <PageContainer>
      <PageHeader
        kicker="WhatsApp · nurture"
        title="Broadcast"
        description="Compose a personalized WhatsApp campaign, target a live segment, preview the first recipient, and send — then track delivery, read and reply rates per blast."
        actions={
          <div className="flex items-center gap-2 rounded-pill border border-border bg-surface-2 px-3 py-1.5">
            <Radio size={14} className="text-positive" />
            <span className="font-mono text-[11px] uppercase tracking-wide text-text-muted">
              Sender verified
            </span>
            <StatusDot color="var(--positive)" pulse size={7} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        {/* ---------------- LEFT · composer ---------------- */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]"
        >
          {/* Audience */}
          <div className="mb-2 flex items-center gap-2">
            <Filter size={15} className="text-accent" />
            <Label>Audience</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {segments.map((s) => {
              const active = s.id === segId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSegId(s.id)}
                  className={cn(
                    "rounded-pill px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-contrast"
                      : "border border-border bg-surface-2 text-text-muted hover:border-border-strong hover:text-text",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-end gap-3 rounded-[14px] border border-border bg-surface-inset px-4 py-3.5">
            <Users size={20} className="mb-1 text-accent" />
            <div>
              <div className="font-display text-[34px] font-bold leading-none text-text">
                <AnimatedNumber value={count} />
              </div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-wide text-text-faint">
                recipients · {seg.label}
              </div>
            </div>
            {count > 0 && (
              <Pill variant="positive" className="mb-1 ml-auto" mono>
                <Zap size={11} /> reachable on WhatsApp
              </Pill>
            )}
          </div>

          {/* Message */}
          <div className="mb-2 mt-6 flex items-center gap-2">
            <MessageCircle size={15} className="text-accent" />
            <Label>Message</Label>
            <span className="ml-auto font-mono text-[11px] text-text-faint">
              {message.length} chars
            </span>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 flex items-center gap-1 font-mono text-[11px] text-text-faint">
              <Plus size={11} /> insert
            </span>
            {VARS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVar(v)}
                className="rounded-[8px] border border-border bg-surface-2 px-2 py-1 font-mono text-[11px] text-accent transition-colors hover:border-accent hover:bg-accent-soft"
              >
                {v}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Type your broadcast… use {Name}, {Config}, {Locality}, {Budget}, {Offer} to personalize."
            className="w-full resize-y rounded-[12px] border border-border bg-surface-2 px-3.5 py-3 text-sm leading-relaxed text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
          />

          {/* Live preview */}
          <div className="mb-2 mt-6 flex items-center gap-2">
            <Eye size={15} className="text-accent" />
            <Label>Live preview</Label>
            <Pill variant="outline" className="ml-auto" mono>
              first recipient
            </Pill>
          </div>
          {sampleBuyer ? (
            <div className="rounded-[14px] border border-border bg-surface-inset p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <Avatar name={sampleBuyer.name} hue={sampleBuyer.hue} size={32} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-text">{sampleBuyer.name}</div>
                  <div className="font-mono text-[11px] text-text-faint">
                    {sampleBuyer.config} · {sampleBuyer.locality}
                  </div>
                </div>
                <MessageCircle size={16} className="ml-auto text-positive" />
              </div>
              <div className="flex justify-start">
                <div className="relative max-w-[88%] rounded-[14px] rounded-tl-[4px] bg-positive-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-text shadow-[var(--shadow-soft)]">
                  <span className="whitespace-pre-wrap">{preview}</span>
                  <span className="mt-1 flex items-center justify-end gap-1 font-mono text-[10px] text-text-faint">
                    10:24 <CheckCircle2 size={11} className="text-positive" />
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[96px] place-items-center rounded-[14px] border border-dashed border-border text-sm text-text-faint">
              No recipients in this segment — pick another audience.
            </div>
          )}

          {/* Send bar */}
          <div className="mt-6 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5 text-[12px] text-text-muted">
              <Sparkles size={13} className="text-accent" />
              Personalized per recipient · {VARS.length} variables
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={schedule}
                className="flex h-10 items-center gap-1.5 rounded-[10px] border border-border bg-surface-2 px-4 text-sm font-semibold text-text-muted transition-colors hover:border-border-strong hover:text-text"
              >
                <Clock size={15} /> Schedule
              </button>
              <button
                type="button"
                onClick={send}
                disabled={count === 0}
                className="flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
              >
                <SendHorizontal size={16} strokeWidth={2.4} /> Send to {count} recipient{count === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </motion.div>

        {/* ---------------- RIGHT · past campaigns ---------------- */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Megaphone size={15} className="text-accent" />
            <Label>Past campaigns</Label>
            <span className="tabular ml-auto rounded-pill bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-muted">
              {campaigns.length}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {campaigns.map((c, i) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i, 6) * 0.04 }}
                className="group rounded-[16px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold leading-tight text-text">{c.name}</span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-text-faint">
                      {c.audience}
                    </div>
                  </div>
                  <Pill variant={STATUS_PILL[c.status]} className="shrink-0">
                    <StatusDot color={STATUS_COLOR[c.status]} pulse={c.status === "Scheduled"} size={6} />
                    {c.status}
                  </Pill>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="tabular font-display text-[22px] font-bold leading-none text-text">
                      {c.status === "Draft" ? "—" : c.sent.toLocaleString("en-IN")}
                    </span>
                    <span className="font-mono text-[11px] text-text-faint">sent</span>
                  </div>
                  {c.status === "Sent" && (
                    <Sparkline points={c.spark} width={92} height={28} color="var(--positive)" />
                  )}
                </div>

                {c.status === "Sent" ? (
                  <div className="mt-3 space-y-2">
                    <MetricRow label="Delivered" value={c.delivered} color="var(--positive)" />
                    <MetricRow label="Read" value={c.read} color="var(--accent)" />
                    <MetricRow label="Reply" value={c.reply} color="var(--live)" />
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.status === "Scheduled" ? (
                      <Pill variant="live" mono>
                        <Clock size={11} /> queued · 10:00 AM
                      </Pill>
                    ) : (
                      <Pill variant="neutral" mono>
                        <Star size={11} /> draft · not sent
                      </Pill>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                  <span className="tabular flex items-center gap-1 font-mono text-[11px] text-text-faint">
                    <Clock size={11} /> {relativeTime(c.at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCampaign(c.id)}
                    aria-label="Remove campaign"
                    className="grid h-7 w-7 place-items-center rounded-lg text-text-faint opacity-0 transition-all hover:bg-negative-soft hover:text-negative group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
            {campaigns.length === 0 && (
              <div className="grid min-h-[120px] place-items-center rounded-[16px] border border-dashed border-border text-sm text-text-faint">
                No campaigns yet — compose one on the left.
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function MetricRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[58px] shrink-0 font-mono text-[11px] text-text-muted">{label}</span>
      <Meter value={value} color={color} height={6} />
      <span className="tabular w-[34px] shrink-0 text-right font-mono text-[11px] font-semibold text-text">
        {value}%
      </span>
    </div>
  );
}
