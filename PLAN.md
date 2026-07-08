# PLAN.md — SIFARISH v2 "The Jasoos Update" (08-Jul-2026)

v1 is live and green (65/65). v2 gives the app eyes, ears, and a voice — WITHOUT breaking the Design Law:
*Compile truth. Draft everything. Send nothing.* Regression is the enemy; the v1 suite stays green.

## WS0 verified live (08-Jul-2026)

| Fact | Result |
|---|---|
| Tavily | ✅ `POST https://api.tavily.com/search` (api_key in body); returns `results[]`, `response_time` |
| Groq | ✅ `llama-3.3-70b-versatile` — function-calling + streaming confirmed; also gpt-oss-120b/20b, llama-3.1-8b-instant, qwen3-32b |
| **JSearch** | ✅ it's **OpenWeb Ninja** (`ak_` key, `X-API-Key` header): `GET https://api.openwebninja.com/jsearch/search?query=&page=&num_pages=&date_posted=&country=`; surfaces LinkedIn/Indeed/Glassdoor listings; 40+ fields |
| GitHub PAT | ✅ 200 (raises Nabz to 5000/hr) |
| HN Algolia | ✅ keyless; latest "Who is hiring? (July 2026)" = objectID 48747976; comments via `/api/v1/items/{id}` |
| Remotive | ✅ keyless `GET https://remotive.com/api/remote-jobs?search=` |
| RemoteOK | ✅ keyless `GET https://remoteok.com/api?tags=` (row 0 is metadata) |

All keys server-side only (Vercel env: GROQ/TAVILY/JSEARCH/GITHUB_PAT set; local `.env` gitignored). Never VITE_.

## v2 architecture

- **Serverless functions (`api/`)** — all metered keys stay here:
  - `api/polish.ts` (v1, Groq) · `api/khabri/jobs.ts` (JSearch) · `api/khabri/signals.ts` (Tavily) ·
    `api/intel.ts` (Tavily, 7-day cache) · `api/guru.ts` (Groq streaming + tools) · `api/pulse.ts` (Tavily).
  - Every function: reads key from `process.env`; if absent → 200 with `{keyless:true}` and the client uses a
    keyless/deterministic path (I4). Enforces per-run caps + returns `creditsSpent` (I8).
- **Keyless discovery** runs browser-direct (CORS-permitting) or via a keyless passthrough: HN Algolia
  (CORS `*`), Remotive, RemoteOK.
- **New Dexie tables:** `signals`, `intel`, `budgets`, `pulse`, `guruThreads`, `savedHunts`; extend `settings`
  with `visionProfile` + `rubricChangelog`.
- **New invariants I7 (cited intelligence), I8 (budget honesty), I9 (no guarantee language)** — Referee-enforced.

## Workstreams
WS1 Khabri · WS2 Darzi v2 Intel · WS3 Guru · WS4 Pulse + Ledger QoL · WS5 Budgets + keys panel ·
WS6 Certification v2 · WS7 Ship.

## Gate commands (unchanged + additive)
`npm run gates` (Vitest: v1 65 + new I7/I8/I9/Khabri/Guru/Intel) · `npm run build` · `npm run screenshots`.
Live-integration checks are opt-in via `SIFARISH_LIVE=1` (reads `.env`) so CI stays keyless-deterministic.
