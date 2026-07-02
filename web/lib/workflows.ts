import { SEED_NOW } from "./utils";
import type { Workflow, WorkflowNode } from "./data/types";

/* Deterministic hash (no Math.random) */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

export function titleCase(input: string): string {
  const words = input.trim().replace(/[^a-zA-Z0-9 ]+/g, " ").split(/\s+/).filter(Boolean).slice(0, 5);
  if (words.length === 0) return "Custom automation";
  return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

/** Pure keyword → workflow generator. Same logic the builder shows. */
export function generateFlow(input: string): { name: string; nodes: WorkflowNode[] } {
  const q = input.toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => q.includes(k));

  let nodes: WorkflowNode[];
  let defaultName: string;

  if (has("collection", "overdue", "payment")) {
    defaultName = "Overdue collections";
    nodes = [
      { type: "trigger", label: "Payment overdue > 7 days" },
      { type: "condition", label: "Booking amount unpaid" },
      { type: "action", label: "Send WhatsApp payment reminder" },
      { type: "action", label: "Create follow-up task for agent" },
      { type: "action", label: "Escalate to manager if unpaid > 14d" },
    ];
  } else if (has("welcome", "new lead")) {
    defaultName = "New-lead welcome";
    nodes = [
      { type: "trigger", label: "New lead captured" },
      { type: "action", label: "Send welcome WhatsApp" },
      { type: "action", label: "Auto-assign to an agent" },
      { type: "action", label: "Schedule intro call within 2h" },
    ];
  } else if (has("no-show", "no show", "re-engage", "re engage", "reengage")) {
    defaultName = "No-show re-engagement";
    nodes = [
      { type: "trigger", label: "Site visit marked no-show" },
      { type: "condition", label: "No reply for 2 days" },
      { type: "action", label: "Send re-engagement message" },
      { type: "action", label: "Offer to reschedule the visit" },
      { type: "action", label: "Lower lead temperature" },
    ];
  } else if (has("cold", "hot lead", "score")) {
    defaultName = "Hot-lead drop alert";
    nodes = [
      { type: "trigger", label: "Lead score drops below 50" },
      { type: "condition", label: "Was Hot in last 7 days" },
      { type: "action", label: "Alert the manager" },
      { type: "action", label: "Create a priority callback task" },
    ];
  } else {
    defaultName = "Custom automation";
    nodes = [
      { type: "trigger", label: "Custom event" },
      { type: "action", label: "Notify the team" },
      { type: "action", label: "Log to timeline" },
    ];
  }

  const name = input.trim() ? titleCase(input) : defaultName;
  return { name, nodes };
}

export const WORKFLOW_EXAMPLES = [
  "Create a collections workflow for overdue accounts",
  "Welcome new leads on WhatsApp",
  "Re-engage site-visit no-shows after 2 days",
  "Alert the manager when a hot lead goes cold",
];

/** The starter automations every client ships with. */
export function seedWorkflows(clientId: string): Workflow[] {
  return WORKFLOW_EXAMPLES.map((p, i) => {
    const { name, nodes } = generateFlow(p);
    const h = hash(p);
    return {
      id: `${clientId}-wf${i + 1}`,
      clientId,
      name,
      nodes,
      active: i !== 2, // one paused for variety, deterministic
      runs: 40 + (h % 360),
      lastRun: SEED_NOW - i * 86_400_000 - (h % 18) * 3_600_000,
    };
  });
}

/** A buyer-facing message body for a workflow's run (drafted into Approvals). */
export function workflowMessage(actionLabel: string, firstName: string, config: string, locality: string, agent: string): string {
  const l = actionLabel.toLowerCase();
  if (/payment|collection|overdue/.test(l))
    return `Hi ${firstName}, a gentle reminder — the booking payment for your ${config} is still pending. Here's the secure link to complete it today. — ${agent}`;
  if (/welcome|new/.test(l))
    return `Hi ${firstName}, welcome! Thanks for your interest in our ${config} homes in ${locality}. When's a good time for a quick call to share options? — ${agent}`;
  if (/re-engage|no-show|reschedule|reengage/.test(l))
    return `Hi ${firstName}, sorry we missed you for the site visit. Shall I reschedule for this weekend? I can arrange a cab for pickup. — ${agent}`;
  return `Hi ${firstName}, quick update on your ${config} in ${locality} — I'd love to take the next step with you. — ${agent}`;
}
