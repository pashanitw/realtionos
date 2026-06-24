"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, ArrowUp, Sparkles, Building2, CalendarCheck, CheckCircle2, TrendingUp } from "lucide-react";
import { useScopedBuyers, useScopedDeals, useClientUnits, useClientProjects, useClientAnalytics, useCurrentUser } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { Avatar } from "./ui/primitives";
import { rupees, rupeeRange, perSqft, cn, SEED_NOW } from "@/lib/utils";
import { isBooked, SOURCE_LABEL, type Config, type Source, type Project, type Unit } from "@/lib/data/types";

type Stat = { label: string; value: string };
type Row = { name: string; meta: string; right?: string; href?: string; hue?: number };
type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "ai"; kind: "text"; text: string }
  | { id: string; role: "ai"; kind: "units"; unitIds: string[]; text: string }
  | { id: string; role: "ai"; kind: "answer"; text: string; stats?: Stat[]; rows?: Row[]; href?: string; hrefLabel?: string };

const SUGGESTIONS = [
  "What's my pipeline worth?",
  "Show my hot buyers",
  "Which visits are due?",
  "Show ready 3BHK under ₹1.4 Cr",
  "Add a buyer: Priya, 2BHK Narsingi, ₹85L",
];

let mid = 0;
const nid = () => `m${++mid}`;

/* ---- tiny parsers (keyword-based; no LLM in the demo) ---- */
const parseConfig = (t: string): Config | undefined => {
  const bhk = t.match(/\b([1-4])\s?bhk\b/i);
  if (bhk) return `${bhk[1]}BHK` as Config;
  if (/\bvilla\b/i.test(t)) return "Villa" as Config;
  if (/\bplot\b/i.test(t)) return "Plot" as Config;
  return undefined;
};
const parsePrice = (t: string): number | undefined => {
  const cr = t.match(/(\d+(?:\.\d+)?)\s?cr/i);
  if (cr) return parseFloat(cr[1]) * 1e7;
  const l = t.match(/(\d+(?:\.\d+)?)\s?(?:l|lakh|lac)\b/i);
  if (l) return parseFloat(l[1]) * 1e5;
  return undefined;
};
const parseSource = (t: string): Source | undefined =>
  /magicbricks/i.test(t) ? "magicbricks" : /99\s?acres/i.test(t) ? "99acres" : /housing/i.test(t) ? "housing" : /whatsapp/i.test(t) ? "whatsapp" : /referral/i.test(t) ? "referral" : undefined;

