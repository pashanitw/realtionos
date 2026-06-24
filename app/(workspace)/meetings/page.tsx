"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video, Mic2, AudioLines, Captions, Play, Upload, FileText, ScrollText,
  ListChecks, CheckCircle2, Circle, CircleDot, Users, Clock, Sparkles,
  ArrowRight, ChevronRight, X, Check, Star,
} from "lucide-react";
import { useScopedBuyers } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Avatar, Pill, Label, Meter, StatusDot, AnimatedNumber } from "@/components/ui/primitives";
import { cn, rupeeRange, relativeTime, SEED_NOW } from "@/lib/utils";
import type { Buyer } from "@/lib/data/types";
import { toast } from "sonner";

const DAY = 86_400_000;
/** Turn an action-item due label ("Today", "3 days", "This week") into a timestamp. */
function dueMs(label: string): number {
  const l = label.toLowerCase();
  if (l.includes("today")) return SEED_NOW + 6 * 3_600_000;
  if (l.includes("tomorrow")) return SEED_NOW + DAY;
  const m = l.match(/(\d+)\s*day/);
  if (m) return SEED_NOW + Number(m[1]) * DAY;
  if (l.includes("week")) return SEED_NOW + 4 * DAY;
  return SEED_NOW + DAY;
}

/* ---------------- deterministic helpers ---------------- */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
const pick = <T,>(arr: readonly T[], seed: number) => arr[seed % arr.length];

type MeetKind = "In-person" | "Video" | "Phone";
const KIND_ICON: Record<MeetKind, typeof Video> = {
  "In-person": Users,
  Video: Video,
  Phone: Mic2,
};
const KIND_HINT: Record<MeetKind, string> = {
  "In-person": "Site visit",
  Video: "Sales call",
  Phone: "Sales call",
};
const KINDS: MeetKind[] = ["In-person", "Video", "Phone"];

const PROJECTS = ["Skyline Terraces", "Aurum Heights", "Lakeview Residences", "The Meridian", "Palm Grove Enclave", "Iris County"];
const SENTIMENTS = ["Positive", "Neutral"] as const;

type Status = "Transcribed" | "Processing";

interface ActionItem {
  id: string;
  text: string;
  owner: string;
  ownerHue: number;
  due: string;
  done: boolean;
}
interface Moment {
  t: string;
  label: string;
}
interface TranscriptLine {
  t: string;
  who: "agent" | "buyer";
  speaker: string;
  text: string;
}
interface Meeting {
  id: string;
  buyer: Buyer;
  kind: MeetKind;
  title: string;
  project: string;
  at: number;
  durationMin: number;
  status: Status;
  sentiment: (typeof SENTIMENTS)[number];
  summary: string;
  items: ActionItem[];
  moments: Moment[];
  transcript: TranscriptLine[];
}

function firstName(name: string) {
  return name.split(" ")[0];
}

