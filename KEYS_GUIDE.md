# KEYS_GUIDE — SIFARISH

SIFARISH runs **fully with zero keys.** Keys are amplifiers, not dependencies (Invariant I4). They live
server-side only — on Vercel as environment variables, and locally in a **gitignored** `.env`. A key is
never `VITE_`-prefixed and never reaches the browser bundle (there is a build-time audit gate for this).

## What each key unlocks

| Env var | Unlocks | Without it (keyless path) |
|---|---|---|
| `GROQ_API_KEY` | Guru conversational chat + resume phrasing polish | Guru runs its deterministic router (still answers, refuses, plans); resume stays exactly as compiled |
| `TAVILY_API_KEY` | Hiring **signals**, company **intel**, market **pulse** | Discovery via the free lanes; no signal/intel/pulse panels |
| `JSEARCH_API_KEY` | **JSearch** (OpenWeb Ninja) — LinkedIn/Indeed/Glassdoor job aggregation | Discovery via Hacker News "Who is Hiring" + Remotive + RemoteOK + Arbeitnow + Jobicy + Working Nomads (all keyless) |
| `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` | **Adzuna** — global job aggregation across 18 country markets (US/CA/IN/GB/DE/SG/AU/…) with real salaries | Other aggregator + keyless lanes carry the sweep |
| `GITHUB_PAT` | GitHub Nabz at 5,000 req/hr | Nabz at 60 req/hr (still fully works) |

## Where to get them (free tiers)

- **Groq** — https://console.groq.com → API Keys. Free tier. Models used: `openai/gpt-oss-120b`
  (reasoning + Guru + polish) and `openai/gpt-oss-20b` (classify). (Migrated from the deprecated
  `llama-3.x` models per Groq's shutdown notice — see D35.)
- **Tavily** — https://app.tavily.com → API Keys. Free dev tier includes monthly credits.
- **JSearch / OpenWeb Ninja** — https://www.openwebninja.com → get an `ak_…` key; sent as the `X-API-Key`
  header to `api.openwebninja.com/jsearch/search`.
- **Adzuna** — https://developer.adzuna.com → register for a free `app_id` + `app_key`; sent as query
  params to `api.adzuna.com/v1/api/jobs/{country}/search/1` (all 18 country markets, server-side only).
- **GitHub PAT** — https://github.com/settings/tokens → fine-grained token, **public read only** (no scopes
  needed for public repos). Optional.

## Setting them

**On Vercel (production):**
```bash
vercel env add GROQ_API_KEY production      # paste value when prompted
vercel env add TAVILY_API_KEY production
vercel env add JSEARCH_API_KEY production
vercel env add ADZUNA_APP_ID production
vercel env add ADZUNA_APP_KEY production
vercel env add GITHUB_PAT production
vercel --prod                                # redeploy to pick them up
```

**Locally** (for `vercel dev` and live-integration tests) — create `.env` (already gitignored):
```
GROQ_API_KEY=...
TAVILY_API_KEY=...
JSEARCH_API_KEY=...
GITHUB_PAT=...
```

## Budgets (Invariant I8)

Every metered key has a monthly + per-run cap, tracked in Settings → API budgets. Sweeps refuse to exceed
the monthly cap and degrade to the keyless lanes. The app never silently burns credits. Adjust caps in
`src/lib/budget.ts`.

## ⚠️ Rotation

Any key that has ever appeared in plaintext (chat, a screenshot, a commit) must be rotated. Rotate at the
provider console above, then update the Vercel env and your local `.env`. The repo itself contains **no**
keys — audited in CI (`tests/security.test.ts`).
