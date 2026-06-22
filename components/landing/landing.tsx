"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Sparkles, ArrowRight, ArrowUpRight, Check, Loader2, Database,
  Command as CommandIcon, ListChecks, Bot, Building2, Columns3, BarChart3,
  MessageCircle, Phone, PhoneIncoming, Globe, RadioTower, ScanSearch, CornerDownLeft, CalendarCheck,
} from "lucide-react";
import { ScoreBadge, AnimatedNumber } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* RelationOS — Real Estate Edition · landing. Thesis: a WhatsApp line becoming a booked site visit. */

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg text-text">
      <Ambient />
      <LandingNav />
      <main>
        <Hero />
        <Claims />
        <OmniMerge />
        <Screens />
        <Honest />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0" style={{ background: "radial-gradient(900px 500px at 78% -8%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 70%), radial-gradient(700px 500px at 0% 0%, color-mix(in oklab, var(--live) 8%, transparent), transparent 60%)" }} />
      <div className="absolute inset-0 opacity-[0.5]" style={{ backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)", backgroundSize: "64px 64px", maskImage: "radial-gradient(circle at 50% 25%, black, transparent 75%)", WebkitMaskImage: "radial-gradient(circle at 50% 25%, black, transparent 75%)" }} />
    </div>
  );
}

function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-[color-mix(in_oklab,var(--bg)_72%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-[#34b3a3] to-[#0c4a45] text-white shadow-[0_0_18px_-4px_rgba(52,179,163,0.7)]"><Sparkles size={17} strokeWidth={2.4} /></span>
          <span className="font-display text-[16px] font-bold tracking-tight">RelationOS</span>
          <span className="hidden rounded-pill border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-faint sm:inline">Real estate</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-text-muted md:flex">
          <a href="#how" className="transition-colors hover:text-text">How it works</a>
          <a href="#channels" className="transition-colors hover:text-text">Omni-channel</a>
          <a href="#screens" className="transition-colors hover:text-text">The screens</a>
          <a href="#honest" className="transition-colors hover:text-text">The honest part</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/onboarding" className="hidden h-9 items-center rounded-[10px] border border-border px-3.5 text-sm font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text sm:flex">Connect sources</Link>
          <Link href="/worklist" className="flex h-9 items-center gap-1.5 rounded-[10px] bg-accent px-3.5 text-sm font-semibold text-accent-contrast shadow-[0_0_22px_-7px_var(--accent)] transition-transform hover:scale-[1.03] active:scale-95">Launch demo <ArrowRight size={15} /></Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-[1180px] items-center gap-12 px-4 pb-16 pt-14 md:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-24 lg:pt-20">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-5 inline-flex items-center gap-2 rounded-pill border border-border bg-surface/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live" />
          </span>
          TheVertical.ai · real-estate CRM
        </div>

        <h1 className="font-display text-[40px] font-extrabold leading-[1.02] tracking-[-0.02em] sm:text-[54px] lg:text-[60px]">
          Book the site visit.
          <br className="hidden sm:block" /> Close{" "}
          <span className="relative whitespace-nowrap text-accent">the deal.<Underline /></span>
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-muted">
          RelationOS captures every 99acres lead, WhatsApp and missed call, qualifies buyers 24×7, and tells your
          agents exactly who to call — and which site visits to push. No forms. No leads dying in a spreadsheet.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/worklist" className="group inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-accent px-6 text-[15px] font-semibold text-accent-contrast shadow-[0_0_30px_-8px_var(--accent)] transition-transform hover:scale-[1.02] active:scale-95">
            Launch the live demo <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link href="/onboarding" className="inline-flex h-12 items-center justify-center gap-2 rounded-[12px] border border-border-strong px-6 text-[15px] font-medium text-text transition-colors hover:bg-surface">
            Connect your sources
          </Link>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-2.5 text-text-muted">
          {["Chat-first", "Self-driving", "Explainable"].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 text-sm"><Check size={15} className="text-accent" strokeWidth={2.6} />{t}</span>
          ))}
          <span className="hidden items-center gap-1.5 text-sm text-text-faint sm:inline-flex">
            <span className="mx-1 h-4 w-px bg-border" />Press
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px]"><CommandIcon size={10} className="inline" /> K</kbd> to talk to it
          </span>
        </div>
      </motion.div>

      <LiveTransform />
    </section>
  );
}

