"use client";

import { toast } from "sonner";
import { useStore } from "./store";

/**
 * The Demo Conductor — fires scripted "live" real-estate events on cue so the
 * self-driving magic is reliable, not improvised. Every beat drives the real
 * store and UI; only the trigger is staged.
 */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Buyers visible to the current persona within the active tenant. */
function activeBuyers() {
  const s = useStore.getState();
  const u = s.users.find((x) => x.id === s.currentUserId);
  const cid = u?.role === "super-admin" ? s.activeClientId : u?.clientId ?? s.activeClientId;
  return s.buyers.filter((b) => b.clientId === cid && (u?.role !== "agent" || b.agentId === u.id));
}

/** A buyer replies on WhatsApp → score ticks → worklist re-ranks. */
export async function conductBuyerReply(targetId?: string) {
  const scoped = activeBuyers();
  const candidates = scoped.filter((b) => b.score < 92 && b.score > 55);
  const buyer =
    (targetId && scoped.find((b) => b.id === targetId)) ||
    candidates[Math.floor(candidates.length / 2)] ||
    scoped[3] ||
    scoped[0];
  if (!buyer) return null;

  toast(`WhatsApp · ${buyer.name}`, { description: "Buyer replied — qualifying live…", duration: 2400 });
  await delay(1400);

  const { delta } = useStore.getState().landBuyerReply(buyer.id);
  useStore.getState().pushActivity({
    kind: "whatsapp",
    text: `${buyer.name} confirmed a site visit`,
    meta: `re-scored +${delta}`,
  });
  toast.success("Site visit confirmed · re-scored", {
    description: `${buyer.name} jumped +${delta} — now ${useStore.getState().buyers.find((b) => b.id === buyer.id)?.score}`,
    duration: 4200,
  });
  return buyer.id;
}

/** The Customer AI Concierge qualifies a new buyer and books a visit → fresh scored lead. */
export async function conductConciergeLead() {
  toast("New WhatsApp buyer · 99acres", { description: "AI Inbox qualifying — 3BHK, Gachibowli…", duration: 2400 });
  await delay(1500);
  const buyer = useStore.getState().landConciergeLead();
  useStore.getState().pushActivity({
    kind: "sitevisit",
    text: `AI Inbox booked a site visit · ${buyer.name}`,
    meta: "scored 86 · no agent touched it",
  });
  toast.success("AI Inbox qualified + booked a visit", {
    description: `${buyer.name} · scored 86 · on the worklist`,
    duration: 4400,
  });
  return buyer.id;
}

/** A missed call is captured, called back, and matched to a buyer. */
export async function conductMissedCall() {
  const scoped = activeBuyers();
  const buyer = scoped.find((b) => b.score > 40 && b.score < 80) ?? scoped[5] ?? scoped[0];
  if (!buyer) return null;
  toast(`Missed call · ${buyer.phone}`, { description: "Matching to a buyer…", duration: 2200 });
  await delay(1300);
  const delta = useStore.getState().rescoreBuyer(buyer.id, { delta: 5 });
  useStore.getState().pushActivity({ kind: "call", text: `Missed call → called back · ${buyer.name}`, meta: `re-scored +${delta}` });
  toast.success("Call back · logged · buyer matched", { description: `${buyer.name} +${delta}`, duration: 3600 });
  return buyer.id;
}
