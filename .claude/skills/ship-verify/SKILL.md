---
name: ship-verify
description: Deploy SIFARISH to Vercel production and PROVE the served bundle carries the change (D76/D83 law — a green build proves nothing about what users are served). Use for any deploy, "make it live", or when prod looks stale.
---

# Ship & verify (the only trusted deploy runbook)

1. Preconditions: gates green (`npx vitest run`), `tsc -b` clean, `npm run build` warning-free.
2. Token: `VERCEL_TOKEN` comes from gitignored `.env.local` (D109 — pulled, never pasted). If
   absent, ask the owner once with baby steps (vercel.com → Settings → Tokens), then stop.
3. Deploy: `npx vercel deploy --prod --token <from .env.local> --yes` from repo root.
4. **Served-hash proof (mandatory):** fetch the live URL, extract the `index-*.js` asset name,
   confirm it CHANGED from the pre-deploy value AND that the bundle contains a string unique to
   this session's change (`curl -s <asset-url> | grep -c "<unique-string>"` ≥ 1).
5. Adversary curls on any function touched: POST with no Origin → 403; fabricated
   x-sifarish-token → keyless degrade (not 500).
6. Demo smoke: `node scripts/demo-smoke.mjs` → 7 screens, Arjun persona, 0 metered POSTs,
   ERRORS(0). Owner smoke needs `SIFARISH_PASS` in env — never in a file.
7. Record: PROGRESS.md gets the served hash + date; a deploy without step 4 evidence is NOT a
   deploy, it is a hope.
