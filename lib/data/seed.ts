import { faker } from "@faker-js/faker";
import {
  type Buyer,
  type Message,
  type ScoreReason,
  type ProfileField,
  type Project,
  type Unit,
  type Deal,
  type ReviewItem,
  type Connector,
  type ConciergeChat,
  type ActivityEvent,
  type Analytics,
  type Channel,
  type Config,
  type SignalCategory,
  type Source,
  type Stage,
  type Availability,
  type TranscriptLine,
  STAGES,
  LOCALITIES,
} from "./types";
import { computeScore, DEFAULT_WEIGHTS } from "./scoring";
import { SEED_NOW } from "../utils";

const NOW = SEED_NOW;
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const CRORE = 10_000_000;
const LAKH = 100_000;

// ---------- people ----------
const BUYER_NAMES = [
  "Rohan Mehta", "Priya Iyer", "Anjali Reddy", "Vikram Nair", "Sandeep Kumar",
  "Sneha Rao", "Arjun Menon", "Kavya Sharma", "Rahul Verma", "Deepa Nair",
  "Karthik Reddy", "Meera Pillai", "Aditya Joshi", "Nisha Gupta", "Suresh Babu",
  "Lakshmi Narayan", "Faisal Khan", "Pooja Desai", "Manish Agarwal", "Divya Krishnan",
];
const AGENTS = ["Suresh Kumar", "Anita Rao", "Vimal Shetty", "Reshma Khan", "Karan Mehta"];

// ---------- quotable lines, mapped to category + field ----------
type Quote = {
  text: string;
  category: SignalCategory;
  polarity: "positive" | "negative";
  reason: string;
  field?: { label: string; value: string };
};

const POSITIVE: Quote[] = [
  {
    text: "Our budget's set at around 1.4 crore and the home loan is pre-approved.",
    category: "Budget fit",
    polarity: "positive",
    reason: "Budget confirmed (~₹1.4 Cr) with loan pre-approved",
    field: { label: "Budget", value: "₹1.4 Cr · loan pre-approved" },
  },
  {
    text: "We specifically want a 3BHK in Kokapet — nothing else really works for us.",
    category: "Config & locality match",
    polarity: "positive",
    reason: "Clear, matchable requirement — 3BHK in Kokapet",
    field: { label: "Requirement", value: "3BHK · Kokapet" },
  },
  {
    text: "Can we visit this Saturday? We're keen to close fast.",
    category: "Site-visit intent",
    polarity: "positive",
    reason: "Asked to book a site visit this weekend",
    field: { label: "Next step", value: "Book site visit" },
  },
  {
    text: "We want ready-to-move — possession can't wait beyond this year.",
    category: "Loan readiness",
    polarity: "positive",
    reason: "Ready-to-move requirement with firm timeline",
    field: { label: "Possession", value: "Ready-to-move" },
  },
  {
    text: "Thanks for the quick reply — the floor plan and the east-facing unit look great.",
    category: "Engagement",
    polarity: "positive",
    reason: "Highly engaged — responding fast, reviewing floor plans",
  },
  {
    text: "If the east-facing unit is still available we'll put down the token.",
    category: "Site-visit intent",
    polarity: "positive",
    reason: "Token-ready on the right unit",
    field: { label: "Intent", value: "Token-ready" },
  },
];

const NEGATIVE: Quote[] = [
  {
    text: "We're just starting to look, honestly no rush right now.",
    category: "Site-visit intent",
    polarity: "negative",
    reason: "Early-stage browsing — no urgency yet",
    field: { label: "Next step", value: "Nurture" },
  },
  {
    text: "Anything above 1.1 crore is going to be a stretch for us.",
    category: "Budget fit",
    polarity: "negative",
    reason: "Budget below typical inventory in this locality",
  },
  {
    text: "We need to sort out the home loan first before committing to anything.",
    category: "Loan readiness",
    polarity: "negative",
    reason: "Loan not arranged — financing is a blocker",
    field: { label: "Loan", value: "Not arranged" },
  },
  {
    text: "Couldn't make it to the site last weekend, something came up.",
    category: "Engagement",
    polarity: "negative",
    reason: "Missed a scheduled site visit (no-show)",
  },
];

