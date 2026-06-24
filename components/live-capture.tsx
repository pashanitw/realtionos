"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, MessageCircle, TrendingUp, UserPlus, CalendarCheck, KeyRound, Inbox } from "lucide-react";
import { useClientActivity } from "@/lib/roles";
import { relativeTime } from "@/lib/utils";
import { StatusDot } from "./ui/primitives";
import type { ActivityKind } from "@/lib/data/types";

const ICON: Record<ActivityKind, typeof Phone> = {
  enquiry: Inbox,
  call: Phone,
  whatsapp: MessageCircle,
  sitevisit: CalendarCheck,
  booking: KeyRound,
  score: TrendingUp,
  lead: UserPlus,
};

export function ActivityPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const activity = useClientActivity();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[380px] flex-col border-l border-border bg-surface shadow-[var(--shadow-lift)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <StatusDot color="var(--live)" pulse size={8} />
                <div>
                  <h3 className="font-display text-base font-bold">Live capture</h3>
                  <p className="text-xs text-text-muted">The CRM, updating itself</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <X size={17} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <AnimatePresence initial={false}>
                {activity.map((e) => {
                  const Icon = ICON[e.kind];
                  return (
                    <motion.div
                      key={e.id}
                      layout
                      initial={{ opacity: 0, y: -12, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 34 }}
                      className="flex gap-3 rounded-[12px] px-3 py-2.5 hover:bg-surface-2"
                    >
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                        <Icon size={15} strokeWidth={2.2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-text">{e.text}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-faint">
                          {e.meta && <span className="font-mono">{e.meta}</span>}
                          <span suppressHydrationWarning>{relativeTime(e.timestamp)}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
