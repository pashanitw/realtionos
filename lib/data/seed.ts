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
  type OvernightLead,
  type MorningBrief,
  type ActivityEvent,
  type Analytics,
  type Client,
  type Team,
  type OrgUser,
  type Cab,
  type Driver,
  type CabBooking,
  CAB_FLOW,
  type Channel,
  type Config,
  type SignalCategory,
  type Source,
  type Stage,
  type Availability,
  type TranscriptLine,
  type ConciergeStatus,
  STAGES,
  BOOKED_STAGES,
  VISITED_STAGES,
  isBooked,
  SOURCE_LABEL,
} from "./types";
import { computeScore, DEFAULT_WEIGHTS } from "./scoring";
import { SEED_NOW, rupeeRange, rupees, initials } from "../utils";

const NOW = SEED_NOW;
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const CRORE = 10_000_000;
const LAKH = 100_000;

// ---------- Indian name pools (buyers generated from these per client) ----------
const FIRST = ["Rohan","Priya","Anjali","Vikram","Sandeep","Sneha","Arjun","Kavya","Rahul","Deepa","Karthik","Meera","Aditya","Nisha","Suresh","Lakshmi","Faisal","Pooja","Manish","Divya","Ananya","Rohit","Neha","Vivek","Shreya","Aakash","Ritika","Gaurav","Tanvi","Imran","Sanjana","Harish","Megha","Naveen","Pallavi","Zoya","Ishaan","Aarav","Riya","Dev","Nikhil","Tara","Varun","Mira","Kabir","Sana"];
const LAST = ["Mehta","Iyer","Reddy","Nair","Kumar","Rao","Menon","Sharma","Verma","Pillai","Joshi","Gupta","Krishnan","Bose","Saxena","Kulkarni","Malhotra","Jain","Hegde","Deshpande","Qureshi","Chandra","Kapoor","Sheikh","Shah","Desai","Khan","Agarwal","Banerjee","Chopra","Sethi","Nanda"];

function fakeName(): string {
  return `${faker.helpers.arrayElement(FIRST)} ${faker.helpers.arrayElement(LAST)}`;
}
function makeNames(count: number): string[] {
  const set = new Set<string>();
  let guard = 0;
  while (set.size < count && guard < count * 30) {
    set.add(fakeName());
    guard++;
  }
  return [...set];
}

// ---------- quotable lines, mapped to category + field ----------
type Quote = {
  text: string;
  category: SignalCategory;
  polarity: "positive" | "negative";
  reason: string;
  field?: { label: string; value: string };
};

const POSITIVE: Quote[] = [
  { text: "Our budget's set at around 1.4 crore and the home loan is pre-approved.", category: "Budget fit", polarity: "positive", reason: "Budget confirmed (~₹1.4 Cr) with loan pre-approved", field: { label: "Budget", value: "₹1.4 Cr · loan pre-approved" } },
  { text: "We specifically want a 3BHK here — nothing else really works for us.", category: "Config & locality match", polarity: "positive", reason: "Clear, matchable requirement — 3BHK in the preferred locality", field: { label: "Requirement", value: "3BHK · preferred locality" } },
  { text: "Can we visit this Saturday? We're keen to close fast.", category: "Site-visit intent", polarity: "positive", reason: "Asked to book a site visit this weekend", field: { label: "Next step", value: "Book site visit" } },
  { text: "We want ready-to-move — possession can't wait beyond this year.", category: "Loan readiness", polarity: "positive", reason: "Ready-to-move requirement with firm timeline", field: { label: "Possession", value: "Ready-to-move" } },
  { text: "Thanks for the quick reply — the floor plan and the east-facing unit look great.", category: "Engagement", polarity: "positive", reason: "Highly engaged — responding fast, reviewing floor plans" },
  { text: "If the east-facing unit is still available we'll put down the token.", category: "Site-visit intent", polarity: "positive", reason: "Token-ready on the right unit", field: { label: "Intent", value: "Token-ready" } },
];

const NEGATIVE: Quote[] = [
  { text: "We're just starting to look, honestly no rush right now.", category: "Site-visit intent", polarity: "negative", reason: "Early-stage browsing — no urgency yet", field: { label: "Next step", value: "Nurture" } },
  { text: "Anything above 1.1 crore is going to be a stretch for us.", category: "Budget fit", polarity: "negative", reason: "Budget below typical inventory in this locality" },
  { text: "We need to sort out the home loan first before committing to anything.", category: "Loan readiness", polarity: "negative", reason: "Loan not arranged — financing is a blocker", field: { label: "Loan", value: "Not arranged" } },
  { text: "Couldn't make it to the site last weekend, something came up.", category: "Engagement", polarity: "negative", reason: "Missed a scheduled site visit (no-show)" },
];

const CONFIG_AREA: Record<Config, [number, number]> = {
  "1BHK": [620, 720], "2BHK": [1050, 1280], "3BHK": [1480, 1820], "4BHK": [2300, 2800], Villa: [3200, 4200], Plot: [1800, 2400],
};
const CONFIG_PRICE: Record<Config, [number, number]> = {
  "1BHK": [0.55 * CRORE, 0.78 * CRORE], "2BHK": [0.82 * CRORE, 1.15 * CRORE], "3BHK": [1.2 * CRORE, 1.7 * CRORE], "4BHK": [1.9 * CRORE, 2.6 * CRORE], Villa: [2.8 * CRORE, 4.5 * CRORE], Plot: [0.9 * CRORE, 1.6 * CRORE],
};
const FACINGS = ["East", "North-East", "West", "North", "South-East"];

function pickN<T>(arr: T[], n: number): T[] {
  return faker.helpers.arrayElements(arr, n);
}
function round5L(n: number) {
  return Math.round(n / (5 * LAKH)) * 5 * LAKH;
}

function buildUnits(clientId: string, projects: Project[]): Unit[] {
  const units: Unit[] = [];
  let u = 0;
  for (const p of projects) {
    const configs: Config[] = faker.helpers.arrayElements(["2BHK", "3BHK", "4BHK", "Villa"], 3) as Config[];
    const count = faker.number.int({ min: 7, max: 10 });
    for (let i = 0; i < count; i++) {
      const config = faker.helpers.arrayElement(configs);
      const [aMin, aMax] = CONFIG_AREA[config];
      const [pMin, pMax] = CONFIG_PRICE[config];
      units.push({
        id: `${clientId}-u${++u}`,
        clientId,
        projectId: p.id,
        tower: faker.helpers.arrayElement(["Tower A", "Tower B", "Tower C", "Tower D"]),
        unitNo: `${faker.number.int({ min: 4, max: 22 })}0${faker.number.int({ min: 1, max: 4 })}`,
        config,
        carpetAreaSqft: faker.number.int({ min: aMin, max: aMax }),
        priceInr: round5L(faker.number.float({ min: pMin, max: pMax })),
        floor: faker.number.int({ min: 4, max: 24 }),
        facing: faker.helpers.arrayElement(FACINGS),
        availability: faker.helpers.weightedArrayElement<Availability>([
          { weight: 5, value: "available" }, { weight: 2, value: "blocked" }, { weight: 2, value: "booked" }, { weight: 1, value: "sold" },
        ]),
      });
    }
  }
  return units;
}

