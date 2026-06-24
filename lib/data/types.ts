// ============================================================
// RelationOS — Real Estate Edition · domain model
// Chat-first, self-driving CRM for Indian real-estate sales.
// Production-shaped types; the demo fills them from the seed,
// the real RelationOS API re-implements DataSource against them.
// ============================================================

/** Where a buyer first came from (capture source). */
export type Source =
  | "99acres"
  | "magicbricks"
  | "housing"
  | "whatsapp"
  | "ivr"
  | "website"
  | "walkin"
  | "referral";

export const SOURCES: Source[] = [
  "99acres",
  "magicbricks",
  "housing",
  "whatsapp",
  "ivr",
  "website",
  "walkin",
  "referral",
];

export const SOURCE_LABEL: Record<Source, string> = {
  "99acres": "99acres",
  magicbricks: "MagicBricks",
  housing: "Housing.com",
  whatsapp: "WhatsApp",
  ivr: "Missed call",
  website: "Website",
  walkin: "Walk-in",
  referral: "Referral",
};

/** A conversation channel (how a message arrived). */
export type Channel = "whatsapp" | "call" | "email" | "sms" | "web";
export const CHANNELS: Channel[] = ["whatsapp", "call", "email", "sms", "web"];
export const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  call: "Call",
  email: "Email",
  sms: "SMS",
  web: "Web chat",
};

export type Config = "1BHK" | "2BHK" | "3BHK" | "4BHK" | "Villa" | "Plot";
export const CONFIGS: Config[] = ["1BHK", "2BHK", "3BHK", "4BHK", "Villa", "Plot"];

export type Possession = "ready" | "under-construction" | "either";
export const POSSESSION_LABEL: Record<Possession, string> = {
  ready: "Ready to move",
  "under-construction": "Under construction",
  either: "Either",
};

export type LoanStatus = "not needed" | "pre-approved" | "in process" | "needs help";

/** Site-visit-centric pipeline. */
export type Stage =
  | "New Enquiry"
  | "Qualified"
  | "Site Visit Scheduled"
  | "Site Visit Completed"
  | "Unit Selected"
  | "Booking Amount Paid"
  | "Booking Confirmed"
  | "Agreement Signed"
  | "Loan Sanction"
  | "Registration"
  | "Handover";

export const STAGES: Stage[] = [
  "New Enquiry",
  "Qualified",
  "Site Visit Scheduled",
  "Site Visit Completed",
  "Unit Selected",
  "Booking Amount Paid",
  "Booking Confirmed",
  "Agreement Signed",
  "Loan Sanction",
  "Registration",
  "Handover",
];

/** A site visit has happened (or is at least scheduled). */
export const VISITED_STAGES: Stage[] = [
  "Site Visit Scheduled", "Site Visit Completed", "Unit Selected", "Booking Amount Paid",
  "Booking Confirmed", "Agreement Signed", "Loan Sanction", "Registration", "Handover",
];
/** Counts as a booking — the booking amount has been paid (token) onward. */
export const BOOKED_STAGES: Stage[] = [
  "Booking Amount Paid", "Booking Confirmed", "Agreement Signed", "Loan Sanction", "Registration", "Handover",
];
export const isBooked = (s: Stage) => BOOKED_STAGES.includes(s);
export const isVisited = (s: Stage) => VISITED_STAGES.includes(s);

/** Lead temperature / interest (PRD §2.1) — a classification layered over the journey stages. */
export type Interest = "New" | "Hot" | "Warm" | "Cold" | "Interested" | "Not Interested";
export const INTERESTS: Interest[] = ["New", "Hot", "Warm", "Cold", "Interested", "Not Interested"];
export function interestOf(b: { isNew?: boolean; stage: Stage; stalled: boolean; siteVisitDue?: number; score: number }): Interest {
  if (b.isNew || b.stage === "New Enquiry") return "New";
  if (b.stalled) return "Not Interested";
  if (b.siteVisitDue) return "Interested"; // a visit is lined up — actively engaged
  if (b.score >= 75) return "Hot";
  if (b.score >= 58) return "Warm";
  return "Cold";
}

export type SignalCategory =
  | "Budget fit"
  | "Config & locality match"
  | "Engagement"
  | "Site-visit intent"
  | "Loan readiness";

export const SIGNAL_CATEGORIES: SignalCategory[] = [
  "Budget fit",
  "Config & locality match",
  "Engagement",
  "Site-visit intent",
  "Loan readiness",
];

export const LOCALITIES = [
  "Kokapet",
  "Gachibowli",
  "Narsingi",
  "Tellapur",
  "Kondapur",
  "Manikonda",
  "Financial District",
  "Nanakramguda",
];

// ============================================================
// Org & tenancy: Super-admin (platform) → Client → Manager → Agent
// ============================================================
export type Role = "super-admin" | "manager" | "agent" | "telecaller";

