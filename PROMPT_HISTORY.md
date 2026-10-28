# Prompt history

Cloudflare's optional assignment asks for the prompt history to be submitted
alongside the project ("AI-assisted coding encouraged, but prompt history
must be submitted"). This file logs the prompts used to build it.

## 2026-10-10 — initial scaffold (with AI assistant)

1. "Scaffold a Cloudflare Workers project: signup-fraud signal demo. POST
   /events/signup ingests signup events (email, IP, device fingerprint, promo
   code), a pure-TypeScript signal layer scores them (disposable email,
   plus-addressing, gibberish local part, IP velocity, device reuse, promo
   abuse), a scorer routes approve / review / deny with reasons, and a
   self-contained HTML case-review page lists scored events."
2. "Add an optional Workers AI second opinion on the email pattern, with
   graceful fallback when the binding is absent."
3. "Add vitest unit tests for the scoring layer and end-to-end tests for the
   router using real Request/Response objects (no Workers runtime)."
4. "Write a README: architecture, run instructions, curl examples, deploy
   steps, and next steps."

## 2026-10-10 — aligning to the assignment text

5. "Switch the Workers AI model to Llama 3.3 as recommended in the assignment
   field text, and start this prompt history file."