function Underline() {
  const reduce = useReducedMotion();
  return (
    <svg className="absolute -bottom-2 left-0 w-full" height="10" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden>
      <motion.path d="M2,7 C50,2 150,2 198,6" fill="none" stroke="var(--live)" strokeWidth="3" strokeLinecap="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }} />
    </svg>
  );
}

const TRANSFORM_FIELDS = [
  { label: "Buyer", value: "Rohan Mehta", tag: "matched" },
  { label: "Requirement", value: "3BHK · Kokapet", tag: "from chat" },
  { label: "Budget", value: "₹1.4 Cr · loan ready", tag: "from chat" },
  { label: "Site visit", value: "Sat 11:00 AM", tag: "booked by AI" },
];

function LiveTransform() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(reduce ? 3 : 0);
  const timers = useRef<number[]>([]);

  const play = useCallback(() => {
    timers.current.forEach(clearTimeout);
    if (reduce) { setPhase(3); return; }
    setPhase(0);
    timers.current = [
      window.setTimeout(() => setPhase(1), 1100),
      window.setTimeout(() => setPhase(2), 2000),
      window.setTimeout(() => setPhase(3), 3500),
    ];
  }, [reduce]);

  useEffect(() => { play(); return () => timers.current.forEach(clearTimeout); }, [play]);

  return (
    <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }} className="relative">
      <div aria-hidden className="absolute -inset-4 -z-10 rounded-[28px] opacity-60 blur-2xl" style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--accent) 22%, transparent), transparent)" }} />
      <div className="overflow-hidden rounded-[18px] border border-border bg-surface shadow-[var(--shadow-lift)]">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint"><RadioTower size={13} className="text-accent" /> Customer AI Concierge</div>
          <button onClick={play} className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-text-faint transition-colors hover:bg-surface-2 hover:text-text-muted">Replay</button>
        </div>

        <div className="border-b border-border p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-positive-soft text-positive"><MessageCircle size={15} strokeWidth={2.2} /></span>
            <div>
              <div className="text-sm font-semibold">WhatsApp · 99acres buyer</div>
              <div className="font-mono text-[10px] uppercase tracking-wide text-text-faint">AI replying live</div>
            </div>
          </div>
          <p className="text-[15px] leading-relaxed text-text-muted">
            “Hi, saw your <span className="text-text">3BHK in Kokapet</span> on 99acres. Budget around{" "}
            <span className="text-text">1.4 cr, loan&apos;s ready</span> — can we <span className="text-text">visit Saturday</span>?”
          </p>
        </div>

        <div className="relative p-4">
          {phase === 1 && <div className="scan-sweep pointer-events-none absolute inset-0" />}
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint"><ScanSearch size={13} className="text-accent" /> Scored buyer · site visit</span>
            <PhasePill phase={phase} />
          </div>

          <div className="flex items-center gap-4">
            <ScoreBadge score={phase >= 2 ? 86 : 71} size={56} />
            <div className="min-w-0">
              <div className="text-[15px] font-semibold">Rohan Mehta · 3BHK</div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-text-faint">intent score</span>
                <AnimatePresence>
                  {phase >= 2 && <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="font-mono font-semibold text-positive">+15 · #1 to call</motion.span>}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {TRANSFORM_FIELDS.map((f, i) => (
              <AnimatePresence key={f.label}>
                {phase >= 2 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1, type: "spring", stiffness: 400, damping: 28 }} className="rounded-[10px] border border-border bg-surface-2 px-3 py-2">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-faint">{f.label}</div>
                    <div className="truncate text-sm font-medium text-text">{f.value}</div>
                    <div className="mt-0.5 flex items-center gap-1 font-mono text-[9px] uppercase tracking-wide text-accent"><ScanSearch size={9} /> {f.tag}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
            {phase < 2 && [0, 1, 2, 3].map((i) => <div key={i} className="h-[58px] rounded-[10px] border border-dashed border-border" />)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PhasePill({ phase }: { phase: number }) {
  if (phase < 1) return <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-text-faint">qualifying…</span>;
  if (phase === 1) return <span className="inline-flex items-center gap-1.5 rounded-pill bg-live-soft px-2.5 py-1 font-mono text-[11px] text-live"><Loader2 size={11} className="animate-spin" /> matching units</span>;
  if (phase === 2) return <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent-soft px-2.5 py-1 font-mono text-[11px] text-accent"><Database size={11} /> booking</span>;
  return (
    <motion.span initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} className="inline-flex items-center gap-1.5 rounded-pill bg-positive-soft px-2.5 py-1 font-mono text-[11px] text-positive">
      <Check size={11} strokeWidth={3} /> saved · scored · visit booked
    </motion.span>
  );
}

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.5, delay }} className={className}>
      {children}
    </motion.div>
  );
}

