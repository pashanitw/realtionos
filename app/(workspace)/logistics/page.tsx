"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, MapPin, Navigation, Flag, CheckCircle2, ClipboardCheck, Circle,
  Plus, Star, Phone, Clock, X, ArrowRight, Route, UserPlus, Trash2, BellRing,
  CalendarClock, ShieldCheck, TrendingUp, FileText, RefreshCw, Sparkles, TriangleAlert, Check,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  useClientCabs, useClientDrivers, useClientCabBookings, useScopedBuyers, useScopedDeals,
} from "@/lib/roles";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Avatar, Pill, Label, AnimatedNumber } from "@/components/ui/primitives";
import { CAB_FLOW, CAB_STATUS_LABEL, STAGES, personaOf, type CabStatus, type Cab, type Driver, type Buyer } from "@/lib/data/types";
import { cn, rupees, bookingProbability, SEED_NOW } from "@/lib/utils";
import { toast } from "sonner";

/* deterministic per-entity hash (no Math.random) */
function vHash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
/** Predicted no-show risk BEFORE the visit — low intent + gone-quiet leads skip visits. */
function noShowRisk(b: Buyer): number {
  let r = Math.max(6, 84 - b.score);
  if (b.stalled) r += 20;
  r += vHash(b.id) % 7;
  return Math.min(86, Math.round(r));
}

const STATUS_META: Record<CabStatus, { color: string; icon: typeof Car }> = {
  idle: { color: "var(--text-faint)", icon: Circle },
  assigned: { color: "var(--text-muted)", icon: ClipboardCheck },
  pickup: { color: "var(--accent)", icon: MapPin },
  "en-route": { color: "var(--live)", icon: Navigation },
  "at-site": { color: "var(--live)", icon: Flag },
  completed: { color: "var(--positive)", icon: CheckCircle2 },
};
const STATUS_PILL: Record<CabStatus, "neutral" | "accent" | "live" | "positive"> = {
  idle: "neutral", assigned: "neutral", pickup: "accent", "en-route": "live", "at-site": "live", completed: "positive",
};
/** The automated alert sent to the sales agent + site manager at each stage (PRD §3). */
const NOTE: Partial<Record<CabStatus, { text: string; tone: string }>> = {
  assigned: { text: "Driver assigned — awaiting dispatch", tone: "var(--text-faint)" },
  pickup: { text: "Dispatched for pickup · agent notified", tone: "var(--accent)" },
  "en-route": { text: "ETA pinged to agent + site manager", tone: "var(--live)" },
  "at-site": { text: "Arrival alert sent · agent + site manager", tone: "var(--positive)" },
  completed: { text: "Drop-off logged · agent notified", tone: "var(--text-faint)" },
};

function clock(t: number) {
  return new Date(t).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: true });
}
const isToday = (t: number) => new Date(t).toDateString() === new Date(Date.now()).toDateString();

