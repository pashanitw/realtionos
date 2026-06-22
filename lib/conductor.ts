"use client";

import { toast } from "sonner";
import { useStore } from "./store";

/**
 * The Demo Conductor — fires scripted "live" real-estate events on cue so the
 * self-driving magic is reliable, not improvised. Every beat drives the real
 * store and UI; only the trigger is staged.
 */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A buyer replies on WhatsApp → score ticks → worklist re-ranks. */
export async function conductBuyerReply(targetId?: string) {
  const s = useStore.getState();
  const candidates = s.buyers.filter((b) => b.score < 92 && b.score > 55);
  const buyer =
    (targetId && s.buyers.find((b) => b.id === targetId)) ||
    candidates[Math.floor(candidates.length / 2)] ||
    s.buyers[3];
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
  toast("New WhatsApp buyer · 99acres", { description: "Concierge qualifying — 3BHK, Gachibowli…", duration: 2400 });
  await delay(1500);
  const buyer = useStore.getState().landConciergeLead();
  useStore.getState().pushActivity({
    kind: "sitevisit",
    text: `Concierge booked a site visit · ${buyer.name}`,
    meta: "scored 86 · no agent touched it",
  });
  toast.success("Concierge qualified + booked a visit", {
    description: `${buyer.name} · scored 86 · on the worklist`,
    duration: 4400,
  });
  return buyer.id;
}

/** A missed call is captured, called back, and matched to a buyer. */
export async function conductMissedCall() {
  const s = useStore.getState();
  const buyer = s.buyers.find((b) => b.score > 40 && b.score < 80) ?? s.buyers[5];
  toast(`Missed call · ${buyer.phone}`, { description: "Matching to a buyer…", duration: 2200 });
  await delay(1300);
  const delta = useStore.getState().rescoreBuyer(buyer.id, { delta: 5 });
  useStore.getState().pushActivity({ kind: "call", text: `Missed call → called back · ${buyer.name}`, meta: `re-scored +${delta}` });
  toast.success("Call back · logged · buyer matched", { description: `${buyer.name} +${delta}`, duration: 3600 });
  return buyer.id;
}
