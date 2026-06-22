"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import {
  Mail,
  Phone,
  MessageSquare,
  MessageCircle,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { scoreTone } from "@/lib/data/scoring";
import type { Channel } from "@/lib/data/types";

export const SPRING = { type: "spring" as const, stiffness: 380, damping: 30 };
export const EASE = [0.34, 1.4, 0.5, 1] as const;

/* ---------------- Section label (mono) ---------------- */
export function Label({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("label", className)}>{children}</div>;
}

/* ---------------- Animated number ---------------- */
export function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => Math.round(v));
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.75, ease: EASE });
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [value, mv, rounded]);

  return <span className={cn("tabular", className)}>{display}</span>;
}

/* ---------------- Avatar ---------------- */
export function Avatar({
  name,
  hue,
  size = 36,
  className,
}: {
  name: string;
  hue: number;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold text-white select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(140deg, hsl(${hue} 55% 42%), hsl(${(hue + 40) % 360} 60% 32%))`,
      }}
    >
      {initials(name)}
    </div>
  );
}

/* ---------------- Channel icon ---------------- */
const CHANNEL_ICON: Record<Channel, LucideIcon> = {
  whatsapp: MessageCircle,
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  web: Globe,
};
const CHANNEL_COLOR: Record<Channel, string> = {
  whatsapp: "var(--positive)",
  call: "var(--live)",
  email: "var(--accent)",
  sms: "var(--text-muted)",
  web: "var(--text-muted)",
};

export function ChannelIcon({
  channel,
  size = 14,
  withBg = false,
  className,
}: {
  channel: Channel;
  size?: number;
  withBg?: boolean;
  className?: string;
}) {
  const Icon = CHANNEL_ICON[channel];
  const color = CHANNEL_COLOR[channel];
  if (withBg) {
    return (
      <span
        className={cn("grid place-items-center rounded-lg", className)}
        style={{
          width: size * 2,
          height: size * 2,
          background: `color-mix(in oklab, ${color} 16%, transparent)`,
          color,
        }}
      >
        <Icon size={size} strokeWidth={2.2} />
      </span>
    );
  }
  return <Icon size={size} strokeWidth={2.2} style={{ color }} className={className} />;
}

/* ---------------- Status dot ---------------- */
export function StatusDot({
  color,
  pulse = false,
  size = 8,
}: {
  color: string;
  pulse?: boolean;
  size?: number;
}) {
  return (
    <span
      className={cn("relative inline-block rounded-full", pulse && "live-dot")}
      style={
        {
          width: size,
          height: size,
          background: color,
          "--live": color,
        } as React.CSSProperties
      }
    />
  );
}

/* ---------------- Pill / badge ---------------- */
type PillVariant = "neutral" | "accent" | "live" | "positive" | "negative" | "outline";
const PILL_STYLES: Record<PillVariant, string> = {
  neutral: "bg-surface-2 text-text-muted border border-border",
  accent: "bg-accent-soft text-accent border border-transparent",
  live: "bg-live-soft text-live border border-transparent",
  positive: "bg-positive-soft text-positive border border-transparent",
  negative: "bg-negative-soft text-negative border border-transparent",
  outline: "bg-transparent text-text-muted border border-border-strong",
};

export function Pill({
  children,
  variant = "neutral",
  className,
  mono = false,
}: {
  children: React.ReactNode;
  variant?: PillVariant;
  className?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium leading-none whitespace-nowrap",
        mono && "font-mono text-[11px] tracking-wide",
        PILL_STYLES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------- Score badge (animated ring) ---------------- */
const TONE_COLOR = {
  hot: "var(--accent)",
  warm: "var(--live)",
  cool: "var(--text-faint)",
} as const;

export function ScoreBadge({
  score,
  size = 46,
  delta,
}: {
  score: number;
  size?: number;
  delta?: number;
}) {
  const tone = scoreTone(score);
  const color = TONE_COLOR[tone];
  const stroke = Math.max(3, size * 0.08);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: EASE }}
        />
      </svg>
      <div
        className="absolute inset-0 grid place-items-center font-semibold tabular"
        style={{ fontSize: size * 0.34, color }}
      >
        <AnimatedNumber value={score} />
      </div>
      {delta ? (
        <motion.span
          initial={{ opacity: 0, y: 4, scale: 0.8 }}
          animate={{ opacity: [0, 1, 1, 0], y: [-2, -14, -18, -22], scale: 1 }}
          transition={{ duration: 2.2, times: [0, 0.15, 0.7, 1] }}
          className="absolute -right-1 -top-2 text-xs font-bold"
          style={{ color: "var(--positive)" }}
        >
          +{delta}
        </motion.span>
      ) : null}
    </div>
  );
}

/* ---------------- Confidence / progress meter ---------------- */
export function Meter({
  value,
  color = "var(--accent)",
  className,
  height = 6,
}: {
  value: number;
  color?: string;
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={cn("w-full overflow-hidden rounded-pill bg-surface-inset", className)}
      style={{ height }}
    >
      <motion.div
        className="h-full rounded-pill"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.9, ease: EASE }}
      />
    </div>
  );
}

/* ---------------- Sparkline ---------------- */
export function Sparkline({
  points,
  width = 120,
  height = 34,
  color = "var(--accent)",
  className,
}: {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });
  const d = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${width},${height} L0,${height} Z`;
  const id = useRef(`sg-${Math.round(coords[0]?.[1] ?? 0)}-${points.length}`).current;

  return (
    <svg width={width} height={height} className={className} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r={2.8} fill={color} />
    </svg>
  );
}
