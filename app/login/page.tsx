"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Sparkles, ArrowRight, Mail, Lock, ArrowLeft, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar } from "@/components/ui/primitives";
import { ROLE_LABEL, type OrgUser } from "@/lib/data/types";

export default function LoginPage() {
  const router = useRouter();
  const users = useStore((s) => s.users);
  const clients = useStore((s) => s.clients);
  const activeClientId = useStore((s) => s.activeClientId);
  const login = useStore((s) => s.login);
  const authed = useStore((s) => s.authed);
  const restoreSession = useStore((s) => s.restoreSession);

  // already signed in? skip the form
  useEffect(() => { restoreSession(); }, [restoreSession]);
  useEffect(() => { if (authed) router.replace("/home"); }, [authed, router]);

  const clientName = clients.find((c) => c.id === activeClientId)?.name ?? "RelationOS";
  const demo = useMemo(() => {
    const cu = users.filter((u) => u.clientId === activeClientId && u.email);
    return [
      cu.find((u) => u.role === "manager"),
      cu.find((u) => u.role === "agent"),
      cu.find((u) => u.role === "telecaller"),
    ].filter(Boolean) as OrgUser[];
  }, [users, activeClientId]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const enter = (u: OrgUser) => { login(u.id); router.push("/home"); };
  const pick = (u: OrgUser) => { setEmail(u.email ?? ""); setPassword("demo1234"); enter(u); };
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = users.find((x) => x.email && x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u) return toast.error("No account for that email — try a demo account below.");
    if (!password.trim()) return toast.error("Enter your password.");
    enter(u);
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute -top-1/3 left-1/2 h-[60vh] w-[60vh] -translate-x-1/2 rounded-full opacity-[0.18] blur-[120px]"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[420px] rounded-[20px] border border-border bg-surface p-6 shadow-[var(--shadow-lift)] sm:p-8"
      >
        {/* brand */}
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-[11px] bg-gradient-to-br from-[#34b3a3] to-[#0c4a45] text-white shadow-[0_0_18px_-4px_rgba(52,179,163,0.6)]">
            <Sparkles size={18} strokeWidth={2.4} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[16px] font-bold tracking-tight text-text">RelationOS</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-faint">thevertical.ai</div>
          </div>
        </div>

        <h1 className="mt-6 font-display text-[22px] font-bold tracking-tight text-text">Sign in</h1>
        <p className="mt-1 text-sm text-text-muted">Welcome back to <span className="text-text">{clientName}</span> — real-estate sales on autopilot.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-text-faint">Email</span>
            <div className="flex h-11 items-center gap-2 rounded-[11px] border border-border bg-surface-2 px-3 focus-within:border-border-strong">
              <Mail size={15} className="shrink-0 text-text-faint" />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.in" autoComplete="username"
                className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-faint"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-text-faint">Password</span>
            <div className="flex h-11 items-center gap-2 rounded-[11px] border border-border bg-surface-2 px-3 focus-within:border-border-strong">
              <Lock size={15} className="shrink-0 text-text-faint" />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-faint"
              />
            </div>
          </label>
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-[11px] bg-accent text-sm font-semibold text-accent-contrast shadow-[0_0_22px_-7px_var(--accent)] transition-transform hover:scale-[1.01] active:scale-95"
          >
            Sign in <ArrowRight size={16} />
          </button>
        </form>

        {/* demo accounts */}
        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">or continue as</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="space-y-2">
          {demo.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => pick(u)}
              className="group flex w-full items-center gap-3 rounded-[12px] border border-border bg-surface-2 px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-inset"
            >
              <Avatar name={u.name} hue={u.hue} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-text">{u.name}</span>
                  <span className="rounded-pill bg-accent-soft px-2 py-0.5 font-mono text-[10px] text-accent">{ROLE_LABEL[u.role]}</span>
                </div>
                <div className="truncate font-mono text-[11px] text-text-faint">{u.email}</div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-text" />
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-text">
            <ArrowLeft size={13} /> Back to site
          </Link>
          <span className="font-mono text-[10px] text-text-faint">demo · any password works</span>
        </div>
      </motion.div>
    </div>
  );
}