interface BuyerCtx {
  clientId: string;
  agents: OrgUser[];
  localities: string[];
  name: string;
}

function buildBuyer(idx: number, tone: "hot" | "warm" | "cool", ctx: BuyerCtx): { buyer: Buyer; messages: Message[] } {
  const id = `${ctx.clientId}-b${idx + 1}`;
  const name = ctx.name;
  const agentUser = faker.helpers.arrayElement(ctx.agents);
  const hue = faker.number.int({ min: 0, max: 360 });
  const config = faker.helpers.weightedArrayElement<Config>([
    { weight: 4, value: "3BHK" }, { weight: 3, value: "2BHK" }, { weight: 1, value: "4BHK" }, { weight: 1, value: "Villa" },
  ]);
  const [pMin, pMax] = CONFIG_PRICE[config];
  const budgetMax = round5L(faker.number.float({ min: pMin * 1.0, max: pMax * 1.05 }));
  const budgetMin = round5L(budgetMax * 0.86);
  const localityPrefs = faker.helpers.arrayElements(ctx.localities, faker.number.int({ min: 1, max: 2 }));
  const source = faker.helpers.weightedArrayElement<Source>([
    { weight: 5, value: "99acres" }, { weight: 3, value: "magicbricks" }, { weight: 3, value: "whatsapp" }, { weight: 2, value: "housing" }, { weight: 2, value: "ivr" }, { weight: 1, value: "website" }, { weight: 1, value: "referral" },
  ]);

  const posCount = tone === "hot" ? 4 : tone === "warm" ? 3 : 1;
  const negCount = tone === "hot" ? 0 : tone === "warm" ? 1 : 2;
  const quotes = faker.helpers.shuffle([...pickN(POSITIVE, posCount), ...pickN(NEGATIVE, negCount)]);

  const channels = faker.helpers.arrayElements<Channel>(["whatsapp", "call", "email", "sms", "web"], faker.number.int({ min: 2, max: 4 }));
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
        fields.push({ id: `${id}-f${fields.length + 1}`, label: q.field.label, value: q.field.value, sourceMessageId: msgId, sourceQuote: q.text });
      }
    }
    return used;
  };

  const cid = ctx.clientId;
  const first = name.split(" ")[0];
  const agentFirst = agentUser.name.split(" ")[0];
  const loc = localityPrefs[0];
  const replyChannel: Channel = channels.includes("email") ? "email" : "whatsapp";

  const m1 = `${id}-m${++mIdx}`;
  const q1 = consume(2, m1);
  messages.push({ id: m1, clientId: cid, buyerId: id, channel: "whatsapp", direction: "inbound", timestamp: NOW - faker.number.int({ min: 9, max: 11 }) * DAY, body: `Hi, saw the ${config} listing in ${loc}. ` + q1.map((q) => q.text).join(" "), summary: "Inbound portal enquiry — qualifying interest.", handledBy: "ai" });

  const m2 = `${id}-m${++mIdx}`;
  messages.push({ id: m2, clientId: cid, buyerId: id, channel: replyChannel, direction: "outbound", timestamp: NOW - 8 * DAY, subject: replyChannel === "email" ? `${config} options in ${loc} — price list & floor plans` : undefined, body: `Hi ${first}, thanks for reaching out! Sharing a few ${config} options in ${loc} with the price list and floor plans. Would you like to schedule a site visit this weekend? — ${agentFirst}`, summary: "Sent matching units, price list and brochure.", handledBy: "agent" });

  const m3 = `${id}-m${++mIdx}`;
  const q3 = consume(1, m3);
  messages.push({ id: m3, clientId: cid, buyerId: id, channel: "email", direction: "inbound", timestamp: NOW - faker.number.int({ min: 6, max: 7 }) * DAY, subject: "Re: pricing & timeline", body: `Thanks for the brochure — the ${config} looks ideal. What's the all-in cost including floor-rise and registration, and how soon can we close? ` + q3.map((q) => q.text).join(" "), summary: "Asked for all-in cost + closing timeline.", handledBy: "ai" });

  const m4 = `${id}-m${++mIdx}`;
  const q4 = consume(2, m4);
  const lines: TranscriptLine[] = [
    { id: "", speaker: "agent", t: "00:05", text: "Hi, thanks for taking the call — happy to walk you through the options." },
    { id: "", speaker: "buyer", t: "00:12", text: "Yes, we've been comparing a few projects over the last couple of weeks." },
  ];
  q4.forEach((q, i2) => {
    lines.push({ id: "", speaker: "agent", t: `0${2 + i2}:1${i2}`, text: faker.helpers.arrayElement(["Got it — and what's your budget range looking like?", "Understood. Which localities work best for you?", "And when are you hoping to take possession?", "How are you planning the financing — loan or self-funded?"]) });
    lines.push({ id: "", speaker: "buyer", t: `0${2 + i2}:2${i2}`, text: q.text });
  });
  lines.push({ id: "", speaker: "agent", t: "07:52", text: "Perfect — I'll share the shortlisted units and we'll plan a site visit." });
  lines.forEach((l, i2) => (l.id = `${m4}-t${i2 + 1}`));
  messages.push({ id: m4, clientId: cid, buyerId: id, channel: "call", direction: "outbound", timestamp: NOW - faker.number.int({ min: 3, max: 5 }) * DAY, body: "Outbound call", durationSec: faker.number.int({ min: 360, max: 700 }), summary: "Discovery call. " + (q4.length ? q4.map((q) => q.reason).join("; ") + "." : "Walked through options, budget and timeline."), transcript: lines, handledBy: "agent" });

  const m5 = `${id}-m${++mIdx}`;
  const q5 = consume(1, m5);
  messages.push({ id: m5, clientId: cid, buyerId: id, channel: "whatsapp", direction: "inbound", timestamp: NOW - faker.number.int({ min: 30, max: 44 }) * HOUR, body: `Visited the site with my family — really liked the project. Could you share pricing for the higher floors? ` + q5.map((q) => q.text).join(" "), summary: "Post-visit interest — wants higher-floor pricing.", handledBy: "ai" });

  const m6 = `${id}-m${++mIdx}`;
  const q6 = consume(1, m6);
  messages.push({ id: m6, clientId: cid, buyerId: id, channel: faker.helpers.arrayElement<Channel>(["whatsapp", "sms"]), direction: "inbound", timestamp: NOW - faker.number.int({ min: 2, max: 20 }) * HOUR, body: q6[0]?.text ?? faker.helpers.arrayElement(["Any update on the availability and next steps?", "Can you confirm the unit is still available?", "Following up — when can we close this?"]), summary: q6[0] ? undefined : "Follow-up nudge.", handledBy: "ai" });

  const signals: Record<SignalCategory, number> = { "Budget fit": 55, "Config & locality match": 55, Engagement: 50, "Site-visit intent": 48, "Loan readiness": 52 };
  for (const r of reasons) signals[r.category] = Math.max(8, Math.min(98, signals[r.category] + r.weight * 2.7));
  (Object.keys(signals) as SignalCategory[]).forEach((k) => (signals[k] = Math.round(signals[k])));

  const score = computeScore(signals, DEFAULT_WEIGHTS);
  const drift = faker.number.int({ min: -6, max: 5 });
  const stage: Stage = tone === "hot"
    ? faker.helpers.arrayElement<Stage>(["Site Visit Scheduled", "Site Visit Completed", "Unit Selected", "Booking Amount Paid", "Booking Confirmed", "Agreement Signed", "Loan Sanction", "Registration", "Handover"])
    : tone === "warm"
      ? faker.helpers.arrayElement<Stage>(["Qualified", "Site Visit Scheduled", "Site Visit Completed", "Unit Selected"])
      : faker.helpers.arrayElement<Stage>(["New Enquiry", "Qualified", "Site Visit Scheduled"]);

  const points = 8;
  const history = Array.from({ length: points }).map((_, p) => {
    const base = score - 20 + (p / (points - 1)) * 20;
    return { label: `W${p + 1}`, score: Math.max(5, Math.min(99, Math.round(base + faker.number.int({ min: -5, max: 5 })))) };
  });
  history[points - 1].score = score;

  const lastTouch = Math.min(...messages.map((m) => NOW - m.timestamp));
  const hasVisit = stage === "Site Visit Scheduled";

  const buyer: Buyer = {
    id, clientId: cid, name,
    phone: `+91 9${faker.string.numeric(9)}`,
    source, config, budgetMin, budgetMax, localityPrefs,
    possession: faker.helpers.arrayElement(["ready", "under-construction", "either"]),
    loanStatus: faker.helpers.arrayElement(["pre-approved", "in process", "needs help", "not needed"]),
    hue, score, prevScore: Math.max(3, Math.min(99, score - drift)),
    scoreReasons: reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
    profile: fields,
    channelsUsed: Array.from(new Set(messages.map((m) => m.channel))),
    stalled: tone === "cool" && faker.datatype.boolean(0.5),
    siteVisitDue: hasVisit ? NOW + faker.number.int({ min: 1, max: 4 }) * DAY : undefined,
    followUpAt: hasVisit
      ? NOW + faker.number.int({ min: 1, max: 4 }) * DAY
      : NOW + (tone === "cool" ? faker.number.int({ min: -48, max: 6 }) : faker.number.int({ min: 4, max: 60 })) * HOUR,
    agentId: agentUser.id, agent: agentUser.name, agentInitials: agentUser.initials,
    stage, lastTouch: NOW - lastTouch, signals, weights: { ...DEFAULT_WEIGHTS }, scoreHistory: history, matchedUnitIds: [],
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

function buildDeals(clientId: string, buyers: Buyer[], projects: Project[], units: Unit[]): Deal[] {
  const projName = (unitId: string) => {
    const u = units.find((x) => x.id === unitId);
    const p = u && projects.find((pp) => pp.id === u.projectId);
    return { project: p?.name ?? projects[0].name, unitLabel: u ? `${u.tower} · ${u.config}` : "3BHK" };
  };
  return buyers.slice(0, Math.min(16, buyers.length)).map((b, i) => {
    const unitId = b.matchedUnitIds[0];
    const pn = projName(unitId ?? "");
    const sIdx = STAGES.indexOf(b.stage);
    const give = b.score >= 70 && sIdx >= 1 && sIdx < STAGES.length - 2 && i < 6;
    return {
      id: `${clientId}-d${i + 1}`, clientId, buyerId: b.id, unitId,
      name: b.name, project: pn.project, unitLabel: pn.unitLabel, valueInr: b.budgetMax, stage: b.stage,
      tokenInr: isBooked(b.stage) || b.stage === "Unit Selected" ? round5L(faker.number.float({ min: 2 * LAKH, max: 5 * LAKH })) : undefined,
      closeDate: NOW + faker.number.int({ min: 3, max: 35 }) * DAY,
      stalled: b.stalled || faker.datatype.boolean(0.15),
      noShow: b.stage !== "Site Visit Scheduled" ? false : faker.datatype.boolean(0.12),
      agentId: b.agentId, agentInitials: b.agentInitials, hue: b.hue,
      suggestion: give ? { toStage: STAGES[sIdx + 1], reason: faker.helpers.arrayElement(["“asked to visit Saturday” on WhatsApp", "token ₹2 L discussed on call", "loan pre-approved · ready to move", "visited twice this week"]) } : undefined,
    };
  });
}

function buildReviewItems(clientId: string, buyers: Buyer[]): ReviewItem[] {
  const leadCode = (b: Buyer) => `L-${2000 + Number(b.id.split("-b").pop() ?? 1)}`;
  const fn = (b: Buyer) => b.name.split(" ")[0];
  const hot = buyers[0];
  const fresh = buyers.find((b) => b.score > 55 && b.score < 78) ?? buyers[Math.min(6, buyers.length - 1)];
  const cold = buyers.find((b) => b.stalled) ?? buyers[buyers.length - 2];
  const mover = buyers.find((b) => b.stage === "Site Visit Completed" || b.stage === "Unit Selected") ?? buyers[2];
  const moverNext = STAGES[Math.min(STAGES.indexOf(mover.stage) + 1, STAGES.length - 1)];
  const fieldA = buyers[Math.min(4, buyers.length - 1)];
  const fieldB = buyers[Math.min(5, buyers.length - 1)];
  const dupBuyer = buyers[Math.min(3, buyers.length - 1)];
  const base = (b: Buyer) => ({ clientId, agentId: b.agentId, hue: b.hue, buyerName: b.name });
  return [
    { id: `${clientId}-rv1`, ...base(hot), leadId: leadCode(hot), kind: "outbound", channel: "whatsapp", source: hot.source, confidence: 97, title: `Send booking payment link to ${hot.name}`, why: "Asked for the payment link twice (WhatsApp today 9:14, call 19 Jun).", body: `Hi ${fn(hot)} — here's the secure link for the ₹5,00,000 booking amount on the unit. Once received we'll hold it and share the agreement for signing. — ${hot.agent}`, attachment: "RERA project no. + receipt terms attached · cleared", autonomyLabel: "L1 — needs your nod", cta: "Approve" },
    { id: `${clientId}-rv2`, ...base(fresh), leadId: leadCode(fresh), kind: "new-lead", channel: "web", source: "website", confidence: 82, title: `New lead auto-created — ${fresh.name}`, why: "First contact from an unknown visitor; name, budget and config extracted from the chat itself.", body: `Name: ${fresh.name} · Budget: ≤ ${rupees(fresh.budgetMax)} · Config: ${fresh.config} · Source: Web chat · Interested in home-loan tie-ups`, attachment: "No external enrichment — fields from conversation only", autonomyLabel: "Auto-created · confirm to finalise", cta: "Confirm lead" },
    { id: `${clientId}-rv3`, ...base(cold), leadId: leadCode(cold), kind: "sequence", channel: "whatsapp", source: cold.source, confidence: 88, title: `Cold re-engagement sequence — ${cold.name}`, why: "No reply for 9 days after the agreement draft; drafted a 3-touch nudge referencing the last objection.", body: `Touch 1 · WhatsApp (now): "Still keen on ${cold.localityPrefs[0]}? Prices revise next month." → Touch 2 · Email (+2d) → Touch 3 · Call task (+4d)`, attachment: "Fair-practice hours · opt-out respected", autonomyLabel: "L1 — you approve each send", cta: "Approve sequence" },
    { id: `${clientId}-rv4`, ...base(mover), leadId: leadCode(mover), kind: "stage-move", channel: "call", source: mover.source, confidence: 91, title: `Move ${mover.name} to ${moverNext}`, why: '"Budget approved" detected on the last call; the deal is ready to advance.', body: `${mover.stage} → ${moverNext} · ${mover.config} · ${rupeeRange(mover.budgetMin, mover.budgetMax)}`, attachment: "Stage rule matched · reversible", autonomyLabel: "L2 — auto-moves on approve", cta: "Move stage" },
    { id: `${clientId}-rv5`, ...base(fieldA), leadId: leadCode(fieldA), kind: "field-update", channel: "call", source: fieldA.source, confidence: 94, title: `Update Budget on ${fieldA.name}`, why: "Buyer confirmed a higher budget on the latest call.", body: `Budget: ${rupees(fieldA.budgetMin)} → ${rupees(fieldA.budgetMax)} · loan pre-approved`, attachment: "Single-field change", autonomyLabel: "Field update", cta: "Apply update" },
    { id: `${clientId}-rv6`, ...base(fieldB), leadId: leadCode(fieldB), kind: "field-update", channel: "whatsapp", source: fieldB.source, confidence: 90, title: `Update possession preference — ${fieldB.name}`, why: "Buyer now wants ready-to-move, not under-construction.", body: "Possession: Under-construction → Ready-to-move", attachment: "Single-field change", autonomyLabel: "Field update", cta: "Apply update" },
    { id: `${clientId}-rv-dup`, ...base(dupBuyer), leadId: leadCode(dupBuyer), kind: "duplicate", source: "99acres", confidence: 96, title: `Possible duplicate — ${dupBuyer.name}`, why: `Same phone number and the same ${dupBuyer.config} requirement appeared on two portals.`, body: "Merge two enquiries into one buyer with a combined timeline.", autonomyLabel: "De-dupe · reversible", cta: "Merge", mergeFrom: { source: "whatsapp", label: "WhatsApp enquiry · today" }, mergeInto: { source: "99acres", label: "99acres lead · 4d ago" } },
  ];
}

/** Channel-appropriate conversation copy — calls read like a transcript,
 *  SMS like short texts, email like a formal thread, WhatsApp like chat. */
type ThreadCtx = { first: string; config: string; loc: string; budget: string; project: string; mgrFirst: string; src: string };
function conciergeThread(channel: Channel, status: ConciergeStatus, c: ThreadCtx): ConciergeChat["messages"] {
  const { first, config, loc, budget, project, mgrFirst, src } = c;

  if (channel === "call") {
    if (status === "qualifying")
      return [
        { from: "ai", text: `Hi ${first}, this is the ${project} sales assistant calling about your ${config} enquiry in ${loc} — is now a good time?` },
        { from: "buyer", text: "Yes, go ahead." },
        { from: "ai", text: "Great — to line up the right options, what budget are you working to, and would you need a home loan?" },
        { from: "buyer", text: `Around ${budget}, and yes, some loan help would be useful.` },
      ];
    if (status === "matched")
      return [
        { from: "ai", text: `Hi ${first}, following up on your ${config} search in ${loc}. ${project} has a couple that fit ${budget} — shall I walk you through them?` },
        { from: "buyer", text: "Yes please, go ahead." },
        { from: "ai", text: "It's RERA-registered with ready possession. I'll text you the floor plans and price sheet right after this call." },
        { from: "buyer", text: "Perfect, send them across." },
      ];
    return [
      { from: "ai", text: `Hi ${first}, calling to set up your site visit at ${project}. Does this Saturday morning work?` },
      { from: "buyer", text: "Saturday morning is good for me." },
      { from: "ai", text: `Booked — Sat 11:00 AM with ${mgrFirst}'s team. I'll send the location pin and a cab option by SMS.` },
      { from: "buyer", text: "Great, thank you!" },
    ];
  }

  if (channel === "sms") {
    if (status === "qualifying")
      return [
        { from: "buyer", text: `${config} in ${loc}? price pls` },
        { from: "ai", text: `Hi ${first}! ${config} at ${project} ~${budget}. Loan help available. Want full details?` },
        { from: "buyer", text: "yes" },
        { from: "ai", text: "Sharing options on WhatsApp now 👍" },
      ];
    if (status === "matched")
      return [
        { from: "buyer", text: `still available? ${config} ${loc}` },
        { from: "ai", text: `Yes ${first} — ${project}, ${config}, ${budget}, ready to move. Free for a site visit this weekend?` },
        { from: "buyer", text: "maybe sat" },
        { from: "ai", text: "Great, holding Sat 11 AM for you. Reply YES to confirm." },
      ];
    return [
      { from: "ai", text: `Hi ${first}, confirming your ${project} site visit for Sat 11 AM. Reply YES to lock it in.` },
      { from: "buyer", text: "yes confirmed" },
      { from: "ai", text: "Done ✅ Location pin sent. Need a cab?" },
      { from: "buyer", text: "yes pls" },
    ];
  }

  if (channel === "email") {
    if (status === "qualifying")
      return [
        { from: "buyer", text: `Hi, I'm exploring a ${config} in ${loc} within ${budget}. Could you share available options, pricing and possession timelines? Regards, ${first}` },
        { from: "ai", text: `Hi ${first}, thank you for reaching out. ${project} has ${config} units that fit ${budget} — I've attached the price sheet and floor plans. We also offer home-loan assistance with pre-approval tie-ups. Would you like to schedule a site visit? Best regards, ${mgrFirst}'s team` },
        { from: "buyer", text: "Thanks, these look promising. What's the loan eligibility process like?" },
        { from: "ai", text: "I've attached the eligibility sheet — three partner banks, typically a 2-day approval. Shall I block a weekend slot for a visit?" },
      ];
    if (status === "matched")
      return [
        { from: "buyer", text: `Hi, following up on the ${config} options at ${project}. Are they still available within ${budget}? Regards, ${first}` },
        { from: "ai", text: `Hi ${first}, yes — a RERA-registered, ready-to-move ${config} is available. Attaching the brochure, payment plan and RERA details. Would Saturday or Sunday suit you for a site visit? Best, ${mgrFirst}'s team` },
        { from: "buyer", text: "Saturday could work. Please share the location." },
        { from: "ai", text: "Sharing the location pin and holding a tentative 11 AM slot — I'll confirm shortly." },
      ];
    return [
      { from: "buyer", text: `Hi, confirming our site visit to ${project} this Saturday. Regards, ${first}` },
      { from: "ai", text: `Hi ${first}, confirmed — Sat 11:00 AM at ${project} with ${mgrFirst}'s team. I've attached the location, brochure and a cab option for you. Looking forward to meeting you. Best regards` },
      { from: "buyer", text: "Great, see you then." },
      { from: "ai", text: "Wonderful — I'll send a reminder the evening before." },
    ];
  }

  // whatsapp (default chat)
  if (status === "qualifying")
    return [
      { from: "buyer", text: `Hi, looking for a ${config} in ${loc}.` },
      { from: "ai", text: "Great — what's your budget range, and is a home loan needed?" },
      { from: "buyer", text: `Around ${budget}.` },
      { from: "ai", text: `Noted. ${project} has ${config}s in that range. Shall I share a few matching options?` },
    ];
  if (status === "matched")
    return [
      { from: "buyer", text: `Hi, saw your ${config} ad on ${src}. Still available?` },
      { from: "ai", text: `Yes — we have ${config}s at ${project}, ${loc}. May I know your budget, and ready-to-move or under-construction?` },
      { from: "buyer", text: `${budget}, ready to move.` },
      { from: "ai", text: `Perfect. ${project} has a ${config} — RERA-registered. Visit this weekend? I have Sat 11 AM or Sun 4 PM.` },
    ];
  return [
    { from: "buyer", text: `${config} options in ${loc}?` },
    { from: "ai", text: `${project} has ${config}s that fit ${budget}. Shall I book a visit?` },
    { from: "buyer", text: "Yes, Saturday morning works." },
    { from: "ai", text: `Done — site visit booked Sat 11:00 AM with ${mgrFirst}'s team. Sharing the location pin + brochure now.` },
  ];
}

function buildConcierge(clientId: string, buyers: Buyer[], projects: Project[], units: Unit[], mgrFirst: string): ConciergeChat[] {
  const unitFor = (cfg: Config) => units.filter((u) => u.config === cfg).slice(0, 1).map((u) => u.id);
  const projFor = (b: Buyer) => projects.find((p) => b.localityPrefs.includes(p.locality)) ?? projects[0];
  // Spread live conversations across EVERY agent (their own buyers), so an agent's
  // Concierge console shows their conversations and the manager sees the whole client.
  const byAgent = new Map<string, Buyer[]>();
  for (const b of buyers) {
    const arr = byAgent.get(b.agentId) ?? [];
    arr.push(b);
    byAgent.set(b.agentId, arr);
  }
  const picks: Buyer[] = [];
  for (const arr of byAgent.values()) {
    arr.sort((x, y) => y.score - x.score);
    picks.push(...arr.slice(0, 2)); // up to 2 per agent
  }
  const pool = picks.sort((x, y) => y.score - x.score).slice(0, 12);
  const statusFor = (b: Buyer): ConciergeStatus => (b.siteVisitDue ? "visit-booked" : b.score >= 62 ? "matched" : "qualifying");

  return pool.map((b, i) => {
    const status = statusFor(b);
    const channel: Channel = b.channelsUsed[i % b.channelsUsed.length] ?? "whatsapp";
    const p = projFor(b);
    const loc = b.localityPrefs[0];
    const budget = rupeeRange(b.budgetMin, b.budgetMax);
    const offeredUnitIds: string[] = status === "qualifying" ? [] : unitFor(b.config);
    const siteVisitAt = status === "visit-booked" ? "Sat 11:00 AM" : undefined;
    const messages = conciergeThread(channel, status, {
      first: b.name.split(" ")[0], config: b.config, loc, budget,
      project: p.name, mgrFirst, src: SOURCE_LABEL[b.source],
    });

    return {
      id: `${clientId}-cc${i + 1}`, clientId, agentId: b.agentId, channel,
      buyerName: b.name, phone: b.phone, hue: b.hue, source: b.source, status,
      intent: `${b.config} · ${loc} · ${budget}`, messages, offeredUnitIds, siteVisitAt,
      score: b.score, startedAt: NOW - (i + 2) * 60_000,
    };
  });
}

function buildActivity(clientId: string, buyers: Buyer[]): ActivityEvent[] {
  return buyers.slice(0, 6).map((b, i) => ({
    id: `${clientId}-a${i + 1}`, clientId,
    kind: faker.helpers.arrayElement<ActivityEvent["kind"]>(["enquiry", "call", "whatsapp", "sitevisit", "score", "lead"]),
    text: faker.helpers.arrayElement([`99acres enquiry · qualified · scored ${b.score}`, `Site visit booked · ${b.name}`, `Missed call → called back · ${b.name}`, `${b.name} re-scored ${b.prevScore} → ${b.score}`]),
    meta: b.localityPrefs[0], timestamp: NOW - (i + 1) * 9 * 60_000,
  }));
}

function buildAnalytics(buyers: Buyer[], agents: OrgUser[]): Analytics {
  const n = buyers.length;
  const enquiries = n * 58;
  const funnel = [
    { stage: "Enquiry", count: enquiries },
    { stage: "Qualified", count: Math.round(enquiries * 0.4) },
    { stage: "Site Visit", count: Math.round(enquiries * 0.17) },
    { stage: "Visited", count: Math.round(enquiries * 0.105) },
    { stage: "Negotiation", count: Math.round(enquiries * 0.045) },
    { stage: "Booked", count: Math.round(enquiries * 0.02) },
    { stage: "Registered", count: Math.round(enquiries * 0.011) },
  ];
  const srcDefs: [Source, number, number][] = [["99acres", 0.34, 4.2], ["magicbricks", 0.21, 3.0], ["whatsapp", 0.16, 4.6], ["housing", 0.12, 2.1], ["ivr", 0.1, 1.4], ["referral", 0.07, 5.1]];
  const sourceROI = srcDefs.map(([source, share, rate]) => {
    const enq = Math.round(enquiries * share);
    return { source, enquiries: enq, bookings: Math.max(1, Math.round((enq * rate) / 100)), rate };
  });
  // Real counts from each agent's assigned buyers — canonical stage sets, no padding.
  const agentsLb = agents.map((a) => {
    const mine = buyers.filter((b) => b.agentId === a.id);
    const bookings = mine.filter((b) => BOOKED_STAGES.includes(b.stage)).length;
    const visits = mine.filter((b) => VISITED_STAGES.includes(b.stage)).length;
    const conversion = visits ? Math.round((bookings / visits) * 100) : 0;
    return { name: a.name, initials: a.initials, bookings, visits, conversion, hue: a.hue };
  }).sort((x, y) => y.bookings - x.bookings);
  return {
    funnel, sourceROI, agents: agentsLb,
    health: { capturePrecision: faker.number.int({ min: 90, max: 96 }), aiHandledShare: faker.number.int({ min: 54, max: 66 }), dedupeRate: faker.number.int({ min: 93, max: 97 }) },
    bookingTrend: ["W1", "W2", "W3", "W4", "W5", "W6"].map((week, i) => ({ week, bookings: Math.max(1, Math.round(n * 0.06) + i + faker.number.int({ min: -1, max: 2 })), visits: Math.round(n * 0.5) + i * 4 + faker.number.int({ min: -3, max: 4 }) })),
  };
}

const NIGHT_LABELS = ["11:11 PM", "11:47 PM", "12:38 AM", "1:09 AM", "1:52 AM", "2:14 AM", "3:05 AM", "4:38 AM", "5:20 AM", "6:32 AM", "7:15 AM", "8:40 AM"];
const NIGHT_ACTION: Record<OvernightLead["status"], string> = { "visit-booked": "Confirm the booked visit", qualified: "Approve & add to worklist", new: "Approve & reply" };
const NIGHT_SUMMARY: Record<OvernightLead["status"], string> = { "visit-booked": "Qualified on WhatsApp, matched units and booked a site visit.", qualified: "Replied to the enquiry, captured budget + config, scored the lead.", new: "Created the lead from the chat — filled name, budget and config." };

function buildOvernight(clientId: string, buyers: Buyer[]): { overnightLeads: OvernightLead[]; morningBrief: MorningBrief } {
  const eligible = buyers.filter((b) => ["whatsapp", "ivr", "website", "99acres", "housing"].includes(b.source));
  // Spread overnight captures across EVERY agent (their own buyers) so each agent's
  // Leads page is populated — not just the first few buyers.
  const byAgent = new Map<string, Buyer[]>();
  for (const b of eligible) {
    const arr = byAgent.get(b.agentId) ?? [];
    arr.push(b);
    byAgent.set(b.agentId, arr);
  }
  const picks: Buyer[] = [];
  for (const arr of byAgent.values()) {
    arr.sort((x, y) => y.score - x.score);
    picks.push(...arr.slice(0, 2)); // up to 2 per agent
  }
  const pool = picks.sort((x, y) => y.score - x.score).slice(0, 12); // intent-ranked, capped
  const statusFor = (b: Buyer): OvernightLead["status"] => (b.siteVisitDue ? "visit-booked" : b.score >= 60 ? "qualified" : "new");
  const overnightLeads: OvernightLead[] = pool.map((b, i) => {
    const status = statusFor(b);
    return { id: `${clientId}-ov${i + 1}`, clientId, agentId: b.agentId, buyerId: b.id, name: b.name, hue: b.hue, channel: b.channelsUsed[0] ?? "whatsapp", source: b.source, capturedLabel: NIGHT_LABELS[i % NIGHT_LABELS.length], requirement: `${b.config} · ${b.localityPrefs[0]} · ${rupeeRange(b.budgetMin, b.budgetMax)}`, score: b.score, status, aiSummary: NIGHT_SUMMARY[status], reasons: b.scoreReasons.slice(0, 2).map((r) => r.text), action: NIGHT_ACTION[status] };
  });
  const morningBrief: MorningBrief = { window: "10:00 PM → 9:00 AM", conversations: Math.round(buyers.length * 0.45) + 4, channels: 4, leadsCreated: overnightLeads.length, needNod: Math.min(3, overnightLeads.length), visitsBooked: overnightLeads.filter((l) => l.status === "visit-booked").length, fieldsAutoFilled: Math.round(buyers.length * 0.85), actionsDrafted: overnightLeads.length };
  return { overnightLeads, morningBrief };
}

// ---------- cab / site-visit logistics ----------
const DRIVER_NAMES = ["Ramesh Yadav", "Salim Sheikh", "Venkat Rao", "Joseph Thomas", "Bhola Singh", "Kiran Patil"];
const CAB_MODELS = ["Toyota Innova", "Maruti Ertiga", "Toyota Camry", "Hyundai Aura", "Tata Nexon EV", "Mahindra XUV700"];

function buildLogistics(clientId: string, buyers: Buyer[], projects: Project[]) {
  const drivers: Driver[] = DRIVER_NAMES.slice(0, 5).map((name, i) => ({
    id: `${clientId}-dr${i + 1}`, clientId, name,
    phone: `+91 9${faker.string.numeric(9)}`,
    rating: Math.round(faker.number.float({ min: 4.2, max: 5 }) * 10) / 10,
  }));
  const cabs: Cab[] = drivers.map((d, i) => ({
    id: `${clientId}-cab${i + 1}`, clientId,
    model: CAB_MODELS[i % CAB_MODELS.length],
    plate: `TS09 ${faker.string.alpha({ length: 2, casing: "upper" })} ${faker.string.numeric(4)}`,
    seats: [7, 7, 5, 5, 7][i % 5],
    driverId: d.id,
    status: i < 2 ? "idle" : faker.helpers.arrayElement<Cab["status"]>(["idle", "assigned", "en-route"]),
  }));
  const visitBuyers = buyers.filter((b) => b.siteVisitDue).slice(0, 5);
  const cabBookings: CabBooking[] = visitBuyers.map((b, i) => {
    const cab = cabs[i % cabs.length];
    const proj = projects.find((p) => b.localityPrefs.includes(p.locality)) ?? projects[0];
    return {
      id: `${clientId}-bk${i + 1}`, clientId, cabId: cab.id, buyerId: b.id, buyerName: b.name,
      project: proj.name,
      pickup: `${faker.helpers.arrayElement(["Residence", "Office", "Metro station", "Airport"])} · ${b.localityPrefs[0]}`,
      scheduledAt: b.siteVisitDue ?? NOW + DAY,
      status: CAB_FLOW[i % CAB_FLOW.length],
      etaMin: faker.number.int({ min: 8, max: 40 }),
      agentInitials: b.agentInitials,
    };
  });
  return { drivers, cabs, cabBookings };
}

// ============================================================
// Client specs — 3 tenant companies
// ============================================================
type AgentSpec = { name: string; target: number };
interface ClientSpec {
  id: string; name: string; city: string; hue: number; plan: string; seed: number;
  buyerCount: number; localities: string[]; manager: string; telecaller: string;
  teams: { name: string; agents: AgentSpec[] }[];
  projects: Omit<Project, "id" | "clientId">[];
}

const CLIENT_SPECS: ClientSpec[] = [
  {
    id: "c1", name: "Aurum Realty", city: "Hyderabad", hue: 168, plan: "Enterprise", seed: 990077,
    buyerCount: 32, manager: "Rohan Desai", telecaller: "Divya Pillai",
    localities: ["Kokapet", "Gachibowli", "Narsingi", "Tellapur", "Kondapur", "Manikonda", "Financial District", "Nanakramguda"],
    teams: [
      { name: "West Zone", agents: [{ name: "Anita Rao", target: 8 }, { name: "Vimal Shetty", target: 7 }, { name: "Reshma Khan", target: 7 }] },
      { name: "Central Zone", agents: [{ name: "Karan Mehta", target: 8 }, { name: "Suresh Kumar", target: 6 }, { name: "Farah Ali", target: 6 }] },
    ],
    projects: [
      { name: "Aurum Heights", builder: "Aparna Constructions", reraNo: "P02400004821", locality: "Kokapet", status: "ready", possessionDate: "Ready", amenities: ["Clubhouse", "Pool", "Gym", "Kids' play"], towers: 4 },
      { name: "Lakeside Residences", builder: "My Home Group", reraNo: "P02400005934", locality: "Narsingi", status: "under-construction", possessionDate: "Dec 2026", amenities: ["Lake view", "Sky lounge", "Pool"], towers: 6 },
      { name: "Greenfield Enclave", builder: "Rajapushpa Properties", reraNo: "P02400006102", locality: "Tellapur", status: "under-construction", possessionDate: "Jun 2027", amenities: ["Central park", "Clubhouse", "EV charging"], towers: 5 },
      { name: "Riverdale Heights", builder: "Prestige Group", reraNo: "P02400003345", locality: "Gachibowli", status: "ready", possessionDate: "Ready", amenities: ["Clubhouse", "Tennis", "Pool"], towers: 3 },
      { name: "Maple Woods", builder: "Vasavi Group", reraNo: "P02400004410", locality: "Kondapur", status: "ready", possessionDate: "Ready", amenities: ["Gym", "Jogging track"], towers: 2 },
      { name: "Skyline Towers", builder: "Sumadhura", reraNo: "P02400007781", locality: "Financial District", status: "under-construction", possessionDate: "Mar 2027", amenities: ["Sky deck", "Co-work", "Pool"], towers: 4 },
    ],
  },
  {
    id: "c2", name: "Skyline Estates", city: "Bengaluru", hue: 28, plan: "Scale", seed: 551122,
    buyerCount: 20, manager: "Kabir Shah", telecaller: "Asha Menon",
    localities: ["Whitefield", "Sarjapur", "Hebbal", "Indiranagar", "Electronic City", "Marathahalli", "Koramangala"],
    teams: [
      { name: "North Bengaluru", agents: [{ name: "Divya Nair", target: 7 }, { name: "Arnav Gupta", target: 6 }] },
      { name: "South Bengaluru", agents: [{ name: "Sneha Pillai", target: 7 }, { name: "Rohit Verma", target: 6 }] },
    ],
    projects: [
      { name: "Skyline Vista", builder: "Prestige Group", reraNo: "PRM/KA/RERA/1251/446/PR/220101", locality: "Whitefield", status: "ready", possessionDate: "Ready", amenities: ["Clubhouse", "Pool", "Gym"], towers: 5 },
      { name: "Brigade Lakefront", builder: "Brigade Group", reraNo: "PRM/KA/RERA/1251/309/PR/210715", locality: "Sarjapur", status: "under-construction", possessionDate: "Sep 2026", amenities: ["Lake view", "Co-work", "Pool"], towers: 7 },
      { name: "Embassy Grove", builder: "Embassy Group", reraNo: "PRM/KA/RERA/1250/303/PR/200120", locality: "Hebbal", status: "ready", possessionDate: "Ready", amenities: ["Sky deck", "Tennis", "Spa"], towers: 4 },
      { name: "Sobha Crest", builder: "Sobha Ltd", reraNo: "PRM/KA/RERA/1251/472/PR/221110", locality: "Marathahalli", status: "under-construction", possessionDate: "Dec 2026", amenities: ["Clubhouse", "Kids' play"], towers: 6 },
    ],
  },
  {
    id: "c3", name: "Metro Homes", city: "Pune", hue: 268, plan: "Growth", seed: 773344,
    buyerCount: 12, manager: "Neha Joshi", telecaller: "Rajesh Iyer",
    localities: ["Hinjewadi", "Baner", "Kharadi", "Wakad", "Viman Nagar", "Aundh"],
    teams: [
      { name: "Pune West", agents: [{ name: "Sameer Kale", target: 6 }, { name: "Pooja Shetty", target: 6 }, { name: "Aditya Rane", target: 5 }] },
    ],
    projects: [
      { name: "Metro Greens", builder: "Kolte-Patil", reraNo: "P52100012345", locality: "Hinjewadi", status: "under-construction", possessionDate: "Mar 2027", amenities: ["Clubhouse", "Pool"], towers: 5 },
      { name: "Riverside Pune", builder: "Godrej Properties", reraNo: "P52100023456", locality: "Kharadi", status: "ready", possessionDate: "Ready", amenities: ["River view", "Gym"], towers: 3 },
      { name: "Baner Heights", builder: "Gera Developments", reraNo: "P52100034567", locality: "Baner", status: "ready", possessionDate: "Ready", amenities: ["Clubhouse", "Co-work"], towers: 2 },
    ],
  },
];

const SUPER_ADMIN: OrgUser = { id: "u-super", name: "Maya Chen", initials: "MC", hue: 172, role: "super-admin", title: "Platform Admin · TheVertical.ai" };

interface ClientBundle {
  client: Client; teams: Team[]; users: OrgUser[];
  buyers: Buyer[]; messages: Message[]; projects: Project[]; units: Unit[]; deals: Deal[];
  reviewItems: ReviewItem[]; concierge: ConciergeChat[]; overnightLeads: OvernightLead[]; morningBrief: MorningBrief;
  activity: ActivityEvent[]; analytics: Analytics;
  drivers: Driver[]; cabs: Cab[]; cabBookings: CabBooking[];
}

function buildClient(spec: ClientSpec): ClientBundle {
  faker.seed(spec.seed);
  const client: Client = { id: spec.id, name: spec.name, city: spec.city, hue: spec.hue, plan: spec.plan };

  // teams + users
  const slug = spec.name.split(" ")[0].toLowerCase();
  const mkEmail = (n: string, i = 0) => `${n.split(" ")[0].toLowerCase()}${i ? i : ""}@${slug}.in`;
  const teams: Team[] = spec.teams.map((t, ti) => ({ id: `${spec.id}-t${ti + 1}`, clientId: spec.id, name: t.name, managerId: `${spec.id}-mgr` }));
  const manager: OrgUser = { id: `${spec.id}-mgr`, name: spec.manager, initials: initials(spec.manager), hue: spec.hue, role: "manager", clientId: spec.id, title: `Sales Manager · ${spec.name}`, email: mkEmail(spec.manager) };
  const agents: OrgUser[] = [];
  let aIdx = 0;
  spec.teams.forEach((t, ti) => {
    t.agents.forEach((a) => {
      aIdx++;
      agents.push({ id: `${spec.id}-a${aIdx}`, name: a.name, initials: initials(a.name), hue: (spec.hue + aIdx * 47) % 360, role: "agent", clientId: spec.id, teamId: `${spec.id}-t${ti + 1}`, title: "Sales Agent", target: a.target, email: mkEmail(a.name, aIdx) });
    });
  });
  const telecaller: OrgUser = { id: `${spec.id}-tc1`, name: spec.telecaller, initials: initials(spec.telecaller), hue: (spec.hue + 200) % 360, role: "telecaller", clientId: spec.id, title: `Telecaller · ${spec.name}`, email: mkEmail(spec.telecaller) };
  const users = [manager, ...agents, telecaller];

  // projects + units
  const projects: Project[] = spec.projects.map((p, i) => ({ ...p, id: `${spec.id}-p${i + 1}`, clientId: spec.id }));
  const units = buildUnits(spec.id, projects);

  // buyers
  const tones: ("hot" | "warm" | "cool")[] = [];
  const hotN = Math.round(spec.buyerCount * 0.28);
  const warmN = Math.round(spec.buyerCount * 0.38);
  for (let i = 0; i < spec.buyerCount; i++) tones.push(i < hotN ? "hot" : i < hotN + warmN ? "warm" : "cool");
  const names = makeNames(spec.buyerCount);
  const built = tones.map((t, i) => buildBuyer(i, t, { clientId: spec.id, agents, localities: spec.localities, name: names[i] }));
  const buyers = built.map((b) => b.buyer).sort((a, b) => b.score - a.score);
  const messages = built.flatMap((b) => b.messages);

  // matched units (locality-aware)
  for (const buyer of buyers) {
    const localityUnits = units.filter((u) => {
      const proj = projects.find((p) => p.id === u.projectId)!;
      return buyer.localityPrefs.length === 0 || buyer.localityPrefs.includes(proj.locality);
    });
    buyer.matchedUnitIds = matchUnits(buyer, localityUnits.length >= 2 ? localityUnits : units);
  }

  const deals = buildDeals(spec.id, buyers, projects, units);
  const reviewItems = buildReviewItems(spec.id, buyers);
  const concierge = buildConcierge(spec.id, buyers, projects, units, manager.name.split(" ")[0]);
  const activity = buildActivity(spec.id, buyers);
  const analytics = buildAnalytics(buyers, agents);
  const { overnightLeads, morningBrief } = buildOvernight(spec.id, buyers);
  const { drivers, cabs, cabBookings } = buildLogistics(spec.id, buyers, projects);

  return { client, teams, users, buyers, messages, projects, units, deals, reviewItems, concierge, overnightLeads, morningBrief, activity, analytics, drivers, cabs, cabBookings };
}

export interface SeedData {
  clients: Client[];
  users: OrgUser[];
  teams: Team[];
  buyers: Buyer[];
  messages: Message[];
  projects: Project[];
  units: Unit[];
  deals: Deal[];
  reviewItems: ReviewItem[];
  connectors: Connector[];
  concierge: ConciergeChat[];
  overnightLeads: OvernightLead[];
  morningBriefByClient: Record<string, MorningBrief>;
  activity: ActivityEvent[];
  analyticsByClient: Record<string, Analytics>;
  drivers: Driver[];
  cabs: Cab[];
  cabBookings: CabBooking[];
}

function aggregateAnalytics(byClient: Analytics[]): Analytics {
  const sumByStage = (stage: string) => byClient.reduce((s, a) => s + (a.funnel.find((f) => f.stage === stage)?.count ?? 0), 0);
  const funnel = byClient[0].funnel.map((f) => ({ stage: f.stage, count: sumByStage(f.stage) }));
  const srcMap = new Map<Source, { enquiries: number; bookings: number }>();
  byClient.forEach((a) => a.sourceROI.forEach((s) => { const m = srcMap.get(s.source) ?? { enquiries: 0, bookings: 0 }; m.enquiries += s.enquiries; m.bookings += s.bookings; srcMap.set(s.source, m); }));
  const sourceROI = [...srcMap.entries()].map(([source, m]) => ({ source, enquiries: m.enquiries, bookings: m.bookings, rate: Math.round((m.bookings / m.enquiries) * 1000) / 10 }));
  const agents = byClient.flatMap((a) => a.agents).sort((x, y) => y.bookings - x.bookings).slice(0, 6);
  const avg = (k: "capturePrecision" | "aiHandledShare" | "dedupeRate") => Math.round(byClient.reduce((s, a) => s + a.health[k], 0) / byClient.length);
  const bookingTrend = byClient[0].bookingTrend.map((b, i) => ({ week: b.week, bookings: byClient.reduce((s, a) => s + a.bookingTrend[i].bookings, 0), visits: byClient.reduce((s, a) => s + a.bookingTrend[i].visits, 0) }));
  return { funnel, sourceROI, agents, health: { capturePrecision: avg("capturePrecision"), aiHandledShare: avg("aiHandledShare"), dedupeRate: avg("dedupeRate") }, bookingTrend };
}

export function createSeed(): SeedData {
  // Single-client deployment for now. To go multi-tenant later: build all
  // CLIENT_SPECS again and prepend SUPER_ADMIN to `users` below.
  const bundles = CLIENT_SPECS.slice(0, 1).map(buildClient);

  const connectors: Connector[] = [
    { id: "99acres", name: "99acres", source: "99acres", status: "connected", detail: "1,204 enquiries synced · live" },
    { id: "magicbricks", name: "MagicBricks", source: "magicbricks", status: "connected", detail: "486 enquiries synced · live" },
    { id: "housing", name: "Housing.com", source: "housing", status: "token-expiring", detail: "Token expires in 2 days" },
    { id: "whatsapp", name: "WhatsApp Business", source: "whatsapp", status: "connected", detail: "Concierge live · 24×7" },
    { id: "ivr", name: "IVR / Missed-call", source: "ivr", status: "connected", detail: "1 number · calls transcribed" },
    { id: "website", name: "Website forms", source: "website", status: "error", detail: "Webhook needs re-auth" },
  ];

  const analyticsByClient: Record<string, Analytics> = {};
  const morningBriefByClient: Record<string, MorningBrief> = {};
  bundles.forEach((b) => { analyticsByClient[b.client.id] = b.analytics; morningBriefByClient[b.client.id] = b.morningBrief; });
  analyticsByClient["all"] = aggregateAnalytics(bundles.map((b) => b.analytics));

  return {
    clients: bundles.map((b) => b.client),
    // SUPER_ADMIN intentionally omitted — single-client mode. Re-add for multi-tenant.
    users: bundles.flatMap((b) => b.users),
    teams: bundles.flatMap((b) => b.teams),
    buyers: bundles.flatMap((b) => b.buyers),
    messages: bundles.flatMap((b) => b.messages),
    projects: bundles.flatMap((b) => b.projects),
    units: bundles.flatMap((b) => b.units),
    deals: bundles.flatMap((b) => b.deals),
    reviewItems: bundles.flatMap((b) => b.reviewItems),
    connectors,
    concierge: bundles.flatMap((b) => b.concierge),
    overnightLeads: bundles.flatMap((b) => b.overnightLeads),
    morningBriefByClient,
    activity: bundles.flatMap((b) => b.activity),
    analyticsByClient,
    drivers: bundles.flatMap((b) => b.drivers),
    cabs: bundles.flatMap((b) => b.cabs),
    cabBookings: bundles.flatMap((b) => b.cabBookings),
  };
}
