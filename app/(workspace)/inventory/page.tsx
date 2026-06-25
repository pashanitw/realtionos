"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Building2,
  MapPin,
  CheckCircle2,
  CalendarClock,
  Layers,
  Sparkles,
  X,
  Compass,
  Ruler,
  Hash,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { useClientProjects, useClientUnits, useScopedBuyers } from "@/lib/roles";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Pill, Label } from "@/components/ui/primitives";
import {
  CONFIGS,
  type Config,
  type Availability,
  type Project,
  type Unit,
  type Buyer,
} from "@/lib/data/types";
import { cn, rupees, perSqft, rupeeRange } from "@/lib/utils";

const SPRING = { type: "spring" as const, stiffness: 380, damping: 30 };

/* Availability presentation -------------------------------------------------- */
const AVAIL: Record<
  Availability,
  { label: string; variant: "positive" | "live" | "accent" | "neutral"; dim: boolean }
> = {
  available: { label: "Available", variant: "positive", dim: false },
  blocked: { label: "Blocked", variant: "live", dim: false },
  booked: { label: "Booked", variant: "accent", dim: true },
  sold: { label: "Sold", variant: "neutral", dim: true },
};

type AvailFilter = Availability | "all";

/**
 * Buyer-match logic — the source of truth the AI quotes against.
 * A unit "Fits" a buyer when ALL three hold:
 *   1. config matches the buyer's wanted config exactly
 *   2. price is within budget, with a soft ±band:  budgetMin*0.85 .. budgetMax*1.05
 *   3. the unit's project locality is in the buyer's localityPrefs
 * Sold / booked stock can never fit (nothing left to quote).
 */
function unitFits(unit: Unit, buyer: Buyer, project: Project | undefined): boolean {
  if (unit.availability === "sold" || unit.availability === "booked") return false;
  if (unit.config !== buyer.config) return false;
  const lo = buyer.budgetMin * 0.85;
  const hi = buyer.budgetMax * 1.05;
  if (unit.priceInr < lo || unit.priceInr > hi) return false;
  if (!project) return false;
  return buyer.localityPrefs.includes(project.locality);
}

