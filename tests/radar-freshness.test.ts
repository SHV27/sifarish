import { describe, expect, it } from 'vitest'
import { stalenessPart } from '../src/lib/radar/score'
import type { Job } from '../src/types'

/**
 * RADAR FRESHNESS (Session 5.4, D65) — the apology for a defect visible in the owner's own top 15.
 *
 * His screenshot: "Senior Fullstack Engineer, AI Observability & Evals — LangChain — updated 511d
 * ago — 85". The rubric scored WHAT a role is and never WHEN it was posted, so a 17-month-old
 * listing held the #3 slot in a queue capped at 15. That is exactly the "top 15 mein se kayi mere
 * liye hote hi nhi" he reported: dead roles crowding out live ones.
 */

const job = (updatedAt?: string): Job =>
  ({
    id: 'j1',
    source: 'greenhouse',
    company: 'LangChain',
    title: 'Senior Fullstack Engineer, AI Observability & Evals',
    location: 'San Francisco, CA',
    url: 'https://example.com/j1',
    jd: 'AI evals platform.',
    fetchedAt: new Date().toISOString(),
    status: 'found',
    updatedAt,
  }) as Job

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString()

describe('staleness deduction', () => {
  it('hammers the 511-day-old posting that held slot #3 on his radar', () => {
    const p = stalenessPart(job(daysAgo(511)))
    expect(p.points).toBe(-30)
    expect(p.why).toContain('511d ago')
    // 85 - 30 = 55 → it can no longer hold a top-15 slot against live roles.
    expect(85 + p.points).toBeLessThan(60)
  })

  it('leaves a live posting completely alone', () => {
    const p = stalenessPart(job(daysAgo(3)))
    expect(p.points).toBe(0)
    expect(p.why).toContain('live')
  })

  it('scales the penalty with age, monotonically', () => {
    const ages = [10, 45, 90, 180, 400].map((d) => stalenessPart(job(daysAgo(d))).points)
    expect(ages).toEqual([...ages].sort((a, b) => b - a)) // never gets less harsh as it ages
    expect(new Set(ages).size).toBeGreaterThan(3) // real bands, not a cliff
  })

  it('never punishes a board that simply publishes no date (evidence of staleness, not absence)', () => {
    const p = stalenessPart(job(undefined))
    expect(p.points).toBe(0)
    expect(p.why).toContain('not penalised')
  })

  it('renders its reason like every other part — the penalty is never hidden math (L4)', () => {
    const p = stalenessPart(job(daysAgo(511)))
    expect(p.label).toBe('Freshness')
    expect(p.why.length).toBeGreaterThan(20)
  })
})