function buildMeeting(buyer: Buyer, i: number, override?: { kind?: MeetKind; status?: Status; at?: number }): Meeting {
  const seed = hash(buyer.id + ":" + i);
  const kind = override?.kind ?? pick(KINDS, seed);
  const project = pick(PROJECTS, hash(buyer.id));
  const locality = buyer.localityPrefs[0] ?? "the corridor";
  const at = override?.at ?? SEED_NOW - i * 1000 * 60 * 60 * 19 - (seed % 7) * 1000 * 60 * 60 * 5;
  const durationMin = 18 + (seed % 26);
  const status: Status = override?.status ?? "Transcribed";
  const sentiment = pick(SENTIMENTS, seed >> 3);

  const title =
    kind === "In-person"
      ? `Site visit · ${firstName(buyer.name)} · ${project}`
      : `Sales call · ${firstName(buyer.name)}`;

  const summary =
    `${firstName(buyer.name)} is exploring a ${buyer.config} in ${locality}, working to a budget of ${rupeeRange(buyer.budgetMin, buyer.budgetMax)}. ` +
    `The conversation centred on ${project} — floor-rise pricing, possession timeline and a possible loan pre-approval. ` +
    `${sentiment === "Positive" ? "Intent reads strong; a follow-up site visit is the natural next step." : "Interest is genuine but unhurried; keep nurturing with options that fit the budget."}`;

  const items: ActionItem[] = [
    { id: `${buyer.id}-a1`, text: `Share floor-rise pricing for ${buyer.config}`, owner: buyer.agent, ownerHue: 210, due: "Tomorrow", done: false },
    { id: `${buyer.id}-a2`, text: `Send brochure for ${project}`, owner: buyer.agent, ownerHue: 210, due: "Today", done: true },
    { id: `${buyer.id}-a3`, text: "Schedule follow-up call", owner: buyer.name, ownerHue: buyer.hue, due: "This week", done: false },
    { id: `${buyer.id}-a4`, text: "Confirm loan pre-approval", owner: buyer.name, ownerHue: buyer.hue, due: "3 days", done: false },
  ];

  const moments: Moment[] = [
    { t: "04:12", label: "Budget discussed" },
    { t: "08:47", label: `${locality} vs alternatives` },
    { t: "11:30", label: "Asked about possession date" },
    { t: `${15 + (seed % 6)}:05`, label: "Floor-rise & pricing" },
  ];

  const transcript: TranscriptLine[] = [
    { t: "00:42", who: "agent", speaker: buyer.agent, text: `Thanks for making time. You were looking at a ${buyer.config} around ${locality}, right?` },
    { t: "01:10", who: "buyer", speaker: buyer.name, text: `Yes — ideally close to ${locality}, but the budget has to stay within ${rupeeRange(buyer.budgetMin, buyer.budgetMax)}.` },
    { t: "04:12", who: "agent", speaker: buyer.agent, text: `Understood. ${project} has a couple of ${buyer.config} units that fit; I can share the floor-rise sheet.` },
    { t: "08:47", who: "buyer", speaker: buyer.name, text: "What does the possession timeline look like, and is there a loan tie-up?" },
    { t: "11:30", who: "agent", speaker: buyer.agent, text: "Possession is on schedule, and we have pre-approval support with three banks." },
    { t: "13:58", who: "buyer", speaker: buyer.name, text: "Great — send the brochure and let's line up a site visit." },
  ];

  return {
    id: `meet-${buyer.id}-${i}`,
    buyer,
    kind,
    title,
    project,
    at,
    durationMin,
    status,
    sentiment,
    summary,
    items,
    moments,
    transcript,
  };
}

function whenLabel(at: number) {
  const isToday = new Date(at).toDateString() === new Date(SEED_NOW).toDateString();
  return isToday ? "Today" : relativeTime(at);
}

const STATUS_PILL: Record<Status, { variant: "positive" | "live"; live?: boolean }> = {
  Transcribed: { variant: "positive" },
  Processing: { variant: "live", live: true },
};

