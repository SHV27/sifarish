import { describe, it, expect } from 'vitest'
import { scoreJob, FRESH_DAYS, STALE_DAYS } from '../src/lib/radar/score'
import { DEFAULT_RUBRIC } from '../src/lib/radar/rubric'
import { DEFAULT_VISION } from '../src/db/seed'
import { SEED_LEDGER, fakeJob } from './helpers'
import type { Job } from '../src/types'

/**
 * v2 Arc 3 — THE HUNT, RE-RANKED. Owner-caught: "saare work ex maangte hain, how are you rating
 * them 89/100?" and "itni purani purani". Two ceilings above the additive rubric — window and
 * freshness — rendered as parts, never hidden math; demoted, never hidden. Two-sided gates.
 */

const daysAgoIso = (d: number) => new Date(Date.now() - d * 86400000).toISOString()
const AI = 'Build agentic LLM systems: RAG, evals, guardrails, LangGraph, Python, TypeScript. Remote. Paid.'

function job(title: string, jd: string, extra: Partial<Job> = {}): Job {
  return { ...fakeJob('Acme', title, jd), updatedAt: daysAgoIso(2), ...extra }
}
const score = (j: Job) => scoreJob(j, SEED_LEDGER, DEFAULT_RUBRIC, false, DEFAULT_VISION)

describe('window ceiling', () => {
  it('a senior Forward Deployed Engineer with every keyword cannot exceed 40', () => {
    const s = score(job('Senior Forward Deployed Engineer, Agentic Platform', `${AI} 5+ years of experience required. Senior role.`))
    expect(s.total).toBeLessThanOrEqual(40)
    expect(s.parts.find((p) => p.key === 'ceiling')?.why).toMatch(/senior/i)
    expect(s.why).toMatch(/senior role/i)
  })
  it('a leadership-titled role is capped even when the JD reads junior', () => {
    const s = score(job('Engineering Manager, AI Platform', `${AI} interns welcome.`))
    expect(s.total).toBeLessThanOrEqual(40)
  })
  it('a regular engineer role (no intern/new-grad wording) is capped at 72; an intern role is not', () => {
    const regular = score(job('AI Engineer', `${AI} You will own production systems.`))
    const intern = score(job('AI Engineer Intern', `${AI} Internship, 6 months.`))
    expect(regular.total).toBeLessThanOrEqual(72)
    expect(intern.parts.find((p) => p.key === 'ceiling')).toBeUndefined()
    expect(intern.total).toBeGreaterThan(regular.total)
  })
  it('a fresh intern role outranks a 100-point-keyword senior role (the reported symptom)', () => {
    const senior = score(job('Forward Deployed Engineer, Agentic Platform (West Coast)', `${AI} 7+ years. Lead customer deployments. Senior.`))
    const intern = score(job('Agentic AI Intern', `${AI} Internship for students, Jan–May 2027.`))
    expect(intern.total).toBeGreaterThan(senior.total)
  })
})

describe('freshness ceiling', () => {
  it(`a role older than ${FRESH_DAYS} days and not verified open is capped at 62 and says so`, () => {
    const s = score(job('AI Engineer Intern', `${AI} Internship.`, { updatedAt: daysAgoIso(30) }))
    expect(s.total).toBeLessThanOrEqual(62)
    expect(s.parts.find((p) => p.key === 'ceiling')?.why).toMatch(/30d ago/)
    expect(s.why).toMatch(/30d ago/)
  })
  it(`older than ${STALE_DAYS} days → 40; the same age VERIFIED OPEN on its board is not capped by freshness`, () => {
    const stale = score(job('AI Engineer Intern', `${AI} Internship.`, { updatedAt: daysAgoIso(60) }))
    expect(stale.total).toBeLessThanOrEqual(40)
    expect(stale.why).toMatch(/stale/)
    const alive = score(job('AI Engineer Intern', `${AI} Internship.`, { updatedAt: daysAgoIso(60), lastSeenOpenAt: daysAgoIso(1) }))
    expect(alive.parts.find((p) => p.key === 'ceiling')).toBeUndefined()
    expect(alive.total).toBeGreaterThan(stale.total)
    expect(alive.why).toMatch(/verified open/)
  })
  it('a fresh role is never capped by freshness; no date → no freshness cap (never penalised on a guess)', () => {
    const fresh = score(job('AI Engineer Intern', `${AI} Internship.`, { updatedAt: daysAgoIso(3) }))
    expect(fresh.parts.find((p) => p.key === 'ceiling')).toBeUndefined()
    const undated = score(job('AI Engineer Intern', `${AI} Internship.`, { updatedAt: undefined }))
    expect(undated.parts.find((p) => p.key === 'ceiling')).toBeUndefined()
    expect(undated.why).toMatch(/no posting date/)
  })
})

describe('the one-sentence why', () => {
  it('every score carries a plain sentence a human reads first', () => {
    for (const j of [job('AI Engineer Intern', AI), job('Senior ML Engineer', `${AI} 8+ years`), job('Data Analyst', 'SQL, Excel, dashboards')]) {
      const s = score(j)
      expect(s.why && s.why.length > 20).toBe(true)
      expect(s.why!.endsWith('.')).toBe(true)
    }
  })
  it('names the vision match and the not-interested hit in words', () => {
    const on = score(job('AI Engineer Intern', `${AI} Internship.`))
    expect(on.why).toMatch(/matches a role you named/)
    const off = score(job('Frontend Developer Intern', 'React, CSS, frontend-heavy UI work. Internship.'))
    expect(off.why).toMatch(/not-interested|family outside/)
  })
})
