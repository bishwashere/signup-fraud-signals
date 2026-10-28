// In-memory event store for the demo. Keeps the last 5000 events; good
// enough for the current scope, and the EventStore interface means KV or D1 can
// replace it without touching the scoring code.
import type { EventStore, SignupEvent } from "./types";

const MAX_EVENTS = 5000;

export class MemoryStore implements EventStore {
  private events: SignupEvent[] = [];

  add(event: SignupEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }
  }

  private since(sinceMs: number): SignupEvent[] {
    return this.events.filter((e) => e.receivedAt >= sinceMs);
  }

  countByIp(ip: string, sinceMs: number): number {
    return this.since(sinceMs).filter((e) => e.ip === ip).length;
  }

  countByDevice(fingerprint: string, sinceMs: number): number {
    return this.since(sinceMs).filter(
      (e) => e.deviceFingerprint === fingerprint
    ).length;
  }

  distinctEmailsForPromo(promo: string, sinceMs: number): number {
    const emails = this.since(sinceMs)
      .filter((e) => e.promoCode === promo)
      .map((e) => e.email.toLowerCase());
    return new Set(emails).size;
  }

  all(): SignupEvent[] {
    return [...this.events].reverse();
  }
}