export default function LogisticsPage() {
  const cabs = useClientCabs();
  const drivers = useClientDrivers();
  const bookings = useClientCabBookings();
  const advanceBooking = useStore((s) => s.advanceBooking);
  const removeCab = useStore((s) => s.removeCab);
  const [booking, setBooking] = useState(false);
  const [addCabOpen, setAddCabOpen] = useState(false);
  const [addDriverOpen, setAddDriverOpen] = useState(false);

  const driverOf = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);
  const cabOf = useMemo(() => new Map(cabs.map((c) => [c.id, c])), [cabs]);

  const active = bookings.filter((b) => b.status !== "completed");
  const available = cabs.filter((c) => c.status === "idle");
  const onTrip = cabs.filter((c) => ["pickup", "en-route", "at-site"].includes(c.status));
  const visitsToday = bookings.filter((b) => isToday(b.scheduledAt));

  const kpis = [
    { label: "Fleet", value: cabs.length, hint: "cabs + drivers" },
    { label: "Available", value: available.length, hint: "idle now", tone: "positive" as const },
    { label: "On a trip", value: onTrip.length, hint: "moving to site", tone: "live" as const },
    { label: "Visits today", value: visitsToday.length, hint: "scheduled" },
    { label: "Drivers", value: drivers.length, hint: "on roster" },
  ];

  return (
    <PageContainer>
      <PageHeader
        kicker="Cab logistics · site visits"
        title="Logistics"
        description="Book and track cabs for site visits — pickup to drop-off — with automatic ETA pings to agents and site managers."
        actions={
          <button
            type="button"
            onClick={() => setBooking(true)}
            className="flex h-10 items-center gap-1.5 rounded-[5px] bg-accent px-4 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Plus size={16} strokeWidth={2.5} /> Book a cab
          </button>
        }
      />

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
            className="rounded-[6px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]"
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

      {/* Site Visit Intelligence (Stage 6) */}
      <VisitIntelligence />

      {/* Movement tracking board */}
      <div className="mb-3 flex items-center gap-2">
        <Route size={15} className="text-accent" />
        <Label>Live movement · pickup → drop-off</Label>
        <span className="ml-1 rounded-pill bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-muted">{active.length} active</span>
        <span className="ml-auto hidden items-center gap-1.5 font-mono text-[11px] text-positive sm:flex">
          <Route size={12} /> routes optimised · saves ~{active.length * 8 + 6} min today
        </span>
      </div>
      <div className="mb-8 flex gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">
        {CAB_FLOW.map((status, i) => {
          const col = bookings.filter((b) => b.status === status);
          const Meta = STATUS_META[status];
          return (
            <motion.section
              key={status}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className="flex w-[260px] shrink-0 flex-col"
            >
              <div className="h-[3px] w-full rounded-pill" style={{ background: Meta.color, opacity: 0.85 }} />
              <div className="mb-3 mt-3 flex items-center gap-2 px-1">
                <Meta.icon size={14} style={{ color: Meta.color }} />
                <h2 className="font-display text-[14px] font-bold tracking-tight text-text">{CAB_STATUS_LABEL[status]}</h2>
                <span className="tabular ml-auto rounded-pill bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-muted">{col.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-3">
                <AnimatePresence initial={false}>
                  {col.map((b) => {
                    const cab = cabOf.get(b.cabId);
                    const driver = cab ? driverOf.get(cab.driverId) : undefined;
                    const idx = CAB_FLOW.indexOf(b.status);
                    return (
                      <motion.div
                        key={b.id}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ type: "spring", stiffness: 360, damping: 32 }}
                        className="rounded-[6px] border border-border bg-surface p-3.5 shadow-[var(--shadow-soft)]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/buyers/${b.buyerId}`} className="min-w-0 truncate font-semibold leading-tight text-text hover:text-accent">
                            {b.buyerName}
                          </Link>
                          <Avatar name={b.agentInitials} hue={210} size={22} />
                        </div>
                        <div className="mt-1 truncate text-[13px] text-text-muted">{b.project}</div>
                        <div className="mt-2 space-y-1 text-[12px] text-text-muted">
                          <div className="flex items-center gap-1.5"><MapPin size={12} className="shrink-0 text-text-faint" /> <span className="truncate">{b.pickup}</span></div>
                          <div className="flex items-center gap-1.5"><Car size={12} className="shrink-0 text-text-faint" /> <span className="truncate">{cab ? `${cab.model} · ${cab.plate}` : "—"}</span></div>
                          <div className="flex items-center gap-1.5"><Clock size={12} className="shrink-0 text-text-faint" /> <span className="tabular">{clock(b.scheduledAt)}{b.status === "en-route" && b.etaMin ? ` · ETA ${b.etaMin}m` : ""}</span></div>
                          {["pickup", "en-route"].includes(b.status) && (
                            <div className="flex items-center gap-1.5 text-[11px] text-positive"><Route size={11} className="shrink-0" /> optimised route · −{6 + (vHash(b.id) % 9)} min</div>
                          )}
                        </div>
                        {driver && (
                          <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5 text-[12px]">
                            <span className="truncate text-text-muted">{driver.name}</span>
                            <span className="tabular flex items-center gap-0.5 font-mono text-[11px] text-text-faint"><Star size={10} className="fill-live text-live" /> {driver.rating}</span>
                          </div>
                        )}
                        {NOTE[b.status] && (
                          <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: NOTE[b.status]!.tone }}>
                            <BellRing size={11} className="shrink-0" /> <span className="truncate">{NOTE[b.status]!.text}</span>
                          </div>
                        )}
                        {b.status !== "completed" && (
                          <button
                            type="button"
                            onClick={() => { advanceBooking(b.id); toast.success(`${b.buyerName} → ${CAB_STATUS_LABEL[CAB_FLOW[idx + 1]]}`); }}
                            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-text transition-colors hover:border-border-strong hover:bg-surface-inset"
                          >
                            Advance to {CAB_STATUS_LABEL[CAB_FLOW[idx + 1]]} <ArrowRight size={12} />
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {col.length === 0 && (
                  <div className="grid min-h-[72px] place-items-center rounded-[6px] border border-dashed border-border text-xs text-text-faint">—</div>
                )}
              </div>
            </motion.section>
          );
        })}
      </div>

      {/* Fleet inventory */}
      <div className="mb-3 flex items-center gap-2">
        <Car size={15} className="text-accent" />
        <Label>Cab inventory</Label>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setAddDriverOpen(true)} className="flex h-8 items-center gap-1.5 rounded-[5px] border border-border bg-surface px-2.5 text-[12px] font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text">
            <UserPlus size={13} /> Add driver
          </button>
          <button type="button" onClick={() => setAddCabOpen(true)} className="flex h-8 items-center gap-1.5 rounded-[5px] border border-border bg-surface px-2.5 text-[12px] font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text">
            <Plus size={13} /> Add cab
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cabs.map((cab, i) => {
          const driver = driverOf.get(cab.driverId);
          const Meta = STATUS_META[cab.status];
          return (
            <motion.div
              key={cab.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.03 }}
              className="flex items-center gap-3 rounded-[6px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[6px]" style={{ background: `color-mix(in oklab, ${Meta.color} 16%, transparent)`, color: Meta.color }}>
                <Car size={20} strokeWidth={2.1} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-text">{cab.model}</span>
                  <Pill variant={STATUS_PILL[cab.status]} className="ml-auto shrink-0">{CAB_STATUS_LABEL[cab.status]}</Pill>
                </div>
                <div className="tabular mt-0.5 font-mono text-[12px] text-text-muted">{cab.plate} · {cab.seats} seats</div>
                {driver && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-text-faint">
                    <Phone size={11} /> <span className="truncate">{driver.name}</span>
                    <span className="tabular ml-auto flex items-center gap-0.5"><Star size={10} className="fill-live text-live" /> {driver.rating}</span>
                  </div>
                )}
              </div>
              {cab.status === "idle" && (
                <button
                  type="button"
                  onClick={() => { removeCab(cab.id); toast.success(`${cab.model} removed from the fleet`); }}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] text-text-faint transition-colors hover:bg-negative-soft hover:text-negative"
                  title="Remove cab"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {booking && <BookingModal key="book" cabs={available} onClose={() => setBooking(false)} />}
        {addCabOpen && <AddCabModal key="addcab" drivers={drivers} onClose={() => setAddCabOpen(false)} />}
        {addDriverOpen && <AddDriverModal key="adddriver" onClose={() => setAddDriverOpen(false)} />}
      </AnimatePresence>
    </PageContainer>
  );
}

/* ---------------- Book a cab modal ---------------- */
function BookingModal({ cabs, onClose }: { cabs: Cab[]; onClose: () => void }) {
  const buyers = useScopedBuyers();
  const bookings = useStore((s) => s.cabBookings);
  const bookCab = useStore((s) => s.bookCab);

  const bookedIds = useMemo(() => new Set(bookings.filter((b) => b.status !== "completed").map((b) => b.buyerId)), [bookings]);
  const candidates = useMemo(
    () => buyers.filter((b) => b.siteVisitDue && !bookedIds.has(b.id)).sort((a, b) => (a.siteVisitDue ?? 0) - (b.siteVisitDue ?? 0)),
    [buyers, bookedIds],
  );

  const [buyerId, setBuyerId] = useState(candidates[0]?.id ?? "");
  const [cabId, setCabId] = useState(cabs[0]?.id ?? "");
  const buyer = buyers.find((b) => b.id === buyerId);
  const [pickup, setPickup] = useState("");

  const canBook = buyerId && cabId;
  const submit = () => {
    if (!canBook || !buyer) return;
    const where = pickup.trim() || `Residence · ${buyer.localityPrefs[0]}`;
    bookCab(buyerId, cabId, where);
    toast.success(`Cab assigned for ${buyer.name}`);
    onClose();
  };

  return (
    <motion.div className="fixed inset-0 z-[110] flex items-center justify-center px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog" aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 440, damping: 30 }}
        className="relative w-full max-w-[440px] overflow-hidden rounded-[6px] border border-border bg-surface p-5 shadow-[var(--shadow-lift)]"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-[6px] bg-accent-soft text-accent"><Car size={19} /></span>
            <div><h3 className="font-display text-lg font-bold leading-tight">Book a cab</h3><p className="text-sm text-text-muted">Assign a cab to a site visit.</p></div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-[6px] text-text-faint hover:bg-surface-2 hover:text-text"><X size={16} /></button>
        </div>

        {candidates.length === 0 ? (
          <p className="mt-5 rounded-[6px] border border-dashed border-border p-4 text-center text-sm text-text-muted">No site visits awaiting a cab right now.</p>
        ) : (
          <div className="mt-5 space-y-4">
            <Field label="Buyer · upcoming visit">
              <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} className="h-10 w-full rounded-[5px] border border-border bg-surface-2 px-3 text-sm text-text">
                {candidates.map((b) => (<option key={b.id} value={b.id}>{b.name} · {b.localityPrefs[0]} · {clock(b.siteVisitDue ?? 0)}</option>))}
              </select>
            </Field>
            <Field label="Cab · available">
              {cabs.length === 0 ? (
                <p className="rounded-[5px] border border-dashed border-border px-3 py-2.5 text-sm text-text-faint">No idle cabs — all on trips.</p>
              ) : (
                <select value={cabId} onChange={(e) => setCabId(e.target.value)} className="h-10 w-full rounded-[5px] border border-border bg-surface-2 px-3 text-sm text-text">
                  {cabs.map((c) => (<option key={c.id} value={c.id}>{c.model} · {c.plate} · {c.seats} seats</option>))}
                </select>
              )}
            </Field>
            <Field label="Pickup point">
              <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder={buyer ? `Residence · ${buyer.localityPrefs[0]}` : "Pickup location"} className="h-10 w-full rounded-[5px] border border-border bg-surface-2 px-3 text-sm text-text placeholder:text-text-faint" />
            </Field>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 rounded-[5px] border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2">Cancel</button>
          <button onClick={submit} disabled={!canBook || cabs.length === 0} className="h-10 rounded-[5px] bg-accent px-4 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100">Assign cab</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label className="block"><span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-text-faint">{label}</span>{children}</label>);
}

/* ---------------- Shared modal shell ---------------- */
function ModalShell({ icon, title, subtitle, onClose, children }: { icon: React.ReactNode; title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div className="fixed inset-0 z-[110] flex items-center justify-center px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog" aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 440, damping: 30 }}
        className="relative w-full max-w-[440px] overflow-hidden rounded-[6px] border border-border bg-surface p-5 shadow-[var(--shadow-lift)]"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-[6px] bg-accent-soft text-accent">{icon}</span>
            <div><h3 className="font-display text-lg font-bold leading-tight">{title}</h3><p className="text-sm text-text-muted">{subtitle}</p></div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-[6px] text-text-faint hover:bg-surface-2 hover:text-text"><X size={16} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

const FIELD_INPUT = "h-10 w-full rounded-[5px] border border-border bg-surface-2 px-3 text-sm text-text placeholder:text-text-faint";

/* ---------------- Add driver ---------------- */
function AddDriverModal({ onClose }: { onClose: () => void }) {
  const addDriver = useStore((s) => s.addDriver);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const valid = name.trim().length >= 2;
  const submit = () => {
    if (!valid) return;
    addDriver({ name: name.trim(), phone: phone.trim() || "+91 90000 00000" });
    toast.success(`Driver ${name.trim()} added to the roster`);
    onClose();
  };
  return (
    <ModalShell icon={<UserPlus size={19} />} title="Add driver" subtitle="Onboard a driver to the roster." onClose={onClose}>
      <div className="mt-5 space-y-4">
        <Field label="Driver name"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Yadav" className={FIELD_INPUT} /></Field>
        <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 90000 00000" className={FIELD_INPUT} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="h-10 rounded-[5px] border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2">Cancel</button>
        <button onClick={submit} disabled={!valid} className="h-10 rounded-[5px] bg-accent px-4 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100">Add driver</button>
      </div>
    </ModalShell>
  );
}

/* ---------------- Add cab ---------------- */
function AddCabModal({ drivers, onClose }: { drivers: Driver[]; onClose: () => void }) {
  const addCab = useStore((s) => s.addCab);
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [seats, setSeats] = useState(5);
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? "");
  const valid = model.trim() && plate.trim() && driverId;
  const submit = () => {
    if (!valid) return;
    addCab({ model: model.trim(), plate: plate.trim().toUpperCase(), seats, driverId });
    toast.success(`${model.trim()} added to the fleet`);
    onClose();
  };
  return (
    <ModalShell icon={<Car size={19} />} title="Add cab" subtitle="Register a vehicle in the fleet." onClose={onClose}>
      {drivers.length === 0 ? (
        <p className="mt-5 rounded-[6px] border border-dashed border-border p-4 text-center text-sm text-text-muted">Add a driver first, then assign them a cab.</p>
      ) : (
        <div className="mt-5 space-y-4">
          <Field label="Model"><input autoFocus value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Toyota Innova" className={FIELD_INPUT} /></Field>
          <Field label="Plate"><input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="e.g. TS09 AB 1234" className={cn(FIELD_INPUT, "uppercase")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Seats">
              <select value={seats} onChange={(e) => setSeats(Number(e.target.value))} className={FIELD_INPUT}>
                {[4, 5, 6, 7].map((n) => (<option key={n} value={n}>{n} seats</option>))}
              </select>
            </Field>
            <Field label="Driver">
              <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className={FIELD_INPUT}>
                {drivers.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
              </select>
            </Field>
          </div>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="h-10 rounded-[5px] border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2">Cancel</button>
        <button onClick={submit} disabled={!valid} className="h-10 rounded-[5px] bg-accent px-4 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100">Add cab</button>
      </div>
    </ModalShell>
  );
}

/* ============================================================
   Site Visit Intelligence (PRD Stage 6)
   Upcoming: no-show prediction, reminders, briefing, reschedule.
   Completed: post-visit summary + interest score + booking likelihood.
   Guardian: visit-data + follow-up effectiveness audit.
   ============================================================ */
const VISIT_DONE_RANK = STAGES.indexOf("Site Visit Completed");

function VisitIntelligence() {
  const buyers = useScopedBuyers();
  const deals = useScopedDeals();
  const units = useStore((s) => s.units);
  const projects = useStore((s) => s.projects);
  const bookVisit = useStore((s) => s.bookVisit);
  const [brief, setBrief] = useState<Buyer | null>(null);

  const upcoming = useMemo(
    () => buyers.filter((b) => b.siteVisitDue != null).sort((a, b) => (a.siteVisitDue ?? 0) - (b.siteVisitDue ?? 0)).slice(0, 5),
    [buyers],
  );
  const visitedAll = useMemo(() => buyers.filter((b) => STAGES.indexOf(b.stage) >= VISIT_DONE_RANK), [buyers]);
  const recentVisited = useMemo(() => [...visitedAll].sort((a, b) => b.score - a.score).slice(0, 4), [visitedAll]);
  const noShows = useMemo(() => deals.filter((d) => d.noShow).length, [deals]);
  const attendance = visitedAll.length + noShows > 0 ? Math.round((visitedAll.length / (visitedAll.length + noShows)) * 100) : 100;

  const projName = (b: Buyer) => {
    const u = units.find((x) => x.id === b.matchedUnitIds[0]);
    const p = u ? projects.find((pp) => pp.id === u.projectId) : undefined;
    return p?.name ?? b.localityPrefs[0] ?? "the project";
  };
  const summaryFor = (b: Buyer) => {
    const h = vHash(b.id);
    const liked = ["loved the natural light and layout", "liked the clubhouse and amenities", "liked the location and connectivity", "was impressed by the show flat"][h % 4];
    const ask = ["asked for higher-floor pricing", "asked about the payment plan", "asked for the all-in cost sheet", "compared it with a nearby project"][(h >>> 3) % 4];
    return `Visited ${projName(b)} — ${b.name.split(" ")[0]} ${liked} and ${ask}.`;
  };

  const gFollowPct = 84 + (vHash(buyers[0]?.id ?? "g") % 9);
  const gDebriefs = visitedAll.length ? 1 + (vHash("dbf") % 2) : 0;

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock size={15} className="text-accent" />
        <Label>Site-visit intelligence</Label>
        <Pill variant="accent" mono><Sparkles size={11} /> AI-coordinated</Pill>
        <span className="ml-auto hidden font-mono text-[11px] text-text-faint sm:block">
          Attendance · <span className="text-text">{visitedAll.length} visited</span> · {noShows} no-show{noShows === 1 ? "" : "s"} · {upcoming.length} upcoming · <span className="text-positive">{attendance}%</span>
        </span>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        {/* upcoming visits — prediction + coordination */}
        <div className="rounded-[6px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">Upcoming visits · no-show prediction + reminders</span>
            <span className="tabular rounded-pill bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-muted">{upcoming.length}</span>
          </div>
          <div className="space-y-2">
            {upcoming.map((b) => {
              const risk = noShowRisk(b);
              const riskTone = risk >= 55 ? "negative" : risk >= 35 ? "live" : "positive";
              const reminderSent = (b.siteVisitDue ?? 0) - SEED_NOW < 24 * 3_600_000;
              return (
                <div key={b.id} className="rounded-[5px] border border-border bg-surface-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/buyers/${b.id}`} className="min-w-0 truncate text-sm font-semibold text-text hover:text-accent">{b.name}</Link>
                    <span className="font-mono text-[11px] text-text-faint" suppressHydrationWarning>{clock(b.siteVisitDue ?? 0)}</span>
                    <Pill variant={riskTone as "negative" | "live" | "positive"} className="ml-auto shrink-0"><TriangleAlert size={11} /> {risk}% no-show risk</Pill>
                  </div>
                  <div className="mt-1 truncate text-xs text-text-muted">{b.config} · {b.localityPrefs[0]} · {projName(b)}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 font-mono text-[10px]", reminderSent ? "bg-positive-soft text-positive" : "bg-surface px-1.5 text-text-muted")}>
                      {reminderSent ? <Check size={10} /> : <BellRing size={10} />} {reminderSent ? "Reminder sent · WhatsApp" : "Reminder armed · T-24h"}
                    </span>
                    <button onClick={() => setBrief(b)} className="inline-flex h-7 items-center gap-1 rounded-[4px] border border-border bg-surface px-2 text-[11px] font-semibold text-text-muted transition-colors hover:border-border-strong hover:text-text">
                      <FileText size={11} /> Briefing
                    </button>
                    <button
                      onClick={() => { bookVisit(b.id, "auto-rescheduled · weekend slot"); toast.success(`Visit rescheduled · ${b.name}`, { description: "New slot proposed on WhatsApp — reminder re-armed." }); }}
                      className={cn(
                        "inline-flex h-7 items-center gap-1 rounded-[4px] px-2 text-[11px] font-semibold transition-transform hover:scale-[1.03] active:scale-95",
                        risk >= 45 ? "bg-accent text-accent-contrast" : "border border-border bg-surface text-text-muted transition-colors hover:border-border-strong hover:text-text",
                      )}
                    >
                      <RefreshCw size={11} /> {risk >= 45 ? "Auto-reschedule" : "Reschedule"}
                    </button>
                  </div>
                </div>
              );
            })}
            {upcoming.length === 0 && <div className="grid place-items-center rounded-[5px] border border-dashed border-border py-8 text-xs text-text-faint">No visits scheduled.</div>}
          </div>
        </div>

        {/* completed visits — post-visit intelligence */}
        <div className="flex flex-col rounded-[6px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">Post-visit · summaries + interest</span>
            <span className="tabular rounded-pill bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-muted">{visitedAll.length} visited</span>
          </div>
          <div className="flex-1 space-y-2">
            {recentVisited.map((b) => {
              const interest = Math.min(97, b.score + 3 + (vHash(b.id) % 8));
              const likely = bookingProbability(b.score, STAGES.indexOf(b.stage), STAGES.length);
              return (
                <div key={b.id} className="rounded-[5px] border border-border bg-surface-2 p-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/buyers/${b.id}`} className="min-w-0 truncate text-sm font-semibold text-text hover:text-accent">{b.name}</Link>
                    <span className="tabular ml-auto shrink-0 font-mono text-[11px] font-bold text-accent">interest {interest}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">{summaryFor(b)}</p>
                  <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-positive"><TrendingUp size={11} /> {likely}% likely to book · Insights</div>
                </div>
              );
            })}
            {recentVisited.length === 0 && <div className="grid place-items-center rounded-[5px] border border-dashed border-border py-8 text-xs text-text-faint">No completed visits yet.</div>}
          </div>
          {/* Guardian — visit audit */}
          <div className="mt-3 flex items-start gap-2 rounded-[5px] bg-surface-inset px-3 py-2.5 text-[11px] leading-relaxed text-text-muted">
            <ShieldCheck size={13} className="mt-0.5 shrink-0 text-accent" />
            <span><span className="font-semibold text-text">Guardian · visit audit</span> — visit data logged on 100% of trips · post-visit follow-up within 4h on <span className="font-semibold text-text">{gFollowPct}%</span> · {gDebriefs} debrief{gDebriefs === 1 ? "" : "s"} pending</span>
          </div>
        </div>
      </div>

      <AnimatePresence>{brief && <BriefingDrawer buyer={brief} projName={projName(brief)} onClose={() => setBrief(null)} />}</AnimatePresence>
    </>
  );
}

/* Pre-visit sales briefing — generated from the buyer's profile (Conversa/Insights) */
function BriefingDrawer({ buyer, projName, onClose }: { buyer: Buyer; projName: string; onClose: () => void }) {
  const first = buyer.name.split(" ")[0];
  const positive = buyer.scoreReasons.find((r) => r.polarity === "positive");
  const objection = buyer.scoreReasons.find((r) => r.polarity === "negative");
  const facts = [buyer.config, rupees(buyer.budgetMax), buyer.localityPrefs[0], buyer.stage, personaOf(buyer)].filter(Boolean) as string[];
  const plan = [
    `Meet at ${projName} — walk the model ${buyer.config}${buyer.intel.preferredFloor ? `, then the ${buyer.intel.preferredFloor.toLowerCase()}` : ""}${buyer.intel.facing ? ` (${buyer.intel.facing}-facing)` : ""}.`,
    positive ? `Lean on: ${positive.text}.` : `Reinforce the ${buyer.config} fit for their budget.`,
    objection ? `Be ready for: ${objection.text}.` : "Pre-empt pricing questions with the all-in cost sheet.",
    "Close with the next step before they leave — quote on the spot if interest is high.",
  ];
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-[rgba(5,18,52,0.45)] backdrop-blur-[2px]" />
      <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-surface shadow-[var(--shadow-lift)]">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] bg-accent-soft text-accent"><FileText size={17} /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-text">Visit briefing · {buyer.name}</div>
            <div className="font-mono text-[11px] text-text-faint" suppressHydrationWarning>{projName} · {buyer.siteVisitDue ? clock(buyer.siteVisitDue) : "to schedule"}</div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-[5px] border border-border text-text-muted transition-colors hover:text-text" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex flex-wrap gap-1.5">{facts.map((f) => (<span key={f} className="rounded-[4px] bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-muted">{f}</span>))}</div>
          {buyer.intel.bestContact && (
            <div className="flex items-center gap-1.5 text-[13px]"><Clock size={13} className="shrink-0 text-accent" /><span className="text-text-muted">Best time to reach:</span> <span className="font-semibold text-text">{buyer.intel.bestContact}</span></div>
          )}
          {buyer.intel.concerns.length > 0 && (
            <div>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-text-faint">They care about</div>
              <div className="flex flex-wrap gap-1.5">{buyer.intel.concerns.map((c) => (<span key={c} className="rounded-[4px] bg-live-soft px-2 py-0.5 text-[11px] text-live">{c}</span>))}</div>
            </div>
          )}
          <div>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-text-faint">Visit plan · generated</div>
            <ul className="space-y-1.5">
              {plan.map((p, i) => (<li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-text-muted"><ArrowRight size={13} className="mt-0.5 shrink-0 text-accent" /><span>{p}</span></li>))}
            </ul>
          </div>
          <div className="rounded-[5px] border border-accent/25 bg-accent-soft/40 p-3 text-[13px] leading-relaxed text-text">
            “Hi {first}, looking forward to Saturday — I've lined up the {buyer.config} you shortlisted at {projName}. The cab will pick you up; see you there!”
          </div>
        </div>
        <div className="border-t border-border p-4">
          <button onClick={() => { toast.success("Briefing sent to the agent", { description: `${buyer.agent} has the pre-visit brief on WhatsApp.` }); onClose(); }} className="flex h-11 w-full items-center justify-center gap-2 rounded-[5px] bg-accent text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.01] active:scale-95">
            <Sparkles size={16} /> Send briefing to agent
          </button>
        </div>
      </motion.aside>
    </>
  );
}