export default function InventoryPage() {
  const projects = useClientProjects();
  const units = useClientUnits();
  const buyers = useScopedBuyers();

  const [projectId, setProjectId] = useState<string | "all">("all");
  const [config, setConfig] = useState<Config | "all">("all");
  const [avail, setAvail] = useState<AvailFilter>("all");
  const [tower, setTower] = useState<string | "all">("all");
  const [facing, setFacing] = useState<string | "all">("all");
  const [buyerId, setBuyerId] = useState<string | "">("");

  const projectById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])) as Record<string, Project>,
    [projects],
  );

  const activeBuyer = useMemo(
    () => buyers.find((b) => b.id === buyerId),
    [buyers, buyerId],
  );

  // available-unit count per project (for the rail cards)
  const availCountByProject = useMemo(() => {
    const m: Record<string, number> = {};
    for (const u of units) {
      if (u.availability === "available")
        m[u.projectId] = (m[u.projectId] ?? 0) + 1;
    }
    return m;
  }, [units]);

  // Configs that actually exist (for filter chips)
  const presentConfigs = useMemo(() => {
    const set = new Set(units.map((u) => u.config));
    return CONFIGS.filter((c) => set.has(c));
  }, [units]);

  const presentTowers = useMemo(() => {
    const scope = units.filter((u) => (projectId === "all" ? true : u.projectId === projectId));
    return Array.from(new Set(scope.map((u) => u.tower))).sort();
  }, [units, projectId]);
  const presentFacings = useMemo(() => Array.from(new Set(units.map((u) => u.facing))).sort(), [units]);

  // The filtered + match-annotated + sorted unit list -----------------------
  const view = useMemo(() => {
    const annotated = units
      .filter((u) => (projectId === "all" ? true : u.projectId === projectId))
      .filter((u) => (config === "all" ? true : u.config === config))
      .filter((u) => (avail === "all" ? true : u.availability === avail))
      .filter((u) => (tower === "all" ? true : u.tower === tower))
      .filter((u) => (facing === "all" ? true : u.facing === facing))
      .map((u) => ({
        unit: u,
        project: projectById[u.projectId],
        fit: activeBuyer ? unitFits(u, activeBuyer, projectById[u.projectId]) : false,
      }));

    // Fits float to the top; otherwise keep available stock above closed stock.
    const order: Record<Availability, number> = { available: 0, blocked: 1, booked: 2, sold: 3 };
    return annotated.sort((a, b) => {
      if (a.fit !== b.fit) return a.fit ? -1 : 1;
      const oa = order[a.unit.availability];
      const ob = order[b.unit.availability];
      if (oa !== ob) return oa - ob;
      return a.unit.priceInr - b.unit.priceInr;
    });
  }, [units, projectId, config, avail, tower, facing, activeBuyer, projectById]);

  const fitCount = useMemo(() => view.filter((v) => v.fit).length, [view]);

  // Inventory-health stats (respect the project filter; ignore config/avail/tower) ---
  const health = useMemo(() => {
    const scope = units.filter((u) => (projectId === "all" ? true : u.projectId === projectId));
    const by: Record<Availability, number> = { available: 0, blocked: 0, booked: 0, sold: 0 };
    let minP = Infinity, maxP = 0, psqftSum = 0;
    for (const u of scope) {
      by[u.availability] += 1;
      if (u.priceInr < minP) minP = u.priceInr;
      if (u.priceInr > maxP) maxP = u.priceInr;
      psqftSum += u.priceInr / u.carpetAreaSqft;
    }
    const total = scope.length;
    return {
      total, available: by.available, blocked: by.blocked, booked: by.booked, sold: by.sold,
      availablePct: total ? Math.round((by.available / total) * 100) : 0,
      sellThrough: total ? Math.round(((by.booked + by.sold) / total) * 100) : 0,
      minP: minP === Infinity ? 0 : minP,
      maxP,
      avgPsqft: total ? Math.round(psqftSum / total) : 0,
      projects: projectId === "all" ? projects.length : 1,
    };
  }, [units, projectId, projects.length]);

  return (
    <PageContainer>
      <PageHeader
        kicker="What the AI matches against"
        title="Inventory"
        description="Projects, towers and units — with live availability. The AI quotes from the same source of truth the agent sees."
      />

      <InventoryHealth {...health} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* PROJECT RAIL ---------------------------------------------------- */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Label className="mb-2 hidden lg:block">Projects</Label>
          <div className="flex gap-2.5 overflow-x-auto pb-1 lg:flex-col lg:gap-2.5 lg:overflow-visible lg:pb-0">
            <ProjectCard
              active={projectId === "all"}
              onClick={() => setProjectId("all")}
              allMode
              availCount={Object.values(availCountByProject).reduce((a, b) => a + b, 0)}
              projectCount={projects.length}
            />
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                active={projectId === p.id}
                onClick={() => setProjectId(p.id)}
                availCount={availCountByProject[p.id] ?? 0}
              />
            ))}
          </div>
        </aside>

        {/* MAIN ------------------------------------------------------------ */}
        <main className="min-w-0">
          {projectId !== "all" && projectById[projectId] && (
            <ProjectHero project={projectById[projectId]} units={units.filter((u) => u.projectId === projectId)} />
          )}

          {/* Buyer-match banner */}
          <AnimatePresence initial={false}>
            {activeBuyer && (
              <motion.div
                key="match-banner"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={SPRING}
                className="mb-4 overflow-hidden"
              >
                <div className="flex flex-col gap-3 rounded-[14px] border border-accent/40 bg-accent-soft px-4 py-3.5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent/15 text-accent">
                      <Sparkles size={17} />
                    </span>
                    <div className="min-w-0 text-sm">
                      <span className="font-semibold text-text">{activeBuyer.name}</span>
                      <span className="text-text-muted">
                        {" · "}
                        {activeBuyer.config} ·{" "}
                        {rupeeRange(activeBuyer.budgetMin, activeBuyer.budgetMax)}
                      </span>
                      <div className="mt-0.5 text-xs text-accent">
                        <span className="tabular font-semibold">{fitCount}</span>{" "}
                        matching unit{fitCount === 1 ? "" : "s"} light up
                        <span className="text-text-faint">
                          {" "}
                          · {activeBuyer.localityPrefs.join(", ")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setBuyerId("")}
                    className="flex h-8 shrink-0 items-center gap-1.5 self-start rounded-pill border border-border-strong bg-surface/60 px-3 text-xs font-medium text-text-muted transition-colors hover:text-text sm:self-auto"
                  >
                    <X size={13} /> Clear match
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters bar */}
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect value={config} onChange={(v) => setConfig(v as Config | "all")} allLabel="All configs" options={presentConfigs} active={config !== "all"} />
              {presentTowers.length > 1 && <FilterSelect value={tower} onChange={setTower} allLabel="All towers" options={presentTowers} active={tower !== "all"} />}
              {presentFacings.length > 1 && <FilterSelect value={facing} onChange={setFacing} allLabel="All facings" options={presentFacings} active={facing !== "all"} />}
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {(["all", "available", "blocked", "booked", "sold"] as AvailFilter[]).map(
                  (a) => (
                    <Chip key={a} active={avail === a} onClick={() => setAvail(a)} tone={a}>
                      {a === "all" ? "All" : AVAIL[a as Availability].label}
                    </Chip>
                  ),
                )}
              </div>

              {/* THE buyer-match selector */}
              <div
                className={cn(
                  "relative flex h-9 shrink-0 items-center rounded-[10px] border px-1 transition-colors",
                  activeBuyer
                    ? "border-accent bg-accent-soft"
                    : "border-border-strong bg-surface",
                )}
              >
                <Sparkles
                  size={14}
                  className={cn("ml-2", activeBuyer ? "text-accent" : "text-text-faint")}
                />
                <select
                  value={buyerId}
                  onChange={(e) => setBuyerId(e.target.value)}
                  className={cn(
                    "h-full max-w-[170px] cursor-pointer appearance-none bg-transparent pl-2 pr-2 text-sm outline-none",
                    activeBuyer ? "font-medium text-accent" : "text-text-muted",
                  )}
                >
                  <option value="">Match for a buyer…</option>
                  {buyers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.config}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Unit grid */}
          <LayoutGroup>
            <motion.div
              layout
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {view.map((v, i) => (
                  <UnitCard
                    key={v.unit.id}
                    unit={v.unit}
                    project={v.project}
                    fit={v.fit}
                    dimmed={!!activeBuyer && !v.fit}
                    index={i}
                    buyer={activeBuyer}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </LayoutGroup>

          {view.length === 0 && (
            <div className="rounded-[14px] border border-border bg-surface px-6 py-16 text-center shadow-[var(--shadow-soft)]">
              <p className="text-sm text-text-muted">No units match these filters.</p>
              <button
                onClick={() => {
                  setConfig("all");
                  setAvail("all");
                  setProjectId("all");
                  setTower("all");
                  setFacing("all");
                }}
                className="mt-2 text-sm font-medium text-accent"
              >
                Clear filters
              </button>
            </div>
          )}
        </main>
      </div>
    </PageContainer>
  );
}

/* ---------------- Inventory health strip ---------------- */
function InventoryHealth({
  total, available, blocked, booked, sold, availablePct, sellThrough, minP, maxP, avgPsqft, projects,
}: {
  total: number; available: number; blocked: number; booked: number; sold: number;
  availablePct: number; sellThrough: number; minP: number; maxP: number; avgPsqft: number; projects: number;
}) {
  const seg = [
    { label: "Available", n: available, color: "var(--positive)" },
    { label: "Blocked", n: blocked, color: "var(--live)" },
    { label: "Booked", n: booked, color: "var(--accent)" },
    { label: "Sold", n: sold, color: "var(--text-faint)" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-5 grid gap-5 rounded-[16px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)] sm:p-5 lg:grid-cols-[1.4fr_1fr]"
    >
      {/* counts + availability bar */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-end gap-x-7 gap-y-3">
          <HealthStat label="Total units" value={total} sub={`${projects} project${projects === 1 ? "" : "s"}`} />
          <HealthStat label="Available" value={available} sub={`${availablePct}% of stock`} color="var(--positive)" />
          <HealthStat label="Sell-through" value={`${sellThrough}%`} sub="booked + sold" color="var(--accent)" />
        </div>
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-inset">
          {seg.map((s) => (s.n > 0 ? (
            <motion.div key={s.label} initial={{ width: 0 }} animate={{ width: `${total ? (s.n / total) * 100 : 0}%` }} transition={{ duration: 0.6, ease: "easeOut" }} style={{ background: s.color }} className="h-full" />
          ) : null))}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
          {seg.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.label} <span className="tabular font-mono text-text-faint">{s.n}</span>
            </span>
          ))}
        </div>
      </div>

      {/* price intelligence */}
      <div className="grid grid-cols-2 gap-3 lg:border-l lg:border-border lg:pl-5">
        <PriceStat label="Price range" value={minP ? `${rupees(minP)} – ${rupees(maxP)}` : "—"} />
        <PriceStat label="Avg / sq.ft" value={avgPsqft ? `₹${avgPsqft.toLocaleString("en-IN")}` : "—"} />
      </div>
    </motion.div>
  );
}

