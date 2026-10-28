// Shared shapes for the signup fraud signal demo.
// The scoring layer (signals.ts, scorer.ts) is pure TypeScript with no
// Workers dependencies, so it can be unit tested in plain Node.

export interface SignupEvent {
  id: string;
  email: string;
  ip: string;
  deviceFingerprint?: string;
  promoCode?: string;
  userAgent?: string;
  receivedAt: number; // epoch millis
}

export interface Signal {
  name: string;
  weight: number; // contribution to the 0-100 score when triggered
  triggered: boolean;
  detail: string; // human readable reason, shown in the review UI
}

export type Decision = "approve" | "review" | "deny";

export interface ScoreResult {
  score: number; // 0-100
  decision: Decision;
  reasons: string[];
  signals: Signal[]; // only the triggered ones
}

// Minimal store interface the velocity signals need. The Worker uses an
// in-memory implementation (store.ts); production would use KV or D1.
export interface EventStore {
  add(event: SignupEvent): void;
  countByIp(ip: string, sinceMs: number): number;
  countByDevice(fingerprint: string, sinceMs: number): number;
  distinctEmailsForPromo(promo: string, sinceMs: number): number;
  all(): SignupEvent[];
}
