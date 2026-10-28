// Worker entry: ingest signup events, score them, route them, and serve a
// small case-review page for analysts.
import { emailSignals, velocitySignals } from "./signals";
import { score } from "./scorer";
import { aiSecondOpinion, type AiEnv } from "./ai";
import { MemoryStore } from "./store";
import { caseReviewPage } from "./ui";
import type { ScoreResult, SignupEvent } from "./types";

interface Env extends AiEnv {}

const store = new MemoryStore();
const decisions = new Map<string, ScoreResult>();

const newId = () => Math.random().toString(36).slice(2, 10);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Ingest: score one signup event and return the routing decision.
    if (req.method === "POST" && url.pathname === "/events/signup") {
      let body: Record<string, unknown>;
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch {
        return json({ error: "invalid JSON body" }, 400);
      }
      if (typeof body.email !== "string" || typeof body.ip !== "string") {
        return json({ error: "email and ip are required" }, 400);
      }

      const now = Date.now();
      const event: SignupEvent = {
        id: newId(),
        email: body.email,
        ip: body.ip,
        deviceFingerprint:
          typeof body.deviceFingerprint === "string"
            ? body.deviceFingerprint
            : undefined,
        promoCode:
          typeof body.promoCode === "string" ? body.promoCode : undefined,
        userAgent:
          typeof body.userAgent === "string" ? body.userAgent : undefined,
        receivedAt: now,
      };

      // Score against history first, then record the event.
      const signals = [
        ...emailSignals(event),
        ...velocitySignals(event, store, now),
      ];
      const ai = await aiSecondOpinion(event.email, env);
      if (ai?.suspicious) {
        signals.push({
          name: "ai_flag",
          weight: 15,
          triggered: true,
          detail: ai.note,
        });
      }

      const result = score(signals);
      store.add(event);
      decisions.set(event.id, result);

      return json({
        id: event.id,
        decision: result.decision,
        score: result.score,
        reasons: result.reasons,
      });
    }

    // Analyst API: list scored cases, optionally filtered by decision.
    if (req.method === "GET" && url.pathname === "/api/cases") {
      const filter = url.searchParams.get("decision");
      const cases = store.all().map((e) => ({
        ...e,
        ...(decisions.get(e.id) ?? { score: null, decision: null, reasons: [] }),
      }));
      const filtered =
        filter === "review" || filter === "deny" || filter === "approve"
          ? cases.filter((c) => c.decision === filter)
          : cases;
      return json({ cases: filtered });
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return json({ ok: true });
    }

    if (req.method === "GET" && url.pathname === "/") {
      return new Response(caseReviewPage(), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    return json({ error: "not found" }, 404);
  },
};
