import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { db } from '../src/db/db'
import {
  BUDGET_DEFAULTS,
  DAILY_PACED,
  dailyAllowance,
  dayKey,
  allowedThisRun,
  laneSkipReason,
  recordSpend,
  monthKey,
} from '../src/lib/budget'
import { addSavedHunt, syncVisionHunts, cleanAdzunaQuery } from '../src/lib/khabri/client'
import { deriveHunts } from '../src/lib/vision/derive'
import { dedupeKey, mergeDiscovered, withDedupeKey } from '../src/lib/khabri/normalize'
import type { Job, VisionProfile } from '../src/types'

/**
 * Session 7.2 "The Sanad" — WS-B gates: the hunt's arithmetic must CLOSE. The audit proved the
 * 6h-sweep × 6-credit design killed the 200/month JSearch budget by day ~8, silently — after
 * which the only LinkedIn-reaching lane ran zero times for three weeks. These gates pin the
 * ration math, the legible skips, the vision-net quotas, and the dedupe that stopped eating
 * role identity.
 */

const VISION: VisionProfile = {
  dream: 'Direct AI agents, RAG pipelines and guardrails to build products that ship.',
  targetRoles: ['AI Engineer Intern', 'Agentic AI Engineer'],
  notInterested: [],
  compFloorStipend: 20000,
  ppoFloorLpa: 16,
  windowStart: 'Jan 2027',
  windowEnd: 'May 2027',
  remoteInternational: true,
  openToOctoberStart: false,
  dreamCompanies: ['Netomi'],
}

describe('B1 — daily rationing: the budget survives the month', () => {
  beforeEach(async () => {
    await db.budgets.clear()
  })

  it('30 days of full rations never exceed the monthly cap (per-lane arithmetic closes)', () => {
    for (const def of BUDGET_DEFAULTS) {
      if (!DAILY_PACED.has(def.id)) continue
      expect(dailyAllowance(def.monthlyCap) * 30, `${def.id} ration × 30 must fit its month`).toBeLessThanOrEqual(def.monthlyCap)
    }
    expect(dailyAllowance(200)).toBe(6)
    expect(dailyAllowance(300)).toBe(10)
  })

  it("a lane stops at today's ration and returns tomorrow — the month-killer sweep pattern is dead", async () => {
    // Day 1, sweep 1: full ration available.
    expect(await allowedThisRun('jsearch')).toBe(6)
    await recordSpend('jsearch', 6)
    // Day 1, sweeps 2-4 (the 6h autopilot pattern): ration spent — lane rests, legibly.
    expect(await allowedThisRun('jsearch')).toBe(0)
    expect(await laneSkipReason('jsearch')).toBe('ration')
    // Simulate the next day (the stored dayKey no longer matches today).
    const b = (await db.budgets.get('jsearch'))!
    await db.budgets.update('jsearch', { dayKey: '2000-01-01' })
    expect(await allowedThisRun('jsearch')).toBe(6)
    // Monthly ledger still counted every spend.
    expect(b.used).toBe(6)
  })

  it('a spent MONTH reads as budget, not ration', async () => {
    await allowedThisRun('jsearch') // ensure row
    const b = (await db.budgets.get('jsearch'))!
    await db.budgets.update('jsearch', { used: b.monthlyCap, dayKey: '2000-01-01', usedToday: 0 })
    expect(await allowedThisRun('jsearch')).toBe(0)
    expect(await laneSkipReason('jsearch')).toBe('budget')
  })

  it('reasoning lanes are NOT rationed — a heavy tailoring day is his call (monthly cap still rules)', async () => {
    expect(DAILY_PACED.has('dimaag')).toBe(false)
    expect(DAILY_PACED.has('chhota')).toBe(false)
    expect(DAILY_PACED.has('groq')).toBe(false)
  })

  it('recordSpend tracks the day ledger', async () => {
    await allowedThisRun('adzuna')
    await recordSpend('adzuna', 3)
    const b = (await db.budgets.get('adzuna'))!
    expect(b.dayKey).toBe(dayKey())
    expect(b.usedToday).toBe(3)
    expect(b.monthKey).toBe(monthKey())
  })
})

