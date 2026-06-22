import { SIGNAL_CATEGORIES, type SignalCategory } from "./types";

/** Default category weights (0–1) — tuned for property buying (budget + site-visit intent heavy). */
export const DEFAULT_WEIGHTS: Record<SignalCategory, number> = {
  "Budget fit": 1.0,
  "Config & locality match": 0.9,
  Engagement: 0.7,
  "Site-visit intent": 0.95,
  "Loan readiness": 0.55,
};

/**
 * Buyer intent score = weighted average of the five real-estate signals.
 * Same math powers the seed and the deep-dive WeightSlider, so retuning a
 * weight recomputes the score live and truthfully.
 */
export function computeScore(
  signals: Record<SignalCategory, number>,
  weights: Record<SignalCategory, number>,
): number {
  let num = 0;
  let den = 0;
  for (const c of SIGNAL_CATEGORIES) {
    const w = weights[c] ?? 0;
    num += (signals[c] ?? 0) * w;
    den += w;
  }
  if (den === 0) return 0;
  return Math.round(num / den);
}

export function scoreTone(score: number): "hot" | "warm" | "cool" {
  if (score >= 75) return "hot";
  if (score >= 50) return "warm";
  return "cool";
}
