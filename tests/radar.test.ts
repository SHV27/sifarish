import { describe, it, expect } from 'vitest'
import { JD_FIXTURES } from './fixtures/jds'
import { fakeJob, SEED_LEDGER } from './helpers'
import { scoreJob, stalenessPart } from '../src/lib/radar/score'
import { DEFAULT_RUBRIC } from '../src/lib/radar/rubric'
import { recognizeAtsUrl } from '../src/lib/radar/pasteLane'
import { WATCHLIST_SEED } from '../src/lib/radar/watchlist.seed'

describe('Gate — Radar rubric agreement with hand labels', () => {
  it('every strong-fit JD scores >= 60 and every weak-fit scores < 45', () => {
    for (const fx of JD_FIXTURES) {
      const job = fakeJob(fx.company, fx.title, fx.jd)
      const score = scoreJob(job, SEED_LEDGER, DEFAULT_RUBRIC, false)
      if (fx.strongFit) expect(score.total, `${fx.company} should be strong`).toBeGreaterThanOrEqual(60)
      else expect(score.total, `${fx.company} should be weak`).toBeLessThan(45)
    }
  })

  it('the senior Java role ranks last', () => {
    const ranked = JD_FIXTURES.map((fx) => ({
      fx,
      total: scoreJob(fakeJob(fx.company, fx.title, fx.jd), SEED_LEDGER, DEFAULT_RUBRIC, false).total,
    })).sort((a, b) => b.total - a.total)
    expect(ranked[ranked.length - 1].fx.company).toBe('GenericCorp')
  })

  it('every score part explains its WHY (Law 4)', () => {
    const score = scoreJob(fakeJob('Anthropic', 'AI Eng Intern', JD_FIXTURES[0].jd), SEED_LEDGER, DEFAULT_RUBRIC, true)
    // 6 rubric dimensions + the Freshness deduction (D65). Every one still owes the reader a WHY.
    // 6 rubric dimensions + Freshness (D65) + Vision fit (D85). Every one owes the reader a WHY.
    expect(score.parts).toHaveLength(8)
    for (const p of score.parts) {
      expect(p.why.length, `${p.key} missing WHY`).toBeGreaterThan(10)
      expect(p.points).toBeLessThanOrEqual(p.max)
    }
  })

  it('conviction star adds exactly its weight', () => {
    const job = fakeJob('Anthropic', 'AI Eng Intern', JD_FIXTURES[0].jd)
    const off = scoreJob(job, SEED_LEDGER, DEFAULT_RUBRIC, false).total
    const on = scoreJob(job, SEED_LEDGER, DEFAULT_RUBRIC, true).total
    expect(on - off).toBe(DEFAULT_RUBRIC.conviction)
  })
})

describe('Paste Lane URL recognition (no scraping — API resolution only)', () => {
  it('recognizes Greenhouse job URLs', () => {
    const m = recognizeAtsUrl('https://job-boards.greenhouse.io/anthropic/jobs/4567890')
    expect(m).toMatchObject({ source: 'greenhouse', token: 'anthropic', externalId: '4567890' })
  })
  it('recognizes Lever job URLs', () => {
    const m = recognizeAtsUrl('https://jobs.lever.co/mistral/abc12345-6789-0000-1111-222233334444')
    expect(m?.source).toBe('lever')
  })
  it('recognizes Ashby job URLs', () => {
    const m = recognizeAtsUrl('https://jobs.ashbyhq.com/openai/12345678-1234-1234-1234-123456789abc')
    expect(m?.source).toBe('ashby')
  })
  it('returns null for a LinkedIn URL (paste JD text instead)', () => {
    expect(recognizeAtsUrl('https://www.linkedin.com/jobs/view/123456')).toBeNull()
  })
})

