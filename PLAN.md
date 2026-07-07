# PLAN.md — SIFARISH build plan (WS0, 07-Jul-2026)

Constitution: CLAUDE.md. Evidence: RESEARCH.md. This plan executes the SESSION 1 brief workstream-by-workstream.

## Architecture (locked at WS0)

- **App:** Vite 8 + React 19 + TS 5.9, Tailwind 4 (`src/styles/tokens.css` is the single token source).
  No router lib — top-level screen state. No state lib — Dexie 4 + `dexie-react-hooks` `useLiveQuery` is the store.
- **Persistence:** IndexedDB via Dexie. Tables: `ledger`, `identity`, `voicebank`, `jobs`, `packets`,
  `watchlist`, `suggestions`, `settings`, `nabzCache`. Seed from `seed/ledger.seed.json` on first open.
- **Darzi pipeline** (pure functions in `src/lib/`, each unit-tested):
  `jd/decode` → `match/evidence` → `compile/compiler` (one-page budget, human-readable errors)
  → `export/pdf` (pdf-lib, Helvetica standard font, manual line layout = deterministic text order)
  → `export/docx` (docx) → `export/parseback` (pdfjs-dist; dev + CI gate).
- **Radar:** browser-direct fetch (all four ATS feeds verified `Access-Control-Allow-Origin: *` live on
  07-Jul-2026) + paste lane. Scoring rubric = visible, editable weights; every score expands to WHY.
- **Nabz:** GitHub public REST browser-side (CORS `*` verified), Dexie cache with `fetchedAt`, rate budget
  shown honestly. Suggestions queue; human confirms every mutation.
- **Serverless:** exactly one function, `api/polish.ts` (Groq; keyless fallback = compiled text untouched).
- **Compiled resume artifacts:** every `CompiledLine` carries `ledgerIds` (I1 structural); `in_forge`
  renders only via the single dated "Currently Building" line (I2 structural); no send mechanism exists
  anywhere (I3 — verified by a Referee test that greps the source for banned APIs).

## Workstreams

- **WS0** ✅ verify volatile facts → scaffold + tokens + PLAN/PROGRESS + git.
- **WS1** Sach Ledger: types, Dexie schema, real seed (SHV27 verified live), shelf UI, Voice Bank,
  promotion ceremony.
- **WS2** Darzi core (before Radar — a compiled truthful packet from a pasted JD is the walking skeleton):
  decode → match → compile → PDF+DOCX → parse-back tests → packet UI.
- **WS3** Shikaar Radar: feed adapters + live-probed watchlist seed + paste lane + rubric + ranked queue.
- **WS4** GitHub Nabz: sync, suggestion queue, promotion loop, strength meter.
- **WS5** Morcha Board: pipeline, day-7/14 nudges, interview dossier, header strip.
- **WS6** `/api/polish` + fact-drift guard, onboarding (first packet ≤60s), keyboard map, empty states, a11y.
- **WS7** Certification: full gate table, chaos runs, 3-breakpoint screenshots, README-as-case-study,
  deploy (Vercel), LinkedIn draft + 100-word pitch.

## Gate commands

- `npm run gates` — full Vitest suite: invariants I1–I5, parse-back fidelity, JD coverage, one-page,
  slop-scan, rubric agreement fixture, chaos cases.
- `npm run build` — typecheck + production build (zero errors tolerated).
- `npm run screenshots` — Playwright headless captures at 360/768/1280 (Law 9).
