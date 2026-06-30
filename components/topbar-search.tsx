"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Search, ChevronRight, CornerDownLeft } from "lucide-react";
import { useScopedBuyers } from "@/lib/roles";
import { ScoreBadge } from "@/components/ui/primitives";
import { SOURCE_LABEL } from "@/lib/data/types";
import { cn, rupeeRange } from "@/lib/utils";

/** Top-bar lead search — type to get a dropdown of matching leads; click → that lead. */
export function TopbarSearch() {
  const buyers = useScopedBuyers();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const query = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (!query) return [];
    return buyers
      .filter((b) =>
        b.name.toLowerCase().includes(query) ||
        b.phone.toLowerCase().includes(query) ||
        b.config.toLowerCase().includes(query) ||
        b.localityPrefs.some((l) => l.toLowerCase().includes(query)) ||
        SOURCE_LABEL[b.source].toLowerCase().includes(query) ||
        b.stage.toLowerCase().includes(query),
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 7);
  }, [buyers, query]);

  useEffect(() => setActive(0), [query]);

  // close on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const go = (id: string) => { setOpen(false); setQ(""); router.push(`/buyers/${id}`); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") {
      if (results[active]) go(results[active].id);
      else if (query) { setOpen(false); router.push("/search"); }
    } else if (e.key === "Escape") { setOpen(false); (e.target as HTMLInputElement).blur(); }
  };

  return (
    <div ref={ref} className="relative w-full min-w-0 max-w-[240px] sm:max-w-sm">
      <div className="flex h-9 items-center gap-2.5 rounded-[5px] border border-border bg-surface px-3 transition-colors focus-within:border-border-strong">
        <Search size={15} className="shrink-0 text-text-faint" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search leads…"
          className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-faint"
        />
      </div>

      <AnimatePresence>
        {open && query && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-[6px] border border-border bg-surface shadow-[var(--shadow-lift)]"
          >
            {results.length === 0 ? (
              <div className="px-4 py-5 text-center text-sm text-text-muted">
                No leads match “{q.trim()}”.
              </div>
            ) : (
              <>
                <div className="max-h-[60vh] overflow-y-auto p-1.5">
                  {results.map((b, i) => (
                    <button
                      key={b.id}
                      onClick={() => go(b.id)}
                      onMouseEnter={() => setActive(i)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[5px] px-2.5 py-2 text-left transition-colors",
                        i === active ? "bg-surface-2" : "hover:bg-surface-2",
                      )}
                    >
                      <ScoreBadge score={b.score} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-text">{b.name}</div>
                        <div className="truncate text-[11px] text-text-faint">
                          {b.config} · {b.localityPrefs[0]} · {rupeeRange(b.budgetMin, b.budgetMax)}
                        </div>
                      </div>
                      <ChevronRight size={15} className="shrink-0 text-text-faint" />
                    </button>
                  ))}
                </div>
                <Link
                  href="/search"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between border-t border-border px-3.5 py-2 text-xs font-medium text-accent transition-colors hover:bg-surface-2"
                >
                  View all results
                  <span className="inline-flex items-center gap-1 text-text-faint">Enter <CornerDownLeft size={12} /></span>
                </Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