describe('Vision fit (D85) — the top 15 must be HIS, not a generic AI list', () => {
  const vision: import('../src/types').VisionProfile = {
    dream: 'Become an AI/agent engineer building LLM and RAG systems — remote, international.',
    targetRoles: ['AI Engineer', 'Machine Learning Engineer'],
    notInterested: ['sales', 'frontend'],
    compFloorStipend: 35000,
    ppoFloorLpa: 16,
    windowStart: 'Jan 2027',
    windowEnd: 'May 2027',
    remoteInternational: true,
    openToOctoberStart: true,
  }

  const jd = 'Build LLM and RAG systems. Python, agents, evals. Remote.'

  it('a role whose TITLE is his named target outranks the same role generically titled', () => {
    const onVision = scoreJob(fakeJob('Acme', 'AI Engineer', jd), SEED_LEDGER, DEFAULT_RUBRIC, false, vision)
    const offTitle = scoreJob(fakeJob('Acme', 'Software Developer', jd), SEED_LEDGER, DEFAULT_RUBRIC, false, vision)
    expect(onVision.total).toBeGreaterThan(offTitle.total)
    const vf = onVision.parts.find((p) => p.key === 'visionFit')!
    expect(vf.points).toBeGreaterThan(0)
    expect(vf.why).toMatch(/target role/i)
  })

  it('a not-interested hit is a real penalty, rendered in the WHY (L4)', () => {
    const sales = scoreJob(fakeJob('Acme', 'AI Engineer', `${jd} This is a sales engineering role.`), SEED_LEDGER, DEFAULT_RUBRIC, false, vision)
    const vf = sales.parts.find((p) => p.key === 'visionFit')!
    expect(vf.why).toMatch(/not-interested/i)
  })

  it('no vision profile → neutral, nothing breaks (backward compatible)', () => {
    const s = scoreJob(fakeJob('Acme', 'AI Engineer', jd), SEED_LEDGER, DEFAULT_RUBRIC, false)
    const vf = s.parts.find((p) => p.key === 'visionFit')!
    expect(vf.points).toBe(0)
  })

  it('total never exceeds 100 even with a full vision boost', () => {
    const s = scoreJob(fakeJob('Acme', 'AI Engineer', jd), SEED_LEDGER, DEFAULT_RUBRIC, true, vision)
    expect(s.total).toBeLessThanOrEqual(100)
    expect(s.total).toBeGreaterThanOrEqual(0)
  })
})

describe('Watchlist seed integrity', () => {
  it('has >= 20 boards, unique ids, valid sources', () => {
    expect(WATCHLIST_SEED.length).toBeGreaterThanOrEqual(20)
    const ids = new Set(WATCHLIST_SEED.map((w) => w.id))
    expect(ids.size).toBe(WATCHLIST_SEED.length)
    for (const w of WATCHLIST_SEED) {
      expect(['greenhouse', 'lever', 'ashby', 'smartrecruiters']).toContain(w.source)
    }
  })
})

// ============================================================================================
// Session 5.5 — scoring + Settings audit fixes (bugs B1, B2)
// ============================================================================================
describe('Session 5.5 — staleness + Vision Lens tunability', () => {
  it('B1: a malformed posting date is NOT treated as maximally stale (no NaN, no -30)', () => {
    const p = stalenessPart({ ...fakeJob('X', 'AI Engineer', 'jd'), updatedAt: 'sometime-recently' })
    expect(p.points).toBe(0)
    expect(p.why).not.toMatch(/NaN/)
  })
  it('B1: a genuinely old date is still penalised (the feature still works)', () => {
    const old = new Date(Date.now() - 300 * 86400000).toISOString()
    const p = stalenessPart({ ...fakeJob('X', 'AI Engineer', 'jd'), updatedAt: old })
    expect(p.points).toBeLessThan(0)
  })
  it('B1: a missing date is never penalised', () => {
    const p = stalenessPart({ ...fakeJob('X', 'AI Engineer', 'jd'), updatedAt: undefined })
    expect(p.points).toBe(0)
  })
  it('B2: Settings now WIRES the Vision Lens levers (targetRoles + notInterested were frozen at seed)', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/screens/SettingsScreen.tsx', 'utf8')
    expect(src).toMatch(/save\(\{\s*targetRoles/) // the strongest ranking signal is now editable
    expect(src).toMatch(/save\(\{\s*notInterested/)
  })
})
