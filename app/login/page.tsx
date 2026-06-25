"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft, ChevronRight, Lock } from "lucide-react";
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

  // already signed in? skip the picker
  useEffect(() => { restoreSession(); }, [restoreSession]);
  useEffect(() => { if (authed) router.replace("/home"); }, [authed, router]);

  const clientName = clients.find((c) => c.id === activeClientId)?.name ?? "RelationOS";

  // One demo account per role in the active client.
  const roles = useMemo(() => {
    const cu = users.filter((u) => u.clientId === activeClientId);
    return [
      cu.find((u) => u.role === "manager"),
      cu.find((u) => u.role === "agent"),
      cu.find((u) => u.role === "telecaller"),
    ].filter(Boolean) as OrgUser[];
  }, [users, activeClientId]);

  const enter = (u: OrgUser) => { login(u.id); router.push("/home"); };

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
          <div className="grid h-9 w-9 place-items-center rounded-[11px] bg-gradient-to-br from-[#e2612d] to-[#1f3f74] text-white shadow-[0_0_18px_-4px_rgba(226,97,45,0.5)]">
            <Sparkles size={18} strokeWidth={2.4} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[16px] font-bold tracking-tight text-text">RelationOS</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-faint">thevertical.ai</div>
          </div>
        </div>

        <h1 className="mt-6 font-display text-[22px] font-bold tracking-tight text-text">Choose a role</h1>

        {/* demo-environment note — real auth comes later */}
        <div className="mt-3 flex items-start gap-2.5 rounded-[12px] border border-border bg-surface-2 px-3.5 py-3 text-sm text-text-muted">
          <Lock size={16} className="mt-0.5 shrink-0 text-accent" />
          <p>
            Real logins will be added later — this is a <span className="font-medium text-text">demo environment</span>.
            Pick a role below to explore <span className="text-text">{clientName}</span>.
          </p>
        </div>

        {/* role pickers */}
        <div className="mt-5 space-y-2">
          {roles.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => enter(u)}
              className="group flex w-full items-center gap-3 rounded-[12px] border border-border bg-surface-2 px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-inset"
            >
              <Avatar name={u.name} hue={u.hue} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-pill bg-accent-soft px-2 py-0.5 font-mono text-[10px] text-accent">{ROLE_LABEL[u.role]}</span>
                  <span className="truncate text-sm font-semibold text-text">{u.name}</span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-text-faint">{u.title}</div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-text" />
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-text">
            <ArrowLeft size={13} /> Back to site
          </Link>
          <span className="font-mono text-[10px] text-text-faint">demo · no password needed</span>
        </div>
      </motion.div>
    </div>
  );
}
