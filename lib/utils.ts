import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Fixed "now" reference for all seeded data so the server and client render
 * identical relative times (no hydration mismatch). Live Demo-Conductor events
 * carry a real Date.now() timestamp (> SEED_NOW) and therefore read "just now".
 */
export const SEED_NOW = new Date("2026-06-22T12:00:00Z").getTime();

/** Format a relative time like "2h", "3d", "just now". */
export function relativeTime(date: Date | number): string {
  const d = typeof date === "number" ? date : date.getTime();
  const diff = SEED_NOW - d;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w`;
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const CRORE = 10_000_000;
const LAKH = 100_000;

/** Indian currency, e.g. ₹1.38 Cr, ₹85 L, ₹40,000. */
export function rupees(n: number): string {
  if (n >= CRORE) {
    const cr = n / CRORE;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)} Cr`;
  }
  if (n >= LAKH) return `₹${Math.round(n / LAKH)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

/** A budget range like "₹1.3–1.4 Cr" or "₹80–95 L". */
export function rupeeRange(min: number, max: number): string {
  if (min >= CRORE && max >= CRORE) {
    return `₹${(min / CRORE).toFixed(2).replace(/0$/, "")}–${(max / CRORE).toFixed(2).replace(/0$/, "")} Cr`;
  }
  if (max >= LAKH) return `₹${Math.round(min / LAKH)}–${Math.round(max / LAKH)} L`;
  return `${rupees(min)}–${rupees(max)}`;
}

/** Per-sq.ft rate from price + area. */
export function perSqft(priceInr: number, sqft: number): string {
  if (!sqft) return "";
  return `₹${Math.round(priceInr / sqft).toLocaleString("en-IN")}/sq.ft`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