export function AgentCopilot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: nid(), role: "ai", kind: "text", text: "I'm your copilot. Ask about your book — pipeline, hot buyers, visits, overdue follow-ups — search live inventory, add a buyer, or book a visit. In plain language." },
  ]);
  const scroller = useRef<HTMLDivElement>(null);

  const user = useCurrentUser();
  const buyers = useScopedBuyers();
  const deals = useScopedDeals();
  const units = useClientUnits();
  const projects = useClientProjects();
  const analytics = useClientAnalytics();
  const addBuyer = useStore((s) => s.addBuyer);
  const bookVisit = useStore((s) => s.bookVisit);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") { e.preventDefault(); setOpen((o) => !o); }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("relos-open-copilot", onOpen);
    return () => { document.removeEventListener("keydown", onKey); window.removeEventListener("relos-open-copilot", onOpen); };
  }, []);

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [msgs, open]);

  const reply = (raw: string): Msg => {
    const t = raw.toLowerCase();
    const firstName = user.name.split(" ")[0];
    const open = deals.filter((d) => d.stage !== "Registration" && d.stage !== "Handover");
    const pv = open.reduce((s, d) => s + d.valueInr, 0);
    const booked = deals.filter((d) => isBooked(d.stage)).length;
    const hot = [...buyers].filter((b) => b.score >= 70).sort((a, b) => b.score - a.score);
    const due = [...buyers].filter((b) => b.siteVisitDue).sort((a, b) => (a.siteVisitDue! - b.siteVisitDue!));
    const overdue = buyers.filter((b) => b.followUpAt != null && b.followUpAt < SEED_NOW && !b.siteVisitDue);
    const text = (s: string): Msg => ({ id: nid(), role: "ai", kind: "text", text: s });

    // 1) book a visit
    if (/book\b/.test(t) && /visit/.test(t)) {
      const q = raw.match(/for\s+([A-Za-z][A-Za-z'.\- ]*?)(?:\s+(?:on|this|next|sat|sun|mon|tue|wed|thu|fri|tomorrow)|,|$)/i)?.[1]?.trim();
      const target = q ? buyers.find((b) => b.name.toLowerCase().includes(q.toLowerCase())) : buyers.find((b) => !b.siteVisitDue) ?? buyers[0];
      if (!target) return text(`I couldn't find a buyer matching "${q ?? ""}" in your list.`);
      const when = raw.match(/\b((?:mon|tue|wed|thu|fri|sat|sun)[a-z]*|tomorrow|this weekend)\b[^,.]*?(?:\d{1,2}\s?(?:am|pm))?/i)?.[0]?.trim() || "this weekend";
      bookVisit(target.id, when);
      return { id: nid(), role: "ai", kind: "answer", text: `✓ Site visit booked for ${target.name} — ${when}. It's on the worklist and pipeline now.`, rows: [{ name: target.name, meta: `${target.config} · ${target.localityPrefs[0]}`, right: when, href: `/buyers/${target.id}`, hue: target.hue }], href: "/logistics", hrefLabel: "Arrange a cab" };
    }

    // 2) add a buyer
    if (/\b(add|create|new)\b/.test(t) && /\b(buyer|lead)\b/.test(t)) {
      const name = (raw.match(/(?:buyer|lead)[:\-\s]+([A-Za-z][A-Za-z'.\-]*(?:\s[A-Za-z'.\-]+)?)/i)?.[1] || "New Lead").trim();
      const config = parseConfig(t);
      const locality = projects.map((p) => p.locality).find((l) => t.includes(l.toLowerCase()));
      const budgetMax = parsePrice(t);
      const source = parseSource(t);
      const id = addBuyer({ name, config, locality, budgetMax, source });
      const created = useStore.getState().buyers.find((b) => b.id === id);
      const meta = `${config ?? created?.config} · ${locality ?? created?.localityPrefs[0]}${budgetMax ? ` · ${rupeeRange(Math.round(budgetMax * 0.9), budgetMax)}` : ""}`;
      return { id: nid(), role: "ai", kind: "answer", text: `✓ Added ${name} to your worklist — scored ${created?.score ?? "—"}, assigned to ${created?.agent ?? "you"}.`, rows: [{ name, meta, right: created ? `#${created.score}` : undefined, href: `/buyers/${id}`, hue: created?.hue ?? 210 }], href: "/worklist", hrefLabel: "Open worklist" };
    }

    // 2a) root-cause analysis — why are we losing deals?
    if (/(why).*(los|slip|drop|deal|leak|under)|root[- ]?cause|lost reason/.test(t)) {
      const funnel = analytics?.funnel ?? [];
      let leakStage = ""; let leakPct = 0;
      for (let i = 0; i < funnel.length - 1; i++) {
        const drop = funnel[i].count ? (funnel[i].count - funnel[i + 1].count) / funnel[i].count : 0;
        if (drop > leakPct) { leakPct = drop; leakStage = funnel[i].stage; }
      }
      return {
        id: nid(), role: "ai", kind: "answer",
        text: `Biggest leak: ${Math.round(leakPct * 100)}% of leads drop at "${leakStage}". Top reasons deals are lost:`,
        stats: [
          { label: "Budget mismatch", value: "28%" },
          { label: "Competitor", value: "22%" },
          { label: "Possession", value: "18%" },
          { label: "Loan rejected", value: "17%" },
          { label: "Went cold", value: "15%" },
        ],
        href: "/analytics", hrefLabel: "Full root-cause analysis",
      };
    }

    // 2b) source / campaign performance
    if (/which source|source roi|campaign|underperform|best source|worst source|channel.*perform|source.*(perform|conver|roi)/.test(t)) {
      const roi = [...(analytics?.sourceROI ?? [])].sort((a, b) => b.rate - a.rate);
      if (!roi.length) return text("No source-performance data yet.");
      const best = roi[0], worst = roi[roi.length - 1];
      return {
        id: nid(), role: "ai", kind: "answer",
        text: `${SOURCE_LABEL[best.source]} converts best (${best.rate}%); ${SOURCE_LABEL[worst.source]} is underperforming (${worst.rate}%).`,
        stats: roi.slice(0, 6).map((s) => ({ label: SOURCE_LABEL[s.source], value: `${s.rate}%` })),
        href: "/analytics", hrefLabel: "Source ROI",
      };
    }

    // 3) live inventory search
    if (/\b(show|find|match|search|list|under|inventory|available|options)\b/.test(t) && /bhk|villa|plot/.test(t)) {
      const cfg = parseConfig(t) ?? ("3BHK" as Config);
      const cap = parsePrice(t) ?? 2e7;
      const matched = units.filter((u) => u.config === cfg && (u.availability === "available" || u.availability === "blocked") && u.priceInr <= cap * 1.05).slice(0, 3).map((u) => u.id);
      return { id: nid(), role: "ai", kind: "units", unitIds: matched, text: `${matched.length} matching ${cfg}${matched.length === 1 ? "" : "s"} in live inventory:` };
    }

    // 4) pipeline value / revenue
    if (/pipeline|worth|revenue|forecast|deal value/.test(t)) {
      return { id: nid(), role: "ai", kind: "answer", text: `Your pipeline is worth ${rupees(pv)} across ${open.length} open contract${open.length === 1 ? "" : "s"}.`, stats: [{ label: "Pipeline", value: rupees(pv) }, { label: "Open", value: String(open.length) }, { label: "Booked", value: String(booked) }], href: "/pipeline", hrefLabel: "Open pipeline" };
    }

    // 5) who to call
    if (/who.*call|call (today|first|next)|next call/.test(t)) {
      const top = [...buyers].sort((a, b) => b.score - a.score)[0];
      if (!top) return text("No buyers are assigned to you yet.");
      return { id: nid(), role: "ai", kind: "answer", text: `Call ${top.name} first — intent score ${top.score}. ${top.scoreReasons[0]?.text ?? "Strong fit."}`, rows: [{ name: top.name, meta: `${top.config} · ${top.localityPrefs[0]} · ${rupeeRange(top.budgetMin, top.budgetMax)}`, right: `#${top.score}`, href: `/buyers/${top.id}`, hue: top.hue }], href: "/worklist", hrefLabel: "See the full ranked list" };
    }

    // 6) hot buyers
    if (/\bhot\b|top (buyer|lead)|best (buyer|lead)/.test(t)) {
      if (!hot.length) return text("No hot buyers (score ≥ 70) in your book right now.");
      return { id: nid(), role: "ai", kind: "answer", text: `You have ${hot.length} hot buyer${hot.length === 1 ? "" : "s"} (score ≥ 70):`, rows: hot.slice(0, 5).map((b) => ({ name: b.name, meta: `${b.config} · ${b.localityPrefs[0]}`, right: `#${b.score}`, href: `/buyers/${b.id}`, hue: b.hue })), href: "/worklist", hrefLabel: "Open worklist" };
    }

    // 7) visits due
    if (/visit/.test(t) && /due|today|scheduled|upcoming|coming/.test(t)) {
      if (!due.length) return text("No site visits scheduled in your book right now.");
      return { id: nid(), role: "ai", kind: "answer", text: `${due.length} site visit${due.length === 1 ? "" : "s"} coming up:`, rows: due.slice(0, 5).map((b) => ({ name: b.name, meta: `${b.config} · ${b.localityPrefs[0]}`, right: "visit due", href: `/buyers/${b.id}`, hue: b.hue })), href: "/logistics", hrefLabel: "Logistics" };
    }

    // 8) overdue / stalled / follow-ups
    if (/overdue|follow.?up|stalled|slipping|cold|losing/.test(t)) {
      if (!overdue.length) return text("Nothing overdue — you're all caught up. 🎉");
      return { id: nid(), role: "ai", kind: "answer", text: `${overdue.length} follow-up${overdue.length === 1 ? "" : "s"} ${overdue.length === 1 ? "is" : "are"} overdue:`, rows: overdue.slice(0, 5).map((b) => ({ name: b.name, meta: `${b.config} · ${b.localityPrefs[0]}`, right: "overdue", href: `/buyers/${b.id}`, hue: b.hue })), href: "/tasks", hrefLabel: "Open tasks" };
    }

    // 9) summary
    if (/summary|overview|how (am i|are we)|my (day|book|numbers|stats)/.test(t)) {
      return { id: nid(), role: "ai", kind: "answer", text: `Here's your book, ${firstName}:`, stats: [{ label: "Contracts", value: String(buyers.length) }, { label: "Pipeline", value: rupees(pv) }, { label: "Booked", value: String(booked) }, { label: "Visits due", value: String(due.length) }, { label: "Overdue", value: String(overdue.length) }, { label: "Hot", value: String(hot.length) }], href: "/home", hrefLabel: "Open dashboard" };
    }

    // 10) fallback help
    return text(`I can search live inventory ("show ready 3BHK under ₹1.4 Cr"), answer about your book ("what's my pipeline worth", "show my hot buyers", "which visits are due", "what's overdue"), add a buyer, or book a visit. What do you need?`);
  };

  const send = (raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    setInput("");
    const userMsg: Msg = { id: nid(), role: "user", text: clean };
    setMsgs((m) => [...m, userMsg]);
    // reply() performs real store mutations (addBuyer/bookVisit) — run it ONCE here,
    // never inside a setState updater (React re-invokes those, double-firing effects).
    setTimeout(() => {
      const aiMsg = reply(clean);
      setMsgs((m) => [...m, aiMsg]);
    }, 450);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-border bg-surface shadow-[var(--shadow-lift)]"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 360, damping: 36 }}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-[#34b3a3] to-[#0c4a45] text-white"><Bot size={17} /></span>
                <div>
                  <h3 className="font-display text-base font-bold">Agent Copilot</h3>
                  <p className="text-xs text-text-muted">Ask about your book · {buyers.length} contracts</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text"><X size={17} /></button>
            </div>

            <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4">
              {msgs.map((m) => (<Bubble key={m.id} m={m} projects={projects} units={units} onClose={() => setOpen(false)} />))}
              {msgs.length <= 1 && (
                <div className="space-y-1.5 pt-2">
                  <div className="font-mono text-[10px] uppercase tracking-wide text-text-faint">Try</div>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="block w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-left text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text">{s}</button>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-border p-3">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message the copilot…" className="h-11 flex-1 rounded-[12px] border border-border bg-surface-2 px-3.5 text-sm outline-none placeholder:text-text-faint focus:border-accent" />
              <button type="submit" className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-accent text-accent-contrast transition-transform hover:scale-105 active:scale-95" aria-label="Send"><ArrowUp size={18} strokeWidth={2.4} /></button>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Bubble({ m, projects, units, onClose }: { m: Msg; projects: Project[]; units: Unit[]; onClose: () => void }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[14px] rounded-br-sm bg-accent px-3.5 py-2 text-sm text-accent-contrast">{m.text}</div>
      </div>
    );
  }
  if (m.kind === "text") {
    return (
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"><Sparkles size={12} /></span>
        <div className="max-w-[85%] rounded-[14px] rounded-tl-sm bg-surface-2 px-3.5 py-2 text-sm text-text">{m.text}</div>
      </div>
    );
  }
  if (m.kind === "answer") {
    return (
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"><TrendingUp size={12} /></span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="text-sm text-text">{m.text}</div>
          {m.stats && (
            <div className="flex flex-wrap gap-1.5">
              {m.stats.map((s) => (
                <div key={s.label} className="rounded-[10px] border border-border bg-surface-2 px-2.5 py-1.5">
                  <div className="font-mono text-[9px] uppercase tracking-wide text-text-faint">{s.label}</div>
                  <div className="tabular font-display text-[15px] font-bold leading-tight text-text">{s.value}</div>
                </div>
              ))}
            </div>
          )}
          {m.rows?.map((r, i) => {
            const inner = (
              <>
                <Avatar name={r.name} hue={r.hue ?? 210} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-text">{r.name}</div>
                  <div className="truncate text-[11px] text-text-muted">{r.meta}</div>
                </div>
                {r.right && <span className="tabular shrink-0 font-mono text-xs text-accent">{r.right}</span>}
              </>
            );
            return r.href ? (
              <Link key={i} href={r.href} onClick={onClose} className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface-2 px-2.5 py-2 transition-colors hover:border-border-strong">{inner}</Link>
            ) : (
              <div key={i} className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface-2 px-2.5 py-2">{inner}</div>
            );
          })}
          {m.href && (
            <Link href={m.href} onClick={onClose} className="inline-flex items-center gap-1 text-xs font-semibold text-accent">{m.hrefLabel ?? "Open"} →</Link>
          )}
        </div>
      </div>
    );
  }
  // units
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"><Building2 size={12} /></span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="text-sm text-text">{m.text}</div>
        {m.unitIds.length === 0 && <div className="text-sm text-text-faint">No matching units available right now.</div>}
        {m.unitIds.map((uid) => {
          const u = units.find((x) => x.id === uid);
          if (!u) return null;
          const p = projects.find((pp) => pp.id === u.projectId);
          return (
            <div key={uid} className="rounded-[12px] border border-border bg-surface-2 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text">{p?.name}</span>
                <span className="font-mono text-sm font-semibold text-accent">{rupees(u.priceInr)}</span>
              </div>
              <div className="mt-0.5 text-xs text-text-muted">{u.tower} · {u.config} · {u.carpetAreaSqft.toLocaleString("en-IN")} sq.ft · {u.facing} · {perSqft(u.priceInr, u.carpetAreaSqft)}</div>
              <div className="mt-1.5 flex items-center gap-1 text-[11px] text-positive"><CheckCircle2 size={12} /> {p?.status === "ready" ? "Ready to move" : `Possession ${p?.possessionDate}`} · RERA {p?.reraNo.slice(0, 8)}…</div>
            </div>
          );
        })}
        {m.unitIds.length > 0 && (
          <button className="inline-flex items-center gap-1.5 rounded-pill bg-positive-soft px-3 py-1.5 text-xs font-semibold text-positive"><CalendarCheck size={13} /> Share on WhatsApp + book a visit</button>
        )}
      </div>
    </div>
  );
}