export const ROLE_LABEL: Record<Role, string> = {
  "super-admin": "Super-admin",
  manager: "Manager",
  agent: "Agent",
  telecaller: "Telecaller",
};

/** A client company (tenant) using RelationOS. */
export interface Client {
  id: string;
  name: string;
  city: string;
  hue: number;
  plan: string; // "Growth" / "Scale" / "Enterprise"
}

export interface Team {
  id: string;
  clientId: string;
  name: string;
  managerId: string;
}

/** Any human in the org: the platform super-admin, a client manager, or a sales agent. */
export interface OrgUser {
  id: string;
  name: string;
  initials: string;
  hue: number;
  role: Role;
  clientId?: string; // super-admin has none
  teamId?: string; // agents belong to a team
  title: string;
  target?: number; // monthly booking target (agents)
  email?: string; // sign-in identity (demo)
}

export interface ScoreReason {
  id: string;
  text: string;
  polarity: "positive" | "negative";
  weight: number;
  category: SignalCategory;
  sourceMessageId: string;
  sourceQuote: string;
}

export interface ProfileField {
  id: string;
  label: string; // Budget · Config · Locality · Possession · Loan
  value: string;
  sourceMessageId: string;
  sourceQuote: string;
  justCrystallized?: boolean;
}

export interface TranscriptLine {
  id: string;
  speaker: "agent" | "buyer" | "ai";
  t: string;
  text: string;
}

export interface Message {
  id: string;
  clientId: string;
  buyerId: string;
  channel: Channel;
  direction: "inbound" | "outbound";
  timestamp: number;
  subject?: string;
  body: string;
  summary?: string;
  durationSec?: number;
  transcript?: TranscriptLine[];
  handledBy?: "ai" | "agent";
  isLive?: boolean;
}

export interface Buyer {
  id: string;
  clientId: string;
  name: string;
  phone: string;
  source: Source;
  config: Config; // wanted
  budgetMin: number; // INR
  budgetMax: number; // INR
  localityPrefs: string[];
  possession: Possession;
  loanStatus: LoanStatus;
  hue: number;
  score: number;
  prevScore: number;
  scoreReasons: ScoreReason[];
  profile: ProfileField[];
  channelsUsed: Channel[];
  stalled: boolean;
  siteVisitDue?: number; // ms epoch of a scheduled/overdue visit
  agentId: string;
  agent: string;
  agentInitials: string;
  stage: Stage;
  lastTouch: number;
  signals: Record<SignalCategory, number>;
  weights: Record<SignalCategory, number>;
  scoreHistory: { label: string; score: number }[];
  matchedUnitIds: string[];
  followUpAt?: number; // next scheduled follow-up (ms epoch) — drives the SLA / overdue flag
  isNew?: boolean;
}

/** A requirement string like "3BHK · Kokapet · ₹1.3–1.4 Cr". */
export type Availability = "available" | "blocked" | "booked" | "sold";

export interface Project {
  id: string;
  clientId: string;
  name: string;
  builder: string;
  reraNo: string;
  locality: string;
  status: "ready" | "under-construction";
  possessionDate: string; // e.g. "Dec 2026" or "Ready"
  amenities: string[];
  towers: number;
}

export interface Unit {
  id: string;
  clientId: string;
  projectId: string;
  tower: string;
  unitNo: string;
  config: Config;
  carpetAreaSqft: number;
  priceInr: number;
  floor: number;
  facing: string;
  availability: Availability;
}

export interface Deal {
  id: string;
  clientId: string;
  buyerId: string;
  unitId?: string;
  name: string; // buyer
  project: string;
  unitLabel: string; // e.g. "Tower B · 3BHK"
  valueInr: number;
  stage: Stage;
  tokenInr?: number;
  closeDate: number;
  stalled: boolean;
  noShow: boolean;
  agentId: string;
  agentInitials: string;
  hue: number;
  suggestion?: { toStage: Stage; reason: string };
}

export type ReviewKind =
  | "outbound"
  | "new-lead"
  | "sequence"
  | "stage-move"
  | "field-update"
  | "duplicate";

export interface ReviewItem {
  id: string;
  clientId: string;
  agentId: string;
  leadId: string; // "L-2041"
  kind: ReviewKind;
  title: string;
  why: string; // why the AI is proposing this
  body: string; // the drafted message / extracted detail
  attachment?: string; // "RERA no. + receipt terms attached · cleared"
  autonomyLabel: string; // "L1 — needs your nod"
  cta: string; // primary action label
  source: Source;
  channel?: Channel;
  confidence: number;
  buyerName: string;
  hue: number;
  // for duplicate merges
  mergeFrom?: { source: Source; label: string };
  mergeInto?: { source: Source; label: string };
}

export type ConnectorStatus = "connected" | "token-expiring" | "error" | "disconnected";
export interface Connector {
  id: string;
  name: string;
  source: Source;
  status: ConnectorStatus;
  detail: string;
}

