import { describe, it, expect } from 'vitest'
import { dedupeKey, mergeDiscovered, withDedupeKey } from '../src/lib/khabri/normalize'
import type { Job } from '../src/types'

function j(id: string, company: string, title: string, location: string, source: Job['source'] = 'jsearch'): Job {
  return { id, source, company, title, location, url: `https://x/${id}`, jd: 'python llm', fetchedAt: new Date().toISOString(), status: 'found' }
}

/**
 * Khabri normalize + dedupe — the Jasoos gate. The same role from LinkedIn, Indeed, and the
 * company ATS must collapse to one card. Existing pipeline status must survive a re-sweep.
 */
describe('dedupe key — fuzzy company+title+location', () => {
  it('collapses the same role across publishers', () => {
    const a = dedupeKey('Anthropic', 'AI Engineer Intern', 'San Francisco, CA')
    const b = dedupeKey('Anthropic Inc', 'AI Engineer, Intern', 'San Francisco')
    expect(a).toBe(b)
  })
  it('separates genuinely different roles', () => {
    const a = dedupeKey('Anthropic', 'Research Scientist', 'London')
    const b = dedupeKey('Anthropic', 'Frontend Designer', 'London')
    expect(a).not.toBe(b)
  })
})

describe('mergeDiscovered', () => {
  it('drops cross-source duplicates, keeps one', () => {
    const discovered = [
      j('jsearch:1', 'OpenAI', 'ML Engineer Intern', 'Remote'),
      j('remotive:9', 'OpenAI', 'ML Engineer, Intern', 'Remote', 'remotive'),
    ]
    const res = mergeDiscovered(discovered, [])
    expect(res.found).toBe(2)
    expect(res.added).toBe(1)
    expect(res.duplicate).toBe(1)
    expect(res.toPersist).toHaveLength(1)
    expect(res.toPersist[0].isNew).toBe(true)
  })

  it('a job already in the queue is refreshed, not re-added, and keeps its status', () => {
    const existing = [{ ...withDedupeKey(j('jsearch:1', 'OpenAI', 'ML Eng Intern', 'Remote')), status: 'applied' as const, appliedAt: '2026-07-01' }]
    const discovered = [{ ...j('jsearch:1', 'OpenAI', 'ML Eng Intern', 'Remote'), jd: 'updated jd' }]
    const res = mergeDiscovered(discovered, existing)
    expect(res.added).toBe(0)
    const persisted = res.toPersist.find((x) => x.id === 'jsearch:1')
    expect(persisted?.status).toBe('applied') // status preserved — a re-sweep never resets the Morcha
    expect(persisted?.jd).toBe('updated jd') // volatile field refreshed
  })

  it('a discovered role matching an existing dedupeKey (different id) is a duplicate', () => {
    // Cross-source: an ATS listing already in the queue, re-surfaced by JSearch/LinkedIn.
    const existing = [withDedupeKey(j('greenhouse:anthropic:5', 'Anthropic', 'AI Engineer Intern', 'San Francisco, CA'))]
    const discovered = [j('jsearch:99', 'Anthropic Inc', 'AI Engineer, Intern', 'San Francisco')]
    const res = mergeDiscovered(discovered, existing)
    expect(res.added).toBe(0)
    expect(res.duplicate).toBe(1)
  })
})