function SectionHead({ kicker, title, blurb }: { kicker: string; title: string; blurb?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">{kicker}</div>
      <h2 className="font-display text-[30px] font-bold leading-tight tracking-tight sm:text-[40px]">{title}</h2>
      {blurb && <p className="mt-4 text-base leading-relaxed text-text-muted">{blurb}</p>}
    </div>
  );
}

function Claims() {
  return (
    <section id="how" className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-16 md:px-6 lg:py-24">
      <Reveal><SectionHead kicker="What every screen says" title="A CRM that drives, unifies, and explains itself" blurb="Three promises the product keeps on every screen — and the proof that it does." /></Reveal>
      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        <Reveal delay={0}><ClaimCard icon={RadioTower} title="It drives itself" body="99acres, MagicBricks and WhatsApp leads qualify themselves, buyers re-score, and your day re-ranks — agents never fill a form."><DriveProof /></ClaimCard></Reveal>
        <Reveal delay={0.08}><ClaimCard icon={Building2} title="It's one surface" body="Portals, WhatsApp, calls and walk-ins resolve into one buyer and one ranked list. Source is a label, not an inbox."><ChannelsProof /></ClaimCard></Reveal>
        <Reveal delay={0.16}><ClaimCard icon={ScanSearch} title="It explains itself" body="Every score carries a why you can click — the exact message it heard. The opposite of a black box."><ExplainProof /></ClaimCard></Reveal>
      </div>
    </section>
  );
}

function ClaimCard({ icon: Icon, title, body, children }: { icon: typeof RadioTower; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-[16px] border border-border bg-surface p-6 transition-colors hover:border-border-strong">
      <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-accent-soft text-accent"><Icon size={19} strokeWidth={2.1} /></span>
      <h3 className="mt-4 font-display text-xl font-bold">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-text-muted">{body}</p>
      <div className="mt-5 rounded-[12px] border border-border bg-surface-inset/60 p-4">{children}</div>
    </div>
  );
}

function DriveProof() {
  const reduce = useReducedMotion();
  const [bump, setBump] = useState(false);
  useEffect(() => { if (reduce) return; const id = setInterval(() => setBump((b) => !b), 2600); return () => clearInterval(id); }, [reduce]);
  const rows = bump
    ? [{ n: "Rohan Mehta", s: 86, hot: true }, { n: "Priya Iyer", s: 78 }, { n: "Vikram Nair", s: 71 }]
    : [{ n: "Priya Iyer", s: 78 }, { n: "Vikram Nair", s: 71 }, { n: "Rohan Mehta", s: 71, hot: true }];
  return (
    <div className="space-y-1.5">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-text-faint">Worklist · re-ranks itself</div>
      {rows.map((r) => (
        <motion.div key={r.n} layout transition={{ type: "spring", stiffness: 420, damping: 34 }} className={cn("flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm", r.hot ? "bg-accent-soft" : "bg-surface-2")}>
          <span className={cn("font-medium", r.hot && "text-accent")}>{r.n}</span>
          <span className="font-mono tabular text-text-muted">{r.s}</span>
        </motion.div>
      ))}
    </div>
  );
}

