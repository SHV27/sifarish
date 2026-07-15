import { describe, it, expect } from 'vitest'
import { deriveHunts, deriveArchetypes } from '../src/lib/vision/derive'
import type { VisionProfile } from '../src/types'

/**
 * Vision Engine (P12). The encoded fixture from the brief: an "AI architect solving real problems
 * with agentic AI" vision must derive the expected market role names. Deterministic → reliable gate.
 */
const FIXTURE: VisionProfile = {
  dream: 'Become an AI architect solving real problems with agentic AI — ship things people use.',
  targetRoles: ['Applied AI Intern'],
  notInterested: ['generic SDE'],
  compFloorStipend: 35000,
  ppoFloorLpa: 16,
  windowStart: 'Jan 2027',
  windowEnd: 'May 2027',
  remoteInternational: true,
  openToOctoberStart: true,
}

describe('deriveHunts — the hunt derives from the dream', () => {
  const hunts = deriveHunts(FIXTURE).map((h) => h.query.toLowerCase())

  it('produces the expected market role names', () => {
    // From the brief's worked example (expanded query set, D85).
    expect(hunts).toContain('forward deployed engineer')
    expect(hunts).toContain('ai solutions engineer')
    expect(hunts.some((h) => h.includes('agent'))).toBe(true) // agentic/agent-engineer family
    expect(hunts).toContain('applied ai intern')
  })

  it('casts a wider net than the original 7 rules (D85 — kone kone se)', () => {
    // A rich agentic-AI vision should imply many distinct on-vision queries, not a handful.
    expect(new Set(hunts).size).toBeGreaterThanOrEqual(8)
  })

  it('every derived hunt has a rationale (why)', () => {
    for (const h of deriveHunts(FIXTURE)) expect(h.why.length).toBeGreaterThan(10)
  })

  it('respects the remote-international constraint', () => {
    for (const h of deriveHunts(FIXTURE)) expect(h.remoteOnly).toBe(true)
  })

  it('includes explicitly named target roles', () => {
    expect(hunts).toContain('applied ai intern')
  })
})

describe('deriveArchetypes', () => {
  it('surfaces agent/applied archetypes for an agentic-AI vision', () => {
    const arch = deriveArchetypes(FIXTURE).map((a) => a.id)
    expect(arch.some((id) => ['agent-eng', 'applied-ai', 'forward-deployed'].includes(id))).toBe(true)
  })
  it('each derived archetype carries a reason', () => {
    for (const a of deriveArchetypes(FIXTURE)) expect(a.why.length).toBeGreaterThan(5)
  })
})
