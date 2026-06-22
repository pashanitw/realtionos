"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Plug,
  SlidersHorizontal,
  Building2,
  MessageCircle,
  PhoneIncoming,
  Globe,
  RefreshCw,
  KeyRound,
  Settings2,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Pill, StatusDot } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { Connector, ConnectorStatus, Source } from "@/lib/data/types";

const SPRING = { type: "spring" as const, stiffness: 380, damping: 26 };

/* -------------------------------------------------------------------------- */
/* status → presentation                                                      */
/* -------------------------------------------------------------------------- */

type PillVariant = "neutral" | "accent" | "live" | "positive" | "negative" | "outline";

const STATUS_META: Record<
  ConnectorStatus,
  {
    label: string;
    pill: PillVariant;
    dot: string;
    pulse: boolean;
    needsAttention: boolean;
  }
> = {
  connected: {
    label: "Live",
    pill: "positive",
    dot: "var(--positive)",
    pulse: true,
    needsAttention: false,
  },
  "token-expiring": {
    label: "Token expiring",
    pill: "live",
    dot: "var(--live)",
    pulse: true,
    needsAttention: true,
  },
  error: {
    label: "Re-auth required",
    pill: "negative",
    dot: "var(--negative)",
    pulse: false,
    needsAttention: true,
  },
  disconnected: {
    label: "Disconnected",
    pill: "neutral",
    dot: "var(--text-faint)",
    pulse: false,
    needsAttention: true,
  },
};

/* per-source icon + accent hue */
const SOURCE_ICON: Record<Source, LucideIcon> = {
  "99acres": Building2,
  magicbricks: Building2,
  housing: Building2,
  whatsapp: MessageCircle,
  ivr: PhoneIncoming,
  website: Globe,
  walkin: Building2,
  referral: Building2,
};

const SOURCE_TINT: Record<Source, string> = {
  "99acres": "var(--accent)",
  magicbricks: "var(--accent)",
  housing: "var(--accent)",
  whatsapp: "var(--positive)",
  ivr: "var(--live)",
  website: "var(--text-muted)",
  walkin: "var(--text-muted)",
  referral: "var(--text-muted)",
};

/* -------------------------------------------------------------------------- */
/* page                                                                        */
/* -------------------------------------------------------------------------- */

