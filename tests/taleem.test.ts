import { describe, expect, it } from 'vitest'
import { rankGaps, draftForgeEntry } from '../src/lib/taleem'
import { DEFAULT_VISION } from '../src/db/seed'
import { SEED_LEDGER, fakeJob } from './helpers'
import type { Job } from '../src/types'

/** U5 gates — Taleem Radar: gap ranking fixture agreement; every suggestion cited + rationaled. */

function recentJob(company: string, jd: string): Job {
  return { ...fakeJob(company, 'AI role', jd), fetchedAt: new Date().toISOString() }
}

// Hand-labeled fixture: what the market asks for vs what the seed ledger can prove.
const FIXTURE: Job[] = [
  recentJob('A1', 'Requirements: Python, fine-tuning LLMs with LoRA, agentic systems, evals.'),
  recentJob('A2', 'Must have: fine-tuning experience (SFT/RLHF), transformers internals, PyTorch.'),
  recentJob('A3', 'We need fine-tuning, kubernetes, docker, and strong Python.'),
  recentJob('A4', 'Agentic AI role: LangGraph orchestration, tool calling, guardrails, evals.'),
  recentJob('A5', 'Looking for: kubernetes, docker, terraform, AWS.'),
]

describe('Taleem — gap ranking (demand × vision-fit)', () => {
  const gaps = rankGaps(FIXTURE, SEED_LEDGER, DEFAULT_VISION)

  it('shipped skills are never suggested as gaps (python/git are proven)', () => {
    const keywords = gaps.map((g) => g.keyword)
    expect(keywords).not.toContain('python')
    expect(keywords).not.toContain('git')
  })

  it('hand-labeled agreement: fine-tuning (demand 3, LLM-core) outranks kubernetes (demand 2, peripheral)', () => {
    const ft = gaps.find((g) => g.keyword === 'fine-tuning')!
    const k8s = gaps.find((g) => g.keyword === 'kubernetes')!
    expect(ft).toBeTruthy()
    expect(k8s).toBeTruthy()
    expect(ft.score).toBeGreaterThan(k8s.score)
    // and a vision-core keyword with equal demand beats an infra one
    expect(ft.visionFit).toBeGreaterThan(k8s.visionFit)
  })

  it('in-forge skills are flagged as tracked, not missing (I2 honesty)', () => {
    const ft = gaps.find((g) => g.keyword === 'fine-tuning')
    // seed has skill-lora / skill-transformers in_forge — related entries mark the gap honestly
    expect(ft?.inForge === true || ft?.rationale.includes('in-forge')).toBeTruthy()
  })

  it('every suggestion is cited (I7) and rationaled (L4)', () => {
    for (const g of gaps) {
      expect(g.citations.length, g.keyword).toBeGreaterThan(0)
      for (const c of g.citations) expect(c.url).toMatch(/^https?:\/\//)
      expect(g.rationale.length).toBeGreaterThan(40)
      expect(g.rationale).toMatch(/vision fit/i)
    }
  })

  it('old JDs (outside 90 days) do not feed demand', () => {
    const old: Job = { ...recentJob('Old Corp', 'Needs COBOL and mainframe experience badly, plus fortran.'), fetchedAt: new Date(Date.now() - 120 * 86400000).toISOString() }
    const withOld = rankGaps([...FIXTURE, old], SEED_LEDGER, DEFAULT_VISION)
    expect(withOld.map((g) => g.keyword)).not.toContain('cobol')
  })

  it('draftForgeEntry produces an honest in_forge skill with ETA (never shipped)', () => {
    const gap = gaps[0]
    const entry = draftForgeEntry(gap, 'September 2026')
    expect(entry.tier).toBe('in_forge')
    expect(entry.forgeEta).toBe('September 2026')
    expect(entry.kind).toBe('skill')
    expect(entry.resumeEligible).toBe(true)
  })
})
