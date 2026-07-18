import { describe, it, expect } from 'vitest'
import { deriveHunts } from '../src/lib/vision/derive'
import { roleFamilyPart } from '../src/lib/radar/score'
import { dedupeKey } from '../src/lib/khabri/normalize'
import { interleaveHunts } from '../src/lib/khabri/client'
import type { Job, VisionProfile } from '../src/types'

/**
 * Session 7 discovery gates — the LinkedIn-gap fixes (H1-H6), each tested at the exact
 * mechanism the audit found broken.
 */

const VISION: VisionProfile = {
  dream: 'Become an AI engineer building agentic LLM systems with RAG and evals, worldwide.',
  targetRoles: ['AI Engineer Intern', 'Agentic AI Intern'],
  notInterested: ['Pure frontend'],
  remoteInternational: true,
  dreamCompanies: [],
}

const fakeJob = (over: Partial<Job>): Job =>
  ({
    id: 'j1',
    company: 'Acme',
    title: 'AI Engineer',
    location: 'Remote',
    jd: 'Build AI systems',
    url: 'https://x',
    source: 'test',
    status: 'found',
    fetchedAt: new Date().toISOString(),
    ...over,
  }) as Job

describe('S7 — H2: the BROAD market query leads the derived hunts', () => {
  const hunts = deriveHunts(VISION)
  const queries = hunts.map((h) => h.query)

  it('the plain core role ("AI Engineer") is derived and comes BEFORE its intern variant', () => {
    expect(queries).toContain('AI Engineer')
    expect(queries.indexOf('AI Engineer')).toBeLessThan(queries.indexOf('AI Engineer Intern'))
  })

  it('a region-phrased Europe hunt exists (the LinkedIn-Europe counterpart)', () => {
    expect(queries.some((q) => /europe/i.test(q))).toBe(true)
  })

  it('"research scientist intern" is no longer derived — his vision says ENGINEER', () => {
    expect(queries.some((q) => /research scientist/i.test(q))).toBe(false)
  })
})

describe('S7 — H2b: the role-family lens demotes visibly, never hides', () => {
  it('a research-scientist title takes a visible penalty with the why', () => {
    const part = roleFamilyPart(fakeJob({ title: 'Research Scientist, Foundation Models' }), VISION)
    expect(part).not.toBeNull()
    expect(part!.points).toBeLessThan(0)
    expect(part!.why).toMatch(/research scientist/)
    expect(part!.why).toMatch(/edit your vision/i)
  })

  it('an AI-engineer title is untouched; a family HIS VISION NAMES is untouched', () => {
    expect(roleFamilyPart(fakeJob({ title: 'AI Engineer (LLMs & Agents)' }), VISION)).toBeNull()
    const dsVision = { ...VISION, targetRoles: ['Data Scientist Intern'] }
    expect(roleFamilyPart(fakeJob({ title: 'Data Scientist' }), dsVision)).toBeNull()
  })

  it('no vision → neutral (nothing breaks before onboarding)', () => {
    expect(roleFamilyPart(fakeJob({ title: 'Data Scientist' }), undefined)).toBeNull()
  })
})

describe('S7 — H3: the dedupe key keeps distinct roles of one company distinct', () => {
  it('two different long titles at one company no longer collide (the 14-char over-merge)', () => {
    const a = dedupeKey('Nagarro', 'Python Developer GenAI & Agentic AI', 'Germany (Remote)')
    const b = dedupeKey('Nagarro', 'Python Developer GenAI Platform Services', 'Germany (Remote)')
    expect(a).not.toBe(b)
  })

  it('the same role from two publishers still collapses', () => {
    const a = dedupeKey('Netomi', 'AI Engineer', 'Remote')
    const b = dedupeKey('Netomi Inc', 'AI Engineer', 'Remote')
    expect(a).toBe(b)
  })
})

describe('S7 — H4: manual hunts interleave with derived (starvation is dead)', () => {
  it('with budget 6 and 10 derived hunts, manual hunts still receive slots', () => {
    const derived = Array.from({ length: 10 }, (_, i) => `d${i}`)
    const manual = ['m0', 'm1', 'm2']
    const order = interleaveHunts(derived, manual)
    const firstSix = order.slice(0, 6)
    expect(firstSix).toContain('m0')
    expect(firstSix).toContain('m1')
    expect(firstSix).toContain('m2')
  })

  it('handles empty sides', () => {
    expect(interleaveHunts([], ['a'])).toEqual(['a'])
    expect(interleaveHunts(['b'], [])).toEqual(['b'])
  })
})
