import { describe, it, expect } from 'vitest'
import { draftFollowUp, draftReferralAsk, rejectionRetro } from '../src/lib/sahayak'
import { buildGapNote } from '../src/lib/compile/letters'
import { scanSlop, scanGuarantee } from '../src/lib/slop/scan'
import { SEED_IDENTITY, SEED_LEDGER, fakeJob, compilePacketPure } from './helpers'
import type { Job, Packet } from '../src/types'

/**
 * Session 6 (P1) — SAHAYAK gates: the artifacts an elite human career agent hands over, drafted
 * lawfully. Every draft is honest (I9), slop-free, evidence-grounded, and HUMAN-SENT (I3 — these
 * are strings for the clipboard; nothing here can transmit anything).
 */

const appliedJob = (): Job => ({
  ...fakeJob('Netomi', 'Agentic AI Engineer', 'LLM agents RAG'),
  status: 'applied',
  appliedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
})

describe('P1 — follow-up drafts at the nudge', () => {
  it('day-7 draft names the role, the date, and one shipped proof; day-14 closes gracefully', () => {
    const d7 = draftFollowUp(appliedJob(), 7, SEED_IDENTITY, SEED_LEDGER)
    expect(d7).toContain('Agentic AI Engineer')
    expect(d7).toContain('Netomi')
    expect(d7).toMatch(/Subject:/)
    const d14 = draftFollowUp(appliedJob(), 14, SEED_IDENTITY, SEED_LEDGER)
    expect(d14).toMatch(/Last note|following up once more/i)
    expect(d14).toContain('Netomi')
  })

  it('drafts are slop-free and guarantee-free (I9)', () => {
    for (const day of [7, 14] as const) {
      const d = draftFollowUp(appliedJob(), day, SEED_IDENTITY, SEED_LEDGER)
      expect(scanSlop(d)).toHaveLength(0)
      expect(scanGuarantee(d)).toHaveLength(0)
    }
  })
})

describe('P1 — referral ask (the strongest lawful channel)', () => {
  it('names the role, the company, a shipped proof, and asks with zero pressure', () => {
    const d = draftReferralAsk(appliedJob(), SEED_IDENTITY, SEED_LEDGER)
    expect(d).toContain('Netomi')
    expect(d).toContain('Agentic AI Engineer')
    expect(d).toMatch(/no pressure/i)
    expect(scanSlop(d)).toHaveLength(0)
    expect(scanGuarantee(d)).toHaveLength(0)
  })
})

describe('P1 — post-rejection retro (deterministic pattern learning)', () => {
  const lostJob = (id: string): Job => ({ ...fakeJob(id, 'AI Engineer', 'x'), id, status: 'rejected' })
  const packetWithGaps = (jobId: string, gaps: string[]): Packet => {
    const p = compilePacketPure(fakeJob(jobId, 'AI Engineer', 'python'), SEED_LEDGER)
    return { ...p, jobId, coverage: { ...p.coverage, missing: gaps.map((keyword) => ({ keyword, mustHave: true, ledgerIds: [] })) } }
  }

  it('a gap shared across 2+ lost applications surfaces as the pattern', () => {
    const jobs = [lostJob('a'), lostJob('b'), lostJob('c')]
    const packets = [packetWithGaps('a', ['kubernetes', 'golang']), packetWithGaps('b', ['kubernetes']), packetWithGaps('c', ['terraform'])]
    const r = rejectionRetro(jobs, packets)
    expect(r.sampleSize).toBe(3)
    expect(r.shared[0]).toEqual({ keyword: 'kubernetes', count: 2 })
    expect(r.note).toContain('kubernetes')
  })

  it('no repeating gap → the honest "evidence held" note, never an invented reason', () => {
    const jobs = [lostJob('a'), lostJob('b')]
    const packets = [packetWithGaps('a', ['golang']), packetWithGaps('b', ['terraform'])]
    const r = rejectionRetro(jobs, packets)
    expect(r.shared).toHaveLength(0)
    expect(r.note).toMatch(/loss reasons lived on their side/)
  })

  it('under 2 samples it says so plainly', () => {
    const r = rejectionRetro([lostJob('a')], [packetWithGaps('a', ['x'])])
    expect(r.note).toMatch(/Too few/)
  })
})

describe('P3 — gap notes aggregate (no template rhythm)', () => {
  it('multiple must-have gaps land in ONE line, nice-to-haves in another', () => {
    const notes = buildGapNote({
      matched: [],
      building: [],
      missing: [
        { keyword: 'kubernetes', mustHave: true, ledgerIds: [] },
        { keyword: 'golang', mustHave: true, ledgerIds: [] },
        { keyword: 'graphql', mustHave: false, ledgerIds: [] },
      ],
    })
    expect(notes).toHaveLength(2)
    expect(notes[0]).toContain('"kubernetes"')
    expect(notes[0]).toContain('"golang"')
    expect(notes[1]).toContain('"graphql"')
  })
})

describe('P5 — owner dismissal is HIS verdict and sticks', () => {
  it('the briefing never surfaces a dismissed role', async () => {
    const { buildBriefing } = await import('../src/lib/briefing')
    const settings = {
      id: 'app',
      rubric: { aiRelevance: 30, roleFit: 25, remoteIndia: 15, windowFit: 15, compSignal: 10, conviction: 5 },
    } as never
    const dismissed: Job = { ...fakeJob('X', 'AI Engineer', 'llm agents ai'), dismissed: true }
    const kept: Job = { ...fakeJob('Y', 'AI Engineer', 'llm agents ai') }
    const b = buildBriefing([dismissed, kept], [], settings)
    expect(b.topMatches.some((m) => m.job.company === 'X')).toBe(false)
    expect(b.topMatches.some((m) => m.job.company === 'Y')).toBe(true)
  })
})
