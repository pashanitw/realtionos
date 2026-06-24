"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, MapPin, Navigation, Flag, CheckCircle2, ClipboardCheck, Circle,
  Plus, Star, Phone, Clock, X, ArrowRight, Route, UserPlus, Trash2, BellRing,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  useClientCabs, useClientDrivers, useClientCabBookings, useScopedBuyers,
} from "@/lib/roles";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Avatar, Pill, Label, AnimatedNumber } from "@/components/ui/primitives";
import { CAB_FLOW, CAB_STATUS_LABEL, type CabStatus, type Cab, type Driver } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
            className="flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95"
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

      {/* Movement tracking board */}
      <div className="mb-3 flex items-center gap-2">
        <Route size={15} className="text-accent" />
        <Label>Live movement · pickup → drop-off</Label>
        <span className="ml-1 rounded-pill bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-muted">{active.length} active</span>
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
                        className="rounded-[14px] border border-border bg-surface p-3.5 shadow-[var(--shadow-soft)]"
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
                            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[9px] border border-border bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-text transition-colors hover:border-border-strong hover:bg-surface-inset"
                          >
                            Advance to {CAB_STATUS_LABEL[CAB_FLOW[idx + 1]]} <ArrowRight size={12} />
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {col.length === 0 && (
                  <div className="grid min-h-[72px] place-items-center rounded-[14px] border border-dashed border-border text-xs text-text-faint">—</div>
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
          <button type="button" onClick={() => setAddDriverOpen(true)} className="flex h-8 items-center gap-1.5 rounded-[9px] border border-border bg-surface px-2.5 text-[12px] font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text">
            <UserPlus size={13} /> Add driver
          </button>
          <button type="button" onClick={() => setAddCabOpen(true)} className="flex h-8 items-center gap-1.5 rounded-[9px] border border-border bg-surface px-2.5 text-[12px] font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text">
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
              className="flex items-center gap-3 rounded-[14px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: `color-mix(in oklab, ${Meta.color} 16%, transparent)`, color: Meta.color }}>
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
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-text-faint transition-colors hover:bg-negative-soft hover:text-negative"
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
        className="relative w-full max-w-[440px] overflow-hidden rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-lift)]"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-accent-soft text-accent"><Car size={19} /></span>
            <div><h3 className="font-display text-lg font-bold leading-tight">Book a cab</h3><p className="text-sm text-text-muted">Assign a cab to a site visit.</p></div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-text-faint hover:bg-surface-2 hover:text-text"><X size={16} /></button>
        </div>

        {candidates.length === 0 ? (
          <p className="mt-5 rounded-[12px] border border-dashed border-border p-4 text-center text-sm text-text-muted">No site visits awaiting a cab right now.</p>
        ) : (
          <div className="mt-5 space-y-4">
            <Field label="Buyer · upcoming visit">
              <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} className="h-10 w-full rounded-[10px] border border-border bg-surface-2 px-3 text-sm text-text">
                {candidates.map((b) => (<option key={b.id} value={b.id}>{b.name} · {b.localityPrefs[0]} · {clock(b.siteVisitDue ?? 0)}</option>))}
              </select>
            </Field>
            <Field label="Cab · available">
              {cabs.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-border px-3 py-2.5 text-sm text-text-faint">No idle cabs — all on trips.</p>
              ) : (
                <select value={cabId} onChange={(e) => setCabId(e.target.value)} className="h-10 w-full rounded-[10px] border border-border bg-surface-2 px-3 text-sm text-text">
                  {cabs.map((c) => (<option key={c.id} value={c.id}>{c.model} · {c.plate} · {c.seats} seats</option>))}
                </select>
              )}
            </Field>
            <Field label="Pickup point">
              <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder={buyer ? `Residence · ${buyer.localityPrefs[0]}` : "Pickup location"} className="h-10 w-full rounded-[10px] border border-border bg-surface-2 px-3 text-sm text-text placeholder:text-text-faint" />
            </Field>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 rounded-[10px] border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2">Cancel</button>
          <button onClick={submit} disabled={!canBook || cabs.length === 0} className="h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100">Assign cab</button>
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
        className="relative w-full max-w-[440px] overflow-hidden rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-lift)]"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-accent-soft text-accent">{icon}</span>
            <div><h3 className="font-display text-lg font-bold leading-tight">{title}</h3><p className="text-sm text-text-muted">{subtitle}</p></div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-text-faint hover:bg-surface-2 hover:text-text"><X size={16} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

const FIELD_INPUT = "h-10 w-full rounded-[10px] border border-border bg-surface-2 px-3 text-sm text-text placeholder:text-text-faint";

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
        <button onClick={onClose} className="h-10 rounded-[10px] border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2">Cancel</button>
        <button onClick={submit} disabled={!valid} className="h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100">Add driver</button>
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
        <p className="mt-5 rounded-[12px] border border-dashed border-border p-4 text-center text-sm text-text-muted">Add a driver first, then assign them a cab.</p>
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
        <button onClick={onClose} className="h-10 rounded-[10px] border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2">Cancel</button>
        <button onClick={submit} disabled={!valid} className="h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100">Add cab</button>
      </div>
    </ModalShell>
  );
}
