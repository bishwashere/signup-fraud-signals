// End-to-end test of the Worker router using real Request/Response objects.
// No Workers runtime needed: the handler only uses web standards.
import { describe, expect, it } from "vitest";
import worker from "../src/index";

const BASE = "https://demo.workers.dev";

async function postSignup(body: Record<string, unknown>) {
  const req = new Request(`${BASE}/events/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await worker.fetch(req, {});
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("POST /events/signup", () => {
  it("scores and routes a clean signup to approve", async () => {
    const { status, body } = await postSignup({ email: "jane@acmecorp.com", ip: "1.2.3.4" });
    expect(status).toBe(200);
    expect(body.decision).toBe("approve");
    expect(typeof body.score).toBe("number");
    expect(typeof body.id).toBe("string");
  });

  it("rejects requests missing email or ip", async () => {
    const { status } = await postSignup({ email: "jane@acmecorp.com" });
    expect(status).toBe(400);
  });

  it("routes a disposable-email burst to deny", async () => {
    for (let i = 0; i < 5; i++) {
      await postSignup({ email: `u${i}@gmail.com`, ip: "9.9.9.9" });
    }
    const { body } = await postSignup({ email: "x@mailinator.com", ip: "9.9.9.9" });
    expect(body.decision).toBe("deny");
  });
});

describe("GET /api/cases", () => {
  it("lists scored cases with their reasons", async () => {
    await postSignup({ email: "case1@acmecorp.com", ip: "2.3.4.5" });
    const res = await worker.fetch(new Request(`${BASE}/api/cases`), {});
    expect(res.status).toBe(200);
    const { cases } = (await res.json()) as { cases: unknown[] };
    expect(cases.length).toBeGreaterThan(0);
  });

  it("filters by decision", async () => {
    const res = await worker.fetch(new Request(`${BASE}/api/cases?decision=deny`), {});
    const { cases } = (await res.json()) as { cases: { decision: string }[] };
    expect(cases.every((c) => c.decision === "deny")).toBe(true);
  });
});

describe("GET /", () => {
  it("serves the case-review page", async () => {
    const res = await worker.fetch(new Request(`${BASE}/`), {});
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("Signup fraud review");
  });
});
