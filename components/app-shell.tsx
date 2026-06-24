"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useTheme } from "@/lib/theme";
import {
  ListChecks, Inbox, Bot, Building, Building2, Columns3, ShieldCheck, BarChart3,
  Users, Car, Megaphone, Video, Workflow, LayoutDashboard, LogOut, ListTodo, Plug, Search, Sun, Moon, Menu, X, Activity,
  Command as CommandIcon, Sparkles, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import {
  useCurrentUser, useIsSuperAdmin, useActiveClient,
  useScopedReviewItems, useScopedOvernightLeads,
} from "@/lib/roles";
import { ROLE_LABEL, type Role } from "@/lib/data/types";
import { Avatar, StatusDot } from "./ui/primitives";
import { ActivityPanel } from "./live-capture";

const SALES: Role[] = ["super-admin", "manager", "agent"];
const EVERYONE: Role[] = ["super-admin", "manager", "agent", "telecaller"];

type NavItem = { href: string; label: string; icon: typeof ListChecks; roles: Role[]; badge?: "leads" | "review" };
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Work",
    items: [
      { href: "/home", label: "Home", icon: LayoutDashboard, roles: EVERYONE },
      { href: "/leads", label: "Leads", icon: Inbox, roles: EVERYONE, badge: "leads" },
      { href: "/clients", label: "Clients", icon: Building, roles: ["super-admin"] },
      { href: "/worklist", label: "Worklist", icon: ListChecks, roles: EVERYONE },
      { href: "/tasks", label: "Tasks", icon: ListTodo, roles: EVERYONE },
      { href: "/concierge", label: "AI Inbox", icon: Bot, roles: EVERYONE },
      { href: "/inventory", label: "Inventory", icon: Building2, roles: SALES },
      { href: "/pipeline", label: "Pipeline", icon: Columns3, roles: SALES },
      { href: "/logistics", label: "Logistics", icon: Car, roles: EVERYONE },
      { href: "/broadcast", label: "Broadcast", icon: Megaphone, roles: SALES },
      { href: "/meetings", label: "Meetings", icon: Video, roles: SALES },
      { href: "/approvals", label: "Approvals", icon: ShieldCheck, roles: SALES, badge: "review" },
      { href: "/team", label: "Team", icon: Users, roles: ["manager"] },
      { href: "/analytics", label: "Analytics", icon: BarChart3, roles: ["super-admin", "manager"] },
    ],
  },
  {
    group: "Settings",
    items: [
      { href: "/settings/automations", label: "Automations", icon: Workflow, roles: ["manager"] },
      { href: "/settings/sources", label: "Sources", icon: Plug, roles: ["manager"] },
    ],
  },
];

