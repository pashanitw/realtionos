"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "accent" | "positive" | "negative";
export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
};

const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

const TONE: Record<Tone, { chip: string; btn: string }> = {
  accent: { chip: "bg-accent-soft text-accent", btn: "bg-accent text-accent-contrast" },
  positive: { chip: "bg-positive-soft text-positive", btn: "bg-positive text-white" },
  negative: { chip: "bg-negative-soft text-negative", btn: "bg-negative text-white" },
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );

  const close = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  }, []);

  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [opts, close]);

  const tone = TONE[opts?.tone ?? "accent"];

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {opts && (
          <motion.div
            className="fixed inset-0 z-[110] flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => close(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: "spring", stiffness: 440, damping: 30 }}
              className="relative w-full max-w-[420px] overflow-hidden rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-lift)]"
            >
              <div className="flex items-start gap-3">
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[12px]", tone.chip)}>
                  {opts.tone === "negative" ? <AlertTriangle size={19} /> : <Check size={19} strokeWidth={2.4} />}
                </span>
                <div className="min-w-0 pt-0.5">
                  <h3 className="font-display text-lg font-bold leading-tight">{opts.title}</h3>
                  {opts.description && (
                    <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{opts.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => close(false)}
                  className="h-10 rounded-[10px] border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2"
                >
                  {opts.cancelLabel ?? "Cancel"}
                </button>
                <button
                  autoFocus
                  onClick={() => close(true)}
                  className={cn(
                    "h-10 rounded-[10px] px-4 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-95",
                    tone.btn,
                  )}
                >
                  {opts.confirmLabel ?? "Confirm"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmCtx.Provider>
  );
}
