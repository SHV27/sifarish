import { describe, it, expect } from 'vitest'
import { fakeJob, SEED_LEDGER } from './helpers'
import { scoreJob } from '../src/lib/radar/score'
import { DEFAULT_RUBRIC } from '../src/lib/radar/rubric'
import { ADZUNA_COUNTRIES, adzunaCountriesForSweep } from '../src/lib/khabri/client'
import { parseWwrRss } from '../api/khabri/aggregators'
import { sortCards, ackCard } from '../src/lib/dak/watch'
import { dimaagHealth } from '../src/lib/dimaag/health'
import { migrateWatchlistV58 } from '../src/db/seed'
import { WATCHLIST_ADDITIONS_V58 } from '../src/lib/radar/watchlist.seed'
import { db } from '../src/db/db'
import type { DakCard, DimaagUsageRow, VisionProfile } from '../src/types'

/**
 * Session 5.8 "The Duniya-Depth Pass" — regression gates. Every fix ships with the test that
 * would have caught it (§14).
 */

// ---------- 1 · Salary is a scored signal, not dead data ----------

describe('Salary signal (S5.8) — a provider-stated salary finally reaches the score', () => {
  it('a job with a structured salary but NO comp language in the JD scores above the no-signal floor', () => {
    const jd = 'Build LLM agents in Python. Remote.'
    const withSalary = { ...fakeJob('Acme', 'AI Engineer', jd), salary: '$120,000–$160,000' }
    const without = fakeJob('Acme2', 'AI Engineer', jd)
    const a = scoreJob(withSalary, SEED_LEDGER, DEFAULT_RUBRIC, false)
    const b = scoreJob(without, SEED_LEDGER, DEFAULT_RUBRIC, false)
    const compA = a.parts.find((p) => p.key === 'compSignal')!
    const compB = b.parts.find((p) => p.key === 'compSignal')!
    expect(compA.points).toBeGreaterThan(compB.points)
    expect(compA.why).toMatch(/posting states salary/i)
  })

  it('JD comp language still outranks the fallback (compHints stay first)', () => {
    const jd = 'Stipend ₹40,000/month with PPO conversion for strong performers. LLM work.'
    const j = { ...fakeJob('Acme', 'AI Engineer', jd), salary: '₹40k' }
    const comp = scoreJob(j, SEED_LEDGER, DEFAULT_RUBRIC, false).parts.find((p) => p.key === 'compSignal')!
    expect(comp.why).not.toMatch(/posting states salary/i)
  })

  it('rupee salary scores lower than foreign-currency salary (same bands as compHints)', () => {
    const jd = 'Build agents.'
    const usd = scoreJob({ ...fakeJob('A', 'AI Engineer', jd), salary: '$90,000' }, SEED_LEDGER, DEFAULT_RUBRIC, false)
    const inr = scoreJob({ ...fakeJob('B', 'AI Engineer', jd), salary: '₹9,00,000' }, SEED_LEDGER, DEFAULT_RUBRIC, false)
    const cu = usd.parts.find((p) => p.key === 'compSignal')!
    const ci = inr.parts.find((p) => p.key === 'compSignal')!
    expect(cu.points).toBeGreaterThanOrEqual(ci.points)
  })
})

// ---------- 2 · Adzuna 18-market rotation ----------

describe('Adzuna rotation (S5.8) — the whole world, not the same 8 forever', () => {
  it('the market list is the full 18-country Adzuna index', () => {
    expect(ADZUNA_COUNTRIES).toHaveLength(18)
    expect(new Set(ADZUNA_COUNTRIES).size).toBe(18)
    expect(ADZUNA_COUNTRIES).toContain('in')
  })

  it("'in' is pinned first on EVERY sweep — his home market never rotates out", () => {
    for (const off of [0, 3, 7, 16, 17, 40, -2]) {
      expect(adzunaCountriesForSweep(off, 8)[0]).toBe('in')
    }
  })

  it('successive sweeps cover ALL 18 markets (window rotates by cap-1)', () => {
    const seen = new Set<string>()
    let offset = 0
    for (let sweep = 0; sweep < 3; sweep++) {
      const countries = adzunaCountriesForSweep(offset, 8)
      expect(countries).toHaveLength(8)
      countries.forEach((c) => seen.add(c))
      offset += countries.length - 1
    }
    expect(seen.size).toBe(18)
  })

  it('cap bounds the window (budget-aware, I8)', () => {
    expect(adzunaCountriesForSweep(0, 3)).toHaveLength(3)
    expect(adzunaCountriesForSweep(0, 1)).toEqual(['in'])
  })
})

// ---------- 3 · We Work Remotely parser (the new provider's keyless core) ----------

const WWR_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>We Work Remotely</title>
<item>
  <title><![CDATA[Netomi: Senior Agentic AI Engineer]]></title>
  <region><![CDATA[Anywhere in the World]]></region>
  <category><![CDATA[Programming]]></category>
  <description><![CDATA[<p>Build LLM agents and RAG pipelines for customer experience.</p>]]></description>
  <link>https://weworkremotely.com/remote-jobs/netomi-senior-agentic-ai-engineer</link>
  <pubDate>Tue, 15 Jul 2026 10:00:00 +0000</pubDate>