function HealthStat({ label, value, sub, color }: { label: string; value: React.ReactNode; sub: string; color?: string }) {
  return (
    <div>
      <div className="tabular font-display text-2xl font-bold leading-none" style={{ color: color ?? "var(--text)" }}>{value}</div>
      <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-text-faint">{label}</div>
      <div className="text-[11px] text-text-muted">{sub}</div>
    </div>
  );
}

function PriceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-border bg-surface-inset/50 p-3">
      <div className="font-mono text-[10px] uppercase tracking-wide text-text-faint">{label}</div>
      <div className="tabular mt-1.5 font-display text-base font-bold text-text">{value}</div>
    </div>
  );
}

/* ---------------- Filter select ---------------- */
function FilterSelect({ value, onChange, allLabel, options, active }: { value: string; onChange: (v: string) => void; allLabel: string; options: string[]; active: boolean }) {
  return (
    <div className="relative flex h-9 shrink-0 items-center rounded-[10px] border border-border bg-surface">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-full cursor-pointer appearance-none bg-transparent pl-3 pr-9 text-sm font-medium outline-none", active ? "text-text" : "text-text-muted")}
      >
        <option value="all">{allLabel}</option>
        {options.map((o) => (<option key={o} value={o}>{o}</option>))}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-2.5 text-text-faint" />
    </div>
  );
}

