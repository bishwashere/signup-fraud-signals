# Walkthrough: signup-fraud-signals

Self-guided tour of the signup fraud detection service. Read this, then run the commands below. Verified healthy 2026-10-11 ~8:05 PM EDT: 13/13 vitest tests pass, `tsc` clean per the build log.

## The 60-second pitch

A signup-fraud signal service on Cloudflare Workers: POST a signup event, it extracts explainable fraud signals, scores 0-100 with a weighted sum, routes to approve / hold for review / deny, and serves a small case-review page so an analyst can see exactly why each decision was made. Workers AI (Llama 3.3) gives an optional second opinion on the email pattern, but it never blocks a request and the heuristic layer stands alone.

What it does: ingest signup events, evaluate and route them, and give analysts investigation tooling.

## File map

- `src/index.ts` - the Worker. Routes: `POST /events/signup` (ingest + score + route), `GET /api/cases` (analyst API, filter by decision), `GET /` (case-review page), `GET /health`.
- `src/signals.ts` - signal extractors. Email signals: disposable domain (+45), custom domain trust signal (-10), plus addressing (+10), gibberish local part (+20). Velocity signals against recent history: IP burst 10m (+40 / +20), IP velocity 1h (+25), device fingerprint reuse 1h (+30), promo code abuse 24h (+25).
- `src/scorer.ts` - weighted sum, clamped 0-100. Thresholds: under 30 approves, 30-69 holds for review, 70+ denies. Every fired signal ships its reason, so nothing is a black box.
- `src/ai.ts` - optional Workers AI second opinion. YES/NO prompt on the email local part, weight 15 when flagged. Wrapped in try/catch and a binding check: missing binding or AI error means it is silently skipped, never fails the request.
- `src/store.ts` - in-memory `EventStore` (last 5000 events). The interface means KV or D1 can replace it without touching scoring.
- `src/ui.ts` - case-review page: filter by decision, expand a case for its reasons.

## Run the service

```
npm install
npm test        # 13 tests, scoring layer
npm run dev     # local server on :8787
```

Clean signup (approves: custom domain is a mild trust signal, -10, clamps to 0):

```
curl -X POST localhost:8787/events/signup \
  -H 'content-type: application/json' \
  -d '{"email":"jane@acmecorp.com","ip":"1.2.3.4","deviceFingerprint":"fp-1"}'
```

Disposable email (scores 45: hold for review, with the reason attached):

```
curl -X POST localhost:8787/events/signup \
  -H 'content-type: application/json' \
  -d '{"email":"x@mailinator.com","ip":"9.9.9.9","promoCode":"WELCOME50"}'
```

Velocity escalation: send the abusive signup 5 more times from the same IP, then once more. The 6th request sees 5 prior signups in 10 minutes, so ip_burst_10m fires (+40): 45 + 20 (gibberish local part) + 40 = 105, clamped to 100, denied. This shows the history-aware layer live.

```
for i in 1 2 3 4 5; do
  curl -s -X POST localhost:8787/events/signup \
    -H 'content-type: application/json' \
    -d '{"email":"qzxwrt91@mailinator.com","ip":"9.9.9.9"}' > /dev/null
done
curl -X POST localhost:8787/events/signup \
  -H 'content-type: application/json' \
  -d '{"email":"qzxwrt91@mailinator.com","ip":"9.9.9.9"}'
```

Then open `http://localhost:8787/` for the review page and `http://localhost:8787/api/cases?decision=review` for the analyst API.

## Design decisions

1. Explainability over accuracy theater. Every decision carries its reasons end to end, which is what an analyst needs to overturn or confirm a case.
2. The heuristic layer works with zero AI. The Workers AI call is a second opinion, capped at 8 tokens, and the request succeeds with or without it. No single point of failure.
3. History-aware, not just point-in-time. Velocity signals (IP bursts, device reuse, promo abuse) need the event store; scoring runs against history before the event is recorded, so an event never scores against itself.
4. Thresholds are tunable, not sacred. 30/70 are starting points; the README names the real next step as tuning weights against labelled data plus an analyst feedback loop.
5. Current boundaries. Storage is in-memory, the review page is minimal, and the README says so. The `EventStore` interface is the seam where production persistence (D1/KV) would attach.

## Known limitations

- In-memory store: last 5000 events, lost on restart. D1/KV next.
- No email-age or IP-reputation lookups yet.
- Weights are judgment calls, not tuned on labelled data.
- No analyst confirm/overturn feedback loop yet.

## Deploy

```
npx wrangler login
npm run deploy
```

Publishes to `signup-fraud-signals.<your-account>.workers.dev`. The `[ai]` binding in `wrangler.toml` turns on the Workers AI second opinion; without it the app still scores on heuristics alone.
