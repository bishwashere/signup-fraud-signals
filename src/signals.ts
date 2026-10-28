// Signal extractors: small, explainable checks over one signup event plus
// recent history. Each returns the signals it evaluated; the scorer decides.
import type { EventStore, Signal, SignupEvent } from "./types";

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "guerrillamail.com",
  "10minutemail.com",
  "yopmail.com",
  "trashmail.com",
  "fakeinbox.com",
  "getnada.com",
  "mohmal.com",
  "maildrop.cc",
]);

const FREE_PROVIDERS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase();
}

function localPart(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? email : email.slice(0, at);
}

// Heuristic for auto-generated local parts: digit-heavy strings or long
// consonant runs are rare in real names.
function looksGibberish(local: string): boolean {
  const s = local.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s.length < 4) return false;
  const digits = (s.match(/[0-9]/g) || []).length;
  if (digits / s.length > 0.5) return true;
  return /[bcdfghjklmnpqrstvwxz]{5,}/.test(s);
}

export function emailSignals(event: SignupEvent): Signal[] {
  const out: Signal[] = [];
  const domain = domainOf(event.email);
  const local = localPart(event.email);

  if (DISPOSABLE_DOMAINS.has(domain)) {
    out.push({
      name: "disposable_email",
      weight: 45,
      triggered: true,
      detail: `Disposable email domain: ${domain}`,
    });
  } else if (domain && !FREE_PROVIDERS.has(domain)) {
    // A real custom domain is a mild trust signal.
    out.push({
      name: "custom_domain",
      weight: -10,
      triggered: true,
      detail: `Custom email domain: ${domain}`,
    });
  }

  if (local.includes("+")) {
    out.push({
      name: "plus_addressing",
      weight: 10,
      triggered: true,
      detail: "Plus-addressed email, often used for trial abuse",
    });
  }

  if (looksGibberish(local)) {
    out.push({
      name: "gibberish_local_part",
      weight: 20,
      triggered: true,
      detail: `Email local part looks auto-generated: ${local}`,
    });
  }

  return out;
}

const TEN_MIN = 10 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function velocitySignals(
  event: SignupEvent,
  store: EventStore,
  now: number
): Signal[] {
  const out: Signal[] = [];

  const ip10m = store.countByIp(event.ip, now - TEN_MIN);
  if (ip10m >= 5) {
    out.push({
      name: "ip_burst_10m",
      weight: 40,
      triggered: true,
      detail: `${ip10m} signups from ${event.ip} in the last 10 minutes`,
    });
  } else if (ip10m >= 3) {
    out.push({
      name: "ip_velocity_10m",
      weight: 20,
      triggered: true,
      detail: `${ip10m} signups from ${event.ip} in the last 10 minutes`,
    });
  }

  const ip1h = store.countByIp(event.ip, now - HOUR);
  if (ip1h >= 15) {
    out.push({
      name: "ip_velocity_1h",
      weight: 25,
      triggered: true,
      detail: `${ip1h} signups from ${event.ip} in the last hour`,
    });
  }

  if (event.deviceFingerprint) {
    const dev1h = store.countByDevice(event.deviceFingerprint, now - HOUR);
    if (dev1h >= 3) {
      out.push({
        name: "device_reuse",
        weight: 30,
        triggered: true,
        detail: `Device fingerprint seen on ${dev1h} signups in the last hour`,
      });
    }
  }

  if (event.promoCode) {
    const promoUsers = store.distinctEmailsForPromo(event.promoCode, now - DAY);
    if (promoUsers >= 5) {
      out.push({
        name: "promo_abuse",
        weight: 25,
        triggered: true,
        detail: `Promo code ${event.promoCode} used by ${promoUsers} distinct emails in 24h`,
      });
    }
  }

  return out;
}