describe('B2 — budget exhaustion is LEGIBLE in the sweep (source gates)', () => {
  const client = readFileSync('src/lib/khabri/client.ts', 'utf8')
  it('runSweep names skipped lanes with reasons', () => {
    expect(client).toContain("noteSkip('jsearch'")
    expect(client).toContain("noteSkip('adzuna'")
    expect(client).toContain("noteSkip('tavily'")
    expect(client).toContain('skipped,')
  })
  it('the Radar and Khabri surfaces render the skip', () => {
    expect(readFileSync('src/screens/Radar.tsx', 'utf8')).toContain('r.skipped')
    expect(readFileSync('src/screens/Khabri.tsx', 'utf8')).toContain('result.skipped')
  })
})

describe('B3/B5 — depth where it pays; the owner\'s freshness window honored', () => {
  const server = readFileSync('api/khabri/jobs.ts', 'utf8')
  const client = readFileSync('src/lib/khabri/client.ts', 'utf8')
  it("the server accepts a bounded page and passes 'all' through instead of narrowing it", () => {
    expect(server).toMatch(/body\.page/)
    expect(server).toContain("date_posted: body.datePosted ?? 'month'")
    expect(server).not.toContain("datePosted !== 'all' ? body.datePosted : 'month'")
    expect(server).toContain("num_pages: '1'") // one credit per REQUEST stays law (D144)
  })
  it('the client promotes proven hunts to page 2, bounded and ration-aware', () => {
    expect(client).toContain("'jsearch:yields'")
    expect(client).toMatch(/deepUsed < 2/)
    expect(client).toMatch(/jsearchUsed < jsearchBudget/)
    expect(client).toMatch(/callJobsApi\(\{ \.\.\.hunt, country \}, 2\)/)
  })
  it('market rotation advances by the consumed window and never double-funds India', () => {
    expect(client).toContain('JSEARCH_REST')
    expect(client).toMatch(/marketOffset \+ Math\.max\(1, jsearchBudget - 1\)/)
    // The rest-list carries no 'in', so slot i>0 can never land India again.
    const m = /const JSEARCH_REST = \[([^\]]+)\]/.exec(client)
    expect(m).not.toBeNull()
    expect(m![1]).not.toContain("'in'")
  })
})

describe('B4 — the vision\'s WHOLE net syncs (class quotas beat the single cap)', () => {
  beforeEach(async () => {
    await db.savedHunts.clear()
  })

  it('deriveHunts labels every hunt with its class', () => {
    const derived = deriveHunts(VISION)
    const classes = new Set(derived.map((d) => d.cls))
    expect(classes.has('role')).toBe(true)
    expect(classes.has('region')).toBe(true)
    expect(classes.has('theme')).toBe(true)
    expect(classes.has('company')).toBe(true)
  })

  it('a default-shaped vision syncs at least one region + theme + dream-company hunt', async () => {
    const added = await syncVisionHunts(VISION)
    expect(added).toBeGreaterThan(0)
    const hunts = await db.savedHunts.toArray()
    const queries = hunts.map((h) => h.query.toLowerCase())
    expect(queries.some((q) => q.includes('europe')), 'region hunt must reach savedHunts').toBe(true)
    expect(queries.some((q) => q.includes('netomi')), 'dream-company hunt must reach savedHunts').toBe(true)
    const clsOf = new Map(deriveHunts(VISION).map((d) => [d.query.toLowerCase(), d.cls]))
    expect(hunts.some((h) => clsOf.get(h.query.toLowerCase()) === 'theme'), 'theme hunt must reach savedHunts').toBe(true)
    // Every synced hunt is derived + week-fresh (retirement-eligible, D123; freshness law, D66).
    for (const h of hunts) {
      expect(h.derived).toBe(true)
      expect(h.datePosted).toBe('week')
    }
  })

  it('repeated syncs converge (idempotent under the cap)', async () => {
    await syncVisionHunts(VISION)
    const after1 = (await db.savedHunts.toArray()).length
    const added2 = await syncVisionHunts(VISION)
    expect(added2).toBe(0)
    expect((await db.savedHunts.toArray()).length).toBe(after1)
  })
})

