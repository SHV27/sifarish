import { db } from '../../db/db'
import type { Job, SavedHunt, Signal, SweepYield, VisionProfile } from '../../types'
import { deriveHunts } from '../vision/derive'
import { fetchHackerNews, fetchRemotive, fetchRemoteOK, fetchArbeitnow, fetchJobicy } from './keyless'
import { mergeDiscovered } from './normalize'
import { allowedThisRun, recordSpend } from '../budget'
import { meteredCallsAllowed, meteredHeaders } from '../apiGuard'

/**
 * The Khabri sweep orchestrator. Runs every enabled lane, normalizes + dedupes, merges into
 * the Radar queue with NEW stamps, and returns a transparent yield report (the Jasoos gate:
 * found/new/duplicate, credits spent, which lanes were keyed vs keyless).
 *
 * Keyed lanes (JSearch, Tavily) go through serverless so keys stay server-side; when a key is
 * absent they report `keyless:true` and the keyless lanes carry the sweep alone (I4).
 */

export const SEED_HUNTS: SavedHunt[] = [
  { id: 'h1', query: 'AI engineer intern India remote', country: 'in', remoteOnly: false, datePosted: 'week', enabled: true },
  { id: 'h2', query: 'agentic AI intern', remoteOnly: true, datePosted: 'week', enabled: true },
  { id: 'h3', query: 'Claude Code engineer', remoteOnly: true, datePosted: 'week', enabled: true },
  { id: 'h4', query: 'LLM engineer intern', remoteOnly: true, datePosted: 'week', enabled: true },
  { id: 'h5', query: 'AI residency 2026', remoteOnly: false, datePosted: 'week', enabled: false },
  { id: 'h6', query: 'prompt engineer intern remote', remoteOnly: true, datePosted: 'week', enabled: false },
  // Deeper reach (Session 5): niche / hidden-gem lanes alongside the common ones. Budget-capped
  // by I8; API-only (I3/I9). Enable more from Khabri when you want to widen the net.
  { id: 'h7', query: 'applied AI intern startup', remoteOnly: true, datePosted: 'week', enabled: true },
  { id: 'h8', query: 'RAG engineer intern', remoteOnly: true, datePosted: 'week', enabled: false },
  { id: 'h9', query: 'AI evaluation intern', remoteOnly: true, datePosted: 'week', enabled: false },
  { id: 'h10', query: 'ML research intern remote India', country: 'in', remoteOnly: true, datePosted: 'week', enabled: false },
  { id: 'h11', query: 'developer relations AI intern', remoteOnly: true, datePosted: 'week', enabled: false },
]

export const SEED_SIGNAL_QUERIES = [
  'hiring Claude engineers',
  'agentic AI team hiring announcement',
  'AI internship program announced India',
  'Anthropic ecosystem jobs',
]

/**
 * ADZUNA — the global aggregator lane (Session 5.5). One request = one country, so perRunCap (I8)
 * bounds how many geographies a single sweep reaches.
 *
 * Session 5.8 — ALL 18 Adzuna markets, rotated. The old fixed 8-country list meant the same 8
 * geographies forever and 10 markets ("duniya ke kone") never got hunted at all. Now: India is
 * ALWAYS first (his home market, every sweep), and the remaining 17 rotate through a persistent
 * window — same budget per sweep, the whole index covered every ~3 sweeps.
 */
export const ADZUNA_COUNTRIES = [
  'in', 'us', 'gb', 'ca', 'de', 'sg', 'au', 'nl', 'fr',
  'es', 'it', 'pl', 'br', 'mx', 'za', 'be', 'at', 'nz',
]

/**
 * The countries one sweep will hit: 'in' pinned first, then a rotating window over the other 17.
 * Pure + deterministic (offset in, list out) → unit-tested; the caller persists the next offset.
 */
export function adzunaCountriesForSweep(offset: number, cap = 8): string[] {
  const rest = ADZUNA_COUNTRIES.filter((c) => c !== 'in')
  const start = ((offset % rest.length) + rest.length) % rest.length
  const window: string[] = []
  for (let i = 0; i < Math.min(cap - 1, rest.length); i++) window.push(rest[(start + i) % rest.length])
  return ['in', ...window]
}