/* ---------------- Project hero band ---------------- */
function ProjectHero({ project, units }: { project: Project; units: Unit[] }) {
  const total = units.length;
  const avail = units.filter((u) => u.availability === "available").length;
  const pct = total ? Math.round((avail / total) * 100) : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="mb-4 overflow-hidden rounded-[16px] border border-[#2e5599] bg-[linear-gradient(135deg,#1f3f74_0%,#122244_55%,#0a1a30_100%)] p-5 text-white shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-bold tracking-tight">{project.name}</h2>
            <span className="rounded-pill bg-[rgba(255,255,255,0.12)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#d1dff2]">{project.status === "ready" ? "Ready to move" : "Under construction"}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8baedd]">
            <span className="inline-flex items-center gap-1"><Building2 size={12} /> {project.builder}</span>
            <span className="inline-flex items-center gap-1"><MapPin size={12} /> {project.locality}</span>
            <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> {project.possessionDate}</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck size={12} /> RERA {project.reraNo}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.amenities.map((a) => (
              <span key={a} className="rounded-pill border border-[rgba(255,255,255,0.16)] px-2 py-0.5 text-[11px] text-[#d1dff2]">{a}</span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3.5">
          <Ring pct={pct} />
          <div>
            <div className="font-display text-2xl font-bold leading-none">{avail}<span className="text-base font-medium text-[#8baedd]"> / {total}</span></div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-[#8baedd]">units available</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 24, c = 2 * Math.PI * r;
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" className="shrink-0">
      <circle cx="29" cy="29" r={r} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="5" />
      <motion.circle cx="29" cy="29" r={r} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (pct / 100) * c }} transition={{ duration: 0.8, ease: "easeOut" }} transform="rotate(-90 29 29)" />
      <text x="29" y="33" textAnchor="middle" className="fill-white font-display text-[14px] font-bold">{pct}%</text>
    </svg>
  );
}