export default function MeetingsPage() {
  const buyers = useScopedBuyers();
  const seeded = useMemo(() => {
    const base = buyers.slice(0, 6);
    return base.map((b, i) => buildMeeting(b, i)).slice(0, 5);
  }, [buyers]);

  const [extra, setExtra] = useState<Meeting[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [uploadOpen, setUploadOpen] = useState(false);
  // per-meeting toggled action-item state, keyed by item id
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [showTranscript, setShowTranscript] = useState(true);
  const [sentToTasks, setSentToTasks] = useState<Record<string, boolean>>({});
  const addTasks = useStore((s) => s.addTasks);

  const sendToTasks = (m: Meeting) => {
    const open = m.items.filter((it) => !(toggled[it.id] ?? it.done));
    if (!open.length) { toast("All action items are already done."); return; }
    const n = addTasks(open.map((it) => ({
      buyerId: m.buyer.id, agentId: m.buyer.agentId, title: it.text, dueAt: dueMs(it.due),
      priority: "Medium" as const, source: `From a ${m.kind.toLowerCase()} meeting`,
    })));
    setSentToTasks((p) => ({ ...p, [m.id]: true }));
    toast.success(`${n} action item${n === 1 ? "" : "s"} added to Tasks`);
  };

  const meetings = useMemo(() => [...extra, ...seeded], [extra, seeded]);
  const active = meetings.find((m) => m.id === activeId) ?? meetings[0];

  const transcribed = meetings.filter((m) => m.status === "Transcribed").length;
  const processing = meetings.filter((m) => m.status === "Processing").length;
  const openItems = meetings.reduce(
    (n, m) => n + m.items.filter((it) => !(toggled[it.id] ?? it.done)).length,
    0,
  );

  function handleUpload(buyer: Buyer, kind: MeetKind) {
    const id = `meet-upload-${hash(buyer.id + kind + meetings.length)}`;
    const draft: Meeting = {
      ...buildMeeting(buyer, 0, { kind, status: "Processing", at: SEED_NOW + 60_000 }),
      id,
    };
    setExtra((prev) => [draft, ...prev]);
    setActiveId(id);
    setUploadOpen(false);
    toast.success(`Uploading recording · ${firstName(buyer.name)}`, { description: "Transcribing now…" });
    setTimeout(() => {
      setExtra((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "Transcribed" as Status } : m)),
      );
      // auto-create tasks from the freshly-extracted action items
      const open = draft.items.filter((it) => !it.done);
      const n = addTasks(open.map((it) => ({
        buyerId: draft.buyer.id, agentId: draft.buyer.agentId, title: it.text, dueAt: dueMs(it.due),
        priority: "Medium" as const, source: `From a ${draft.kind.toLowerCase()} meeting`,
      })));
      setSentToTasks((p) => ({ ...p, [id]: true }));
      toast.success(`Transcript ready · ${firstName(buyer.name)}`, { description: `Summary done · ${n} action items added to Tasks.` });
    }, 1500);
  }

  const kpis = [
    { label: "Meetings", value: meetings.length, hint: "this week" },
    { label: "Transcribed", value: transcribed, hint: "AI processed", tone: "positive" as const },
    { label: "Processing", value: processing, hint: "in queue", tone: "live" as const },
    { label: "Open actions", value: openItems, hint: "to close out" },
  ];

  return (
    <PageContainer>
      <PageHeader
        kicker="Meeting intelligence"
        title="Meetings"
        description="Recorded site visits and sales meetings, transcribed and summarised by AI — with action items extracted and assigned automatically."
        actions={
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Upload size={16} strokeWidth={2.5} /> Upload recording
          </button>
        }
      />

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
            className="rounded-[14px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]"
          >
            <Label>{k.label}</Label>
            <div
              className="mt-1.5 font-display text-[26px] font-bold leading-none"
              style={{ color: k.tone === "positive" ? "var(--positive)" : k.tone === "live" ? "var(--live)" : "var(--text)" }}
            >
              <AnimatedNumber value={k.value} />
            </div>
            <div className="mt-1 font-mono text-[11px] text-text-faint">{k.hint}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* ---------------- LEFT · meeting list ---------------- */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <ScrollText size={15} className="text-accent" />
            <Label>Recordings</Label>
            <span className="tabular ml-auto rounded-pill bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-muted">{meetings.length}</span>
          </div>
          <div className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {meetings.map((m, i) => {
                const Icon = KIND_ICON[m.kind];
                const isActive = m.id === active?.id;
                const statusMeta = STATUS_PILL[m.status];
                return (
                  <motion.button
                    key={m.id}
                    type="button"
                    layout
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 360, damping: 32, delay: Math.min(i, 5) * 0.02 }}
                    onClick={() => setActiveId(m.id)}
                    className={cn(
                      "w-full rounded-[14px] border bg-surface p-3.5 text-left shadow-[var(--shadow-soft)] transition-colors",
                      isActive ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
                        style={{ background: "color-mix(in oklab, var(--accent) 14%, transparent)", color: "var(--accent)" }}
                      >
                        <Icon size={16} strokeWidth={2.1} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold leading-tight text-text">{m.title}</div>
                        <div className="tabular mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-text-faint">
                          <Clock size={11} /> {whenLabel(m.at)} · {m.durationMin} min
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Pill variant="outline" mono>{m.kind}</Pill>
                        <div className="flex -space-x-1.5">
                          <Avatar name={m.buyer.name} hue={m.buyer.hue} size={20} className="ring-2 ring-surface" />
                          <Avatar name={m.buyer.agentInitials} hue={210} size={20} className="ring-2 ring-surface" />
                        </div>
                      </div>
                      <Pill variant={statusMeta.variant}>
                        {statusMeta.live && <StatusDot color="var(--live)" pulse size={6} />}
                        {m.status}
                      </Pill>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* ---------------- RIGHT · detail ---------------- */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            {active && (
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-4"
              >
                {/* Header card */}
                <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <Pill variant="outline" mono>{active.kind}</Pill>
                        <span className="font-mono text-[11px] uppercase tracking-wide text-text-faint">{KIND_HINT[active.kind]}</span>
                      </div>
                      <h2 className="truncate font-display text-[20px] font-bold leading-tight tracking-tight text-text">{active.title}</h2>
                      <div className="tabular mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-text-muted">
                        <span className="flex items-center gap-1.5"><Clock size={12} className="text-text-faint" /> {whenLabel(active.at)} · {active.durationMin} min</span>
                        <span className="flex items-center gap-1.5"><Users size={12} className="text-text-faint" /> {firstName(active.buyer.name)} + {active.buyer.agent}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Avatar name={active.buyer.name} hue={active.buyer.hue} size={34} className="ring-2 ring-surface" />
                      <Avatar name={active.buyer.agentInitials} hue={210} size={34} className="-ml-3 ring-2 ring-surface" />
                    </div>
                  </div>

                  {/* faux audio scrubber */}
                  <div className="mt-4 flex items-center gap-3 rounded-[12px] border border-border bg-surface-2 px-3 py-2.5">
                    <button
                      type="button"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast transition-transform hover:scale-105 active:scale-95"
                      aria-label="Play recording"
                    >
                      <Play size={15} className="ml-0.5 fill-current" />
                    </button>
                    <AudioLines size={16} className="shrink-0 text-text-faint" />
                    <div className="flex-1">
                      <Meter value={36} color="var(--accent)" height={6} />
                    </div>
                    <span className="tabular shrink-0 font-mono text-[11px] text-text-faint">
                      10:18 / {String(active.durationMin).padStart(2, "0")}:00
                    </span>
                  </div>
                </div>

                {/* AI summary */}
                <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
                  <div className="mb-2.5 flex items-center gap-2">
                    <Sparkles size={15} className="text-accent" />
                    <Label>AI summary</Label>
                    {active.status === "Processing" && (
                      <Pill variant="live" className="ml-auto"><StatusDot color="var(--live)" pulse size={6} /> Transcribing</Pill>
                    )}
                  </div>
                  {active.status === "Processing" ? (
                    <p className="text-sm leading-relaxed text-text-faint">Transcribing the recording — the summary and action items will appear here in a moment.</p>
                  ) : (
                    <p className="text-sm leading-relaxed text-text-muted">{active.summary}</p>
                  )}
                </div>

                {/* Action items */}
                <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
                  <div className="mb-3 flex items-center gap-2">
                    <ListChecks size={15} className="text-accent" />
                    <Label>Action items</Label>
                    <span className="tabular ml-auto rounded-pill bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-muted">
                      {active.items.filter((it) => !(toggled[it.id] ?? it.done)).length} open
                    </span>
                    {active.status === "Transcribed" && (
                      <button
                        type="button"
                        onClick={() => sendToTasks(active)}
                        disabled={sentToTasks[active.id]}
                        className="flex h-7 items-center gap-1.5 rounded-[9px] border border-border bg-surface-2 px-2.5 text-[12px] font-semibold text-text transition-colors hover:border-border-strong hover:bg-surface-inset disabled:opacity-50"
                      >
                        {sentToTasks[active.id] ? <><Check size={12} /> Added to Tasks</> : <><ArrowRight size={12} /> Add to Tasks</>}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {active.items.map((it) => {
                      const done = toggled[it.id] ?? it.done;
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => setToggled((p) => ({ ...p, [it.id]: !done }))}
                          className="group flex items-center gap-3 rounded-[12px] border border-border bg-surface-2 px-3 py-2.5 text-left transition-colors hover:border-border-strong"
                        >
                          <span className="shrink-0" style={{ color: done ? "var(--positive)" : "var(--text-faint)" }}>
                            {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                          </span>
                          <span className={cn("min-w-0 flex-1 text-sm text-text", done && "text-text-faint line-through")}>{it.text}</span>
                          <span className="tabular hidden shrink-0 items-center gap-1 rounded-pill bg-surface-inset px-2 py-0.5 font-mono text-[10px] text-text-faint sm:inline-flex">
                            <Clock size={10} /> {it.due}
                          </span>
                          <Avatar name={it.owner} hue={it.ownerHue} size={22} className="shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Key moments / sentiment */}
                <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
                  <div className="mb-3 flex items-center gap-2">
                    <CircleDot size={15} className="text-accent" />
                    <Label>Key moments</Label>
                    <Pill variant={active.sentiment === "Positive" ? "positive" : "neutral"} className="ml-auto">
                      {active.sentiment === "Positive" ? <Star size={11} className="fill-positive text-positive" /> : null}
                      {active.sentiment} sentiment
                    </Pill>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {active.moments.map((mo) => (
                      <span key={mo.t + mo.label} className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-2 px-2.5 py-1 text-xs text-text-muted">
                        <span className="tabular font-mono text-[11px] text-accent">{mo.t}</span>
                        <span className="text-text-faint">·</span>
                        {mo.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Transcript (collapsible) */}
                <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
                  <button
                    type="button"
                    onClick={() => setShowTranscript((v) => !v)}
                    className="flex w-full items-center gap-2"
                  >
                    <Captions size={15} className="text-accent" />
                    <Label>Transcript</Label>
                    <span className="tabular ml-auto flex items-center gap-1.5 font-mono text-[11px] text-text-faint">
                      {active.transcript.length} lines
                      <ChevronRight size={14} className={cn("transition-transform", showTranscript && "rotate-90")} />
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {showTranscript && (
                      <motion.div
                        key="transcript"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 flex flex-col gap-3">
                          {active.transcript.map((line, i) => (
                            <div key={i} className="flex gap-3">
                              <Avatar
                                name={line.who === "agent" ? active.buyer.agentInitials : active.buyer.name}
                                hue={line.who === "agent" ? 210 : active.buyer.hue}
                                size={26}
                                className="mt-0.5"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-[13px] font-semibold text-text">{line.who === "agent" ? line.speaker : firstName(line.speaker)}</span>
                                  <span className="tabular font-mono text-[10px] text-text-faint">{line.t}</span>
                                  {line.who === "agent" && (
                                    <span className="font-mono text-[10px] uppercase tracking-wide text-accent">agent</span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-sm leading-relaxed text-text-muted">{line.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {uploadOpen && (
          <UploadModal buyers={buyers} onClose={() => setUploadOpen(false)} onConfirm={handleUpload} />
        )}
      </AnimatePresence>
    </PageContainer>
  );
}

/* ---------------- Upload recording modal ---------------- */
function UploadModal({
  buyers,
  onClose,
  onConfirm,
}: {
  buyers: Buyer[];
  onClose: () => void;
  onConfirm: (buyer: Buyer, kind: MeetKind) => void;
}) {
  const [buyerId, setBuyerId] = useState(buyers[0]?.id ?? "");
  const [kind, setKind] = useState<MeetKind>("In-person");
  const buyer = buyers.find((b) => b.id === buyerId);
  const canConfirm = Boolean(buyer);

  const submit = () => {
    if (!buyer) return;
    onConfirm(buyer, kind);
  };

  return (
    <motion.div className="fixed inset-0 z-[110] flex items-center justify-center px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog" aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 440, damping: 30 }}
        className="relative w-full max-w-[440px] overflow-hidden rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-lift)]"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-accent-soft text-accent"><Upload size={19} /></span>
            <div>
              <h3 className="font-display text-lg font-bold leading-tight">Upload recording</h3>
              <p className="text-sm text-text-muted">We&apos;ll transcribe and extract action items.</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-text-faint hover:bg-surface-2 hover:text-text"><X size={16} /></button>
        </div>

        {buyers.length === 0 ? (
          <p className="mt-5 rounded-[12px] border border-dashed border-border p-4 text-center text-sm text-text-muted">No buyers in scope to attach a recording to.</p>
        ) : (
          <div className="mt-5 space-y-4">
            <Field label="Buyer">
              <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} className="h-10 w-full rounded-[10px] border border-border bg-surface-2 px-3 text-sm text-text">
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} · {b.config} · {b.localityPrefs[0]}</option>
                ))}
              </select>
            </Field>
            <Field label="Meeting type">
              <div className="grid grid-cols-3 gap-2">
                {KINDS.map((k) => {
                  const Icon = KIND_ICON[k];
                  const on = kind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={cn(
                        "flex h-[58px] flex-col items-center justify-center gap-1 rounded-[10px] border text-xs font-medium transition-colors",
                        on ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface-2 text-text-muted hover:border-border-strong",
                      )}
                    >
                      <Icon size={16} />
                      {k}
                    </button>
                  );
                })}
              </div>
            </Field>

            {buyer && (
              <div className="flex items-center gap-2.5 rounded-[12px] border border-dashed border-border bg-surface-2 px-3 py-2.5">
                <FileText size={16} className="shrink-0 text-text-faint" />
                <span className="tabular truncate font-mono text-[12px] text-text-muted">
                  {KIND_HINT[kind].toLowerCase().replace(/\s/g, "-")}-{firstName(buyer.name).toLowerCase()}.m4a
                </span>
                <Check size={14} className="ml-auto shrink-0 text-positive" />
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 rounded-[10px] border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2">Cancel</button>
          <button onClick={submit} disabled={!canConfirm} className="flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100">
            Upload &amp; transcribe <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-text-faint">{label}</span>
      {children}
    </label>
  );
}