const CH = [
  { icon: Building2, c: "var(--accent)" },
  { icon: MessageCircle, c: "var(--positive)" },
  { icon: Phone, c: "var(--live)" },
  { icon: PhoneIncoming, c: "var(--text-muted)" },
  { icon: Globe, c: "var(--text-muted)" },
];
function ChannelsProof() {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-text-faint">Portals + WhatsApp + calls</div>
      <div className="flex items-center justify-between gap-1">
        {CH.map(({ icon: Icon, c }, i) => (
          <span key={i} className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${c} 16%, transparent)`, color: c }}><Icon size={15} strokeWidth={2.2} /></span>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-border-strong to-accent" />
        <span className="rounded-pill bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-contrast">One buyer</span>
      </div>
    </div>
  );
}

function ExplainProof() {
  const [open, setOpen] = useState(true);
  useEffect(() => { const id = setInterval(() => setOpen((o) => !o), 2800); return () => clearInterval(id); }, []);
  return (
    <div>
      <div className="flex items-center justify-between"><span className="text-sm font-medium">Site-visit intent</span><span className="font-mono text-sm font-semibold text-positive">+14</span></div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden font-mono text-[11px] italic leading-relaxed text-text-faint">
            “can we visit Saturday?” — WhatsApp, 2h ago
          </motion.p>
        )}
      </AnimatePresence>
      <div className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-accent"><ScanSearch size={10} /> source you can click</div>
    </div>
  );
}

function OmniMerge() {
  const streams = [
    { icon: Building2, label: "99acres" },
    { icon: Building2, label: "MagicBricks" },
    { icon: MessageCircle, label: "WhatsApp" },
    { icon: PhoneIncoming, label: "Missed call" },
    { icon: Globe, label: "Website" },
  ];
  return (
    <section id="channels" className="scroll-mt-20 border-y border-border bg-surface/40">
      <div className="mx-auto max-w-[1180px] px-4 py-16 md:px-6 lg:py-20">
        <Reveal><SectionHead kicker="One canvas, every channel" title="Every portal in. One buyer out." blurb="No tabs, no copy-paste, no duplicate chasing. Every touch on a buyer — however it arrived — lands on a single timeline and a single ranked worklist." /></Reveal>
        <Reveal delay={0.1}>
          <div className="mt-12 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {streams.map(({ icon: Icon, label }, i) => (
                <div key={label} className="flex items-center gap-3 rounded-[12px] border border-border bg-surface px-4 py-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-text-muted"><Icon size={16} strokeWidth={2.1} /></span>
                  <span className="text-sm font-medium">{label}</span>
                  {i === 2 && <span className="ml-auto rounded-pill bg-positive-soft px-2 py-0.5 text-[10px] font-semibold text-positive">live</span>}
                </div>
              ))}
            </div>
            <div className="hidden place-items-center lg:grid">
              <motion.div animate={{ x: [0, 6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="text-accent"><ArrowRight size={28} /></motion.div>
            </div>
            <div className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint">Rohan Mehta · one timeline</div>
              <div className="space-y-2.5">
                {[
                  { icon: Building2, t: "99acres enquiry · 3BHK Kokapet", s: "4d" },
                  { icon: Phone, t: "Discovery call · summarized", s: "2d" },
                  { icon: MessageCircle, t: "“can we visit Saturday?”", s: "2h" },
                ].map(({ icon: Icon, t, s }, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={13} strokeWidth={2.2} /></span>
                    <span className="flex-1 truncate text-sm text-text-muted">{t}</span>
                    <span className="font-mono text-[11px] text-text-faint">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const SCREENS = [
  { href: "/worklist", icon: ListChecks, name: "Worklist", blurb: "The day, ranked. Opens on which buyers to call — re-ranks live." },
  { href: "/buyers/b1", icon: Building2, name: "Buyer 360", blurb: "One timeline across every channel, with matched units from inventory." },
  { href: "/concierge", icon: Bot, name: "Customer AI Concierge", blurb: "The AI that qualifies and books site visits on WhatsApp, 24×7." },
  { href: "/inventory", icon: Building2, name: "Inventory", blurb: "Projects & units the AI quotes from — match-highlighted to a buyer." },
  { href: "/pipeline", icon: Columns3, name: "Pipeline", blurb: "Enquiry → site visit → booking → registration. It maintains itself." },
  { href: "/dashboard", icon: BarChart3, name: "Owner dashboard", blurb: "Which portal actually books flats — numbers, not promises." },
];

function Screens() {
  return (
    <section id="screens" className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-16 md:px-6 lg:py-24">
      <Reveal><SectionHead kicker="The screens" title="Twelve surfaces. Every one of them live." blurb="This is the real product front end, not a slideshow. Jump into any screen — the demo data is already flowing." /></Reveal>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SCREENS.map((s, i) => (
          <Reveal key={s.href} delay={(i % 3) * 0.06}>
            <Link href={s.href} className="group flex h-full items-start gap-4 rounded-[16px] border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-soft)]">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-accent-soft text-accent"><s.icon size={19} strokeWidth={2.1} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5"><h3 className="font-display text-[17px] font-bold">{s.name}</h3><ArrowUpRight size={15} className="text-text-faint transition-all group-hover:translate-x-0.5 group-hover:text-accent" /></div>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{s.blurb}</p>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Honest() {
  const rows = [
    { fake: "Mocked Indian data", real: "Buyers, projects, units and ₹ prices are seeded. The front end is production-shaped and swaps to the real API behind one interface." },
    { fake: "Scripted “live” events", real: "The incoming WhatsApp / portal lead / missed call is fired by the Conductor — staged for reliability, not a working pipeline." },
    { fake: "Seeded buyer scores", real: "Placeholder scores that look real; the actual scoring engine is heuristic-then-learned, built later." },
    { fake: "Compliance", real: "When the engine lands it respects DND / TRAI, surfaces RERA numbers, and consent-flags WhatsApp opt-ins." },
  ];
  return (
    <section id="honest" className="scroll-mt-20 border-t border-border bg-surface/40">
      <div className="mx-auto max-w-[1180px] px-4 py-16 md:px-6 lg:py-24">
        <Reveal><SectionHead kicker="Straight talk" title="What we fake. What we promise." blurb="Technical buyers can smell vaporware. So, plainly: you're looking at the real product's front end. The intelligence underneath is what we build next." /></Reveal>
        <Reveal delay={0.1}>
          <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-[16px] border border-border bg-surface">
            <div className="grid grid-cols-2 border-b border-border bg-surface-2/60 px-5 py-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint">In the demo it&apos;s…</div>
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">The honest position</div>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-2 gap-4 border-b border-border px-5 py-4 last:border-0">
                <div className="text-sm text-text-muted">{r.fake}</div>
                <div className="text-sm text-text">{r.real}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-[1180px] px-4 py-20 md:px-6 lg:py-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-[24px] border border-border bg-surface px-6 py-14 text-center shadow-[var(--shadow-lift)] md:px-12">
          <div aria-hidden className="absolute inset-0 -z-10 opacity-70" style={{ background: "radial-gradient(600px 280px at 50% 0%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 70%)" }} />
          <h2 className="mx-auto max-w-2xl font-display text-[32px] font-extrabold leading-tight tracking-tight sm:text-[46px]">See it sell itself.</h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-text-muted">
            Everything here is the real product&apos;s front end — only the data is simulated today. Open the worklist,
            press <Kbd>⌘K</Kbd> to talk to it, or <Kbd>⌘J</Kbd> to watch the concierge book a visit live.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/worklist" className="group inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-accent px-7 text-[15px] font-semibold text-accent-contrast shadow-[0_0_30px_-8px_var(--accent)] transition-transform hover:scale-[1.02] active:scale-95">
              Launch the live demo <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/onboarding" className="inline-flex h-12 items-center justify-center gap-2 rounded-[12px] border border-border-strong px-7 text-[15px] font-medium text-text transition-colors hover:bg-surface-2">
              <CalendarCheck size={16} /> Connect your sources first
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-text-muted">{children}</kbd>;
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row md:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#34b3a3] to-[#0c4a45] text-white"><Sparkles size={14} strokeWidth={2.4} /></span>
          <span className="font-display text-sm font-bold">RelationOS</span>
          <span className="font-mono text-[11px] text-text-faint">· real estate · thevertical.ai</span>
        </div>
        <p className="font-mono text-[11px] text-text-faint">Front-end experience demo · confidential · mocked data</p>
      </div>
    </footer>
  );
}
