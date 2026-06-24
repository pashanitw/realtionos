"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ListChecks,
  Bot,
  Building2,
  Columns3,
  ShieldCheck,
  BarChart3,
  Plug,
  MessageCircle,
  PhoneIncoming,
  CalendarCheck,
  CornerDownLeft,
  Sparkles,
  Search,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useScopedBuyers } from "@/lib/roles";
import { conductBuyerReply, conductConciergeLead, conductMissedCall } from "@/lib/conductor";
import { CommitCard, parseSentence } from "./commit-card";
import { Avatar } from "./ui/primitives";
import { rupeeRange } from "@/lib/utils";

const NAV = [
  { label: "Go to Worklist", href: "/worklist", icon: ListChecks },
  { label: "Go to AI Inbox", href: "/concierge", icon: Bot },
  { label: "Go to Inventory", href: "/inventory", icon: Building2 },
  { label: "Go to Pipeline", href: "/pipeline", icon: Columns3 },
  { label: "Go to Approvals", href: "/approvals", icon: ShieldCheck },
  { label: "Go to Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Go to Sources", href: "/settings/sources", icon: Plug },
];

export function CommandPalette() {
  const router = useRouter();
  const buyers = useScopedBuyers();
  const commitField = useStore((s) => s.commitField);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [committing, setCommitting] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCommitting(null);
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const runCommit = (sentence: string) => {
    setCommitting(sentence);
    setTimeout(() => {
      const parsed = parseSentence(sentence);
      const buyer = buyers.find((b) => b.name === parsed.buyerName) ?? buyers[0];
      if (parsed.fields[0]) commitField(buyer.id, parsed.fields[0]);
      toast.success("Committed to record", { description: `${parsed.buyerName ?? buyer.name} · saved · verified` });
      setTimeout(close, 900);
    }, 1900);
  };

  const q = query.trim().toLowerCase();
  const navMatches = NAV.filter((n) => n.label.toLowerCase().includes(q));
  const buyerMatches = q
    ? buyers.filter((b) => b.name.toLowerCase().includes(q) || b.localityPrefs.join(" ").toLowerCase().includes(q)).slice(0, 5)
    : [];
  const showCapture = query.trim().length > 2 && navMatches.length === 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="relative w-full max-w-[600px] overflow-hidden rounded-[16px] border border-border bg-surface shadow-[var(--shadow-lift)]"
          >
            <Command shouldFilter={false} loop>
              <div className="flex items-center gap-3 border-b border-border px-4">
                <Sparkles size={18} className="text-accent" />
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Tell the CRM what the buyer wants, or search…"
                  className="h-14 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-faint"
                />
                <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-muted">ESC</kbd>
              </div>

              {committing ? (
                <div className="p-4">
                  <CommitCard sentence={committing} />
                </div>
              ) : (
                <Command.List className="max-h-[52vh] overflow-y-auto p-2">
                  {showCapture && (
                    <Command.Group heading={<GroupLabel>Agent Copilot</GroupLabel>}>
                      <Item onSelect={() => runCommit(query.trim())} value="capture">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-live-soft text-live">
                          <Sparkles size={15} />
                        </span>
                        <div className="flex-1">
                          <div className="text-sm text-text">
                            Capture: <span className="font-medium">“{query.trim()}”</span>
                          </div>
                          <div className="text-xs text-text-faint">Crystallize into a structured record</div>
                        </div>
                        <CornerDownLeft size={15} className="text-text-faint" />
                      </Item>
                    </Command.Group>
                  )}

                  {buyerMatches.length > 0 && (
                    <Command.Group heading={<GroupLabel>Buyers</GroupLabel>}>
                      {buyerMatches.map((b) => (
                        <Item key={b.id} value={`buyer-${b.id}`} onSelect={() => { router.push(`/buyers/${b.id}`); close(); }}>
                          <Avatar name={b.name} hue={b.hue} size={30} />
                          <div className="flex-1">
                            <div className="text-sm text-text">{b.name}</div>
                            <div className="text-xs text-text-faint">
                              {b.config} · {b.localityPrefs[0]} · {rupeeRange(b.budgetMin, b.budgetMax)}
                            </div>
                          </div>
                          <span className="font-mono text-xs text-text-muted">{b.score}</span>
                        </Item>
                      ))}
                    </Command.Group>
                  )}

                  {navMatches.length > 0 && (
                    <Command.Group heading={<GroupLabel>Navigate</GroupLabel>}>
                      {navMatches.map((n) => (
                        <Item key={n.href} value={n.href} onSelect={() => { router.push(n.href); close(); }}>
                          <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface-2 text-text-muted">
                            <n.icon size={15} />
                          </span>
                          <span className="flex-1 text-sm text-text">{n.label}</span>
                        </Item>
                      ))}
                    </Command.Group>
                  )}

                  <Command.Group heading={<GroupLabel>Demo conductor</GroupLabel>}>
                    <Item value="conduct-reply" onSelect={() => { close(); conductBuyerReply(); }}>
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-positive-soft text-positive"><MessageCircle size={15} /></span>
                      <span className="flex-1 text-sm text-text">Simulate a buyer WhatsApp reply</span>
                    </Item>
                    <Item value="conduct-concierge" onSelect={() => { close(); conductConciergeLead(); }}>
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent"><CalendarCheck size={15} /></span>
                      <span className="flex-1 text-sm text-text">AI Inbox qualifies + books a visit</span>
                    </Item>
                    <Item value="conduct-call" onSelect={() => { close(); conductMissedCall(); }}>
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-live-soft text-live"><PhoneIncoming size={15} /></span>
                      <span className="flex-1 text-sm text-text">Simulate a missed call</span>
                    </Item>
                  </Command.Group>

                  <Command.Empty className="px-3 py-6 text-center text-sm text-text-faint">
                    <Search size={18} className="mx-auto mb-2 opacity-50" />
                    No matches — try typing a sentence to capture it.
                  </Command.Empty>
                </Command.List>
              )}
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <span className="px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">{children}</span>;
}

function Item({ children, value, onSelect }: { children: React.ReactNode; value: string; onSelect: () => void }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 text-text data-[selected=true]:bg-surface-2"
    >
      {children}
    </Command.Item>
  );
}
