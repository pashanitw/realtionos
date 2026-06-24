"use client";

import { useMemo } from "react";
import { useStore } from "./store";
import type { OrgUser, Client } from "./data/types";

/* ---------------- identity ---------------- */
export function useCurrentUser(): OrgUser {
  const id = useStore((s) => s.currentUserId);
  const users = useStore((s) => s.users);
  return useMemo(() => users.find((u) => u.id === id) ?? users[0], [users, id]);
}

/** The tenant currently being viewed (active client for super-admin, own client otherwise). */
export function useActiveClientId(): string {
  const user = useCurrentUser();
  const active = useStore((s) => s.activeClientId);
  return user.role === "super-admin" ? active : user.clientId ?? active;
}

export function useActiveClient(): Client | undefined {
  const cid = useActiveClientId();
  const clients = useStore((s) => s.clients);
  return useMemo(() => clients.find((c) => c.id === cid), [clients, cid]);
}

export function useIsSuperAdmin(): boolean {
  return useCurrentUser().role === "super-admin";
}
export function useIsManager(): boolean {
  const r = useCurrentUser().role;
  return r === "manager" || r === "super-admin";
}

/* ---------------- scoping ---------------- */
// Agent → only their own records; manager/super-admin → the whole active client.
function scopeAgent<T extends { clientId: string; agentId?: string }>(rows: T[], user: OrgUser, clientId: string): T[] {
  if (user.role === "agent") return rows.filter((r) => r.clientId === clientId && r.agentId === user.id);
  return rows.filter((r) => r.clientId === clientId);
}
// Client-only (shared stock / conversations): everyone in the tenant sees these.
function scopeClient<T extends { clientId: string }>(rows: T[], clientId: string): T[] {
  return rows.filter((r) => r.clientId === clientId);
}

export function useScopedBuyers() {
  const user = useCurrentUser();
  const cid = useActiveClientId();
  const buyers = useStore((s) => s.buyers);
  return useMemo(() => scopeAgent(buyers, user, cid), [buyers, user, cid]);
}
export function useScopedDeals() {
  const user = useCurrentUser();
  const cid = useActiveClientId();
  const deals = useStore((s) => s.deals);
  return useMemo(() => scopeAgent(deals, user, cid), [deals, user, cid]);
}
export function useScopedReviewItems() {
  const user = useCurrentUser();
  const cid = useActiveClientId();
  const items = useStore((s) => s.reviewItems);
  return useMemo(() => scopeAgent(items, user, cid), [items, user, cid]);
}
export function useScopedOvernightLeads() {
  const user = useCurrentUser();
  const cid = useActiveClientId();
  const leads = useStore((s) => s.overnightLeads);
  return useMemo(() => scopeAgent(leads, user, cid), [leads, user, cid]);
}

export function useClientProjects() {
  const cid = useActiveClientId();
  const projects = useStore((s) => s.projects);
  return useMemo(() => scopeClient(projects, cid), [projects, cid]);
}
export function useClientUnits() {
  const cid = useActiveClientId();
  const units = useStore((s) => s.units);
  return useMemo(() => scopeClient(units, cid), [units, cid]);
}
export function useClientConcierge() {
  const cid = useActiveClientId();
  const concierge = useStore((s) => s.concierge);
  return useMemo(() => scopeClient(concierge, cid), [concierge, cid]);
}
// Agent → only conversations for their own buyers; manager/telecaller/super → whole client.
export function useScopedConcierge() {
  const user = useCurrentUser();
  const cid = useActiveClientId();
  const concierge = useStore((s) => s.concierge);
  return useMemo(() => scopeAgent(concierge, user, cid), [concierge, user, cid]);
}
export function useClientActivity() {
  const cid = useActiveClientId();
  const activity = useStore((s) => s.activity);
  return useMemo(() => scopeClient(activity, cid), [activity, cid]);
}
export function useClientMessages() {
  const cid = useActiveClientId();
  const messages = useStore((s) => s.messages);
  return useMemo(() => scopeClient(messages, cid), [messages, cid]);
}
export function useClientCabs() {
  const cid = useActiveClientId();
  const cabs = useStore((s) => s.cabs);
  return useMemo(() => scopeClient(cabs, cid), [cabs, cid]);
}
export function useClientDrivers() {
  const cid = useActiveClientId();
  const drivers = useStore((s) => s.drivers);
  return useMemo(() => scopeClient(drivers, cid), [drivers, cid]);
}
export function useClientCabBookings() {
  const cid = useActiveClientId();
  const bookings = useStore((s) => s.cabBookings);
  return useMemo(() => scopeClient(bookings, cid), [bookings, cid]);
}
export function useClientWorkflows() {
  const cid = useActiveClientId();
  const workflows = useStore((s) => s.workflows);
  return useMemo(() => scopeClient(workflows, cid), [workflows, cid]);
}
export function useScopedTasks() {
  const user = useCurrentUser();
  const cid = useActiveClientId();
  const tasks = useStore((s) => s.crmTasks);
  return useMemo(() => scopeAgent(tasks, user, cid), [tasks, user, cid]);
}

export function useClientAnalytics() {
  const cid = useActiveClientId();
  const byClient = useStore((s) => s.analyticsByClient);
  return byClient[cid] ?? byClient["all"];
}
export function useClientMorningBrief() {
  const cid = useActiveClientId();
  const byClient = useStore((s) => s.morningBriefByClient);
  return byClient[cid];
}
