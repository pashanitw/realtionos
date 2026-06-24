"use client";

import { create } from "zustand";
import { mockDataSource } from "./data/source";
import { computeScore } from "./data/scoring";
import {
  type Buyer,
  type Message,
  type Project,
  type Unit,
  type Deal,
  type ReviewItem,
  type Connector,
  type ConciergeChat,
  type OvernightLead,
  type MorningBrief,
  type ActivityEvent,
  type Analytics,
  type Client,
  type Team,
  type OrgUser,
  type Cab,
  type Driver,
  type CabBooking,
  CAB_FLOW,
  type Workflow,
  type WorkflowNode,
  type CrmTask,
  type Stage,
  type SignalCategory,
  type Channel,
  type Config,
  type Source,
} from "./data/types";
import { seedWorkflows, workflowMessage } from "./workflows";

let counter = 5000;
const uid = (p: string) => `${p}-${++counter}`;
const WORKFLOWS_KEY = "relos.workflows.v1";
function persistWorkflows(wf: Workflow[]) {
  if (typeof window !== "undefined") {
    try { localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(wf)); } catch {}
  }
}

interface StoreState {
  clients: Client[];
  users: OrgUser[];
  teams: Team[];
  buyers: Buyer[];
  messages: Message[];
  projects: Project[];
  units: Unit[];
  deals: Deal[];
  reviewItems: ReviewItem[];
  connectors: Connector[];
  concierge: ConciergeChat[];
  overnightLeads: OvernightLead[];
  morningBriefByClient: Record<string, MorningBrief>;
  activity: ActivityEvent[];
  analyticsByClient: Record<string, Analytics>;
  drivers: Driver[];
  cabs: Cab[];
  cabBookings: CabBooking[];
  workflows: Workflow[];
  crmTasks: CrmTask[];

  // who's looking, and at which tenant
  currentUserId: string;
  activeClientId: string;
  authed: boolean; // signed in (demo session)

  autonomy: number; // 0–4
  reviewQueueCount: number;
  recentlyRescored: Record<string, number>;

  setCurrentUser: (id: string) => void;
  setActiveClient: (id: string) => void;
  login: (userId: string) => void;
  logout: () => void;
  restoreSession: () => void;

  acceptOvernightLead: (id: string) => void;
  dismissOvernightLead: (id: string) => void;

  setAutonomy: (n: number) => void;
  pushActivity: (e: Omit<ActivityEvent, "id" | "timestamp" | "clientId">) => void;

  rescoreBuyer: (buyerId: string, opts?: { delta?: number }) => number;
  landBuyerReply: (buyerId: string) => { buyer: Buyer; delta: number };
  landConciergeLead: () => Buyer;
  addBuyer: (input: { name: string; config?: Config; locality?: string; budgetMax?: number; source?: Source }) => string;
  bookVisit: (buyerId: string, whenLabel: string) => void;

  commitField: (buyerId: string, field: { label: string; value: string }) => void;

  moveDeal: (dealId: string, toStage: Stage, remarks?: string) => void;
  acceptSuggestion: (dealId: string) => void;

  bookCab: (buyerId: string, cabId: string, pickup: string) => void;
  advanceBooking: (bookingId: string) => void;
  addDriver: (input: { name: string; phone: string }) => string;
  addCab: (input: { model: string; plate: string; seats: number; driverId: string }) => string;
  removeCab: (id: string) => void;

  createWorkflow: (name: string, nodes: WorkflowNode[]) => string;
  toggleWorkflow: (id: string) => void;
  runWorkflow: (id: string) => void;
  restoreWorkflows: () => void;

  addTasks: (items: { buyerId: string; agentId: string; title: string; dueAt: number; priority: CrmTask["priority"]; source: string }[]) => number;
  toggleTask: (id: string) => void;

  approveReview: (id: string) => void;
  dismissReview: (id: string) => void;
  mergeDuplicate: (id: string) => void;

  setBuyerWeight: (buyerId: string, category: SignalCategory, weight: number) => void;
  connectSource: (id: string) => void;
  takeOverChat: (id: string) => void;
}

const seed = mockDataSource.snapshot();
const QUEUE_BASE = 10;
const SESSION_KEY = "relos.session.v1";

/** The tenant any new record should be written into (current user's client, or the active client for super-admin). */
function writeClientId(s: StoreState): string {
  const u = s.users.find((x) => x.id === s.currentUserId);
  return u?.clientId ?? s.activeClientId;
}