const ADZUNA_STOP = new Set([
  'india', 'indian', 'usa', 'us', 'uk', 'remote', 'onsite', 'hybrid', 'worldwide', 'global',
  'intern', 'internship', 'near', 'me', 'the', 'a', 'for', 'in', 'at', 'and', 'or', 'role', 'roles',
  'job', 'jobs', 'position', 'hiring', 'entry', 'level', '2024', '2025', '2026', '2027',
])

/**
 * Adzuna's `what` does an ALL-words match, so a long hunt like "AI engineer intern India remote"
 * over-constrains and returns nothing. We keep the AI-CORE (the first ≤3 significant words) and
 * drop location/seniority/date noise. "intern" is intentionally dropped — Adzuna carries few
 * intern-tagged roles, so keeping it collapses the yield; the Vision Lens + staleness scoring and
 * his own review handle seniority downstream. Deterministic + pure → unit-tested.
 */
export function cleanAdzunaQuery(q: string): string {
  const words = q
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !ADZUNA_STOP.has(w))
  const core = words.slice(0, 3).join(' ').trim()
  return core || 'AI engineer'
}

/** The distinct AI-core queries a sweep will spread across countries (falls back to a curated set). */
export function adzunaQueriesFromHunts(hunts: SavedHunt[]): string[] {
  const cores = [...new Set(hunts.map((h) => cleanAdzunaQuery(h.query)))].filter(Boolean)
  const fallback = ['AI engineer', 'machine learning engineer', 'artificial intelligence', 'LLM engineer', 'generative AI', 'data scientist']
  return (cores.length ? cores : fallback).slice(0, 8)
}

interface JobsApiResp {
  keyless: boolean
  jobs: Job[]
  creditsSpent: number
  error?: string
}
interface SignalsApiResp {
  keyless: boolean
  signals: Signal[]
  creditsSpent: number
}

async function callJobsApi(hunt: SavedHunt): Promise<JobsApiResp | null> {
  if (!meteredCallsAllowed()) return null // Darshak/demo: keyed lanes never spend (D44)
  try {
    const res = await fetch('/api/khabri/jobs', {
      method: 'POST',
      headers: meteredHeaders(),
      body: JSON.stringify({
        query: hunt.query,
        country: hunt.country,
        remoteOnly: hunt.remoteOnly,
        datePosted: hunt.datePosted,
        numPages: 1,
      }),
    })
    if (!res.ok) return null
    return (await res.json()) as JobsApiResp
  } catch {
    return null // pure vite dev (no serverless) → keyless lanes still run
  }
}

async function callSignalsApi(queries: string[]): Promise<SignalsApiResp | null> {
  if (!meteredCallsAllowed()) return null // Darshak/demo: keyed lanes never spend (D44)
  try {
    const res = await fetch('/api/khabri/signals', {
      method: 'POST',
      headers: meteredHeaders(),
      body: JSON.stringify({ queries, maxResultsPerQuery: 4 }),
    })
    if (!res.ok) return null
    return (await res.json()) as SignalsApiResp
  } catch {
    return null
  }
}

/**
 * Both Adzuna (keyed) and Working Nomads (keyless-but-no-CORS) are relayed by ONE proxy
 * (/api/khabri/aggregators). Owner-gated client-side (D44) AND server-side (the proxy re-checks
 * the token), so demo/Darshak never reaches it and the keys spend for no one but the owner.
 */
