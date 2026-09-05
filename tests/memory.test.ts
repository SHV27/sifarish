import { describe, it, expect } from 'vitest'
import { outcomeLines, memoryFor, memoryForPrompt } from '../src/lib/strategist/memory'
import { clockLine } from '../src/components/Desk'
import { buildDossier } from '../src/lib/dossier'
import { readPostingHeuristic } from '../src/lib/strategist/reading'
import { planHeuristic } from '../src/lib/strategist/plan'
import { SEED_LEDGER, SEED_IDENTITY, fakeJob } from './helpers'
import type { Packet } from '../src/types'

/**
 * v2 R3 — THE MEMORY (outcomes as data), THE CLOCK (his window drives it), the interview brief
 * that speaks the plan. Two-sided where a guard exists.
 */
const BABACLICK = 'We do not care about: your university\'s brand · LeetCode · certificates. We care enormously about: logical reasoning · intellectual honesty · personal agency. React, Python.'

function packetFor(jobId: string): Packet {
  const reading = readPostingHeuristic(BABACLICK, 'Babaclick', 'Growth Intern')
  const plan = planHeuristic(reading, SEED_LEDGER, SEED_IDENTITY)
  return { id: `p-${jobId}`, jobId, createdAt: '2026-09-01T00:00:00.000Z', reading, plan } as unknown as Packet
}

describe('THE MEMORY — recorded outcomes teach the next plan, honestly', () => {
  it('starts empty and says so (never a rule from nothing)', () => {
    const reading = readPostingHeuristic(BABACLICK, 'Babaclick', 'Growth Intern')
    const lines = memoryFor([], reading)
    expect(lines[0]).toMatch(/starts empty/)
    expect(memoryForPrompt(lines)).toMatch(/never rules/)
  })
  it('a rejected founder-read application is remembered with what the page led with', () => {
    const job = { ...fakeJob('Babaclick', 'Growth Intern', BABACLICK), id: 'j1', status: 'rejected' as const, appliedAt: '2026-09-01T00:00:00.000Z' }
    const found = { ...fakeJob('Acme', 'AI Engineer', 'Python'), id: 'j2', status: 'found' as const }
    const lines = outcomeLines([job, found], [packetFor('j1')])
    expect(lines).toHaveLength(1) // 'found' is not an outcome
    const persona = packetFor('j1').reading!.readerPersona
    expect(lines[0]).toMatchObject({ company: 'Babaclick', status: 'rejected', reader: persona })
    expect(lines[0].led).not.toBe('unknown')
    const forPrompt = memoryFor(lines, packetFor('j1').reading!)
    expect(forPrompt[0]).toMatch(/1 recorded outcome/)
    expect(forPrompt[0]).toMatch(/too few to learn a rule/)
    expect(forPrompt[1]).toMatch(new RegExp(`same kind of reader → Babaclick \\(${persona} reader`))
  })
})

describe('THE CLOCK — from his own window', () => {
  it('Jan 2027 window → secure by 31 Dec 2026? no: by end-November (the exam month is gone); Oct–Nov applying window', () => {
    const line = clockLine('Jan 2027', new Date(2026, 8, 5))
    expect(line).toMatch(/secure it by 30 Nov 2026/)
    expect(line).toMatch(/12 weeks left/)
    expect(line).toMatch(/applying window Oct–Nov/)
    expect(line).toMatch(/opens 1 Oct 2026/)
  })
  it('inside the window it says apply now; a garbage window yields nothing', () => {
    expect(clockLine('Jan 2027', new Date(2026, 9, 20))).toMatch(/apply now/)
    expect(clockLine('whenever', new Date())).toBeNull()
    expect(clockLine(undefined, new Date())).toBeNull()
  })
})

describe('the interview brief speaks the plan', () => {
  it('each care they wrote maps to a played proof; do-not-lead names what they dismissed', () => {
    const job = fakeJob('Babaclick', 'Growth Intern', BABACLICK)
    const d = buildDossier(job, SEED_LEDGER, packetFor(job.id))
    expect(d.cares.length).toBeGreaterThanOrEqual(2)
    expect(d.cares.map((c) => c.care.toLowerCase()).join(' ')).toMatch(/logical reasoning/)
    for (const c of d.cares) expect(c.proof.length).toBeGreaterThan(10)
    expect(d.doNotLead.join(' ').toLowerCase()).toMatch(/leetcode|certificates|brand/)
  })
  it('without a packet the brief still stands (no cares, no crash)', () => {
    const d = buildDossier(fakeJob('Acme', 'AI Engineer', 'Python, RAG'), SEED_LEDGER)
    expect(d.cares).toEqual([])
    expect(d.doNotLead).toEqual([])
    expect(d.talkingPoints.length).toBeGreaterThan(0)
  })
})
