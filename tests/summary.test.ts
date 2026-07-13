import { describe, expect, it } from 'vitest'
import { buildSummaryLine } from '../src/lib/darzi/summary'
import { compileResume } from '../src/lib/compile/compiler'
import { parseUtterance } from '../src/lib/baithak/intent'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { DEFAULT_VISION } from '../src/db/seed'
import { JD_FIXTURES } from './fixtures/jds'
import { SEED_IDENTITY, SEED_LEDGER, fakeJob, compilePacketPure } from './helpers'
import type { Packet } from '../src/types'

/** Session 5.2 — professional summary (evidence-linked) + the Baithak understanding it. */

function ctx() {
  const decode = decodeJD(JD_FIXTURES[0].jd)
  const coverage = matchEvidence(decode, SEED_LEDGER)
  return { decode, coverage }
}

describe('professional summary — evidence-dense, never minted (I1)', () => {
  it('compiles a TRULY TIMELESS, vision-framed identity line (no tools, no numbers, no names)', () => {
    const { decode, coverage } = ctx()
    const line = buildSummaryLine({ identity: SEED_IDENTITY, vision: DEFAULT_VISION, ledger: SEED_LEDGER, decode, coverage })
    expect(line).toBeTruthy()
    expect(line!.kind).toBe('summary')
    expect(line!.text.length).toBeGreaterThan(40)
    // Backed by real evidence (I1) even though it names nothing.
    const ids = new Set(SEED_LEDGER.map((e) => e.id))
    expect(line!.ledgerIds.length).toBeGreaterThan(0)
    for (const id of line!.ledgerIds) expect(ids.has(id)).toBe(true)
    // The director/builder identity, vision-framed.
    expect(line!.text).toMatch(/Agentic-AI engineer/i)
    expect(line!.text).toMatch(/architects and ships/i)
    // NO project names.
    for (const name of ['GLOAMING', 'SUTRADHAR', 'DARYA', 'MUNSHI', 'KATHA', 'YOJANA', 'BRAILLIX']) {
      expect(line!.text).not.toContain(name)
    }
    // NO tool/skill names (the stack changes month to month — not timeless).
    for (const tool of ['Python', 'Groq', 'Whisper', 'TypeScript', 'JavaScript', 'Git', 'RAG', 'LoRA', 'PyTorch', 'React']) {
      expect(line!.text).not.toContain(tool)
    }
    // NO numbers (a count is a point-in-time fact).
    expect(line!.text).not.toMatch(/\d/)
    // NO geography, NO decaying "currently building".
    expect(line!.text).not.toMatch(/India|Indian|Punjab/i)
    expect(line!.text).not.toMatch(/currently|building|forge/i)
  })

  it('returns null when the ledger has no AI evidence to back the identity (I1)', () => {
    const { decode, coverage } = ctx()
    const noAi = SEED_LEDGER.filter((e) => e.kind !== 'project' && !(e.kind === 'skill'))
    expect(buildSummaryLine({ identity: SEED_IDENTITY, vision: DEFAULT_VISION, ledger: noAi, decode, coverage })).toBeNull()
  })

  it('renders at the TOP of the resume (first fixation) when passed to the compiler', () => {
    const { decode, coverage } = ctx()
    const summaryLine = buildSummaryLine({ identity: SEED_IDENTITY, vision: DEFAULT_VISION, ledger: SEED_LEDGER, decode, coverage }) ?? undefined
    const resume = compileResume({ identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, jobId: 'x', summaryLine })
    const idx = resume.lines.findIndex((l) => l.kind === 'summary')
    const firstHeading = resume.lines.findIndex((l) => l.kind === 'heading')
    expect(idx).toBeGreaterThan(0) // after the contact block
    expect(idx).toBeLessThan(firstHeading) // before the first section
  })

  it('absent when the compiler is given no summary line (toggle off)', () => {
    const { decode, coverage } = ctx()
    const resume = compileResume({ identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, jobId: 'x' })
    expect(resume.lines.some((l) => l.kind === 'summary')).toBe(false)
  })
})

describe('Baithak understands "professional summary" (the reported dumb response, fixed)', () => {
  const packet = compilePacketPure(fakeJob('Anthropic', 'AI Intern', JD_FIXTURES[0].jd)) as Packet
  const ledger = SEED_LEDGER

  it('"add a professional summary of me based on my vision and truth" → set-summary op (handled)', () => {
    const r = parseUtterance('add a professional summary of me, like a short summary based upon my vision and truth', { packet, ledger })
    expect(r.handled).toBe(true)
    expect(r.proposals).toHaveLength(1)
    expect(r.proposals[0].op).toMatchObject({ kind: 'set-summary', on: true })
  })

  it('"remove the summary" → set-summary on:false', () => {
    const r = parseUtterance('remove the professional summary', { packet, ledger })
    expect(r.proposals[0].op).toMatchObject({ kind: 'set-summary', on: false })
  })

  it('a truly freeform request falls through to the smart layer (handled=false)', () => {
    const r = parseUtterance('make my machine learning experience really pop for this role', { packet, ledger })
    expect(r.handled).toBe(false) // → smartBaithak (LLM) takes over in the component
    expect(r.proposals).toHaveLength(0)
  })
})
