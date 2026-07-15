import { db } from '../../db/db'
import type { Job, SavedHunt, Signal, SweepYield } from '../../types'
import { fetchHackerNews, fetchRemotive, fetchRemoteOK } from './keyless'
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

export async function runSweep(onStep?: (label: string) => void): Promise<SweepYield> {
  // Darshak/demo: sweeps mutate the Radar and can spend credits — Owner Mode only (D44).
  if (!meteredCallsAllowed()) {
    return { found: 0, new: 0, duplicate: 0, bySource: {}, creditsSpent: 0, keylessLanes: [], keyedLanes: [], failed: ['Owner Mode required — the showcase never sweeps'] }
  }
  const hunts = (await db.savedHunts.toArray()).filter((h) => h.enabled)
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
