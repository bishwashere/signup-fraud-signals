# Signup fraud signals

A signup fraud detection service on Cloudflare Workers: ingest signup events, score them with an explainable signal layer plus an optional Workers AI second opinion, route each event to approve / hold for review / deny, and serve a case-review page so analysts can see why.

It ingests signup events, evaluates and routes them, and gives analysts investigation tooling: explainable signals for every decision, a weighted 0-100 score, and a case-review page for held cases.

## Architecture

```
POST /events/signup
        |
        v
 signal extractors          Workers AI (optional second opinion)
  - disposable email          - flags auto-generated email patterns
  - plus addressing           - never blocks; heuristic layer stands alone
  - gibberish local part
  - IP velocity (10m / 1h)
  - device fingerprint reuse
  - promo code abuse
        |
        v
 scorer: weighted sum -> 0-100 -> approve / review / deny
        |
        v
 GET /  -> case-review page (filter by decision, expand for reasons)
```

Thresholds: score under 30 approves, 30 to 69 holds for review, 70 and above denies. Every decision carries its reasons, so nothing is a black box.

## Run it

Prerequisites: Node 18 or newer.

```
npm install
npm test        # unit tests for the scoring layer
npm run dev     # local dev server (wrangler)
```

Try it:

```
curl -X POST localhost:8787/events/signup \
  -H 'content-type: application/json' \
  -d '{"email":"jane@acmecorp.com","ip":"1.2.3.4","deviceFingerprint":"fp-1"}'

curl -X POST localhost:8787/events/signup \
  -H 'content-type: application/json' \
  -d '{"email":"x@mailinator.com","ip":"9.9.9.9","promoCode":"WELCOME50"}'
```

Then open `http://localhost:8787/` for the review page.

## Deploy

```
npx wrangler login
npm run deploy
```

This publishes to `signup-fraud-signals.<your-account>.workers.dev`. The `[ai]` binding in `wrangler.toml` enables the Workers AI second opinion; without it the app still works on heuristics alone.

## Notes and next steps

- Storage is in-memory (last 5000 events). The `EventStore` interface means KV or D1 can replace it without touching scoring.
- Signals are deliberately explainable: each fired signal ships its reason to the API and the review UI.
- Natural next steps: persist to D1, add email-age and IP-reputation lookups, tune weights against labelled data, and add an analyst feedback loop (confirm / overturn) that feeds back into scoring.