/** A live buyer conversation the Customer AI Concierge is handling. */
export type ConciergeStatus =
  | "qualifying"
  | "matched"
  | "visit-booked"
  | "handed-off";

export interface ConciergeChat {
  id: string;
  clientId: string;
  agentId: string; // the agent who owns this conversation
  channel: Channel; // WhatsApp / call / email / sms / web — the inbox is omni-channel
  buyerName: string;
  phone: string;
  hue: number;
  source: Source;
  status: ConciergeStatus;
  intent: string; // "3BHK · Kokapet · ₹1.3–1.4 Cr"
  messages: { from: "buyer" | "ai"; text: string }[];
  offeredUnitIds: string[];
  siteVisitAt?: string; // "Sat 11:00 AM"
  score?: number;
  startedAt: number;
}

export type ActivityKind =
  | "enquiry"
  | "call"
  | "whatsapp"
  | "sitevisit"
  | "booking"
  | "score"
  | "lead";

export interface ActivityEvent {
  id: string;
  clientId: string;
  kind: ActivityKind;
  text: string;
  meta?: string;
  timestamp: number;
}

/** A lead captured by the AI while the team was offline (overnight). */
export interface OvernightLead {
  id: string;
  clientId: string;
  agentId: string;
  buyerId: string;
  name: string;
  hue: number;
  channel: Channel;
  source: Source;
  capturedLabel: string; // "2:14 AM"
  requirement: string; // "3BHK · Kokapet · ₹1.4 Cr"
  score: number;
  status: "new" | "qualified" | "visit-booked";
  aiSummary: string;
  reasons: string[];
  action: string; // primary action label
}

/** Summary of what the AI did between close (10 PM) and open (9 AM). */
export interface MorningBrief {
  window: string; // "10:00 PM → 9:00 AM"
  conversations: number;
  channels: number;
  leadsCreated: number;
  needNod: number;
  visitsBooked: number;
  fieldsAutoFilled: number;
  actionsDrafted: number;
}

export interface Analytics {
  funnel: { stage: string; count: number }[];
  sourceROI: { source: Source; enquiries: number; bookings: number; rate: number }[];
  agents: { name: string; initials: string; bookings: number; visits: number; conversion: number; hue: number }[];
  health: { capturePrecision: number; aiHandledShare: number; dedupeRate: number };
  bookingTrend: { week: string; bookings: number; visits: number }[];
}

// ============================================================
// Cab / Site-Visit logistics
// ============================================================
export type CabStatus = "idle" | "assigned" | "pickup" | "en-route" | "at-site" | "completed";
export const CAB_FLOW: CabStatus[] = ["assigned", "pickup", "en-route", "at-site", "completed"];
export const CAB_STATUS_LABEL: Record<CabStatus, string> = {
  idle: "Idle",
  assigned: "Assigned",
  pickup: "Pickup",
  "en-route": "En route",
  "at-site": "At site",
  completed: "Completed",
};

export interface Driver {
  id: string;
  clientId: string;
  name: string;
  phone: string;
  rating: number;
}

export interface Cab {
  id: string;
  clientId: string;
  model: string;
  plate: string;
  seats: number;
  driverId: string;
  status: CabStatus;
}

export interface CabBooking {
  id: string;
  clientId: string;
  cabId: string;
  buyerId: string;
  buyerName: string;
  project: string;
  pickup: string;
  scheduledAt: number; // ms epoch
  status: CabStatus;
  etaMin?: number;
  agentInitials: string;
}

// ============================================================
// Automations (natural-language workflows)
// ============================================================
export type WorkflowNodeType = "trigger" | "condition" | "action";
export interface WorkflowNode {
  type: WorkflowNodeType;
  label: string;
}
export interface Workflow {
  id: string;
  clientId: string;
  name: string;
  nodes: WorkflowNode[];
  active: boolean;
  runs: number;
  lastRun: number; // ms epoch
}

/** A real task/reminder (e.g. auto-created from a meeting's action items). */
export interface CrmTask {
  id: string;
  clientId: string;
  agentId: string;
  buyerId: string;
  title: string;
  dueAt: number; // ms epoch
  priority: "High" | "Medium" | "Low";
  source: string; // e.g. "From a site-visit meeting"
  done: boolean;
}

/** Autonomy = how far the Customer AI Concierge can act on its own. */
export const AUTONOMY_LEVELS = [
  { level: 0, label: "Answer only", blurb: "Replies to project FAQs. Doesn't qualify or book." },
  { level: 1, label: "Qualify", blurb: "Asks budget, config and locality; scores the buyer." },
  { level: 2, label: "Suggest visit", blurb: "Proposes site-visit slots for the agent to confirm." },
  { level: 3, label: "Book visits", blurb: "Books site visits into the agent's calendar unattended." },
  { level: 4, label: "Autopilot", blurb: "Qualifies, books, nudges and reschedules end-to-end." },
] as const;
