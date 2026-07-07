import { describe, it, expect } from 'vitest'
import { compileResume, CompileError } from '../src/lib/compile/compiler'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { compilePacketPure, fakeJob, SEED_IDENTITY } from './helpers'
import type { LedgerEntry } from '../src/types'
import { stripHtml } from '../src/lib/util/html'

/** Referee chaos runs — every degradation must be legible, never a blank or a crash (I6). */

describe('Chaos — empty ledger', () => {
  it('compiles a contact-only resume without throwing', () => {
    const decode = decodeJD('python llm')
    const coverage = matchEvidence(decode, [])
    const resume = compileResume({ identity: SEED_IDENTITY, ledger: [], decode, coverage, jobId: 'x' })
    expect(resume.lines[0].text).toBe(SEED_IDENTITY.name)
    // No bullet lines can exist with an empty ledger; no orphans.
    expect(resume.lines.every((l) => l.kind !== 'bullet')).toBe(true)
  })
})

describe('Chaos — ledger with zero shipped items', () => {
  it('resume has no projects/skills sections but still renders contact + building line safely', () => {
    const forgeOnly: LedgerEntry[] = [
      {
        id: 'proj-forge', kind: 'project', title: 'Forge Project', summary: 's',
        bullets: [{ id: 'b', text: 'building an llm agent', keywords: ['llm', 'agents'] }],
        tier: 'in_forge', forgeEta: 'July 2026', tags: ['llm', 'agents'], resumeEligible: true,
      },
    ]
    const decode = decodeJD('llm agents')
    const coverage = matchEvidence(decode, forgeOnly)
    const resume = compileResume({ identity: SEED_IDENTITY, ledger: forgeOnly, decode, coverage, jobId: 'x' })
    // in_forge must ONLY surface via a forge line (I2), never a bullet.
    expect(resume.lines.some((l) => l.kind === 'forge')).toBe(true)
    expect(resume.lines.every((l) => l.kind !== 'bullet')).toBe(true)
  })
})

describe('Chaos — malformed / empty JD', () => {
  it('empty JD decodes to empty must-haves, compiles fine', () => {
    const decode = decodeJD('')
    expect(decode.mustHave).toHaveLength(0)
    expect(() => compilePacketPure(fakeJob('X', 'Y', ''))).not.toThrow()
  })
  it('garbage JD does not crash the decoder', () => {
    expect(() => decodeJD('!@#$%^&*()_+{}|:"<>?\n\n\t   ')).not.toThrow()
  })
  it('enormous JD is bounded and fast', () => {
    const huge = 'python llm agents rag '.repeat(5000)
    const t = Date.now()
    const decode = decodeJD(huge)
    expect(Date.now() - t).toBeLessThan(1000)
    expect(decode.mustHave.length).toBeGreaterThan(0)
  })
})

describe('Chaos — HTML JD sanitation', () => {
  it('strips Greenhouse entity-escaped HTML to readable text', () => {
    const raw = '&lt;p&gt;We want &lt;strong&gt;Python&lt;/strong&gt; &amp; LLM skills&lt;/p&gt;&lt;ul&gt;&lt;li&gt;RAG&lt;/li&gt;&lt;/ul&gt;'
    const clean = stripHtml(raw)
    expect(clean).not.toContain('<')
    expect(clean).toContain('Python')
    expect(clean).toContain('RAG')
  })
  it('handles raw (unescaped) HTML too', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toContain('Hello')
  })
})

describe('Chaos — page overflow surfaces a legible error', () => {
  it('30 fat projects throw CompileError, not a silent 2-pager', () => {
    const fat: LedgerEntry[] = Array.from({ length: 30 }, (_, i) => ({
      id: `p${i}`, kind: 'project', title: `Project ${i} With A Long Title`, summary: 's',
      tier: 'shipped', evidence: { repo: 'https://x/y', date: '01/2026', note: '' }, tags: ['python'], resumeEligible: true,
      bullets: [{ id: `b${i}`, text: 'A very long bullet '.repeat(12), keywords: ['python'] }],
    }))
    const decode = decodeJD('python')
    const coverage = matchEvidence(decode, fat)
    expect(() => compileResume({ identity: SEED_IDENTITY, ledger: fat, decode, coverage, jobId: 'x' })).toThrow(CompileError)
  })
})
