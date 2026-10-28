// Score aggregation: sum triggered signal weights, clamp to 0-100, then route.
import type { ScoreResult, Signal } from "./types";

export const THRESHOLDS = {
  review: 30, // score >= 30 goes to hold for review
  deny: 70, // score >= 70 is denied outright
};

export function score(signals: Signal[]): ScoreResult {
  let total = 0;
  const reasons: string[] = [];
  const fired: Signal[] = [];

  for (const s of signals) {
    if (!s.triggered) continue;
    total += s.weight;
    fired.push(s);
    reasons.push(s.detail);
  }

  const clamped = Math.max(0, Math.min(100, Math.round(total)));
  const decision =
    clamped >= THRESHOLDS.deny
      ? "deny"
      : clamped >= THRESHOLDS.review
        ? "review"
        : "approve";

  return { score: clamped, decision, reasons, signals: fired };
}