const PROJECTS_SEED: Omit<Project, "id">[] = [
  { name: "Aurum Heights", builder: "Aparna Constructions", reraNo: "P02400004821", locality: "Kokapet", status: "ready", possessionDate: "Ready", amenities: ["Clubhouse", "Pool", "Gym", "Kids' play"], towers: 4 },
  { name: "Lakeside Residences", builder: "My Home Group", reraNo: "P02400005934", locality: "Narsingi", status: "under-construction", possessionDate: "Dec 2026", amenities: ["Lake view", "Sky lounge", "Pool"], towers: 6 },
  { name: "Greenfield Enclave", builder: "Rajapushpa Properties", reraNo: "P02400006102", locality: "Tellapur", status: "under-construction", possessionDate: "Jun 2027", amenities: ["Central park", "Clubhouse", "EV charging"], towers: 5 },
  { name: "Riverdale Heights", builder: "Prestige Group", reraNo: "P02400003345", locality: "Gachibowli", status: "ready", possessionDate: "Ready", amenities: ["Clubhouse", "Tennis", "Pool"], towers: 3 },
  { name: "Maple Woods", builder: "Vasavi Group", reraNo: "P02400004410", locality: "Kondapur", status: "ready", possessionDate: "Ready", amenities: ["Gym", "Jogging track"], towers: 2 },
  { name: "Skyline Towers", builder: "Sumadhura", reraNo: "P02400007781", locality: "Financial District", status: "under-construction", possessionDate: "Mar 2027", amenities: ["Sky deck", "Co-work", "Pool"], towers: 4 },
];

const CONFIG_AREA: Record<Config, [number, number]> = {
  "1BHK": [620, 720],
  "2BHK": [1050, 1280],
  "3BHK": [1480, 1820],
  "4BHK": [2300, 2800],
  Villa: [3200, 4200],
  Plot: [1800, 2400],
};
const CONFIG_PRICE: Record<Config, [number, number]> = {
  "1BHK": [0.55 * CRORE, 0.78 * CRORE],
  "2BHK": [0.82 * CRORE, 1.15 * CRORE],
  "3BHK": [1.2 * CRORE, 1.7 * CRORE],
  "4BHK": [1.9 * CRORE, 2.6 * CRORE],
  Villa: [2.8 * CRORE, 4.5 * CRORE],
  Plot: [0.9 * CRORE, 1.6 * CRORE],
};
const FACINGS = ["East", "North-East", "West", "North", "South-East"];

function pickN<T>(arr: T[], n: number): T[] {
  return faker.helpers.arrayElements(arr, n);
}
function round5L(n: number) {
  return Math.round(n / (5 * LAKH)) * 5 * LAKH;
}

function buildUnits(projects: Project[]): Unit[] {
  const units: Unit[] = [];
  let u = 0;
  for (const p of projects) {
    const configs: Config[] = faker.helpers.arrayElements(["2BHK", "3BHK", "4BHK", "Villa"], 3) as Config[];
    const count = faker.number.int({ min: 7, max: 10 });
    for (let i = 0; i < count; i++) {
      const config = faker.helpers.arrayElement(configs);
      const [aMin, aMax] = CONFIG_AREA[config];
      const [pMin, pMax] = CONFIG_PRICE[config];
      const avail = faker.helpers.weightedArrayElement<Availability>([
        { weight: 5, value: "available" },
        { weight: 2, value: "blocked" },
        { weight: 2, value: "booked" },
        { weight: 1, value: "sold" },
      ]);
      units.push({
        id: `u${++u}`,
        projectId: p.id,
        tower: faker.helpers.arrayElement(["Tower A", "Tower B", "Tower C", "Tower D"]),
        unitNo: `${faker.number.int({ min: 4, max: 22 })}0${faker.number.int({ min: 1, max: 4 })}`,
        config,
        carpetAreaSqft: faker.number.int({ min: aMin, max: aMax }),
        priceInr: round5L(faker.number.float({ min: pMin, max: pMax })),
        floor: faker.number.int({ min: 4, max: 24 }),
        facing: faker.helpers.arrayElement(FACINGS),
        availability: avail,
      });
    }
  }
  return units;
}

