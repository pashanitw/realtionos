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
  | "Visited"
  | "Negotiation"
  | "Booked"
  | "Registered";

export const STAGES: Stage[] = [
  "New Enquiry",
  "Qualified",
  "Site Visit Scheduled",
  "Visited",
  "Negotiation",
  "Booked",
  "Registered",
];

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
  agent: string;
  agentInitials: string;
  stage: Stage;
  lastTouch: number;
  signals: Record<SignalCategory, number>;
  weights: Record<SignalCategory, number>;
  scoreHistory: { label: string; score: number }[];
  matchedUnitIds: string[];
  isNew?: boolean;
}

/** A requirement string like "3BHK · Kokapet · ₹1.3–1.4 Cr". */
export type Availability = "available" | "blocked" | "booked" | "sold";

export interface Project {
  id: string;
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
  agentInitials: string;
  hue: number;
  suggestion?: { toStage: Stage; reason: string };
}

export type ReviewKind = "new-lead" | "field-update" | "duplicate" | "auto-action";

export interface ReviewItem {
  id: string;
  kind: ReviewKind;
  title: string;
  detail: string;
  source: Source;
  sourceExcerpt: string;
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
  kind: ActivityKind;
  text: string;
  meta?: string;
  timestamp: number;
}

export interface Analytics {
  funnel: { stage: string; count: number }[];
  sourceROI: { source: Source; enquiries: number; bookings: number; rate: number }[];
  agents: { name: string; initials: string; bookings: number; visits: number; hue: number }[];
  health: { capturePrecision: number; aiHandledShare: number; dedupeRate: number };
  bookingTrend: { week: string; bookings: number; visits: number }[];
}

/** Autonomy = how far the Customer AI Concierge can act on its own. */
export const AUTONOMY_LEVELS = [
  { level: 0, label: "Answer only", blurb: "Replies to project FAQs. Doesn't qualify or book." },
  { level: 1, label: "Qualify", blurb: "Asks budget, config and locality; scores the buyer." },
  { level: 2, label: "Suggest visit", blurb: "Proposes site-visit slots for the agent to confirm." },
  { level: 3, label: "Book visits", blurb: "Books site visits into the agent's calendar unattended." },
  { level: 4, label: "Autopilot", blurb: "Qualifies, books, nudges and reschedules end-to-end." },
] as const;
