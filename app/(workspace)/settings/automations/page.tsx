"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Workflow, GitBranch, Wand2, Sparkles, Zap, Send, MessageCircle,
  ListChecks, Clock, ArrowRight, ChevronRight, Power, Filter, TriangleAlert, Play,
  type LucideIcon,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Label, Pill, AnimatedNumber, StatusDot } from "@/components/ui/primitives";
import { cn, relativeTime } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useClientWorkflows } from "@/lib/roles";
import { generateFlow, WORKFLOW_EXAMPLES } from "@/lib/workflows";
import type { WorkflowNode, WorkflowNodeType } from "@/lib/data/types";
import { toast } from "sonner";

/* ---------------- Node visual meta ---------------- */
const TYPE_META: Record<WorkflowNodeType, { caption: string; color: string; icon: LucideIcon }> = {
  trigger: { caption: "Trigger", color: "var(--accent)", icon: Zap },
  condition: { caption: "Condition", color: "var(--live)", icon: GitBranch },
  action: { caption: "Action", color: "var(--positive)", icon: ArrowRight },
};

function nodeIcon(node: WorkflowNode): LucideIcon {
  if (node.type === "trigger") return Zap;
  if (node.type === "condition") return /reply|score|unpaid|hot/i.test(node.label) ? Filter : GitBranch;
  const l = node.label.toLowerCase();
  if (l.includes("whatsapp") || l.includes("message")) return MessageCircle;
  if (l.includes("send")) return Send;
  if (l.includes("escalate") || l.includes("alert")) return TriangleAlert;
  if (l.includes("task") || l.includes("schedule") || l.includes("log")) return ListChecks;
  if (l.includes("notify")) return Send;
  return ArrowRight;
}

/* ---------------- Single flow node card ---------------- */
function FlowNodeCard({ node, index }: { node: WorkflowNode; index: number }) {
  const meta = TYPE_META[node.type];
  const Icon = nodeIcon(node);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 360, damping: 30, delay: index * 0.09 }}
      className="flex w-full items-center gap-3 rounded-[14px] border border-border bg-surface p-3.5 shadow-[var(--shadow-soft)] sm:w-[210px] sm:flex-col sm:items-start sm:gap-2.5"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]" style={{ background: `color-mix(in oklab, ${meta.color} 16%, transparent)`, color: meta.color }}>
        <Icon size={19} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: meta.color }}>{meta.caption}</div>
        <div className="mt-0.5 text-[13px] font-semibold leading-snug text-text">{node.label}</div>
      </div>
    </motion.div>
  );
}

/* ---------------- Generated flow (with connectors) ---------------- */
function GeneratedFlow({ nodes }: { nodes: WorkflowNode[] }) {
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-0">
      {nodes.map((node, i) => (
        <div key={i} className="flex items-center sm:contents">
          <FlowNodeCard node={node} index={i} />
          {i < nodes.length - 1 && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.09 + 0.12 }} className="grid shrink-0 place-items-center text-text-faint">
              <ChevronRight size={18} className="hidden sm:mx-1.5 sm:block" />
              <ArrowRight size={16} className="my-1 ml-[18px] rotate-90 sm:hidden" />
            </motion.span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Compact one-line chain (workflow cards) ---------------- */
function FlowChain({ nodes }: { nodes: WorkflowNode[] }) {
  const shown = nodes.slice(0, 3);
  const extra = nodes.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((node, i) => {
        const meta = TYPE_META[node.type];
        const Icon = nodeIcon(node);
        return (
          <span key={i} className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 rounded-pill bg-surface-2 px-2 py-1 text-[11px] text-text-muted">
              <Icon size={12} style={{ color: meta.color }} />
              <span className="max-w-[160px] truncate">{node.label}</span>
            </span>
            {i < shown.length - 1 && <ArrowRight size={12} className="text-text-faint" />}
          </span>
        );
      })}
      {extra > 0 && <span className="font-mono text-[11px] text-text-faint">+{extra} more</span>}
    </div>
  );
}

/* ---------------- Active / Paused toggle switch ---------------- */
function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} onClick={onToggle}
      className={cn("relative h-6 w-11 shrink-0 rounded-pill border transition-colors", on ? "border-transparent bg-positive" : "border-border bg-surface-inset")}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 520, damping: 34 }} className={cn("absolute top-0.5 rounded-full bg-white shadow-sm", on ? "right-0.5" : "left-0.5")} style={{ height: 18, width: 18 }} />
    </button>
  );
}