describe('C5 — ONE addHunt(): no site can re-introduce the month-window bug', () => {
  beforeEach(async () => {
    await db.savedHunts.clear()
  })

  it('creates week-fresh hunts; derived flag controls retirement eligibility', async () => {
    const h = await addSavedHunt({ query: 'AI Engineer Europe', derived: true })
    expect(h?.datePosted).toBe('week')
    expect(h?.derived).toBe(true)
    expect(h?.id.startsWith('vh-')).toBe(true)
    const manual = await addSavedHunt({ query: 'Claude Code engineer' })
    expect(manual?.derived).toBeUndefined()
    expect(manual?.id.startsWith('h-')).toBe(true)
  })

  it('a duplicate query re-enables instead of duplicating', async () => {
    const first = await addSavedHunt({ query: 'RAG engineer' })
    await db.savedHunts.update(first!.id, { enabled: false })
    const again = await addSavedHunt({ query: 'rag engineer' })
    expect(again!.id).toBe(first!.id)
    expect((await db.savedHunts.get(first!.id))!.enabled).toBe(true)
    expect((await db.savedHunts.toArray()).length).toBe(1)
  })

  it('no screen writes savedHunts with a month window anymore (source gate)', () => {
    for (const f of ['src/screens/Guru.tsx', 'src/screens/SettingsScreen.tsx', 'src/screens/Khabri.tsx', 'src/screens/Radar.tsx']) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} must not hand-roll hunt creation`).not.toMatch(/datePosted:\s*'month'/)
    }
  })
})

describe('B6 — the dedupe key keeps role identity; re-sighting heals staleness', () => {
  it('seniority and discipline survive the key', () => {
    const a = dedupeKey('Acme AI', 'Senior ML Engineer', 'Remote')
    const b = dedupeKey('Acme AI', 'ML Engineer Intern', 'Remote')
    const c = dedupeKey('Acme AI', 'ML Scientist', 'Remote')
    expect(a).not.toBe(b)
    expect(b).not.toBe(c)
    // …while a true cross-source duplicate still collapses.
    expect(dedupeKey('Acme AI', 'ML Engineer (Remote) 2026', 'Bengaluru')).toBe(dedupeKey('Acme, Inc.', 'ML Engineer', 'Bengaluru'))
  })

  it('a duplicate sighting with a fresher date heals the survivor instead of vanishing', () => {
    const survivor: Job = withDedupeKey({
      id: 'jsearch:old',
      source: 'jsearch',
      company: 'Acme AI',
      title: 'ML Engineer',
      location: 'Bengaluru',
      url: 'https://x',
      jd: 'ml',
      updatedAt: '2026-05-01T00:00:00Z',
      fetchedAt: '2026-05-01T00:00:00Z',
      status: 'found',
    } as Job)
    const resight: Job = {
      ...survivor,
      id: 'adzuna:new',
      source: 'adzuna',
      updatedAt: '2026-07-17T00:00:00Z',
      fetchedAt: '2026-07-18T00:00:00Z',
      salary: '₹9.3L',
      dedupeKey: undefined,
    } as Job
    const r = mergeDiscovered([resight], [survivor])
    expect(r.duplicate).toBe(1)
    expect(r.added).toBe(0)
    const healed = r.toPersist.find((j) => j.id === 'jsearch:old')
    expect(healed, 'the survivor must persist with healed fields').toBeDefined()
    expect(healed!.updatedAt).toBe('2026-07-17T00:00:00Z')
    expect(healed!.salary).toBe('₹9.3L')
    expect(healed!.status).toBe('found') // pipeline state untouched
  })
})

describe('B7 — board scans join the dedupe (source gate: board wins, absorbs state)', () => {
  it('syncRadar passes new board jobs through the key and absorbs the aggregator twin', () => {
    const src = readFileSync('src/lib/radar/feeds.ts', 'utf8')
    expect(src).toContain('withDedupeKey(job)')
    expect(src).toMatch(/where\('dedupeKey'\)/)
    expect(src).toContain('db.jobs.delete(twin.id)')
    expect(src).toContain('status: twin.status')
  })
})

describe('B8 — lane-fit queries', () => {
  it('free lanes receive the ≤3-word AI core, not the full hunt phrase', () => {
    expect(cleanAdzunaQuery('AI engineer intern India remote').split(' ').length).toBeLessThanOrEqual(3)
    const client = readFileSync('src/lib/khabri/client.ts', 'utf8')
    expect(client).toMatch(/topQueries = \[\.\.\.new Set\(hunts\.map\(\(h\) => cleanAdzunaQuery\(h\.query\)\)\)\]/)
    expect(client).toContain("'adzuna:queries'") // the query index rotates per sweep
  })
})