function buildBuyer(
  i: number,
  tone: "hot" | "warm" | "cool",
): { buyer: Buyer; messages: Message[] } {
  const id = `b${i + 1}`;
  const name = BUYER_NAMES[i % BUYER_NAMES.length];
  const agent = faker.helpers.arrayElement(AGENTS);
  const hue = faker.number.int({ min: 0, max: 360 });
  const config = faker.helpers.weightedArrayElement<Config>([
    { weight: 4, value: "3BHK" },
    { weight: 3, value: "2BHK" },
    { weight: 1, value: "4BHK" },
    { weight: 1, value: "Villa" },
  ]);
  const [pMin, pMax] = CONFIG_PRICE[config];
  const budgetMax = round5L(faker.number.float({ min: pMin * 1.0, max: pMax * 1.05 }));
  const budgetMin = round5L(budgetMax * 0.86);
  const localityPrefs = faker.helpers.arrayElements(LOCALITIES, faker.number.int({ min: 1, max: 2 }));
  const source = faker.helpers.weightedArrayElement<Source>([
    { weight: 5, value: "99acres" },
    { weight: 3, value: "magicbricks" },
    { weight: 3, value: "whatsapp" },
    { weight: 2, value: "housing" },
    { weight: 2, value: "ivr" },
    { weight: 1, value: "website" },
    { weight: 1, value: "referral" },
  ]);

  const posCount = tone === "hot" ? 4 : tone === "warm" ? 3 : 1;
  const negCount = tone === "hot" ? 0 : tone === "warm" ? 1 : 2;
  const quotes = faker.helpers.shuffle([...pickN(POSITIVE, posCount), ...pickN(NEGATIVE, negCount)]);

  const channels = faker.helpers.arrayElements<Channel>(
    ["whatsapp", "call", "email", "sms", "web"],
    faker.number.int({ min: 2, max: 4 }),
  );
  if (!channels.includes("whatsapp")) channels.unshift("whatsapp");

  const messages: Message[] = [];
  const reasons: ScoreReason[] = [];
  const fields: ProfileField[] = [];
  let qIdx = 0;
  let mIdx = 0;

  const consume = (count: number, msgId: string) => {
    const used: Quote[] = [];
    for (let k = 0; k < count && qIdx < quotes.length; k++) {
      const q = quotes[qIdx++];
      used.push(q);
      reasons.push({
        id: `${id}-r${reasons.length + 1}`,
        text: q.reason,
        polarity: q.polarity,
        weight: q.polarity === "positive" ? faker.number.int({ min: 6, max: 14 }) : -faker.number.int({ min: 5, max: 11 }),
        category: q.category,
        sourceMessageId: msgId,
        sourceQuote: q.text,
      });
      if (q.field && !fields.some((f) => f.label === q.field!.label)) {
        fields.push({
          id: `${id}-f${fields.length + 1}`,
          label: q.field.label,
          value: q.field.value,
          sourceMessageId: msgId,
          sourceQuote: q.text,
        });
      }
    }
    return used;
  };

  // WhatsApp enquiry (oldest, first touch)
  const waId = `${id}-m${++mIdx}`;
  const waQuotes = consume(2, waId);
  messages.push({
    id: waId,
    buyerId: id,
    channel: "whatsapp",
    direction: "inbound",
    timestamp: NOW - faker.number.int({ min: 3, max: 8 }) * DAY,
    body:
      `Hi, saw the ${config} listing. ` +
      waQuotes.map((q) => q.text).join(" "),
    summary: "Inbound portal enquiry — qualifying interest.",
    handledBy: "ai",
  });

  // Call with transcript
  if (channels.includes("call")) {
    const callId = `${id}-m${++mIdx}`;
    const callQuotes = consume(2, callId);
    const lines: TranscriptLine[] = [
      { id: "", speaker: "agent", t: "00:05", text: "Hi, thanks for your enquiry — happy to help you find the right home." },
      { id: "", speaker: "buyer", t: "00:12", text: "Yes, we've been looking around for a few weeks now." },
    ];
    callQuotes.forEach((q, idx) => {
      lines.push({ id: "", speaker: "agent", t: `0${2 + idx}:1${idx}`, text: faker.helpers.arrayElement([
        "Got it — and what's your budget range looking like?",
        "Understood. Which localities are you considering?",
        "And when are you hoping to move in?",
      ]) });
      lines.push({ id: "", speaker: "buyer", t: `0${2 + idx}:2${idx}`, text: q.text });
    });
    lines.push({ id: "", speaker: "agent", t: "06:40", text: "Perfect, I'll share a few matching units and we can plan a visit." });
    lines.forEach((l, idx) => (l.id = `${callId}-t${idx + 1}`));
    messages.push({
      id: callId,
      buyerId: id,
      channel: "call",
      direction: "inbound",
      timestamp: NOW - faker.number.int({ min: 1, max: 3 }) * DAY,
      body: "Inbound call",
      durationSec: faker.number.int({ min: 300, max: 600 }),
      summary: "Discovery call. " + callQuotes.map((q) => q.reason).join("; ") + ".",
      transcript: lines,
      handledBy: "agent",
    });
  }

  // recent WhatsApp/SMS nudge
  if (qIdx < quotes.length) {
    const cId = `${id}-m${++mIdx}`;
    const cq = consume(1, cId);
    messages.push({
      id: cId,
      buyerId: id,
      channel: faker.helpers.arrayElement<Channel>(["whatsapp", "sms"]),
      direction: "inbound",
      timestamp: NOW - faker.number.int({ min: 2, max: 30 }) * HOUR,
      body: cq[0]?.text ?? "Any update on the availability?",
      handledBy: "ai",
    });
  }

  const signals: Record<SignalCategory, number> = {
    "Budget fit": 55, "Config & locality match": 55, Engagement: 50, "Site-visit intent": 48, "Loan readiness": 52,
  };
  for (const r of reasons) {
    signals[r.category] = Math.max(8, Math.min(98, signals[r.category] + r.weight * 2.7));
  }
  (Object.keys(signals) as SignalCategory[]).forEach((k) => (signals[k] = Math.round(signals[k])));

  const score = computeScore(signals, DEFAULT_WEIGHTS);
  const drift = faker.number.int({ min: -6, max: 5 });

  const stage: Stage =
    tone === "hot"
      ? faker.helpers.arrayElement<Stage>(["Site Visit Scheduled", "Visited", "Negotiation"])
      : tone === "warm"
        ? faker.helpers.arrayElement<Stage>(["Qualified", "Site Visit Scheduled", "Visited"])
        : faker.helpers.arrayElement<Stage>(["New Enquiry", "Qualified"]);

  const points = 8;
  const history = Array.from({ length: points }).map((_, p) => {
    const frac = p / (points - 1);
    const base = score - 20 + frac * 20;
    return { label: `W${p + 1}`, score: Math.max(5, Math.min(99, Math.round(base + faker.number.int({ min: -5, max: 5 })))) };
  });
  history[points - 1].score = score;

  const lastTouch = Math.min(...messages.map((m) => NOW - m.timestamp));
  const hasVisit = stage === "Site Visit Scheduled";

  const buyer: Buyer = {
    id,
    name,
    phone: `+91 9${faker.string.numeric(9)}`,
    source,
    config,
    budgetMin,
    budgetMax,
    localityPrefs,
    possession: faker.helpers.arrayElement(["ready", "under-construction", "either"]),
    loanStatus: faker.helpers.arrayElement(["pre-approved", "in process", "needs help", "not needed"]),
    hue,
    score,
    prevScore: Math.max(3, Math.min(99, score - drift)),
    scoreReasons: reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
    profile: fields,
    channelsUsed: Array.from(new Set(messages.map((m) => m.channel))),
    stalled: tone === "cool" && faker.datatype.boolean(0.5),
    siteVisitDue: hasVisit ? NOW + faker.number.int({ min: 1, max: 4 }) * DAY : undefined,
    agent,
    agentInitials: agent.split(" ").map((p) => p[0]).join(""),
    stage,
    lastTouch: NOW - lastTouch,
    signals,
    weights: { ...DEFAULT_WEIGHTS },
    scoreHistory: history,
    matchedUnitIds: [],
  };

  return { buyer, messages };
}

