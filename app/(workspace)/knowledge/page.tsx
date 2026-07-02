"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  BookOpen, Search, Sparkles, ShieldCheck, Bot, Plus, X, Tag, ArrowRight, Eye,
  Building2, CircleDollarSign, Scale, Landmark, MessageSquare, ListChecks, Check, Send,
} from "lucide-react";
import { useClientKbArticles, useCurrentUser } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Pill, Label } from "@/components/ui/primitives";
import { KB_CATEGORIES, type KbCategory, type KbArticle } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const CAT_ICON: Record<KbCategory, typeof BookOpen> = {
  "Projects": Building2,
  "Pricing & Payment": CircleDollarSign,
  "Legal & Compliance": Scale,
  "Home Loans": Landmark,
  "Objection Handling": MessageSquare,
  "Process & SOPs": ListChecks,
  "Policies": ShieldCheck,
};

const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Relevance score of an article against the search/ask terms. */
function score(a: KbArticle, terms: string[]): number {
  const t = a.title.toLowerCase(), s = a.summary.toLowerCase(), b = a.body.toLowerCase(), tags = a.tags.join(" ").toLowerCase();
  let sc = 0;
  for (const term of terms) {
    if (t.includes(term)) sc += 6;
    if (tags.includes(term)) sc += 4;
    if (s.includes(term)) sc += 3;
    if (b.includes(term)) sc += 1;
  }
  return sc;
}

/** Render the article body — "- " lines become bullets, blank lines separate paragraphs. */
function ArticleBody({ body }: { body: string }) {
  const lines = body.split("\n");
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const l = line.trim();
        if (!l) return null;
        if (l.startsWith("- ")) return (
          <div key={i} className="flex items-start gap-2 text-sm leading-relaxed text-text-muted"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /><span>{l.slice(2)}</span></div>
        );
        return <p key={i} className="text-sm leading-relaxed text-text">{l}</p>;
      })}
    </div>
  );
}