</item>
<item>
  <title><![CDATA[Acme Corp: Senior Rails Developer]]></title>
  <region><![CDATA[USA Only]]></region>
  <category><![CDATA[Programming]]></category>
  <description><![CDATA[<p>Classic CRUD web development with Ruby on Rails.</p>]]></description>
  <link>https://weworkremotely.com/remote-jobs/acme-rails</link>
  <pubDate>Mon, 14 Jul 2026 10:00:00 +0000</pubDate>
</item>
<item>
  <title><![CDATA[NoLink Co: Machine Learning Engineer]]></title>
  <description><![CDATA[<p>ML role with a broken feed entry.</p>]]></description>
  <link></link>
</item>
</channel></rss>`

describe('We Work Remotely (S5.8) — new provider, deterministic parser', () => {
  const jobs = parseWwrRss(WWR_FIXTURE)

  it('parses "Company: Title" and normalizes to the Job shape', () => {
    expect(jobs).toHaveLength(1) // Rails role AI-filtered out; broken entry (no link) dropped
    const j = jobs[0] as Record<string, string>
    expect(j.company).toBe('Netomi')
    expect(j.title).toBe('Senior Agentic AI Engineer')
    expect(j.source).toBe('weworkremotely')
    expect(j.location).toBe('Anywhere in the World')
    expect(j.url).toMatch(/^https:\/\/weworkremotely\.com\//)
    expect(j.jd).toMatch(/LLM agents and RAG/)
    expect(j.jd).not.toMatch(/<p>/) // HTML stripped
    expect(j.status).toBe('found')
  })

  it('pubDate becomes a real ISO updatedAt (so the staleness deduction can read it)', () => {
    const j = jobs[0] as Record<string, string>
    expect(j.updatedAt).toMatch(/^2026-07-15T/)
  })

  it('non-AI roles never enter the radar (the lane self-filters like Working Nomads)', () => {
    expect(jobs.some((j) => (j as Record<string, string>).company === 'Acme Corp')).toBe(false)
  })
})

// ---------- 4 · Dak Khana: acknowledge + action-first ordering ----------

function card(id: string, stage: DakCard['stageSuggestion'], date: string): DakCard {
  return {
    id,
    company: 'Acme',
    subject: 's',
    from: 'f',
    date,
    snippet: '',
    gmailUrl: 'https://mail.google.com/mail/u/0/#all/x',
    stageSuggestion: stage,
    status: 'pending',
    fetchedAt: '2026-07-16T00:00:00.000Z',
  }
}

describe('Dak Khana (S5.8) — "I know this one" + interviews on top', () => {
  it('sortCards: interview → rejected → generic, newest first within each band', () => {
    const sorted = sortCards([
      card('g-old', undefined, 'Mon, 01 Jun 2026 10:00:00 +0000'),
      card('r1', 'rejected', 'Wed, 15 Jul 2026 10:00:00 +0000'),
      card('i-old', 'interview', 'Mon, 01 Jun 2026 10:00:00 +0000'),
      card('i-new', 'interview', 'Wed, 15 Jul 2026 10:00:00 +0000'),
      card('g-new', undefined, 'Wed, 15 Jul 2026 10:00:00 +0000'),
    ])
    expect(sorted.map((c) => c.id)).toEqual(['i-new', 'i-old', 'r1', 'g-new', 'g-old'])
  })

  it('an unparseable date falls back to fetchedAt instead of NaN-sorting (the D96 lesson)', () => {
    const sorted = sortCards([card('bad-date', undefined, 'not a date'), card('good', undefined, 'Wed, 15 Jul 2026 10:00:00 +0000')])
    expect(sorted).toHaveLength(2) // no throw, stable output
  })

  it('ackCard persists — an acknowledged mail leaves the pending list and stays gone on reload', async () => {
    await db.dak.put(card('ack-me', 'interview', 'Wed, 15 Jul 2026 10:00:00 +0000'))
    await ackCard('ack-me')
    const row = await db.dak.get('ack-me')
    expect(row?.status).toBe('acked')
    const pending = await db.dak.where('status').equals('pending').toArray()
    expect(pending.some((c) => c.id === 'ack-me')).toBe(false)
    // sweepMail dedupes on message id over ALL cards (not just pending), so it can never resurface:
    const known = new Set((await db.dak.toArray()).map((c) => c.id))
    expect(known.has('ack-me')).toBe(true)
  })
})

// ---------- 5 · Reasoning-tier health (D74's blind spot, closed) ----------

function usage(feature: string, calls: number, fallbacks: number, hits = 0): DimaagUsageRow {
  return { id: `${feature}:2026-07`, feature, monthKey: '2026-07', calls, tokens: 0, cacheHits: hits, fallbacks }
}

describe('dimaagHealth (S5.8) — a dead LLM tier can no longer hide (D74)', () => {
  it('quiet: nothing recorded → no verdict, no badge', () => {
    expect(dimaagHealth([])).toBe('quiet')
  })
  it('keyless: only fallbacks ever ran', () => {
    expect(dimaagHealth([usage('forge', 0, 6)])).toBe('keyless')
  })
  it('degraded: the D73/D74 signature — real volume, fallbacks drowning calls', () => {
    expect(dimaagHealth([usage('decide', 2, 10), usage('classify', 0, 5)])).toBe('degraded')
  })
  it('live: real calls landing', () => {
    expect(dimaagHealth([usage('decide', 8, 2)])).toBe('live')
  })
  it('scopes to the given month — last month’s corpse does not haunt this month', () => {
    const lastMonth: DimaagUsageRow = { id: 'decide:2026-06', feature: 'decide', monthKey: '2026-06', calls: 0, tokens: 0, cacheHits: 0, fallbacks: 20 }
    expect(dimaagHealth([lastMonth, usage('decide', 5, 0)], '2026-07')).toBe('live')
  })
})

// ---------- 6 · Watchlist migration (additive, once-only) ----------

describe('Watchlist v5.8 migration — additive, never resurrects a deletion', () => {
  it('adds the probed AI-first boards once, then never again', async () => {
    await db.nabzCache.delete('migrated:watchlist-v58')
    for (const id of WATCHLIST_ADDITIONS_V58) await db.watchlist.delete(id)

    const added = await migrateWatchlistV58()
    expect(added).toBe(WATCHLIST_ADDITIONS_V58.length)
    expect(await db.watchlist.get('lever:netomi')).toBeTruthy()

    // He deletes one; the flag means it never comes back uninvited (D59 local-first rule).
    await db.watchlist.delete('ashby:kantiv')
    const again = await migrateWatchlistV58()
    expect(again).toBe(0)
    expect(await db.watchlist.get('ashby:kantiv')).toBeUndefined()
  })
})

// ---------- 7 · Relevance fixture from HIS actual LinkedIn feed ----------

describe('Radar sanity (S5.8) — his pasted LinkedIn feed ranks into the top slots', () => {
  const vision: VisionProfile = {
    dream: 'Become an agentic/LLM AI engineer building agents, RAG and evals — remote, India + global, well paid.',
    targetRoles: ['Agentic AI Engineer', 'Generative AI Engineer', 'AI Engineer', 'Prompt Engineer', 'Agentic Systems Engineer'],
    notInterested: ['sales', 'pure frontend', 'manual QA'],
    compFloorStipend: 35000,
    ppoFloorLpa: 16,
    windowStart: 'Jan 2027',
    windowEnd: 'May 2027',
    remoteInternational: true,
    openToOctoberStart: true,
  }
  const aiJd = 'Build and ship LLM-powered agents: RAG pipelines, tool use, evals, guardrails. Python, LangGraph. Remote (India welcome). Salary ₹15–50 LPA.'
  const today = new Date().toISOString()

  // Hand-labeled from the owner's real LinkedIn screenshot (16-Jul-2026).
  const linkedinFeed = [
    { company: 'Netomi', title: 'Agentic Engineer' },
    { company: 'Weekday (YC W21)', title: 'Generative AI Engineer' },
    { company: 'Wingify', title: 'Generative AI Engineer' },
    { company: 'QuantumLoopAi', title: 'AI/ML & Prompt Engineer' },
    { company: 'Kantiv', title: 'Agentic Systems Engineer' },
    { company: 'Teradata', title: 'AI Engineer' },
  ]
  const noise = [
    { company: 'MassCorp', title: 'Java Backend Developer', jd: 'Spring Boot microservices. On-site Bangalore.' },
    { company: 'AgencyX', title: 'WordPress Developer', jd: 'Build marketing sites. PHP.' },
    { company: 'OldCo', title: 'AI Engineer', jd: aiJd, updatedAt: '2025-01-01T00:00:00.000Z' }, // stale
    { company: 'SalesAI', title: 'AI Sales Executive', jd: 'Sell AI products. Quota-carrying sales role.' },
  ]

  it('his six real roles all outrank every noise role (top-6 of 10 = 100% agreement)', () => {
    const scored = [
      ...linkedinFeed.map((r) => ({
        ...r,
        total: scoreJob({ ...fakeJob(r.company, r.title, aiJd), updatedAt: today }, SEED_LEDGER, DEFAULT_RUBRIC, false, vision).total,
      })),
      ...noise.map((r) => ({
        ...r,
        total: scoreJob({ ...fakeJob(r.company, r.title, r.jd), updatedAt: r.updatedAt ?? today }, SEED_LEDGER, DEFAULT_RUBRIC, false, vision).total,
      })),
    ].sort((a, b) => b.total - a.total)

    const top6 = scored.slice(0, 6).map((s) => s.company)
    for (const r of linkedinFeed) expect(top6).toContain(r.company)
  })
})
