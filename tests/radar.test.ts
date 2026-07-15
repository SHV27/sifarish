import { describe, it, expect } from 'vitest'
import { JD_FIXTURES } from './fixtures/jds'
import { fakeJob, SEED_LEDGER } from './helpers'
import { scoreJob } from '../src/lib/radar/score'
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
    expect(score.parts).toHaveLength(7)
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
