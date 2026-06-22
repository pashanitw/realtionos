"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, ArrowUp, Sparkles, Building2, CalendarCheck, CheckCircle2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { CommitCard } from "./commit-card";
import { rupees, perSqft, cn } from "@/lib/utils";
import type { Config } from "@/lib/data/types";

type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "ai"; kind: "text"; text: string }
  | { id: string; role: "ai"; kind: "commit"; sentence: string }
  | { id: string; role: "ai"; kind: "units"; unitIds: string[]; text: string };

const SUGGESTIONS = [
  "Add a buyer: Priya, 2BHK Narsingi, ₹85L from MagicBricks",
  "Show ready 3BHK under ₹1.4 Cr in Kokapet",
  "Book a visit for Rohan Saturday 11am",
];

let mid = 0;
const nid = () => `m${++mid}`;

export function AgentCopilot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: nid(), role: "ai", kind: "text", text: "I'm your copilot. Tell me what a buyer wants, search live inventory, or book a visit — in plain language." },
  ]);
  const scroller = useRef<HTMLDivElement>(null);
  const units = useStore((s) => s.units);
  const projects = useStore((s) => s.projects);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("relos-open-copilot", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("relos-open-copilot", onOpen);
    };
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  const respond = (text: string) => {
    const t = text.toLowerCase();
    if (/\b(show|find|match|search|list|under|inventory)\b/.test(t) && /bhk|villa|plot/.test(t)) {
      const cfg = (t.match(/\b([1-4]\s?bhk|villa|plot)\b/)?.[0]?.toUpperCase().replace(/\s/, "") ?? "3BHK") as Config;
      const cap = t.includes("cr") ? (parseFloat(t.match(/(\d+(?:\.\d+)?)\s?cr/)?.[1] ?? "1.5") * 1e7) : t.includes("l") ? (parseFloat(t.match(/(\d+(?:\.\d+)?)\s?l/)?.[1] ?? "100") * 1e5) : 2e7;
      const matched = units
        .filter((u) => u.config === cfg && (u.availability === "available" || u.availability === "blocked") && u.priceInr <= cap * 1.05)
        .slice(0, 3)
        .map((u) => u.id);
      return { id: nid(), role: "ai", kind: "units", unitIds: matched, text: `${matched.length} matching ${cfg}${matched.length === 1 ? "" : "s"} in live inventory:` } as Msg;
    }
    return { id: nid(), role: "ai", kind: "commit", sentence: text } as Msg;
  };

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setInput("");
    setMsgs((m) => [...m, { id: nid(), role: "user", text: clean }]);
    setTimeout(() => setMsgs((m) => [...m, respond(clean)]), 450);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-border bg-surface shadow-[var(--shadow-lift)]"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-[#34b3a3] to-[#0c4a45] text-white"><Bot size={17} /></span>
                  <div>
                    <h3 className="font-display text-base font-bold">Agent Copilot</h3>
                    <p className="text-xs text-text-muted">Run the CRM by chatting</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text"><X size={17} /></button>
              </div>

              <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4">
                {msgs.map((m) => (
                  <Bubble key={m.id} m={m} projects={projects} units={units} />
                ))}
                {msgs.length <= 1 && (
                  <div className="space-y-1.5 pt-2">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-faint">Try</div>
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => send(s)} className="block w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-left text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); send(input); }}
                className="flex items-center gap-2 border-t border-border p-3"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Message the copilot…"
                  className="h-11 flex-1 rounded-[12px] border border-border bg-surface-2 px-3.5 text-sm outline-none placeholder:text-text-faint focus:border-accent"
                />
                <button type="submit" className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-accent text-accent-contrast transition-transform hover:scale-105 active:scale-95" aria-label="Send">
                  <ArrowUp size={18} strokeWidth={2.4} />
                </button>
              </form>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({
  m,
  projects,
  units,
}: {
  m: Msg;
  projects: ReturnType<typeof useStore.getState>["projects"];
  units: ReturnType<typeof useStore.getState>["units"];
}) {
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
  if (m.kind === "commit") {
    return (
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"><Sparkles size={12} /></span>
        <div className="min-w-0 flex-1"><CommitCard sentence={m.sentence} /></div>
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
              <div className="mt-0.5 text-xs text-text-muted">
                {u.tower} · {u.config} · {u.carpetAreaSqft.toLocaleString("en-IN")} sq.ft · {u.facing} · {perSqft(u.priceInr, u.carpetAreaSqft)}
              </div>
              <div className="mt-1.5 flex items-center gap-1 text-[11px] text-positive">
                <CheckCircle2 size={12} /> {p?.status === "ready" ? "Ready to move" : `Possession ${p?.possessionDate}`} · RERA {p?.reraNo.slice(0, 8)}…
              </div>
            </div>
          );
        })}
        {m.unitIds.length > 0 && (
          <button className="inline-flex items-center gap-1.5 rounded-pill bg-positive-soft px-3 py-1.5 text-xs font-semibold text-positive">
            <CalendarCheck size={13} /> Share on WhatsApp + book a visit
          </button>
        )}
      </div>
    </div>
  );
}
