"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Clapperboard, MessageCircle, CalendarCheck, PhoneIncoming, X, Radio } from "lucide-react";
import { conductBuyerReply, conductConciergeLead, conductMissedCall } from "@/lib/conductor";

const BEATS = [
  {
    label: "Buyer WhatsApp reply",
    hint: "qualifies · re-scores · re-ranks",
    icon: MessageCircle,
    run: async (go: (id: string) => void) => {
      const id = await conductBuyerReply();
      if (id) setTimeout(() => go(`/buyers/${id}`), 500);
    },
  },
  {
    label: "AI Inbox books a visit",
    hint: "new scored buyer appears live",
    icon: CalendarCheck,
    run: async (go: (id: string) => void) => {
      await conductConciergeLead();
      setTimeout(() => go("/concierge"), 400);
    },
  },
  {
    label: "Missed call captured",
    hint: "called back · logged · matched",
    icon: PhoneIncoming,
    run: async () => {
      await conductMissedCall();
    },
  },
];

export function ConductorDock() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="group fixed bottom-5 right-5 z-[60] hidden h-11 items-center gap-2 rounded-pill border border-chrome-border bg-chrome px-3.5 text-chrome-text shadow-[var(--shadow-lift)] transition-transform hover:scale-[1.03] lg:flex"
        aria-label="Demo conductor"
      >
        <Clapperboard size={16} className="text-accent" />
        <span className="text-xs font-semibold">Conductor</span>
        <kbd className="rounded bg-chrome-2 px-1 font-mono text-[10px]">⌘J</kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="chrome fixed bottom-20 right-5 z-[60] w-[300px] overflow-hidden rounded-[16px] border border-chrome-border shadow-[var(--shadow-lift)]"
          >
            <div className="flex items-center justify-between border-b border-chrome-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Radio size={15} className="text-accent" />
                <span className="font-display text-sm font-bold text-chrome-text">Demo conductor</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-chrome-text-faint hover:text-chrome-text"><X size={16} /></button>
            </div>
            <div className="space-y-1 p-2">
              {BEATS.map((b) => (
                <button
                  key={b.label}
                  onClick={() => { setOpen(false); b.run((href) => router.push(href)); }}
                  className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-left transition-colors hover:bg-chrome-2"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[rgba(226,97,45,0.16)] text-accent"><b.icon size={15} /></span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-chrome-text">{b.label}</div>
                    <div className="font-mono text-[10px] text-chrome-text-faint">{b.hint}</div>
                  </div>
                </button>
              ))}
            </div>
            <p className="border-t border-chrome-border px-4 py-2.5 text-[11px] leading-relaxed text-chrome-text-faint">
              Scripted events fire the real store and UI — reliable, not improvised.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
