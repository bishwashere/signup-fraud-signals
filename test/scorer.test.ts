// Unit tests for the pure scoring layer: no Workers runtime needed.
import { describe, expect, it } from "vitest";
import { emailSignals, velocitySignals } from "../src/signals";
import { score } from "../src/scorer";
import { MemoryStore } from "../src/store";
import type { SignupEvent } from "../src/types";

const NOW = 1_790_000_000_000;

function evt(partial: Partial<SignupEvent> & { email: string; ip: string }): SignupEvent {
  return {
    id: Math.random().toString(36).slice(2),
    receivedAt: NOW,
    ...partial,
  };
}

function fullScore(event: SignupEvent, store: MemoryStore) {
  return score([...emailSignals(event), ...velocitySignals(event, store, NOW)]);
}

describe("email signals", () => {
  it("approves a clean corporate signup", () => {
    const store = new MemoryStore();
    const r = fullScore(evt({ email: "bishwas@acmecorp.com", ip: "1.2.3.4" }), store);
    expect(r.decision).toBe("approve");
    expect(r.score).toBeLessThan(30);
  });

  it("flags disposable email domains for review", () => {
    const store = new MemoryStore();
    const r = fullScore(evt({ email: "user@mailinator.com", ip: "1.2.3.4" }), store);
    expect(r.decision).toBe("review");
    expect(r.reasons.join(" ")).toMatch(/Disposable email domain/);
  });

  it("denies disposable email plus an IP burst", () => {
    const store = new MemoryStore();
    for (let i = 0; i < 5; i++) {
      store.add(evt({ email: `victim${i}@gmail.com`, ip: "9.9.9.9", receivedAt: NOW - i * 60_000 }));
    }
    const r = fullScore(evt({ email: "x@mailinator.com", ip: "9.9.9.9" }), store);
    expect(r.decision).toBe("deny");
    expect(r.score).toBeGreaterThanOrEqual(70);
  });
});

describe("velocity signals", () => {
  it("holds for review when one device signs up many emails", () => {
    const store = new MemoryStore();
    for (let i = 0; i < 3; i++) {
      store.add(evt({ email: `user${i}@gmail.com`, ip: `5.6.7.${i}`, deviceFingerprint: "fp-abc", receivedAt: NOW - i * 60_000 }));
    }
    const r = fullScore(evt({ email: "new@gmail.com", ip: "5.6.7.9", deviceFingerprint: "fp-abc" }), store);
    expect(r.decision).toBe("review");
    expect(r.reasons.join(" ")).toMatch(/Device fingerprint/);
  });

  it("flags promo code abuse across distinct emails", () => {
    const store = new MemoryStore();
    for (let i = 0; i < 5; i++) {
      store.add(evt({ email: `promo${i}@gmail.com`, ip: `7.7.7.${i}`, promoCode: "WELCOME50", receivedAt: NOW - i * 3_600_000 }));
    }
    const r = fullScore(evt({ email: "late@gmail.com", ip: "7.7.7.9", promoCode: "WELCOME50" }), store);
    expect(r.reasons.join(" ")).toMatch(/Promo code WELCOME50/);
  });

  it("does not flag a lone signup from a fresh IP", () => {
    const store = new MemoryStore();
    const r = fullScore(evt({ email: "jane.doe@gmail.com", ip: "8.8.8.8" }), store);
    expect(r.decision).toBe("approve");
  });
});

describe("gibberish detection", () => {
  it("adds weight for auto-generated local parts", () => {
    const store = new MemoryStore();
    const r = fullScore(evt({ email: "xzkq928374112@gmail.com", ip: "1.1.1.1" }), store);
    expect(r.reasons.join(" ")).toMatch(/auto-generated/);
  });
});