function Brand() {
  return (
    <Link href="/home" className="flex items-center gap-2.5 px-1">
      <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-[#34b3a3] to-[#0c4a45] text-white shadow-[0_0_18px_-4px_rgba(52,179,163,0.6)]">
        <Sparkles size={17} strokeWidth={2.4} />
      </div>
      <div className="leading-tight">
        <div className="font-display text-[15px] font-bold tracking-tight text-chrome-text">RelationOS</div>
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-chrome-text-faint">thevertical.ai</div>
      </div>
    </Link>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const role = useCurrentUser().role;
  const reviewCount = useScopedReviewItems().length;
  const leadsCount = useScopedOvernightLeads().length;
  const badgeCount = (b?: "leads" | "review") => (b === "review" ? reviewCount : b === "leads" ? leadsCount : 0);

  return (
    <LayoutGroup id="nav">
      <nav className="flex flex-1 flex-col gap-6">
        {NAV.map((section) => {
          const items = section.items.filter((it) => it.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <div key={section.group}>
              <div className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-chrome-text-faint">{section.group}</div>
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} onClick={onNavigate} className={cn("group relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors", active ? "text-white" : "text-chrome-text hover:text-white")}>
                      {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-[10px] border border-[rgba(52,179,163,0.25)] bg-[rgba(52,179,163,0.12)]" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                      <Icon size={17} strokeWidth={2.1} className={cn("relative z-10 shrink-0", active && "text-[#43c9b8]")} />
                      <span className="relative z-10 flex-1">{item.label}</span>
                      {item.badge && badgeCount(item.badge) > 0 && (
                        <span className="relative z-10 grid h-5 min-w-5 place-items-center rounded-full bg-live px-1.5 text-[11px] font-bold text-white tabular">{badgeCount(item.badge)}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="pt-1"><Brand /></div>
      <NavItems onNavigate={onNavigate} />
      <div className="rounded-[12px] border border-chrome-border bg-[rgba(255,255,255,0.03)] p-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-chrome-text"><StatusDot color="#ec9a3c" pulse size={7} /> Live capture on</div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-chrome-text-faint">
          Press <kbd className="rounded bg-[rgba(255,255,255,0.08)] px-1 font-mono text-[10px]">⌘K</kbd> to talk to the CRM, or <kbd className="rounded bg-[rgba(255,255,255,0.08)] px-1 font-mono text-[10px]">⌘J</kbd> for the demo conductor.
        </p>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = theme === "dark";
  return (
    <button aria-label="Toggle theme" onClick={toggle} className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-surface text-text-muted transition-colors hover:text-text">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={mounted ? (isDark ? "moon" : "sun") : "x"} initial={{ rotate: -40, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 40, opacity: 0 }} transition={{ duration: 0.2 }}>
          {isDark ? <Moon size={16} /> : <Sun size={16} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/* ---------------- client switcher ---------------- */
function ClientSwitcher() {
  const isSuper = useIsSuperAdmin();
  const active = useActiveClient();
  const clients = useStore((s) => s.clients);
  const activeClientId = useStore((s) => s.activeClientId);
  const setActiveClient = useStore((s) => s.setActiveClient);

  if (!isSuper) {
    return (
      <span className="hidden h-9 items-center gap-2 rounded-[10px] border border-border bg-surface px-3 md:flex">
        <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${active?.hue ?? 168} 60% 45%)` }} />
        <span className="text-sm font-medium text-text">{active?.name}</span>
      </span>
    );
  }
  return (
    <div className="relative hidden h-9 items-center rounded-[10px] border border-border bg-surface md:flex">
      <Building size={14} className="ml-2.5 text-text-faint" />
      <select value={activeClientId} onChange={(e) => setActiveClient(e.target.value)} className="h-full cursor-pointer appearance-none bg-transparent pl-2 pr-8 text-sm font-medium text-text outline-none">
        {clients.map((c) => (<option key={c.id} value={c.id}>{c.name} · {c.city}</option>))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2 text-text-faint" />
    </div>
  );
}

/* ---------------- persona switcher ---------------- */
function PersonaSwitcher() {
  const user = useCurrentUser();
  const users = useStore((s) => s.users);
  const clients = useStore((s) => s.clients);
  const currentUserId = useStore((s) => s.currentUserId);
  const setCurrentUser = useStore((s) => s.setCurrentUser);

  return (
    <div className="relative flex h-9 items-center gap-2 rounded-[10px] border border-border bg-surface pl-1 pr-7">
      <Avatar name={user.name} hue={user.hue} size={26} />
      <div className="hidden leading-tight sm:block">
        <div className="text-xs font-semibold text-text">{user.name.split(" ")[0]}</div>
        <div className="font-mono text-[9px] uppercase tracking-wide text-accent">{ROLE_LABEL[user.role]}</div>
      </div>
      <ChevronDown size={14} className="pointer-events-none absolute right-2 text-text-faint" />
      <select
        aria-label="Switch persona"
        value={currentUserId}
        onChange={(e) => setCurrentUser(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {clients.map((c) => (
          <optgroup key={c.id} label={c.name}>
            {users.filter((u) => u.clientId === c.id).sort((a, b) => (a.role === "manager" ? -1 : 1)).map((u) => (
              <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

function SignOut() {
  const logout = useStore((s) => s.logout);
  const router = useRouter();
  return (
    <button
      onClick={() => { logout(); router.push("/login"); }}
      className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-surface text-text-muted transition-colors hover:border-negative/40 hover:text-negative"
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut size={16} />
    </button>
  );
}

function openPalette() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const [feedOpen, setFeedOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] px-4 backdrop-blur-xl md:gap-3 md:px-6">
        <button onClick={onMenu} className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-border text-text-muted lg:hidden" aria-label="Open menu"><Menu size={18} /></button>

        <button onClick={openPalette} className="group flex h-9 min-w-0 w-full max-w-[240px] items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 text-sm text-text-faint transition-colors hover:border-border-strong sm:max-w-sm">
          <Search size={15} className="shrink-0" />
          <span className="flex-1 truncate text-left">Talk to the CRM…</span>
          <kbd className="hidden items-center gap-0.5 rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-muted sm:flex"><CommandIcon size={10} /> K</kbd>
        </button>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <ClientSwitcher />
          <button onClick={() => window.dispatchEvent(new Event("relos-open-copilot"))} className="hidden h-9 items-center gap-1.5 rounded-[10px] border border-accent/40 bg-accent-soft px-3 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft/70 sm:flex" aria-label="Open Agent Copilot">
            <Bot size={16} /> <span className="hidden md:inline">Copilot</span>
          </button>
          <button onClick={() => setFeedOpen(true)} className="relative grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-surface text-text-muted transition-colors hover:text-text" aria-label="Activity feed">
            <Activity size={16} />
            <span className="absolute right-2 top-2"><StatusDot color="var(--live)" pulse size={6} /></span>
          </button>
          <ThemeToggle />
          <PersonaSwitcher />
          <SignOut />
        </div>
      </header>
      <ActivityPanel open={feedOpen} onClose={() => setFeedOpen(false)} />
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="min-h-screen">
      <aside className="chrome fixed inset-y-0 left-0 z-40 hidden w-[244px] border-r border-chrome-border lg:block">
        <SidebarInner />
      </aside>

      <AnimatePresence>
        {drawer && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside className="chrome fixed inset-y-0 left-0 z-50 w-[270px] border-r border-chrome-border lg:hidden" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 400, damping: 38 }}>
              <button onClick={() => setDrawer(false)} className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-lg text-chrome-text-faint hover:text-white" aria-label="Close menu"><X size={18} /></button>
              <SidebarInner onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-h-screen flex-col lg:pl-[244px]">
        <TopBar onMenu={() => setDrawer(true)} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
