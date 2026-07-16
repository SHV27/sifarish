import { describe, it, expect } from 'vitest'
import { buildBriefing } from '../src/lib/briefing'
import { fakeJob, SEED_LEDGER } from './helpers'
import { DEFAULT_RUBRIC } from '../src/lib/radar/rubric'
import { DEFAULT_VISION } from '../src/db/seed'
import type { Job, Settings } from '../src/types'

/**
 * The Chief-of-Staff briefing (Session 5.6) — a real assistant hands you ONE next move + the roles
 * worth your time. Pure/deterministic: buildBriefing only reads + aggregates. These gate the
 * priority order (interview > follow-up > apply > tailor > sweep) and the vision-ranked top matches.
 */
const settings = { id: 'app', onboarded: true, rubric: DEFAULT_RUBRIC, visionProfile: DEFAULT_VISION } as unknown as Settings
const jd = 'Build LLM and agentic AI systems. Python, RAG, evals. Remote.'
const found = (company: string, title: string, extra: Partial<Job> = {}): Job => ({ ...fakeJob(company, title, jd), status: 'found', ...extra })

describe('buildBriefing — the ONE next action, priority-ordered', () => {
  it('an interview outranks everything else', () => {
    const jobs = [found('Acme', 'AI Engineer'), { ...fakeJob('Cohere', 'AI Engineer', jd), status: 'interview' as const }, { ...fakeJob('X', 'AI Engineer', jd), status: 'tailored' as const }]
    const b = buildBriefing(jobs, SEED_LEDGER, settings)
    expect(b.next.target).toBe('morcha')
    expect(b.next.text).toMatch(/prep/i)
    expect(b.interviews.length).toBe(1)
  })
  it('a due follow-up outranks a ready packet', () => {
    const old = new Date(Date.now() - 10 * 86400000).toISOString()
    const jobs = [{ ...fakeJob('Sarvam', 'AI Engineer', jd), status: 'applied' as const, appliedAt: old }, { ...fakeJob('X', 'AI Engineer', jd), status: 'tailored' as const }]
    const b = buildBriefing(jobs, SEED_LEDGER, settings)
    expect(b.next.text).toMatch(/follow up/i)
    expect(b.dueFollowups.length).toBe(1)
  })
  it('a ready packet outranks tailoring a new one', () => {
    const jobs = [found('Acme', 'AI Engineer'), { ...fakeJob('X', 'AI Engineer', jd), status: 'tailored' as const }]
    const b = buildBriefing(jobs, SEED_LEDGER, settings)
    expect(b.next.text).toMatch(/apply/i)
    expect(b.next.target).toBe('morcha')
  })
  it('with only found roles, next = tailor your #1 match (routes to the packet)', () => {
    const jobs = [found('Acme', 'AI Engineer'), found('Beta', 'AI Engineer')]
    const b = buildBriefing(jobs, SEED_LEDGER, settings)
    expect(b.next.target).toBe('packet')
    expect(b.next.jobId).toBeTruthy()
    expect(b.next.text).toMatch(/tailor/i)
  })
  it('an empty board teaches: run a sweep', () => {
    const b = buildBriefing([], SEED_LEDGER, settings)
    expect(b.next.target).toBe('khabri')
    expect(b.next.text).toMatch(/sweep/i)
    expect(b.topMatches.length).toBe(0)
  })
})

describe('buildBriefing — vision-ranked matches + new count', () => {
  it('surfaces at most 3 matches, ranked, each carrying its vision reason', () => {
    const jobs = [found('A', 'AI Engineer'), found('B', 'Machine Learning Engineer'), found('C', 'AI Engineer'), found('D', 'Data Analyst')]
    const b = buildBriefing(jobs, SEED_LEDGER, settings)
    expect(b.topMatches.length).toBeLessThanOrEqual(3)
    expect(b.topMatches.length).toBeGreaterThan(0)
    // ranked descending by total
    for (let i = 1; i < b.topMatches.length; i++) expect(b.topMatches[i - 1].score.total).toBeGreaterThanOrEqual(b.topMatches[i].score.total)
    // each match exposes a WHY (visionWhy may be '' but the score.parts always explain)
    for (const m of b.topMatches) expect(m.score.parts.length).toBeGreaterThan(0)
  })
  it('counts only genuinely-new (isNew) roles', () => {
    const jobs = [found('A', 'AI Engineer', { isNew: true }), found('B', 'AI Engineer', { isNew: true }), found('C', 'AI Engineer')]
    expect(buildBriefing(jobs, SEED_LEDGER, settings).newCount).toBe(2)
  })
})