/* ---------------- Filter chip ---------------- */
function Chip({
  active,
  onClick,
  children,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: AvailFilter;
}) {
  const dotColor =
    tone && tone !== "all"
      ? {
          available: "var(--positive)",
          blocked: "var(--live)",
          booked: "var(--accent)",
          sold: "var(--text-faint)",
        }[tone]
      : null;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-pill border px-3 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-surface text-text-muted hover:text-text",
      )}
    >
      {dotColor && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: dotColor }}
        />
      )}
      {children}
    </button>
  );
}

/* ---------------- Project rail card ---------------- */
function ProjectCard({
  project,
  active,
  onClick,
  availCount,
  allMode = false,
  projectCount,
}: {
  project?: Project;
  active: boolean;
  onClick: () => void;
  availCount: number;
  allMode?: boolean;
  projectCount?: number;
}) {
  if (allMode) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex w-[220px] shrink-0 flex-col gap-2 rounded-[14px] border p-3.5 text-left transition-all lg:w-full",
          active
            ? "border-accent bg-accent-soft shadow-[var(--shadow-soft)]"
            : "border-border bg-surface hover:border-border-strong",
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-[9px]",
              active ? "bg-accent/15 text-accent" : "bg-surface-2 text-text-muted",
            )}
          >
            <Layers size={16} />
          </span>
          <div className="min-w-0">
            <div className="font-display text-[15px] font-bold leading-tight text-text">
              All projects
            </div>
            <div className="text-xs text-text-muted">{projectCount} projects</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <CheckCircle2 size={13} className="text-positive" />
          <span className="tabular font-semibold text-positive">{availCount}</span>
          <span className="text-text-faint">units available</span>
        </div>
      </button>
    );
  }

  if (!project) return null;
  const ready = project.status === "ready";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-[240px] shrink-0 flex-col gap-2.5 rounded-[14px] border p-3.5 text-left transition-all lg:w-full",
        active
          ? "border-accent bg-accent-soft shadow-[var(--shadow-soft)]"
          : "border-border bg-surface hover:border-border-strong",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-display text-[15px] font-bold leading-tight text-text">
            {project.name}
          </div>
          <div className="mt-0.5 truncate text-xs text-text-muted">{project.builder}</div>
        </div>
        <Pill variant={ready ? "positive" : "live"} className="shrink-0">
          {ready ? (
            <>
              <CheckCircle2 size={11} /> Ready
            </>
          ) : (
            <>
              <CalendarClock size={11} /> Under construction
            </>
          )}
        </Pill>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <MapPin size={12} className="text-text-faint" />
          {project.locality}
        </span>
        <span className="flex items-center gap-1">
          <Building2 size={12} className="text-text-faint" />
          {project.towers} towers
        </span>
        <span className="flex items-center gap-1">
          <CalendarClock size={12} className="text-text-faint" />
          {project.possessionDate}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        <span
          className="truncate font-mono text-[10px] uppercase tracking-wide text-text-faint"
          title={project.reraNo}
        >
          RERA {project.reraNo}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs">
          <span className="tabular font-semibold text-positive">{availCount}</span>
          <span className="text-text-faint">avail.</span>
        </span>
      </div>
    </button>
  );
}