export const useStore = create<StoreState>((set, get) => ({
  clients: seed.clients,
  users: seed.users,
  teams: seed.teams,
  buyers: seed.buyers,
  messages: seed.messages,
  projects: seed.projects,
  units: seed.units,
  deals: seed.deals,
  reviewItems: seed.reviewItems,
  connectors: seed.connectors,
  concierge: seed.concierge,
  overnightLeads: seed.overnightLeads,
  morningBriefByClient: seed.morningBriefByClient,
  activity: seed.activity,
  analyticsByClient: seed.analyticsByClient,
  drivers: seed.drivers,
  cabs: seed.cabs,
  cabBookings: seed.cabBookings,
  workflows: seedWorkflows(seed.clients[0]?.id ?? "c1"),
  crmTasks: [],

  // Single-client mode: open as the client's Manager (the top role for now).
  currentUserId: seed.users.find((u) => u.role === "manager")?.id ?? seed.users[0]?.id ?? "c1-mgr",
  activeClientId: seed.clients[0]?.id ?? "c1",
  authed: false,

  autonomy: 2,
  reviewQueueCount: Math.max(0, Math.round(QUEUE_BASE * (1 - 2 * 0.18))),
  recentlyRescored: {},

  setCurrentUser: (id) =>
    set((s) => {
      const u = s.users.find((x) => x.id === id);
      if (s.authed && typeof window !== "undefined") localStorage.setItem(SESSION_KEY, id);
      return { currentUserId: id, activeClientId: u?.clientId ?? s.activeClientId };
    }),

  setActiveClient: (id) => set({ activeClientId: id }),

  login: (userId) =>
    set((s) => {
      const u = s.users.find((x) => x.id === userId);
      if (!u) return {};
      if (typeof window !== "undefined") localStorage.setItem(SESSION_KEY, userId);
      return { currentUserId: userId, activeClientId: u.clientId ?? s.activeClientId, authed: true };
    }),

  logout: () => {
    if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY);
    set({ authed: false });
  },

  restoreSession: () =>
    set((s) => {
      if (typeof window === "undefined") return {};
      const id = localStorage.getItem(SESSION_KEY);
      const u = id ? s.users.find((x) => x.id === id) : null;
      if (!u) return {};
      return { currentUserId: u.id, activeClientId: u.clientId ?? s.activeClientId, authed: true };
    }),

  setAutonomy: (n) =>
    set({ autonomy: n, reviewQueueCount: Math.max(0, Math.round(QUEUE_BASE * (1 - n * 0.18))) }),

  pushActivity: (e) =>
    set((s) => ({
      activity: [{ ...e, id: uid("a"), clientId: writeClientId(s), timestamp: Date.now() }, ...s.activity].slice(0, 60),
    })),

  rescoreBuyer: (buyerId, opts = {}) => {
    const delta = opts.delta ?? Math.floor(Math.random() * 7) + 3;
    set((s) => ({
      buyers: s.buyers
        .map((b) =>
          b.id === buyerId
            ? { ...b, prevScore: b.score, score: Math.min(99, b.score + delta), lastTouch: Date.now(), scoreHistory: [...b.scoreHistory.slice(1), { label: "now", score: Math.min(99, b.score + delta) }] }
            : b,
        )
        .sort((a, b) => b.score - a.score),
      recentlyRescored: { ...s.recentlyRescored, [buyerId]: delta },
    }));
    return delta;
  },

  landBuyerReply: (buyerId) => {
    const buyer = get().buyers.find((b) => b.id === buyerId)!;
    const msgId = uid(`${buyerId}-m`);
    const newMsg: Message = {
      id: msgId, clientId: buyer.clientId, buyerId, channel: "whatsapp", direction: "inbound",
      timestamp: Date.now(), body: "Yes, Saturday 11am works for the site visit. Please share the location.",
      isLive: true, handledBy: "ai", summary: "Buyer confirmed the site visit slot.",
    };
    const delta = 11;
    set((s) => ({
      messages: [...s.messages, newMsg],
      buyers: s.buyers
        .map((b) =>
          b.id === buyerId
            ? {
                ...b, prevScore: b.score, score: Math.min(99, b.score + delta), lastTouch: Date.now(),
                siteVisitDue: Date.now() + 2 * 86_400_000,
                channelsUsed: Array.from(new Set([...b.channelsUsed, "whatsapp" as Channel])),
                signals: { ...b.signals, "Site-visit intent": Math.min(98, b.signals["Site-visit intent"] + 18), Engagement: Math.min(98, b.signals.Engagement + 8) },
                scoreHistory: [...b.scoreHistory.slice(1), { label: "now", score: Math.min(99, b.score + delta) }],
              }
            : b,
        )
        .sort((a, b) => b.score - a.score),
      recentlyRescored: { ...s.recentlyRescored, [buyerId]: delta },
    }));
    return { buyer, delta };
  },

  landConciergeLead: () => {
    const s = get();
    const cid = writeClientId(s);
    const agent = s.users.find((u) => u.role === "agent" && u.clientId === cid) ?? s.users.find((u) => u.role === "agent");
    const template = s.buyers.find((b) => b.clientId === cid) ?? s.buyers[0];
    const id = uid("b");
    const newBuyer: Buyer = {
      ...template,
      id, clientId: cid,
      name: "Neha Kapoor", phone: "+91 98765 00000", source: "whatsapp", config: "3BHK",
      localityPrefs: template.localityPrefs.slice(0, 1),
      score: 86, prevScore: 0, stage: "Site Visit Scheduled",
      siteVisitDue: Date.now() + 2 * 86_400_000, lastTouch: Date.now(), isNew: true,
      agentId: agent?.id ?? template.agentId, agent: agent?.name ?? template.agent, agentInitials: agent?.initials ?? template.agentInitials,
      scoreReasons: template.scoreReasons.slice(0, 3), matchedUnitIds: template.matchedUnitIds,
    };
    set((st) => ({ buyers: [newBuyer, ...st.buyers].sort((a, b) => b.score - a.score) }));
    return newBuyer;
  },

  addBuyer: (input) => {
    const s = get();
    const cid = writeClientId(s);
    const me = s.users.find((u) => u.id === s.currentUserId);
    const agent = me?.role === "agent" ? me : s.users.find((u) => u.role === "agent" && u.clientId === cid) ?? me;
    const template = s.buyers.find((b) => b.clientId === cid) ?? s.buyers[0];
    const id = uid("b");
    const score = 58 + (input.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 34); // 58–91, stable per name
    const budgetMax = input.budgetMax ?? template.budgetMax;
    const newBuyer: Buyer = {
      ...template,
      id, clientId: cid,
      name: input.name, phone: "+91 90000 00000",
      source: input.source ?? "whatsapp",
      config: input.config ?? template.config,
      localityPrefs: input.locality ? [input.locality] : template.localityPrefs.slice(0, 1),
      budgetMin: Math.round(budgetMax * 0.9), budgetMax,
      score, prevScore: 0, stage: "Qualified",
      siteVisitDue: undefined, followUpAt: Date.now() + 6 * 3_600_000,
      lastTouch: Date.now(), isNew: true, stalled: false,
      agentId: agent?.id ?? template.agentId, agent: agent?.name ?? template.agent, agentInitials: agent?.initials ?? template.agentInitials,
      scoreReasons: template.scoreReasons.slice(0, 2), matchedUnitIds: template.matchedUnitIds,
    };
    set((st) => ({ buyers: [newBuyer, ...st.buyers].sort((a, b) => b.score - a.score) }));
    get().pushActivity({ kind: "lead", text: `New buyer added · ${input.name}`, meta: `${newBuyer.config} · ${newBuyer.localityPrefs[0]}` });
    return id;
  },

  bookVisit: (buyerId, whenLabel) => {
    const b = get().buyers.find((x) => x.id === buyerId);
    if (!b) return;
    set((s) => ({ buyers: s.buyers.map((x) => (x.id === buyerId ? { ...x, stage: "Site Visit Scheduled", siteVisitDue: Date.now() + 2 * 86_400_000, followUpAt: Date.now() + 2 * 86_400_000, lastTouch: Date.now() } : x)) }));
    get().pushActivity({ kind: "sitevisit", text: `Site visit booked · ${b.name}`, meta: whenLabel });
  },

  commitField: (buyerId, field) => {
    const fId = uid(`${buyerId}-f`);
    const msgId = get().messages.find((m) => m.buyerId === buyerId)?.id;
    set((s) => ({
      buyers: s.buyers.map((b) =>
        b.id === buyerId
          ? { ...b, profile: [{ id: fId, label: field.label, value: field.value, sourceMessageId: msgId ?? "", sourceQuote: "Captured from your message", justCrystallized: true }, ...b.profile.filter((f) => f.label !== field.label)] }
          : b,
      ),
    }));
  },

  moveDeal: (dealId, toStage, remarks) => {
    const deal = get().deals.find((d) => d.id === dealId);
    set((s) => ({ deals: s.deals.map((d) => (d.id === dealId ? { ...d, stage: toStage, suggestion: undefined, stalled: false, noShow: false } : d)) }));
    if (deal && remarks) get().pushActivity({ kind: "lead", text: `${deal.name} → ${toStage}`, meta: remarks });
  },

  acceptSuggestion: (dealId) => {
    const deal = get().deals.find((d) => d.id === dealId);
    if (!deal?.suggestion) return;
    get().moveDeal(dealId, deal.suggestion.toStage);
    get().pushActivity({ kind: "lead", text: `${deal.name} → ${deal.suggestion.toStage}`, meta: "AI suggestion accepted" });
  },

  approveReview: (id) => {
    const item = get().reviewItems.find((r) => r.id === id);
    set((s) => ({ reviewItems: s.reviewItems.filter((r) => r.id !== id) }));
    if (item) get().pushActivity({ kind: "lead", text: `Approved: ${item.title}`, meta: item.buyerName });
  },

  dismissReview: (id) => set((s) => ({ reviewItems: s.reviewItems.filter((r) => r.id !== id) })),

  mergeDuplicate: (id) => {
    const item = get().reviewItems.find((r) => r.id === id);
    set((s) => ({ reviewItems: s.reviewItems.filter((r) => r.id !== id) }));
    if (item) get().pushActivity({ kind: "lead", text: `Merged duplicate · ${item.buyerName}`, meta: "one buyer, one timeline" });
  },

  setBuyerWeight: (buyerId, category, weight) =>
    set((s) => ({
      buyers: s.buyers.map((b) => {
        if (b.id !== buyerId) return b;
        const weights = { ...b.weights, [category]: weight };
        return { ...b, weights, score: computeScore(b.signals, weights) };
      }),
    })),

  connectSource: (id) =>
    set((s) => ({ connectors: s.connectors.map((c) => (c.id === id ? { ...c, status: "connected", detail: "Connected · syncing" } : c)) })),

  takeOverChat: (id) =>
    set((s) => ({ concierge: s.concierge.map((c) => (c.id === id ? { ...c, status: "handed-off" } : c)) })),

  acceptOvernightLead: (id) => {
    const lead = get().overnightLeads.find((l) => l.id === id);
    set((s) => ({ overnightLeads: s.overnightLeads.filter((l) => l.id !== id) }));
    if (lead) get().pushActivity({ kind: "lead", text: `Added to worklist · ${lead.name}`, meta: "overnight capture approved" });
  },

  dismissOvernightLead: (id) => set((s) => ({ overnightLeads: s.overnightLeads.filter((l) => l.id !== id) })),

  bookCab: (buyerId, cabId, pickup) => {
    const s = get();
    const buyer = s.buyers.find((b) => b.id === buyerId);
    if (!buyer) return;
    const cab = s.cabs.find((c) => c.id === cabId);
    const proj = s.projects.find((p) => buyer.localityPrefs.includes(p.locality)) ?? s.projects.find((p) => p.clientId === buyer.clientId);
    const booking: CabBooking = {
      id: uid("bk"), clientId: buyer.clientId, cabId, buyerId, buyerName: buyer.name,
      project: proj?.name ?? "Site visit", pickup, scheduledAt: buyer.siteVisitDue ?? Date.now() + 86_400_000,
      status: "assigned", etaMin: 20, agentInitials: buyer.agentInitials,
    };
    set((st) => ({
      cabBookings: [booking, ...st.cabBookings],
      cabs: st.cabs.map((c) => (c.id === cabId ? { ...c, status: "assigned" } : c)),
    }));
    get().pushActivity({ kind: "sitevisit", text: `Cab assigned · ${buyer.name}`, meta: cab ? `${cab.model} · ${cab.plate}` : "site visit" });
  },

  advanceBooking: (bookingId) => {
    const s = get();
    const bk = s.cabBookings.find((b) => b.id === bookingId);
    if (!bk) return;
    const idx = CAB_FLOW.indexOf(bk.status);
    const next = CAB_FLOW[Math.min(idx + 1, CAB_FLOW.length - 1)];
    set((st) => ({
      cabBookings: st.cabBookings.map((b) => (b.id === bookingId ? { ...b, status: next } : b)),
      cabs: st.cabs.map((c) => (c.id === bk.cabId ? { ...c, status: next === "completed" ? "idle" : next } : c)),
    }));
    // Automated notification → sales agent + site manager (PRD §3)
    const agent = s.buyers.find((b) => b.id === bk.buyerId)?.agent ?? "the agent";
    const note =
      next === "pickup" ? `Driver dispatched for pickup · ${bk.buyerName}`
      : next === "en-route" ? `En route to ${bk.project} · ETA ${bk.etaMin ?? 20}m — pinged ${agent} + site manager`
      : next === "at-site" ? `Cab arrived at ${bk.project} · ${bk.buyerName} — ${agent} + site manager alerted`
      : `Drop-off complete · ${bk.buyerName}`;
    get().pushActivity({ kind: "sitevisit", text: note, meta: bk.project });
  },

  addDriver: (input) => {
    const driver: Driver = { id: uid("dr"), clientId: writeClientId(get()), name: input.name, phone: input.phone, rating: 5 };
    set((s) => ({ drivers: [driver, ...s.drivers] }));
    get().pushActivity({ kind: "lead", text: `Driver added · ${input.name}` });
    return driver.id;
  },

  addCab: (input) => {
    const cab: Cab = { id: uid("cab"), clientId: writeClientId(get()), model: input.model, plate: input.plate, seats: input.seats, driverId: input.driverId, status: "idle" };
    set((s) => ({ cabs: [cab, ...s.cabs] }));
    get().pushActivity({ kind: "lead", text: `Cab added · ${input.model} · ${input.plate}` });
    return cab.id;
  },

  removeCab: (id) => set((s) => ({ cabs: s.cabs.filter((c) => c.id !== id) })),

  createWorkflow: (name, nodes) => {
    const wf: Workflow = { id: uid("wf"), clientId: writeClientId(get()), name, nodes, active: true, runs: 0, lastRun: Date.now() };
    set((s) => ({ workflows: [wf, ...s.workflows] }));
    get().pushActivity({ kind: "lead", text: `Automation created · ${name}`, meta: `${nodes.length} steps · Active` });
    persistWorkflows(get().workflows);
    return wf.id;
  },

  toggleWorkflow: (id) => {
    set((s) => ({ workflows: s.workflows.map((w) => (w.id === id ? { ...w, active: !w.active } : w)) }));
    const w = get().workflows.find((x) => x.id === id);
    if (w) get().pushActivity({ kind: "lead", text: `Automation ${w.active ? "activated" : "paused"} · ${w.name}` });
    persistWorkflows(get().workflows);
  },

  runWorkflow: (id) => {
    const s = get();
    const wf = s.workflows.find((w) => w.id === id);
    if (!wf || !wf.active) return;
    const cid = wf.clientId;
    const actions = wf.nodes.filter((n) => n.type === "action");
    const actionLabel = actions[0]?.label ?? "ran";
    // bump run count + last-run
    set((st) => ({ workflows: st.workflows.map((w) => (w.id === id ? { ...w, runs: w.runs + 1, lastRun: Date.now() } : w)) }));
    // pick a buyer in this client to act on (prefer one that "fits" the trigger)
    const pool = s.buyers.filter((b) => b.clientId === cid);
    const buyer = pool.find((b) => b.stalled) ?? pool[0];
    const messaging = actions.find((a) => /send|message|reminder|welcome|re-engage|reengage|reschedule|payment/i.test(a.label));
    // always log the run to the live activity feed
    get().pushActivity({
      kind: messaging ? "whatsapp" : "lead",
      text: `⚡ ${wf.name} ran`,
      meta: buyer ? `${actionLabel} → ${buyer.name}` : actionLabel,
    });
    // a buyer-facing action drafts an item into Approvals (needs-your-nod)
    if (messaging && buyer) {
      const first = buyer.name.split(" ")[0];
      const review: ReviewItem = {
        id: uid("rv"), clientId: cid, agentId: buyer.agentId, leadId: `L-${2000 + s.reviewItems.length}`,
        kind: "outbound",
        title: `${wf.name} · ${buyer.name}`,
        why: `Auto-triggered by the “${wf.name}” automation`,
        body: workflowMessage(messaging.label, first, buyer.config, buyer.localityPrefs[0], buyer.agent),
        autonomyLabel: "L1 — needs your nod",
        cta: "Approve & send",
        source: buyer.source, channel: "whatsapp", confidence: 90,
        buyerName: buyer.name, hue: buyer.hue,
      };
      set((st) => ({ reviewItems: [review, ...st.reviewItems] }));
    }
    persistWorkflows(get().workflows);
  },

  restoreWorkflows: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(WORKFLOWS_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) set({ workflows: arr });
    } catch {}
  },

  addTasks: (items) => {
    const cid = writeClientId(get());
    const created: CrmTask[] = items.map((it) => ({ id: uid("task"), clientId: cid, done: false, ...it }));
    set((s) => ({ crmTasks: [...created, ...s.crmTasks] }));
    if (created.length) get().pushActivity({ kind: "lead", text: `${created.length} task${created.length === 1 ? "" : "s"} created from a meeting` });
    return created.length;
  },

  toggleTask: (id) => set((s) => ({ crmTasks: s.crmTasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
}));