export default function KnowledgePage() {
  const articles = useClientKbArticles();
  const role = useCurrentUser().role;
  const isManager = role === "manager" || role === "super-admin";
  const addKbArticle = useStore((s) => s.addKbArticle);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<KbCategory | "All">("All");
  const [ask, setAsk] = useState("");
  const [answer, setAnswer] = useState<KbArticle[] | null>(null);
  const [open, setOpen] = useState<KbArticle | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const stats = useMemo(() => ({
    total: articles.length,
    cats: new Set(articles.map((a) => a.category)).size,
    ai: articles.filter((a) => a.usedByAi && a.approved).length,
    approved: articles.filter((a) => a.approved).length,
  }), [articles]);

  const filtered = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    let list = cat === "All" ? articles : articles.filter((a) => a.category === cat);
    if (terms.length) {
      list = list.map((a) => ({ a, s: score(a, terms) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s).map((x) => x.a);
    } else {
      list = [...list].sort((a, b) => b.views - a.views);
    }
    return list;
  }, [articles, q, cat]);

  const runAsk = () => {
    const terms = ask.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) { setAnswer(null); return; }
    const ranked = articles.map((a) => ({ a, s: score(a, terms) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s).slice(0, 3).map((x) => x.a);
    setAnswer(ranked);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Knowledge Base"
        description="The team's approved answers — prices, projects, policies and objection handling. The AI quotes these when it replies, and every agent shares the same facts."
      />

      {/* stat row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<BookOpen size={15} />} value={stats.total} label="Articles" />
        <Stat icon={<ListChecks size={15} />} value={stats.cats} label="Categories" />
        <Stat icon={<Bot size={15} />} value={stats.ai} label="Used by AI" accent />
        <Stat icon={<ShieldCheck size={15} />} value={stats.approved} label="Guardian-cleared" />
      </div>

      {/* Ask the Knowledge Base */}
      <div className="mt-3 rounded-[6px] border border-border bg-surface p-4 shadow-[var(--shadow-soft)] md:p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="shrink-0 text-accent" />
          <Label>Ask the Knowledge Base</Label>
        </div>
        <p className="mt-1.5 text-sm leading-snug text-text-muted">Type a buyer's question and get the saved answer the AI would use — e.g. “what's the floor-rise and GST?” or “documents to book”.</p>
        <form onSubmit={(e) => { e.preventDefault(); runAsk(); }} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex h-11 flex-1 items-center gap-2 rounded-[5px] border border-border bg-surface-inset px-3 transition-colors focus-within:border-border-strong">
            <Sparkles size={14} className="shrink-0 text-accent" />
            <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask a question…" className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-faint" />
          </div>
          <button type="submit" className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-[5px] bg-accent px-5 text-sm font-semibold text-accent-contrast shadow-[0_0_22px_-8px_var(--accent)] transition-transform hover:scale-[1.02] active:scale-95">
            <Send size={15} /> Ask
          </button>
        </form>

        <AnimatePresence mode="wait">
          {answer && (
            <motion.div key={answer.map((a) => a.id).join()} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
              {answer.length === 0 ? (
                <div className="rounded-[6px] border border-dashed border-border bg-surface-inset/50 p-4 text-sm text-text-muted">
                  No saved answer yet. {isManager ? <button onClick={() => setAddOpen(true)} className="font-semibold text-accent">Add this article →</button> : "Ask your manager to add it to the Knowledge Base."}
                </div>
              ) : (
                <div className="rounded-[6px] border border-accent/30 bg-accent-soft/40 p-4">
                  <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-accent"><Bot size={12} /> Top answer{answer[0].usedByAi ? " · the AI replies with this" : " · internal reference"}</div>
                  <button onClick={() => setOpen(answer[0])} className="text-left">
                    <div className="text-[15px] font-semibold text-text hover:text-accent">{answer[0].title}</div>
                  </button>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">{answer[0].summary}</p>
                  <button onClick={() => setOpen(answer[0])} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent">Open full answer <ArrowRight size={13} /></button>
                  {answer.length > 1 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">Related</span>
                      {answer.slice(1).map((a) => (
                        <button key={a.id} onClick={() => setOpen(a)} className="rounded-pill border border-border bg-surface px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text">{a.title}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* toolbar: search + add */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-10 w-full items-center gap-2 rounded-[5px] border border-border bg-surface px-3 transition-colors focus-within:border-border-strong sm:max-w-sm">
          <Search size={15} className="shrink-0 text-text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles…" className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-faint" />
          {q && <button onClick={() => setQ("")} className="text-text-faint hover:text-text"><X size={14} /></button>}
        </div>
        {isManager && (
          <button onClick={() => setAddOpen(true)} className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[5px] bg-accent px-3.5 text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.02] active:scale-95">
            <Plus size={15} /> Add article
          </button>
        )}
      </div>

      {/* category chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {(["All", ...KB_CATEGORIES] as const).map((c) => {
          const active = cat === c;
          const n = c === "All" ? articles.length : articles.filter((a) => a.category === c).length;
          return (
            <button key={c} onClick={() => setCat(c as KbCategory | "All")} className={cn("inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors", active ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface-2 text-text-muted hover:border-border-strong hover:text-text")}>
              {c} <span className="tabular font-mono text-[10px] opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {/* article grid */}
      {filtered.length === 0 ? (
        <div className="mt-6 rounded-[6px] border border-dashed border-border p-10 text-center text-sm text-text-faint">No articles match. {isManager && <button onClick={() => setAddOpen(true)} className="font-semibold text-accent">Add one →</button>}</div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a, i) => {
            const Icon = CAT_ICON[a.category];
            return (
              <motion.button
                key={a.id} onClick={() => setOpen(a)}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                className="group flex flex-col rounded-[6px] border border-border bg-surface p-4 text-left shadow-[var(--shadow-soft)] transition-colors hover:border-border-strong"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-muted"><Icon size={12} /> {a.category}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    {a.usedByAi && a.approved && <span title="The AI quotes this" className="grid h-5 w-5 place-items-center rounded-[4px] bg-accent-soft text-accent"><Bot size={12} /></span>}
                    {a.approved ? <span title="Guardian-cleared" className="grid h-5 w-5 place-items-center rounded-[4px] bg-positive-soft text-positive"><ShieldCheck size={12} /></span> : <Pill variant="live" mono>draft</Pill>}
                  </div>
                </div>
                <div className="text-sm font-semibold leading-snug text-text group-hover:text-accent">{a.title}</div>
                <p className="mt-1 line-clamp-2 flex-1 text-[13px] leading-relaxed text-text-muted">{a.summary}</p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5 font-mono text-[10px] text-text-faint">
                  <span className="inline-flex items-center gap-1"><Eye size={11} /> {a.views}</span>
                  <span suppressHydrationWarning>Updated {fmtDate(a.updatedAt)} · {a.author.split(" ")[0]}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* reading drawer */}
      <AnimatePresence>
        {open && <ReadDrawer article={open} onClose={() => setOpen(null)} />}
      </AnimatePresence>

      {/* add-article drawer (manager) */}
      <AnimatePresence>
        {addOpen && isManager && (
          <AddDrawer
            onClose={() => setAddOpen(false)}
            onSave={(input) => { addKbArticle(input); toast.success("Article added", { description: `"${input.title}" is now in the Knowledge Base.` }); setAddOpen(false); }}
          />
        )}
      </AnimatePresence>
    </PageContainer>
  );
}

function Stat({ icon, value, label, accent }: { icon: React.ReactNode; value: number; label: string; accent?: boolean }) {
  return (
    <div className="rounded-[6px] border border-border bg-surface p-3.5 shadow-[var(--shadow-soft)]">
      <span className={cn("inline-flex", accent ? "text-accent" : "text-text-faint")}>{icon}</span>
      <div className={cn("tabular mt-1.5 font-display text-2xl font-bold leading-none", accent ? "text-accent" : "text-text")}>{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-text-faint">{label}</div>
    </div>
  );
}

/* ---------------- reading drawer ---------------- */
function ReadDrawer({ article, onClose }: { article: KbArticle; onClose: () => void }) {
  const Icon = CAT_ICON[article.category];
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-[rgba(5,18,52,0.45)] backdrop-blur-[2px]" />
      <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col bg-surface shadow-[var(--shadow-lift)]">
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] bg-accent-soft text-accent"><Icon size={17} /></span>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-wide text-text-faint">{article.category}</div>
            <div className="text-[15px] font-semibold leading-snug text-text">{article.title}</div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-[5px] border border-border text-text-muted transition-colors hover:text-text" aria-label="Close"><X size={16} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-2">
            {article.approved
              ? <Pill variant="positive" mono><ShieldCheck size={11} /> Guardian-cleared</Pill>
              : <Pill variant="live" mono>draft · pending review</Pill>}
            {article.usedByAi
              ? <Pill variant="accent" mono><Bot size={11} /> Used by AI</Pill>
              : <Pill variant="neutral" mono>internal only</Pill>}
          </div>

          <p className="rounded-[5px] border-l-2 border-accent bg-accent-soft/30 px-3 py-2 text-sm font-medium text-text">{article.summary}</p>

          <ArticleBody body={article.body} />

          {article.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
              <Tag size={12} className="text-text-faint" />
              {article.tags.map((t) => (<span key={t} className="rounded-[4px] bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-muted">{t}</span>))}
            </div>
          )}

          <div className="rounded-[5px] bg-surface-inset p-3 text-xs leading-relaxed text-text-muted">
            {article.usedByAi
              ? <><Bot size={13} className="mr-1 inline text-accent" /> The AI quotes this article when replying to buyers on WhatsApp, calls and email — so answers stay accurate and consistent.</>
              : <><ShieldCheck size={13} className="mr-1 inline text-text-faint" /> Internal reference only — this is not auto-quoted by the AI.</>}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3 font-mono text-[11px] text-text-faint">
          <span suppressHydrationWarning>Updated {fmtDate(article.updatedAt)} · {article.author}</span>
          <span className="inline-flex items-center gap-1"><Eye size={12} /> {article.views} views</span>
        </div>
      </motion.aside>
    </>
  );
}

/* ---------------- add-article drawer (manager) ---------------- */
function AddDrawer({ onClose, onSave }: { onClose: () => void; onSave: (i: { title: string; category: KbCategory; summary: string; body: string; tags: string[]; usedByAi: boolean }) => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<KbCategory>("Pricing & Payment");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [usedByAi, setUsedByAi] = useState(true);
  const valid = title.trim() && summary.trim() && body.trim();

  const inputCls = "w-full rounded-[5px] border border-border bg-surface-inset px-3 py-2 text-sm text-text outline-none transition-colors focus:border-border-strong placeholder:text-text-faint";

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-[rgba(5,18,52,0.45)] backdrop-blur-[2px]" />
      <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col bg-surface shadow-[var(--shadow-lift)]">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] bg-accent-soft text-accent"><Plus size={17} /></span>
          <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-text">Add Knowledge Base article</div><div className="font-mono text-[11px] text-text-faint">Saved as Guardian-cleared · the team + AI can use it</div></div>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-[5px] border border-border text-text-muted transition-colors hover:text-text" aria-label="Close"><X size={16} /></button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto p-5">
          <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Stamp duty & registration charges" className={inputCls} /></Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value as KbCategory)} className={inputCls}>
              {KB_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </Field>
          <Field label="One-line answer (summary)"><input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="The short answer agents & the AI will lead with" className={inputCls} /></Field>
          <Field label="Full answer">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder={"Details — start a line with '- ' for a bullet point."} className={cn(inputCls, "resize-y leading-relaxed")} />
          </Field>
          <Field label="Tags (comma-separated)"><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="pricing, gst, registration" className={inputCls} /></Field>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-[5px] border border-border bg-surface-2 px-3 py-2.5">
            <input type="checkbox" checked={usedByAi} onChange={(e) => setUsedByAi(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            <span className="flex items-center gap-1.5 text-sm text-text"><Bot size={14} className="text-accent" /> Let the AI quote this in autonomous replies</span>
          </label>
        </div>

        <div className="border-t border-border p-4">
          <button
            disabled={!valid}
            onClick={() => onSave({ title, category, summary, body, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), usedByAi })}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[5px] bg-accent text-sm font-semibold text-accent-contrast transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            <Check size={16} /> Save article
          </button>
        </div>
      </motion.aside>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-text-faint">{label}</div>
      {children}
    </div>
  );
}
