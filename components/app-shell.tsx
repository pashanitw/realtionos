"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useTheme } from "@/lib/theme";
import {
  ListChecks,
  Bot,
  Building2,
  Columns3,
  ShieldCheck,
  BarChart3,
  Plug,
  SlidersHorizontal,
  Search,
  Sun,
  Moon,
  Menu,
  X,
  Activity,
  Command as CommandIcon,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { StatusDot } from "./ui/primitives";
import { ActivityPanel } from "./live-capture";

const NAV = [
  { group: "Work", items: [
    { href: "/worklist", label: "Worklist", icon: ListChecks },
    { href: "/concierge", label: "Concierge", icon: Bot },
    { href: "/inventory", label: "Inventory", icon: Building2 },
    { href: "/pipeline", label: "Pipeline", icon: Columns3 },
    { href: "/review", label: "Review queue", icon: ShieldCheck, badge: true },
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  ] },
  { group: "Settings", items: [
    { href: "/settings/sources", label: "Sources", icon: Plug },
    { href: "/settings/autonomy", label: "Autonomy", icon: SlidersHorizontal },
  ] },
];

function Brand() {
  return (
    <Link href="/worklist" className="flex items-center gap-2.5 px-1">
      <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-[#34b3a3] to-[#0c4a45] text-white shadow-[0_0_18px_-4px_rgba(52,179,163,0.6)]">
        <Sparkles size={17} strokeWidth={2.4} />
      </div>
      <div className="leading-tight">
        <div className="font-display text-[15px] font-bold tracking-tight text-chrome-text">
          RelationOS
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-chrome-text-faint">
          thevertical.ai
        </div>
      </div>
    </Link>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const reviewCount = useStore((s) => s.reviewQueueCount);

  return (
    <LayoutGroup id="nav">
      <nav className="flex flex-1 flex-col gap-6">
        {NAV.map((section) => (
          <div key={section.group}>
            <div className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-chrome-text-faint">
              {section.group}
            </div>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors",
                      active ? "text-white" : "text-chrome-text hover:text-white",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-[10px] border border-[rgba(52,179,163,0.25)] bg-[rgba(52,179,163,0.12)]"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <Icon
                      size={17}
                      strokeWidth={2.1}
                      className={cn("relative z-10 shrink-0", active && "text-[#43c9b8]")}
                    />
                    <span className="relative z-10 flex-1">{item.label}</span>
                    {item.badge && reviewCount > 0 && (
                      <span className="relative z-10 grid h-5 min-w-5 place-items-center rounded-full bg-live px-1.5 text-[11px] font-bold text-white tabular">
                        {reviewCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </LayoutGroup>
  );
}

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="pt-1">
        <Brand />
      </div>
      <NavItems onNavigate={onNavigate} />
      <div className="rounded-[12px] border border-chrome-border bg-[rgba(255,255,255,0.03)] p-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-chrome-text">
          <StatusDot color="#ec9a3c" pulse size={7} />
          Live capture on
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-chrome-text-faint">
          Press{" "}
          <kbd className="rounded bg-[rgba(255,255,255,0.08)] px-1 font-mono text-[10px]">
            ⌘K
          </kbd>{" "}
          to talk to the CRM, or{" "}
          <kbd className="rounded bg-[rgba(255,255,255,0.08)] px-1 font-mono text-[10px]">
            ⌘J
          </kbd>{" "}
          for the demo conductor.
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
    <button
      aria-label="Toggle theme"
      onClick={toggle}
      className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-surface text-text-muted transition-colors hover:text-text"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={mounted ? (isDark ? "moon" : "sun") : "x"}
          initial={{ rotate: -40, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: 40, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {isDark ? <Moon size={16} /> : <Sun size={16} />}
        </motion.span>
      </AnimatePresence>
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
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] px-4 backdrop-blur-xl md:px-6">
        <button
          onClick={onMenu}
          className="grid h-9 w-9 place-items-center rounded-[10px] border border-border text-text-muted lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>

        <button
          onClick={openPalette}
          className="group flex h-9 flex-1 items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 text-sm text-text-faint transition-colors hover:border-border-strong md:max-w-md"
        >
          <Search size={15} />
          <span className="flex-1 text-left">Talk to the CRM, or search…</span>
          <kbd className="hidden items-center gap-0.5 rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-muted sm:flex">
            <CommandIcon size={10} /> K
          </kbd>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.dispatchEvent(new Event("relos-open-copilot"))}
            className="flex h-9 items-center gap-1.5 rounded-[10px] border border-accent/40 bg-accent-soft px-3 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft/70"
            aria-label="Open Agent Copilot"
          >
            <Bot size={16} />
            <span className="hidden sm:inline">Copilot</span>
          </button>
          <button
            onClick={() => setFeedOpen(true)}
            className="relative grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-surface text-text-muted transition-colors hover:text-text"
            aria-label="Activity feed"
          >
            <Activity size={16} />
            <span className="absolute right-2 top-2">
              <StatusDot color="var(--live)" pulse size={6} />
            </span>
          </button>
          <ThemeToggle />
          <div className="hidden h-9 items-center gap-2 rounded-[10px] border border-border bg-surface pl-1 pr-3 sm:flex">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#34b3a3] to-[#0c4a45] text-[11px] font-bold text-white">
              MC
            </div>
            <span className="text-sm font-medium text-text">Maya</span>
          </div>
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
      {/* Desktop sidebar */}
      <aside className="chrome fixed inset-y-0 left-0 z-40 hidden w-[244px] border-r border-chrome-border lg:block">
        <SidebarInner />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            />
            <motion.aside
              className="chrome fixed inset-y-0 left-0 z-50 w-[270px] border-r border-chrome-border lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 38 }}
            >
              <button
                onClick={() => setDrawer(false)}
                className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-lg text-chrome-text-faint hover:text-white"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
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
