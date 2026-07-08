import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/db/db'
import { decide, critique, classify } from '../src/lib/dimaag/core'
import { monthKey } from '../src/lib/budget'

/**
 * Dimaag Core (v3). In the test env there is no /api/dimaag (relative fetch fails), so every
 * call takes the deterministic heuristic fallback — exactly the keyless path (I4). Asserts:
 * rationales always present (I10), caching (identical inputs never re-decide), honest usage.
 */
describe('Dimaag decide — I10 + fallback', () => {
  beforeEach(async () => {
    await db.dimaagCache.clear()
    await db.dimaagUsage.clear()
  })

  const input = {
    feature: 'test.decide',
    question: 'Which project leads for an applied-AI role?',
    options: [
      { id: 'a', label: 'DARYA flood AI', detail: 'agentic civic pipeline python' },
      { id: 'b', label: 'SUTRADHAR cinema', detail: 'entertainment box office prediction' },
    ],
    criteria: ['agentic', 'python', 'civic impact'],
    context: 'applied AI agentic python civic',
  }

  it('always returns a rationale with a valid choice + bounded confidence (I10)', async () => {
    const r = await decide(input)
    expect(['DARYA flood AI', 'SUTRADHAR cinema']).toContain(r.choice)
    expect(r.why.length).toBeGreaterThan(10)
    expect(r.confidence).toBeGreaterThanOrEqual(0)
    expect(r.confidence).toBeLessThanOrEqual(1)
    expect(r.optionsConsidered).toHaveLength(2)
    expect(r.by).toBe('heuristic') // no LLM in test env
  })

  it('caches: identical inputs never re-decide (0 real calls; 2nd is a cache hit)', async () => {
    await decide(input)
    await decide(input)
    await decide(input)
    const usage = await db.dimaagUsage.get(`test.decide:${monthKey()}`)
    expect(usage?.calls).toBe(0) // heuristic fallback, never a real LLM call
    expect(usage?.cacheHits).toBe(2) // 2nd + 3rd served from cache
    expect(usage?.fallbacks).toBe(1) // only the first computed
  })

  it('the generic heuristic picks the option best matching the criteria', async () => {
    const r = await decide(input)
    expect(r.choice).toBe('DARYA flood AI') // agentic/python/civic all hit DARYA
  })
})

describe('Dimaag critique', () => {
  beforeEach(async () => await db.dimaagCache.clear())
  it('heuristic checks flag slop → REVISE', async () => {
    const c = await critique({
      feature: 'test.critique',
      artifact: 'A results-driven professional passionate about leveraging synergies.',
      persona: 'recruiter',
      standard: 'no slop',
      heuristicChecks: (a) => (/results-driven|passionate about leveraging/.test(a) ? ['Remove slop'] : []),
    })
    expect(c.verdict).toBe('REVISE')
    expect(c.fixes.length).toBeGreaterThan(0)
  })
  it('clean artifact → PASS', async () => {
    const c = await critique({
      feature: 'test.critique2',
      artifact: 'Built a flood-alert pipeline for Rupnagar; live and evaluated against the 2025 floods.',
      persona: 'recruiter',
      standard: 'no slop',
      heuristicChecks: () => [],
    })
    expect(c.verdict).toBe('PASS')
  })
})

describe('Dimaag classify', () => {
  beforeEach(async () => await db.dimaagCache.clear())
  it('heuristic picks the label with the most cue hits', async () => {
    const r = await classify({
      feature: 'test.classify',
      text: 'Build agentic LLM systems with tool use and orchestration and guardrails.',
      labels: [
        { id: 'agent-eng', label: 'Agent Engineer', cues: ['agentic', 'tool use', 'orchestration', 'guardrails'] },
        { id: 'ml-generalist', label: 'ML Generalist', cues: ['pandas', 'regression', 'statistics'] },
      ],
      instruction: 'classify',
    })
    expect(r.label).toBe('agent-eng')
    expect(r.by).toBe('heuristic')
  })
})
