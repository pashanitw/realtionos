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
  type ActivityEvent,
  type Analytics,
  type Stage,
  type SignalCategory,
  type Channel,
} from "./data/types";

let counter = 2000;
const uid = (p: string) => `${p}-${++counter}`;

interface StoreState {
  buyers: Buyer[];
  messages: Message[];
  projects: Project[];
  units: Unit[];
  deals: Deal[];
  reviewItems: ReviewItem[];
  connectors: Connector[];
  concierge: ConciergeChat[];
  activity: ActivityEvent[];
  analytics: Analytics;

  autonomy: number; // 0–4
  reviewQueueCount: number;
  recentlyRescored: Record<string, number>;

  setAutonomy: (n: number) => void;
  pushActivity: (e: Omit<ActivityEvent, "id" | "timestamp">) => void;

  rescoreBuyer: (buyerId: string, opts?: { delta?: number }) => number;
  /** Conductor: a buyer replies on WhatsApp → re-score + re-rank. */
  landBuyerReply: (buyerId: string) => { buyer: Buyer; delta: number };
  /** Concierge books a site visit → a fresh scored buyer appears on the worklist. */
  landConciergeLead: () => Buyer;

  /** Agent Copilot: commit a captured field onto a buyer. */
  commitField: (buyerId: string, field: { label: string; value: string }) => void;

  moveDeal: (dealId: string, toStage: Stage) => void;
  acceptSuggestion: (dealId: string) => void;

  approveReview: (id: string) => void;
  dismissReview: (id: string) => void;
  mergeDuplicate: (id: string) => void;

  setBuyerWeight: (buyerId: string, category: SignalCategory, weight: number) => void;
  connectSource: (id: string) => void;
  takeOverChat: (id: string) => void;
}

const seed = mockDataSource.snapshot();

export const useStore = create<StoreState>((set, get) => ({
  buyers: seed.buyers,
  messages: seed.messages,
  projects: seed.projects,
  units: seed.units,
  deals: seed.deals,
  reviewItems: seed.reviewItems,
  connectors: seed.connectors,
  concierge: seed.concierge,
  activity: seed.activity,
  analytics: seed.analytics,

  autonomy: 2,
  reviewQueueCount: Math.max(0, Math.round(seed.reviewItems.length * (1 - 2 * 0.18))),
  recentlyRescored: {},

  setAutonomy: (n) => {
    const base = seed.reviewItems.length;
    set({ autonomy: n, reviewQueueCount: Math.max(0, Math.round(base * (1 - n * 0.18))) });
  },

  pushActivity: (e) =>
    set((s) => ({
      activity: [{ ...e, id: uid("a"), timestamp: Date.now() }, ...s.activity].slice(0, 40),
    })),

  rescoreBuyer: (buyerId, opts = {}) => {
    const delta = opts.delta ?? Math.floor(Math.random() * 7) + 3;
    set((s) => ({
      buyers: s.buyers
        .map((b) =>
          b.id === buyerId
            ? {
                ...b,
                prevScore: b.score,
                score: Math.min(99, b.score + delta),
                lastTouch: Date.now(),
                scoreHistory: [...b.scoreHistory.slice(1), { label: "now", score: Math.min(99, b.score + delta) }],
              }
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
      id: msgId,
      buyerId,
      channel: "whatsapp",
      direction: "inbound",
      timestamp: Date.now(),
      body: "Yes, Saturday 11am works for the site visit. Please share the location.",
      isLive: true,
      handledBy: "ai",
      summary: "Buyer confirmed the site visit slot.",
    };
    const delta = 11;
    set((s) => ({
      messages: [...s.messages, newMsg],
      buyers: s.buyers
        .map((b) =>
          b.id === buyerId
            ? {
                ...b,
                prevScore: b.score,
                score: Math.min(99, b.score + delta),
                lastTouch: Date.now(),
                siteVisitDue: Date.now() + 2 * 86_400_000,
                channelsUsed: Array.from(new Set([...b.channelsUsed, "whatsapp" as Channel])),
                signals: {
                  ...b.signals,
                  "Site-visit intent": Math.min(98, b.signals["Site-visit intent"] + 18),
                  Engagement: Math.min(98, b.signals.Engagement + 8),
                },
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
    const id = uid("b");
    const base = seed.buyers[0];
    const newBuyer: Buyer = {
      ...base,
      id,
      name: "Neha Kapoor",
      phone: "+91 98765 00000",
      source: "whatsapp",
      config: "3BHK",
      localityPrefs: ["Gachibowli"],
      score: 86,
      prevScore: 0,
      stage: "Site Visit Scheduled",
      siteVisitDue: Date.now() + 2 * 86_400_000,
      lastTouch: Date.now(),
      isNew: true,
      scoreReasons: base.scoreReasons.slice(0, 3),
      matchedUnitIds: base.matchedUnitIds,
    };
    set((s) => ({ buyers: [newBuyer, ...s.buyers].sort((a, b) => b.score - a.score) }));
    return newBuyer;
  },

  commitField: (buyerId, field) => {
    const fId = uid(`${buyerId}-f`);
    const msgId = get().messages.find((m) => m.buyerId === buyerId)?.id;
    set((s) => ({
      buyers: s.buyers.map((b) =>
        b.id === buyerId
          ? {
              ...b,
              profile: [
                { id: fId, label: field.label, value: field.value, sourceMessageId: msgId ?? "", sourceQuote: "Captured from your message", justCrystallized: true },
                ...b.profile.filter((f) => f.label !== field.label),
              ],
            }
          : b,
      ),
    }));
  },

  moveDeal: (dealId, toStage) =>
    set((s) => ({
      deals: s.deals.map((d) =>
        d.id === dealId ? { ...d, stage: toStage, suggestion: undefined, stalled: false, noShow: false } : d,
      ),
    })),

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
    set((s) => ({
      connectors: s.connectors.map((c) =>
        c.id === id ? { ...c, status: "connected", detail: "Connected · syncing" } : c,
      ),
    })),

  takeOverChat: (id) =>
    set((s) => ({
      concierge: s.concierge.map((c) => (c.id === id ? { ...c, status: "handed-off" } : c)),
    })),
}));