function matchUnits(buyer: Buyer, units: Unit[]): string[] {
  return units
    .filter((u) => u.availability === "available" || u.availability === "blocked")
    .filter((u) => u.config === buyer.config)
    .filter((u) => u.priceInr <= buyer.budgetMax * 1.05 && u.priceInr >= buyer.budgetMin * 0.85)
    .slice(0, 4)
    .map((u) => u.id);
}

export interface SeedData {
  buyers: Buyer[];
  messages: Message[];
  projects: Project[];
  units: Unit[];
  deals: Deal[];
  reviewItems: ReviewItem[];
  connectors: Connector[];
  concierge: ConciergeChat[];
  activity: ActivityEvent[];
  analytics: Analytics;
}

export function createSeed(): SeedData {
  faker.seed(990077);

  const projects: Project[] = PROJECTS_SEED.map((p, i) => ({ ...p, id: `p${i + 1}` }));
  const units = buildUnits(projects);

  const tones: ("hot" | "warm" | "cool")[] = [];
  for (let i = 0; i < 20; i++) tones.push(i < 6 ? "hot" : i < 13 ? "warm" : "cool");

  const built = tones.map((t, i) => buildBuyer(i, t));
  const buyers = built.map((b) => b.buyer).sort((a, b) => b.score - a.score);
  const messages = built.flatMap((b) => b.messages);

  // attach matched units (use locality-aware project names too)
  for (const buyer of buyers) {
    const localityUnits = units.filter((u) => {
      const proj = projects.find((p) => p.id === u.projectId)!;
      return buyer.localityPrefs.length === 0 || buyer.localityPrefs.includes(proj.locality);
    });
    const pool = localityUnits.length >= 2 ? localityUnits : units;
    buyer.matchedUnitIds = matchUnits(buyer, pool);
  }

  const projName = (unitId: string) => {
    const u = units.find((x) => x.id === unitId);
    const p = u && projects.find((pp) => pp.id === u.projectId);
    return { project: p?.name ?? "Aurum Heights", unitLabel: u ? `${u.tower} · ${u.config}` : "3BHK" };
  };

  // Deals (site-visit-centric board)
  const deals: Deal[] = buyers.slice(0, 16).map((b, i) => {
    const unitId = b.matchedUnitIds[0];
    const pn = projName(unitId ?? "");
    const stalled = b.stalled || faker.datatype.boolean(0.15);
    const noShow = b.stage === "Visited" ? false : faker.datatype.boolean(0.12);
    const sIdx = STAGES.indexOf(b.stage);
    const give = b.score >= 70 && sIdx >= 1 && sIdx < STAGES.length - 2 && i < 6;
    return {
      id: `d${i + 1}`,
      buyerId: b.id,
      unitId,
      name: b.name,
      project: pn.project,
      unitLabel: pn.unitLabel,
      valueInr: b.budgetMax,
      stage: b.stage,
      tokenInr: b.stage === "Booked" || b.stage === "Negotiation" ? round5L(faker.number.float({ min: 2 * LAKH, max: 5 * LAKH })) : undefined,
      closeDate: NOW + faker.number.int({ min: 3, max: 35 }) * DAY,
      stalled,
      noShow,
      agentInitials: b.agentInitials,
      hue: b.hue,
      suggestion: give
        ? {
            toStage: STAGES[sIdx + 1],
            reason: faker.helpers.arrayElement([
              "“asked to visit Saturday” on WhatsApp",
              "token ₹2 L discussed on call",
              "loan pre-approved · ready to move",
              "visited twice this week",
            ]),
          }
        : undefined,
    };
  });

  // Review queue incl. a duplicate-merge
  const reviewItems: ReviewItem[] = [];
  buyers.slice(7, 15).forEach((b, i) => {
    const kinds: ReviewItem["kind"][] = ["new-lead", "field-update", "auto-action"];
    const kind = kinds[i % 3];
    const r = b.scoreReasons[0];
    reviewItems.push({
      id: `rv${i + 1}`,
      kind,
      title:
        kind === "new-lead" ? `New buyer from ${b.source}`
        : kind === "field-update" ? `Update ${b.profile[0]?.label ?? "Budget"} on ${b.name}`
        : `Log site-visit outcome · ${b.name}`,
      detail:
        kind === "new-lead" ? `${b.name} · ${b.config} · ${b.localityPrefs[0] ?? "Kokapet"}`
        : kind === "field-update" ? `Set ${b.profile[0]?.label ?? "Budget"} → ${b.profile[0]?.value ?? "₹1.4 Cr"}`
        : `Auto-summarized the visit and updated the stage`,
      source: b.source,
      sourceExcerpt: r?.sourceQuote ?? "We'd like to visit this weekend.",
      confidence: faker.number.int({ min: 72, max: 97 }),
      buyerName: b.name,
      hue: b.hue,
    });
  });
  // a duplicate to merge (same buyer, two portals)
  const dupBuyer = buyers[3];
  reviewItems.unshift({
    id: "rv-dup",
    kind: "duplicate",
    title: "Possible duplicate buyer",
    detail: `${dupBuyer.name} appears to have enquired twice`,
    source: "99acres",
    sourceExcerpt: "Same phone number, same 3BHK requirement — 99acres + WhatsApp.",
    confidence: 96,
    buyerName: dupBuyer.name,
    hue: dupBuyer.hue,
    mergeFrom: { source: "whatsapp", label: "WhatsApp enquiry · today" },
    mergeInto: { source: "99acres", label: "99acres lead · 4d ago" },
  });

  const connectors: Connector[] = [
    { id: "99acres", name: "99acres", source: "99acres", status: "connected", detail: "1,204 enquiries synced · live" },
    { id: "magicbricks", name: "MagicBricks", source: "magicbricks", status: "connected", detail: "486 enquiries synced · live" },
    { id: "housing", name: "Housing.com", source: "housing", status: "token-expiring", detail: "Token expires in 2 days" },
    { id: "whatsapp", name: "WhatsApp Business", source: "whatsapp", status: "connected", detail: "Concierge live · 24×7" },
    { id: "ivr", name: "IVR / Missed-call", source: "ivr", status: "connected", detail: "1 number · calls transcribed" },
    { id: "website", name: "Website forms", source: "website", status: "error", detail: "Webhook needs re-auth" },
  ];

  // Concierge — live AI conversations
  const concierge: ConciergeChat[] = [
    {
      id: "cc1", buyerName: "Aarav Sharma", phone: "+91 98480 11223", hue: 210, source: "99acres", status: "matched",
      intent: "3BHK · Kokapet · ₹1.3–1.4 Cr",
      messages: [
        { from: "buyer", text: "Hi, saw your 3BHK ad on 99acres. Still available?" },
        { from: "ai", text: "Yes — we have 3BHKs at Aurum Heights, Kokapet. May I know your budget, and ready-to-move or under-construction?" },
        { from: "buyer", text: "Around 1.3–1.4 cr, ready to move." },
        { from: "ai", text: "Perfect. Aurum Heights Tower B has a 3BHK — 1,680 sq.ft, ₹1.38 Cr, ready, east-facing, RERA-registered. Visit this weekend? I have Sat 11 AM or Sun 4 PM." },
      ],
      offeredUnitIds: units.filter((u) => u.config === "3BHK").slice(0, 1).map((u) => u.id),
      startedAt: NOW - 4 * 60_000,
    },
    {
      id: "cc2", buyerName: "Sana Khan", phone: "+91 90000 44556", hue: 320, source: "whatsapp", status: "qualifying",
      intent: "2BHK · Narsingi · budget?",
      messages: [
        { from: "buyer", text: "Hi, looking for a 2BHK in Narsingi." },
        { from: "ai", text: "Great — what's your budget range, and is a home loan needed?" },
        { from: "buyer", text: "Maybe 90 lakh to 1 cr." },
        { from: "ai", text: "Noted. Lakeside Residences has 2BHKs from ₹95 L. Possession Dec 2026 — does under-construction work for you?" },
      ],
      offeredUnitIds: [],
      startedAt: NOW - 2 * 60_000,
    },
    {
      id: "cc3", buyerName: "Imran Ali", phone: "+91 97010 88991", hue: 150, source: "magicbricks", status: "visit-booked",
      intent: "Villa · Tellapur · ₹2.8 Cr",
      messages: [
        { from: "buyer", text: "Villa options in Tellapur?" },
        { from: "ai", text: "Greenfield Enclave has villas from ₹2.8 Cr, possession Jun 2027. Shall I book a visit?" },
        { from: "buyer", text: "Yes, Saturday morning." },
        { from: "ai", text: "Done — site visit booked Sat 11:00 AM with Suresh, our sales lead. Sharing the location pin + brochure now." },
      ],
      offeredUnitIds: units.filter((u) => u.config === "Villa").slice(0, 1).map((u) => u.id),
      siteVisitAt: "Sat 11:00 AM",
      score: 84,
      startedAt: NOW - 9 * 60_000,
    },
    {
      id: "cc4", buyerName: "Divya Menon", phone: "+91 99590 33447", hue: 30, source: "housing", status: "handed-off",
      intent: "3BHK · Gachibowli · ₹1.6 Cr",
      messages: [
        { from: "buyer", text: "Need to understand the payment plan and loan options in detail." },
        { from: "ai", text: "That's best discussed with our sales lead — connecting you to Anita now. Sharing your full chat with her." },
      ],
      offeredUnitIds: [],
      score: 77,
      startedAt: NOW - 16 * 60_000,
    },
  ];

  const activity: ActivityEvent[] = buyers.slice(0, 6).map((b, i) => ({
    id: `a${i + 1}`,
    kind: faker.helpers.arrayElement<ActivityEvent["kind"]>(["enquiry", "call", "whatsapp", "sitevisit", "score", "lead"]),
    text: faker.helpers.arrayElement([
      `99acres enquiry · qualified · scored ${b.score}`,
      `Site visit booked · ${b.name}`,
      `Missed call → called back · ${b.name}`,
      `${b.name} re-scored ${b.prevScore} → ${b.score}`,
    ]),
    meta: b.localityPrefs[0] ?? "Kokapet",
    timestamp: NOW - (i + 1) * 9 * 60_000,
  }));

  const analytics: Analytics = {
    funnel: [
      { stage: "Enquiry", count: 1860 },
      { stage: "Qualified", count: 742 },
      { stage: "Site Visit", count: 318 },
      { stage: "Visited", count: 196 },
      { stage: "Negotiation", count: 84 },
      { stage: "Booked", count: 37 },
      { stage: "Registered", count: 21 },
    ],
    sourceROI: ([
      { source: "99acres", enquiries: 642, bookings: 14, rate: 0 },
      { source: "magicbricks", enquiries: 388, bookings: 8, rate: 0 },
      { source: "whatsapp", enquiries: 296, bookings: 9, rate: 0 },
      { source: "housing", enquiries: 214, bookings: 3, rate: 0 },
      { source: "ivr", enquiries: 188, bookings: 2, rate: 0 },
      { source: "referral", enquiries: 132, bookings: 1, rate: 0 },
    ] as { source: Source; enquiries: number; bookings: number; rate: number }[]).map((s) => ({
      ...s,
      rate: Math.round((s.bookings / s.enquiries) * 1000) / 10,
    })),
    agents: AGENTS.map((a, i) => ({
      name: a,
      initials: a.split(" ").map((p) => p[0]).join(""),
      bookings: [12, 9, 8, 6, 4][i] ?? 3,
      visits: [38, 31, 27, 22, 16][i] ?? 12,
      hue: (i * 67) % 360,
    })),
    health: { capturePrecision: 93, aiHandledShare: 61, dedupeRate: 96 },
    bookingTrend: ["W1", "W2", "W3", "W4", "W5", "W6"].map((week, i) => ({
      week,
      bookings: 3 + i + faker.number.int({ min: -1, max: 2 }),
      visits: 18 + i * 4 + faker.number.int({ min: -3, max: 4 }),
    })),
  };

  return { buyers, messages, projects, units, deals, reviewItems, connectors, concierge, activity, analytics };
}