export default function SourcesPage() {
  const connectors = useStore((s) => s.connectors);
  const connectSource = useStore((s) => s.connectSource);

  const { connectedCount, attentionCount } = useMemo(() => {
    let connected = 0;
    let attention = 0;
    for (const c of connectors) {
      if (STATUS_META[c.status].needsAttention) attention += 1;
      else connected += 1;
    }
    return { connectedCount: connected, attentionCount: attention };
  }, [connectors]);

  return (
    <PageContainer>
      <PageHeader
        kicker="Settings with teeth"
        title="Sources"
        description="Every portal, call and chat resolves into one ranked buyer list. Source is a label, never a separate inbox."
        actions={<TabNav />}
      />

      <SummaryStrip connected={connectedCount} attention={attentionCount} />

      <LayoutGroup>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {connectors.map((c, i) => (
            <SourceCard key={c.id} connector={c} index={i} onConnect={connectSource} />
          ))}
        </div>
      </LayoutGroup>
    </PageContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* segmented tab nav                                                           */
/* -------------------------------------------------------------------------- */

function TabNav() {
  const tabs = [
    { href: "/settings/sources", label: "Sources", icon: Plug, active: true },
    { href: "/settings/autonomy", label: "Autonomy", icon: SlidersHorizontal, active: false },
  ] as const;

  return (
    <LayoutGroup id="settings-tabs">
      <nav
        aria-label="Settings sections"
        className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface p-1 shadow-[var(--shadow-soft)]"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "relative flex h-9 items-center gap-2 rounded-pill px-3.5 text-sm font-medium transition-colors sm:px-4",
                t.active ? "text-accent-contrast" : "text-text-muted hover:text-text",
              )}
            >
              {t.active && (
                <motion.span
                  layoutId="settings-tab-indicator"
                  transition={SPRING}
                  className="absolute inset-0 rounded-pill bg-accent shadow-[0_0_18px_-6px_var(--accent)]"
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon size={15} strokeWidth={2.2} />
                {t.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}

/* -------------------------------------------------------------------------- */
/* summary strip                                                               */
/* -------------------------------------------------------------------------- */

function SummaryStrip({ connected, attention }: { connected: number; attention: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="mb-5 flex flex-col gap-4 rounded-[14px] border border-border bg-surface px-4 py-3.5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <div className="flex items-center gap-5 sm:gap-7">
        <CountStat
          value={connected}
          label="Connected"
          dotColor="var(--positive)"
          pulse
        />
        <span className="h-8 w-px shrink-0 bg-border" />
        <CountStat
          value={attention}
          label="Needs attention"
          dotColor={attention > 0 ? "var(--live)" : "var(--text-faint)"}
          pulse={false}
        />
      </div>
      <p className="text-sm leading-relaxed text-text-muted">
        <span className="text-text">99acres · MagicBricks · Housing · WhatsApp · IVR</span> weave
        into one buyer list.
      </p>
    </motion.div>
  );
}

function CountStat({
  value,
  label,
  dotColor,
  pulse,
}: {
  value: number;
  label: string;
  dotColor: string;
  pulse: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <StatusDot color={dotColor} pulse={pulse} size={9} />
      <div className="leading-none">
        <div className="font-display text-2xl font-bold tabular text-text">{value}</div>
        <div className="label mt-1 text-text-faint">{label}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* source card                                                                 */
/* -------------------------------------------------------------------------- */

function SourceCard({
  connector,
  index,
  onConnect,
}: {
  connector: Connector;
  index: number;
  onConnect: (id: string) => void;
}) {
  const meta = STATUS_META[connector.status];
  const Icon = SOURCE_ICON[connector.source];
  const tint = SOURCE_TINT[connector.source];
  const isConnected = connector.status === "connected";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: 0.04 * index }}
      whileHover={{ y: -3 }}
      className={cn(
        "group flex h-full flex-col gap-4 rounded-[14px] border bg-surface p-4 shadow-[var(--shadow-soft)] transition-colors",
        "border-border hover:border-border-strong",
      )}
    >
      {/* top: icon tile + name + status */}
      <div className="flex items-start gap-3">
        <motion.span
          layout
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-[12px]"
          animate={isConnected ? { scale: [1, 1.14, 1] } : { scale: 1 }}
          transition={isConnected ? { duration: 0.4, ease: "easeOut", delay: 0.05 } : { duration: 0 }}
          style={{
            background: `color-mix(in oklab, ${tint} 16%, transparent)`,
            color: tint,
          }}
        >
          <Icon size={20} strokeWidth={2.1} />
        </motion.span>

        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-text">{connector.name}</div>
          <div className="mt-1.5 flex items-center gap-2">
            <StatusDot color={meta.dot} pulse={meta.pulse} size={7} />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={connector.status}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <Pill variant={meta.pill}>{meta.label}</Pill>
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* detail */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={connector.detail}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="text-sm leading-relaxed text-text-muted"
        >
          {connector.detail}
        </motion.p>
      </AnimatePresence>

      {/* action */}
      <div className="mt-auto pt-1">
        <ActionButton connector={connector} onConnect={onConnect} />
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* status-driven action                                                        */
/* -------------------------------------------------------------------------- */

function ActionButton({
  connector,
  onConnect,
}: {
  connector: Connector;
  onConnect: (id: string) => void;
}) {
  const base =
    "flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] text-sm font-semibold transition-all active:scale-[0.98]";

  switch (connector.status) {
    case "connected":
      return (
        <button
          onClick={() => toast("Synced", { description: `${connector.name} is up to date.` })}
          className={cn(
            base,
            "border border-border bg-surface-2 text-text-muted hover:border-border-strong hover:text-text",
          )}
        >
          <Settings2 size={15} /> Manage
        </button>
      );

    case "token-expiring":
      return (
        <button
          onClick={() => {
            onConnect(connector.id);
            toast.success("Token refreshed", { description: `${connector.name} reconnected.` });
          }}
          className={cn(base, "bg-live text-accent-contrast hover:brightness-110")}
        >
          <RefreshCw size={15} /> Refresh token
        </button>
      );

    case "error":
      return (
        <button
          onClick={() => {
            onConnect(connector.id);
            toast.success("Re-authenticated", { description: `${connector.name} is live again.` });
          }}
          className={cn(base, "bg-negative text-accent-contrast hover:brightness-110")}
        >
          <KeyRound size={15} /> Re-authenticate
        </button>
      );

    case "disconnected":
    default:
      return (
        <button
          onClick={() => {
            onConnect(connector.id);
            toast.success("Connected", { description: `${connector.name} is now syncing.` });
          }}
          className={cn(
            base,
            "bg-accent text-accent-contrast shadow-[0_0_20px_-8px_var(--accent)] hover:scale-[1.01]",
          )}
        >
          <Plug size={15} /> Connect <ArrowRight size={14} />
        </button>
      );
  }
}