/* ---------------- Page ---------------- */
export default function AutomationsPage() {
  const workflows = useClientWorkflows();
  const createWorkflow = useStore((s) => s.createWorkflow);
  const toggleWorkflow = useStore((s) => s.toggleWorkflow);
  const runWorkflow = useStore((s) => s.runWorkflow);
  const restoreWorkflows = useStore((s) => s.restoreWorkflows);

  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [flow, setFlow] = useState<{ name: string; nodes: WorkflowNode[] } | null>(null);

  // bring back any workflows saved in a previous session
  useEffect(() => { restoreWorkflows(); }, [restoreWorkflows]);

  const activeCount = workflows.filter((w) => w.active).length;
  const totalRuns = workflows.reduce((sum, w) => sum + w.runs, 0);

  const runGenerate = () => {
    setGenerating(true);
    setFlow(null);
    setTimeout(() => { setFlow(generateFlow(input)); setGenerating(false); }, 700);
  };

  const saveAutomation = () => {
    if (!flow) return;
    // persist to the store AND fire it once so you can watch it act (Activity + Approvals)
    const id = createWorkflow(flow.name, flow.nodes);
    runWorkflow(id);
    setFlow(null);
    setInput("");
    toast.success(`“${flow.name}” is live — it just ran once. Check Activity & Approvals.`);
  };

  return (
    <PageContainer>
      <PageHeader
        kicker="Natural-language automation"
        title="Automations"
        description="Describe a workflow in plain English — RelationOS builds the trigger, conditions and actions, then runs them. Each run posts to the live Activity feed and drafts buyer messages into Approvals."
        actions={
          <div className="flex items-center gap-2">
            <Pill variant="positive" mono><StatusDot color="var(--positive)" pulse size={7} /> {activeCount} active</Pill>
            <Pill variant="neutral" mono><AnimatedNumber value={totalRuns} /> runs</Pill>
          </div>
        }
      />

      {/* ---------- NL builder ---------- */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent-soft text-accent"><Wand2 size={16} strokeWidth={2.2} /></span>
          <div>
            <Label>Workflow builder</Label>
            <div className="font-display text-[15px] font-bold leading-tight text-text">Describe it, we build it</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <textarea
            value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Describe a workflow… e.g. Create a collections workflow for overdue accounts"
            rows={2}
            className="min-h-[64px] flex-1 resize-none rounded-[12px] border border-border bg-surface-2 px-3.5 py-3 text-sm leading-relaxed text-text placeholder:text-text-faint focus:border-border-strong"
          />
          <button type="button" onClick={runGenerate} disabled={generating} className="flex h-[44px] shrink-0 items-center justify-center gap-1.5 self-end rounded-[10px] bg-accent px-5 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:hover:scale-100 sm:h-auto">
            <Sparkles size={16} strokeWidth={2.4} />{generating ? "Generating…" : "Generate"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wide text-text-faint">Try</span>
          {WORKFLOW_EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setInput(ex)} className="rounded-pill border border-border bg-surface-2 px-3 py-1 text-[12px] text-text-muted transition-colors hover:border-border-strong hover:text-text">{ex}</button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {generating && (
            <motion.div key="building" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 flex items-center gap-2 rounded-[12px] border border-dashed border-border bg-surface-2 px-4 py-5 text-sm text-text-muted">
              <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }} className="text-accent"><Sparkles size={16} /></motion.span>
              Building your automation…
            </motion.div>
          )}
          {!generating && flow && (
            <motion.div key="result" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 rounded-[14px] border border-border bg-surface-2 p-4">
              <div className="mb-3.5 flex flex-wrap items-center gap-2">
                <Workflow size={15} className="text-accent" />
                <span className="font-display text-[15px] font-bold tracking-tight text-text">{flow.name}</span>
                <Pill variant="accent" mono className="ml-1">{flow.nodes.length} steps</Pill>
                <button type="button" onClick={saveAutomation} className="ml-auto flex h-9 items-center gap-1.5 rounded-[10px] bg-accent px-3.5 text-[13px] font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95">
                  <Power size={14} strokeWidth={2.4} /> Save &amp; activate
                </button>
              </div>
              <GeneratedFlow nodes={flow.nodes} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* ---------- Existing workflows ---------- */}
      <div className="mb-3 mt-8 flex items-center gap-2">
        <ListChecks size={15} className="text-accent" />
        <Label>Active workflows</Label>
        <span className="tabular ml-1 rounded-pill bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-muted">{workflows.length}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AnimatePresence initial={false}>
          {workflows.map((wf, i) => (
            <motion.div key={wf.id} layout initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 340, damping: 32, delay: i * 0.03 }} className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]" style={{ background: wf.active ? "color-mix(in oklab, var(--positive) 16%, transparent)" : "var(--surface-inset)", color: wf.active ? "var(--positive)" : "var(--text-faint)" }}>
                    <Workflow size={19} strokeWidth={2.1} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-display text-[15px] font-bold leading-tight text-text">{wf.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Pill variant={wf.active ? "positive" : "neutral"} mono>
                        <StatusDot color={wf.active ? "var(--positive)" : "var(--text-faint)"} pulse={wf.active} size={6} />
                        {wf.active ? "Active" : "Paused"}
                      </Pill>
                    </div>
                  </div>
                </div>
                <Switch on={wf.active} onToggle={() => { toggleWorkflow(wf.id); toast.success(`${wf.name} · ${wf.active ? "Paused" : "Active"}`); }} />
              </div>

              <div className="mt-3.5"><FlowChain nodes={wf.nodes} /></div>

              <div className="mt-3.5 flex items-center gap-4 border-t border-border pt-3 text-[12px] text-text-muted">
                <span className="flex items-center gap-1.5"><Zap size={12} className="text-text-faint" /><span className="tabular font-mono">{wf.runs.toLocaleString("en-IN")}</span> runs</span>
                <span className="flex items-center gap-1.5"><Clock size={12} className="text-text-faint" />last run <span className="tabular">{relativeTime(wf.lastRun)}</span></span>
                <button
                  type="button"
                  disabled={!wf.active}
                  onClick={() => { runWorkflow(wf.id); toast.success(`${wf.name} ran — posted to Activity${/send|message|reminder|welcome|re-engage|reschedule|payment/i.test(wf.nodes.map((n) => n.label).join(" ")) ? " + drafted into Approvals" : ""}`); }}
                  className="ml-auto flex items-center gap-1.5 rounded-[8px] border border-border bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-text transition-colors hover:border-border-strong hover:bg-surface-inset disabled:opacity-40 disabled:hover:bg-surface-2"
                >
                  <Play size={12} /> Run now
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </PageContainer>
  );
}
