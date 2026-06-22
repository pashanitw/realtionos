"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Database, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";

type Parsed = {
  title: string;
  buyerName?: string;
  fields: { label: string; value: string }[];
};

/** NL → structured real-estate record interpreter for the demo. */
export function parseSentence(raw: string): Parsed {
  const s = raw.trim();
  const buyers = useStore.getState().buyers;
  const matchBuyer = buyers.find((b) => s.toLowerCase().includes(b.name.split(" ")[0].toLowerCase()));

  const config = s.match(/\b([1-4]\s?bhk|villa|plot)\b/i)?.[0]?.toUpperCase().replace(/\s/, "");
  const locality = s.match(/\b(kokapet|gachibowli|narsingi|tellapur|kondapur|manikonda|nanakramguda)\b/i)?.[0];
  const budget = s.match(/(\d+(?:\.\d+)?)\s?(cr|crore|l|lakh|lac)/i);

  if (/\b(book|schedule|visit)\b/i.test(s)) {
    const when = s.match(/\b(sat\w*|sun\w*|mon\w*|tomorrow|today)\b.*?(\d{1,2}\s?(am|pm))?/i)?.[0];
    return {
      title: "Site visit booked",
      buyerName: matchBuyer?.name,
      fields: [{ label: "Site visit", value: when ? when.replace(/\s+/g, " ").trim() : "Saturday 11 AM" }],
    };
  }
  if (/\b(add|create|new)\b/i.test(s) && (config || matchBuyer)) {
    const fields = [];
    if (config) fields.push({ label: "Config", value: config });
    if (locality) fields.push({ label: "Locality", value: locality.replace(/^\w/, (c) => c.toUpperCase()) });
    if (budget) fields.push({ label: "Budget", value: budget[0] });
    if (!fields.length) fields.push({ label: "Note", value: s });
    return { title: "Buyer created", buyerName: matchBuyer?.name, fields };
  }
  if (budget) return { title: "Field captured", buyerName: matchBuyer?.name, fields: [{ label: "Budget", value: budget[0] }] };
  if (config) return { title: "Field captured", buyerName: matchBuyer?.name, fields: [{ label: "Config", value: config }] };
  return { title: "Record captured", buyerName: matchBuyer?.name, fields: [{ label: "Note", value: s }] };
}

type Phase = "writing" | "structuring" | "verified";

export function CommitCard({
  sentence,
  onDone,
}: {
  sentence: string;
  onDone?: (parsed: Parsed) => void;
}) {
  const [phase, setPhase] = useState<Phase>("writing");
  const [parsed] = useState<Parsed>(() => parseSentence(sentence));

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("structuring"), 850);
    const t2 = setTimeout(() => {
      setPhase("verified");
      onDone?.(parsed);
    }, 1700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-[14px] border bg-surface p-4 transition-colors",
        phase === "verified" ? "border-positive/40" : "border-border",
      )}
    >
      {phase === "writing" && <div className="scan-sweep pointer-events-none absolute inset-0" />}

      <div className="mb-3 flex items-center justify-between">
        <span className="label">{parsed.title}</span>
        <PhasePill phase={phase} />
      </div>

      {phase === "writing" ? (
        <p className="font-mono text-sm text-text-muted">{sentence}</p>
      ) : (
        <div className="space-y-2">
          {parsed.buyerName && <div className="text-sm font-semibold text-text">{parsed.buyerName}</div>}
          {parsed.fields.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-2 text-sm"
            >
              <span className="font-mono text-[11px] uppercase tracking-wide text-text-faint">{f.label}</span>
              <span className="rounded-md bg-accent-soft px-2 py-0.5 font-medium text-accent">{f.value}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function PhasePill({ phase }: { phase: Phase }) {
  if (phase === "writing")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-live-soft px-2.5 py-1 font-mono text-[11px] text-live">
        <Loader2 size={11} className="animate-spin" /> writing…
      </span>
    );
  if (phase === "structuring")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent-soft px-2.5 py-1 font-mono text-[11px] text-accent">
        <Database size={11} /> structuring
      </span>
    );
  return (
    <motion.span
      initial={{ scale: 0.85 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 18 }}
      className="inline-flex items-center gap-1.5 rounded-pill bg-positive-soft px-2.5 py-1 font-mono text-[11px] text-positive"
    >
      <Check size={11} strokeWidth={3} /> saved · verified
    </motion.span>
  );
}