/* ---------------- Unit card ---------------- */
function UnitCard({
  unit,
  project,
  fit,
  dimmed,
  index,
  buyer,
}: {
  unit: Unit;
  project: Project | undefined;
  fit: boolean;
  dimmed: boolean;
  index: number;
  buyer: Buyer | undefined;
}) {
  const a = AVAIL[unit.availability];
  const closed = a.dim;
  const sold = unit.availability === "sold";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: dimmed ? 0.42 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{
        layout: SPRING,
        opacity: { duration: 0.3 },
        y: { duration: 0.35, delay: Math.min(index, 12) * 0.025 },
      }}
      className={cn(
        "group relative flex flex-col gap-3 rounded-[14px] border bg-surface p-4 shadow-[var(--shadow-soft)] transition-colors",
        fit ? "border-accent" : "border-border",
        closed && "bg-surface-2",
      )}
      style={
        fit
          ? { boxShadow: "0 0 0 1px var(--accent), 0 0 26px -8px var(--accent)" }
          : undefined
      }
    >
      {/* Fit badge */}
      <AnimatePresence>
        {fit && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={SPRING}
            className="absolute -left-1.5 -top-2.5 z-10 flex items-center gap-1 rounded-pill bg-accent px-2 py-1 text-[11px] font-bold leading-none text-accent-contrast shadow-[0_0_18px_-4px_var(--accent)]"
          >
            <Sparkles size={11} /> Fit
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header row: config + availability tag */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-display text-[17px] font-bold leading-none text-text",
                sold && "line-through decoration-text-faint/60",
              )}
            >
              {unit.config}
            </span>
            <span className="flex items-center gap-0.5 font-mono text-xs text-text-faint">
              <Hash size={11} />
              {unit.unitNo}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-text-muted">
            <Building2 size={12} className="text-text-faint" />
            {unit.tower}
            {project && (
              <>
                <span className="text-text-faint">·</span>
                <span className="truncate">{project.name}</span>
              </>
            )}
          </div>
        </div>
        <Pill variant={a.variant} className="shrink-0">
          {a.label}
        </Pill>
      </div>

      {/* Price block */}
      <div className="flex items-end justify-between gap-2 border-y border-border py-2.5">
        <div>
          <div
            className={cn(
              "tabular font-display text-xl font-bold leading-none text-text",
              sold && "text-text-muted line-through decoration-text-faint/50",
            )}
          >
            {rupees(unit.priceInr)}
          </div>
          <div className="tabular mt-1 font-mono text-[11px] text-text-faint">
            {perSqft(unit.priceInr, unit.carpetAreaSqft)}
          </div>
        </div>
        <div className="text-right text-xs text-text-muted">
          <div className="tabular flex items-center justify-end gap-1 font-medium text-text">
            <Ruler size={12} className="text-text-faint" />
            {unit.carpetAreaSqft.toLocaleString("en-IN")} sq.ft
          </div>
          <div className="mt-1 text-[11px] text-text-faint">carpet area</div>
        </div>
      </div>

      {/* Footer: floor + facing, or fit reason */}
      {fit && buyer ? (
        <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
          <ShieldCheck size={13} className="shrink-0" />
          Matches budget + locality
        </div>
      ) : (
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <Layers size={12} className="text-text-faint" />
            Floor {unit.floor}
          </span>
          <span className="flex items-center gap-1">
            <Compass size={12} className="text-text-faint" />
            {unit.facing}
          </span>
        </div>
      )}
    </motion.div>
  );
}