async function callAggregatorApi(src: 'adzuna' | 'workingnomads' | 'weworkremotely', body: Record<string, unknown> = {}): Promise<JobsApiResp | null> {
  if (!meteredCallsAllowed()) return null // Darshak/demo: never spends, never proxies (D44)
  try {
    const res = await fetch(`/api/khabri/aggregators?src=${src}`, {
      method: 'POST',
      headers: meteredHeaders(),
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return (await res.json()) as JobsApiResp
  } catch {
    return null // pure vite dev (no serverless) → the browser-direct keyless lanes still run
  }
}

export async function runSweep(onStep?: (label: string) => void): Promise<SweepYield> {
  // Darshak/demo: sweeps mutate the Radar and can spend credits — Owner Mode only (D44).
  if (!meteredCallsAllowed()) {
    return { found: 0, new: 0, duplicate: 0, bySource: {}, creditsSpent: 0, keylessLanes: [], keyedLanes: [], failed: ['Owner Mode required — the showcase never sweeps'] }
  }
  // His vision-derived hunts are hunted FIRST (Session 5.6) — the budget-limited lanes (JSearch,
  // Adzuna) spend on the roles he actually wants before any generic seed query.
  const hunts = (await db.savedHunts.toArray())
    .filter((h) => h.enabled)
    .sort((a, b) => Number(b.derived ?? false) - Number(a.derived ?? false))
  const existing = await db.jobs.toArray()
  const bySource: Record<string, number> = {}
  const failed: string[] = []
  const keyedLanes: string[] = []
  const keylessLanes: string[] = []
  let creditsSpent = 0
  const discovered: Job[] = []

  // --- Keyed aggregator lane (JSearch), budget-gated (I8) ---
  const jsearchBudget = await allowedThisRun('jsearch')
  let jsearchUsed = 0
  for (const hunt of hunts) {
    if (jsearchUsed >= jsearchBudget) break
    onStep?.(`JSearch: "${hunt.query}"`)
    const resp = await callJobsApi(hunt)
    if (!resp) continue
    if (resp.keyless) break // no key → skip the whole lane, keyless lanes carry it
    if (!keyedLanes.includes('JSearch (LinkedIn/Indeed/…)')) keyedLanes.push('JSearch (LinkedIn/Indeed/…)')
    jsearchUsed += resp.creditsSpent
    creditsSpent += resp.creditsSpent
    if (resp.error) failed.push('JSearch')
    for (const j of resp.jobs) discovered.push(j)
    bySource.jsearch = (bySource.jsearch ?? 0) + resp.jobs.length
  }
  if (jsearchUsed > 0) await recordSpend('jsearch', jsearchUsed)

  // --- Keyed aggregator lane (Adzuna), budget-gated (I8) — the global net (Session 5.5) ---
  // One request per country, so perRunCap bounds how many geographies a sweep reaches. The owner's
  // enabled hunts drive the query terms (their AI-core, location noise stripped); countries are the
  // fixed global set. This is the "duniya ka har corner" lane: India + US + UK + CA + DE + SG + AU + NL
  // each hunt, all real postings with salaries, deduped against everything else by mergeDiscovered.
  const adzunaBudget = await allowedThisRun('adzuna')
  if (adzunaBudget > 0) {
    const adzunaQueries = adzunaQueriesFromHunts(hunts)
    // Rotating window (Session 5.8): persist the offset so every sweep hunts a DIFFERENT slice of
    // the 18 markets ('in' always included) — all corners covered every ~3 sweeps, same budget.
    const offsetRow = await db.nabzCache.get('adzuna:rotation')
    const offset = Number(offsetRow?.json ?? 0) || 0
    const sweepCountries = adzunaCountriesForSweep(offset, adzunaBudget)
    await db.nabzCache.put({ key: 'adzuna:rotation', json: String(offset + sweepCountries.length - 1), fetchedAt: new Date().toISOString() })
    let adzunaUsed = 0
    for (let i = 0; i < sweepCountries.length; i++) {
      if (adzunaUsed >= adzunaBudget) break
      const country = sweepCountries[i]
      const query = adzunaQueries[i % adzunaQueries.length]
      onStep?.(`Adzuna ${country.toUpperCase()}: "${query}"`)
      const resp = await callAggregatorApi('adzuna', { country, query, resultsPerPage: 20 })
      if (!resp) continue
      if (resp.keyless) break // no key → skip the lane, keyless lanes carry the sweep (I4)
      if (!keyedLanes.includes('Adzuna (global · 18 countries)')) keyedLanes.push('Adzuna (global · 18 countries)')
      adzunaUsed += resp.creditsSpent
      creditsSpent += resp.creditsSpent
      if (resp.error) failed.push(`Adzuna ${country.toUpperCase()}`)
      for (const j of resp.jobs) discovered.push(j)
      bySource.adzuna = (bySource.adzuna ?? 0) + resp.jobs.length
    }
    if (adzunaUsed > 0) await recordSpend('adzuna', adzunaUsed)
  }

  // --- Keyless lanes (always run; I4) ---
  // Breadth fix (D88): these used to search only hunts[0], so the wider vision-derived hunt set
  // (D85) never reached the free lanes. Remotive now runs the top distinct hunts, RemoteOK gets
  // all their keywords to match on — more corners at zero budget cost.
  const keywords = hunts.flatMap((h) => h.query.toLowerCase().split(/\s+/)).filter((w) => w.length > 3)
  const topQueries = [...new Set(hunts.map((h) => h.query))].slice(0, 6)
  const laneRuns: [string, () => Promise<Job[]>][] = [
    ['Hacker News · Who is Hiring', () => fetchHackerNews(keywords)],
    [
      'Remotive',
      async () => {
        const out: Job[] = []
        for (const q of topQueries) out.push(...(await fetchRemotive(q).catch(() => [])))
        return out
      },
    ],
    ['RemoteOK', () => fetchRemoteOK(topQueries.join(' ') || 'AI')],
    // D90 — two genuinely new keyless corners: Arbeitnow (Europe + remote) and Jobicy (global
    // remote). Both verified live CORS `*`, both self-filter to AI-relevant roles. Zero budget.
    ['Arbeitnow · Europe + remote', () => fetchArbeitnow()],
    ['Jobicy · global remote', () => fetchJobicy()],
  ]
  for (const [label, run] of laneRuns) {
    onStep?.(label)
    try {
      const jobs = await run()
      keylessLanes.push(label)
      for (const j of jobs) discovered.push(j)
      const src = jobs[0]?.source
      if (src) bySource[src] = (bySource[src] ?? 0) + jobs.length
    } catch {
      failed.push(label)
    }
  }

  // --- Working Nomads (keyless, but no CORS → relayed by the aggregator proxy; Session 5.5) ---
  // Spends no external credit; adds genuinely global remote AI roles the other lanes miss.
  onStep?.('Working Nomads · global remote')
  const wn = await callAggregatorApi('workingnomads')
  if (wn && !wn.keyless) {
    keylessLanes.push('Working Nomads · global remote')
    for (const j of wn.jobs) discovered.push(j)
    bySource.workingnomads = (bySource.workingnomads ?? 0) + wn.jobs.length
    if (wn.error) failed.push('Working Nomads')
  }

  // --- We Work Remotely (keyless RSS, no CORS → proxied; Session 5.8) ---
  // The oldest large remote board; its programming feed carries global AI roles the other lanes
  // miss. Same guarded proxy, zero external credits.
  onStep?.('We Work Remotely · global remote')
  const wwr = await callAggregatorApi('weworkremotely')
  if (wwr && !wwr.keyless) {
    keylessLanes.push('We Work Remotely · global remote')
    for (const j of wwr.jobs) discovered.push(j)
    bySource.weworkremotely = (bySource.weworkremotely ?? 0) + wwr.jobs.length
    if (wwr.error) failed.push('We Work Remotely')
  }

  // --- Merge + dedupe into the Radar queue ---
  const merge = mergeDiscovered(discovered, existing)
  await db.jobs.bulkPut(merge.toPersist)

  // --- Signal lane (Tavily), budget-gated ---
  const tavilyBudget = await allowedThisRun('tavily')
  if (tavilyBudget > 0) {
    onStep?.('Signals: hiring news sweep')
    const resp = await callSignalsApi(SEED_SIGNAL_QUERIES)
    if (resp && !resp.keyless) {
      keyedLanes.push('Tavily (hiring signals)')
      creditsSpent += resp.creditsSpent
      await recordSpend('tavily', resp.creditsSpent)
      // Persist new signals (dedupe by id).
      for (const s of resp.signals) {
        const prior = await db.signals.get(s.id)
        if (!prior) await db.signals.put(s)
      }
    }
  }

  await db.settings.update('app', { lastSweepAt: new Date().toISOString() })

  return {
    found: merge.found,
    new: merge.added,
    duplicate: merge.duplicate,
    bySource,
    creditsSpent,
    keylessLanes,
    keyedLanes,
    failed,
  }
}

export async function seedHuntsIfEmpty(): Promise<void> {
  if ((await db.savedHunts.count()) === 0) await db.savedHunts.bulkPut(SEED_HUNTS)
}

/**
 * VISION → HUNTS (Session 5.6 — closes D68/D85, "the top 15 aren't mine"). His vision IS his
 * instruction: the queries the Radar goes looking for should BE the roles he named plus the market
 * names his dream implies. `deriveHunts(vision)` has always produced these — but nothing wrote them
 * to the live hunts except a buried manual click, so by default the queue was hunted with the
 * generic seed queries written before his vision existed (D69's "built, then not wired").
 *
 * This reconciles his vision into `savedHunts` on every open (via autopilot). It is ADDITIVE and
 * IDEMPOTENT: it only PUTs queries not already present (deduped by lowercase query), marks them
 * `derived:true` so the sweep hunts them first, and NEVER removes or disables a hunt he set or
 * toggled by hand (the D59/D88 local-first rule). Capped so the hunt panel stays readable. Zero
 * budget, zero key — pure DB. Owner-gated by its caller (autopilot is owner-only).
 */
export async function syncVisionHunts(vision?: VisionProfile, cap = 14): Promise<number> {
  if (!vision) return 0
  const existing = await db.savedHunts.toArray()
  const seen = new Set(existing.map((h) => h.query.trim().toLowerCase()))
  // `cap` bounds the TOTAL number of derived hunts, not this run — so repeated opens are idempotent
  // once the cap is reached, and the hunt panel never grows unbounded as the vision is re-derived.
  const budget = cap - existing.filter((h) => h.derived).length
  if (budget <= 0) return 0
  let added = 0
  for (const d of deriveHunts(vision)) {
    if (added >= budget) break
    const key = d.query.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    await db.savedHunts.put({
      id: `vh-${key.replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`,
      query: d.query,
      remoteOnly: d.remoteOnly,
      datePosted: 'week',
      enabled: true,
      derived: true,
    })
    added++
  }
  return added
}

/**
 * FRESHNESS MIGRATION (Session 5.4, D66) — "roz naye roles chahiye, LinkedIn jaise."
 *
 * Every seeded hunt asked JSearch for `datePosted: 'month'`, so each sweep re-requested a MONTH
 * of postings: the same month-old listings returning day after day, while LinkedIn showed him
 * "1 hour ago". The market moved daily; the app asked monthly. The seed default is now 'week'.
 *
 * But (the D59 lesson) local-first means a seed change reaches NOBODY who already has a vault.
 * So the old 'month' default is rewritten ONCE, guarded by a flag, and only where he never chose
 * the value himself — a hunt he deliberately set to 'month' is his call and stays untouched.
 */
export async function migrateHuntFreshness(): Promise<number> {
  const FLAG = 'migrated:hunt-freshness-v1'
  const done = await db.nabzCache.get(FLAG)
  if (done) return 0

  const stale = (await db.savedHunts.toArray()).filter((h) => h.datePosted === 'month' && !h.ownerSetDate)
  for (const h of stale) await db.savedHunts.update(h.id, { datePosted: 'week' })
  await db.nabzCache.put({ key: FLAG, json: 'true', fetchedAt: new Date().toISOString() })
  return stale.length
}

/**
 * Housekeeping (v3): prune `found` jobs older than `days` that were never tailored (no packet,
 * never made it past discovery). Keeps the jobs table from growing unbounded across many sweeps.
 * Only touches untouched finds — anything in the pipeline is never removed.
 */
export async function pruneStaleFinds(days = 21): Promise<number> {
  const cutoff = Date.now() - days * 86400000
  const stale = (await db.jobs.where('status').equals('found').toArray()).filter(
    (j) => !j.packetId && new Date(j.fetchedAt).getTime() < cutoff,
  )
  await db.jobs.bulkDelete(stale.map((j) => j.id))
  return stale.length
}
