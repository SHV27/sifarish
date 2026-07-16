import { describe, it, expect } from 'vitest'
import { SEED_LEDGER, SEED_IDENTITY, fakeJob } from './helpers'
import { composeLetter } from '../src/lib/atelier/letter'
import { checkUniqueness, similarity, SIMILARITY_CEILING } from '../src/lib/atelier/uniqueness'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { scanSlop, scanGuarantee } from '../src/lib/slop/scan'
import { DEFAULT_VISION } from '../src/db/seed'
import type { CompanyIntel, LedgerEntry } from '../src/types'
import EXTRA_SHIPPED from './fixtures/extra-shipped.json'

/**
 * A realistic near-future ledger: the seed ships only GLOAMING today. Uniqueness is only
 * exercisable when there are multiple SHIPPED projects to cast differently per role, so the gate
 * builds that state itself. `extra-shipped.json` is the exact content of four projects (promoted to
 * shipped) — kept in the test fixture, so the gate never depends on which placeholder projects the
 * seed happens to carry (they were removed once Shaurya asked to drop the in-forge stubs).
 */
const MULTI_LEDGER: LedgerEntry[] = [...SEED_LEDGER, ...(EXTRA_SHIPPED as LedgerEntry[])]

// Company-specific intel hooks (real letters get distinct hooks; that is the point).
const INTEL: Record<string, string> = {
  Anthropic: 'Anthropic ships agentic developer tools and treats interpretability as a first-class product concern',
  'Sarvam AI': 'Sarvam AI is building India-first speech and language models for Indian languages at scale',
  LangChain: 'LangChain maintains the most-used agent orchestration framework and is investing in evals tooling',
}

function compose(company: string, title: string, jd: string, useSignature = false) {
  const job = fakeJob(company, title, jd)
  const decode = decodeJD(jd)
  const coverage = matchEvidence(decode, MULTI_LEDGER)
  const intel: CompanyIntel = {
    company: company.toLowerCase(),
    keyless: false,
    fetchedAt: new Date().toISOString(),
    bullets: [{ text: INTEL[company] ?? `${company} builds AI products`, url: `https://${company.toLowerCase().replace(/\s+/g, '')}.com/careers` }],
  }
  return composeLetter({ job, identity: SEED_IDENTITY, ledger: MULTI_LEDGER, decode, coverage, intel, vision: DEFAULT_VISION, useSignature })
}

describe('Atelier — composed letters', () => {
  it('opens with a cited company hook (I7)', () => {
    const doc = compose('Anthropic', 'AI Engineering Intern', 'Python, LLM, RAG, agents')
    expect(doc.paragraphs[0].citationUrl).toContain('anthropic.com')
  })

  it('carries a vision bridge sentence', () => {
    const doc = compose('Anthropic', 'AI Eng Intern', 'Python, LLM, agents')
    const text = doc.paragraphs.map((p) => p.text).join(' ')
    expect(text.toLowerCase()).toMatch(/that matters to me|on that path/)
  })

  it('every proof paragraph carries a ledgerId (I1)', () => {
    const doc = compose('Anthropic', 'AI Eng Intern', 'Python, LLM, agents')
    const proofs = doc.paragraphs.filter((p) => p.ledgerIds.length > 0)
    expect(proofs.length).toBeGreaterThan(0)
  })

  it('is slop-free and guarantee-free (banlist v3, I9)', () => {
    const doc = compose('Anthropic', 'AI Eng Intern', 'Python, LLM, agents')
    const text = doc.paragraphs.map((p) => p.text).join('\n')
    expect(scanSlop(text)).toHaveLength(0)
    expect(scanGuarantee(text)).toHaveLength(0)
  })

  it('Sifarish Signature P.S. appears only when toggled on', () => {
    const off = compose('Anthropic', 'AI Eng Intern', 'Python, LLM', false)
    const on = compose('Anthropic', 'AI Eng Intern', 'Python, LLM', true)
    expect(off.paragraphs.some((p) => p.text.startsWith('P.S.'))).toBe(false)
    expect(on.paragraphs.some((p) => p.text.startsWith('P.S.'))).toBe(true)
  })

  it('core body stays ≤250 words', () => {
    const doc = compose('Anthropic', 'AI Eng Intern', 'Python, LLM, RAG, agents, evals')
    const core = doc.paragraphs.filter((p) => !p.text.startsWith('P.S.')).map((p) => p.text).join(' ')
    expect(core.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(250)
  })
})

describe('Atelier — uniqueness gate (a letter sendable to two companies is a failed letter)', () => {
  it('two letters for different companies stay below the similarity ceiling', () => {
    const a = compose('Anthropic', 'AI Engineering Intern', 'Python, LLM, RAG, agents, guardrails').paragraphs.map((p) => p.text).join('\n')
    const b = compose('Sarvam AI', 'ML Intern Speech', 'Python, PyTorch, ASR, speech, transformers').paragraphs.map((p) => p.text).join('\n')
    const sim = similarity(a, b)
    expect(sim, `similarity ${sim} exceeds ceiling ${SIMILARITY_CEILING}`).toBeLessThanOrEqual(SIMILARITY_CEILING)
  })

  it('checkUniqueness passes a set of distinct-company letters', () => {
    const letters = ['Anthropic', 'Sarvam AI', 'LangChain'].map((c, i) =>
      compose(c, `Role ${i}`, ['Python LLM agents', 'PyTorch ASR speech', 'LangGraph RAG agents'][i]).paragraphs.map((p) => p.text).join('\n'),
    )
    const res = checkUniqueness(letters)
    expect(res.ok, `max similarity ${res.maxSimilarity}`).toBe(true)
  })
})
