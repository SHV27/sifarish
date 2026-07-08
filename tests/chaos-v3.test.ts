import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/db/db'
import { decide } from '../src/lib/dimaag/core'
import { ensureBudgets, recordSpend, getBudget } from '../src/lib/budget'
import { deriveHunts } from '../src/lib/vision/derive'
import type { VisionProfile } from '../src/types'

/**
 * v3 chaos — every degradation must be legible and safe (I4/I6/I8/I10 hold under stress).
 */
describe('Chaos — budget exhaustion mid-compile', () => {
  beforeEach(async () => {
    await db.dimaagCache.clear()
    await db.dimaagUsage.clear()
    await db.budgets.clear()
  })

  it('an exhausted Dimaag budget degrades to the heuristic — never crashes, still rationaled', async () => {
    await ensureBudgets()
    const b = await getBudget('dimaag')
    await recordSpend('dimaag', b!.monthlyCap) // exhaust it
    const r = await decide({
      feature: 'chaos.decide',
      question: 'Which leads?',
      options: [
        { id: 'a', label: 'Alpha', detail: 'python agentic' },
        { id: 'b', label: 'Beta', detail: 'design' },
      ],
      criteria: ['python', 'agentic'],
      context: 'python agentic',
    })
    expect(r.by).toBe('heuristic') // over budget → deterministic
    expect(r.choice).toBe('Alpha')
    expect(r.why.length).toBeGreaterThan(0) // I10 still holds
  })
})

describe('Chaos — Groq/JSON failure (no API in test) always yields a safe decision', () => {
  beforeEach(async () => {
    await db.dimaagCache.clear()
    await db.dimaagUsage.clear()
  })
  it('decide never throws and always returns a valid choice', async () => {
    const r = await decide({
      feature: 'chaos.fail',
      question: 'pick',
      options: [{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }],
      criteria: ['whatever'],
    })
    expect(['X', 'Y']).toContain(r.choice)
  })
})

describe('Chaos — contradictory / empty vision', () => {
  it('an empty dream still derives at least the named target roles, no crash', () => {
    const v: VisionProfile = {
      dream: '',
      targetRoles: ['AI Intern'],
      notInterested: [],
      compFloorStipend: 0,
      ppoFloorLpa: 0,
      windowStart: '',
      windowEnd: '',
      remoteInternational: false,
      openToOctoberStart: false,
    }
    const hunts = deriveHunts(v)
    expect(hunts.some((h) => h.query === 'AI Intern')).toBe(true)
  })
  it('a contradictory dream (wants everything, interested in nothing) does not crash', () => {
    const v: VisionProfile = {
      dream: 'agentic research infra applied voice everything all at once but also nothing',
      targetRoles: [],
      notInterested: ['everything'],
      compFloorStipend: 0,
      ppoFloorLpa: 0,
      windowStart: '',
      windowEnd: '',
      remoteInternational: true,
      openToOctoberStart: true,
    }
    expect(() => deriveHunts(v)).not.toThrow()
    expect(deriveHunts(v).length).toBeGreaterThan(0)
  })
})
