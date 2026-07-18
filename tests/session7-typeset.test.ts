import { describe, it, expect } from 'vitest'
import { sentenceTrim, cleanUrlForDisplay, stripMarkdownResidue, groupSkills, categorizeSkill } from '../src/lib/compile/typeset'
import { compileResume, estimateLineHeight } from '../src/lib/compile/compiler'
import { renderResumePdf } from '../src/lib/export/pdf'
import { parsebackTest } from '../src/lib/export/parseback'
import { distillReadme } from '../src/lib/nabz/github'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { SEED_IDENTITY, SEED_LEDGER } from './helpers'
import type { LedgerEntry } from '../src/types'

/**
 * Session 7 "The Taaj" — the typesetter gates. Every regression test here is built from the
 * EXACT strings on the owner's broken résumé (the §14 rule: the test IS the apology).
 */

// ---------- sentenceTrim (defect R2: "…voice read-outs, and…" cut mid-thought) ----------

describe('S7 — descriptions never end mid-thought', () => {
  it('the exact sehat-saarthi line from his résumé cuts at a clause, not inside the list', () => {
    const s =
      'A free Punjabi-first clinical decision-support screening co-pilot for Punjab\'s government hospitals, offering bilingual risk scores, voice read-outs, and offline-capable triage for low-literacy patients in rural clinics.'
    const t = sentenceTrim(s, 160)
    expect(t.endsWith('and…')).toBe(false)
    expect(t).not.toMatch(/,\s*(and)?…$/)
    // It must end at a sentence or clause boundary (period) or be the whole string.
    expect(/[.…]$/.test(t)).toBe(true)
  })

  it('short strings pass through untouched; whole sentences are preferred over fragments', () => {
    expect(sentenceTrim('Short and complete.', 160)).toBe('Short and complete.')
    const twoSentences = 'First sentence is right here. Second sentence would overflow the budget by a lot more text.'
    const t = sentenceTrim(twoSentences, 60)
    expect(t).toBe('First sentence is right here.')
  })
})

// ---------- cleanUrlForDisplay (defect R1: "sifarish-shv-s-projects.vercel.app**") ----------

describe('S7 — the evidence URL renders clean whatever the vault holds', () => {
  it('the exact polluted URL off his résumé loses its markdown tail', () => {
    expect(cleanUrlForDisplay('https://sifarish-shv-s-projects.vercel.app**')).toBe('sifarish-shv-s-projects.vercel.app')
  })
  it('protocol, www and trailing slash go; the host stays', () => {
    expect(cleanUrlForDisplay('https://www.example.dev/path/')).toBe('example.dev/path')
  })
})

describe('S7 — distillReadme never captures markdown emphasis into the live URL', () => {
  it('a bold-wrapped bare URL yields a clean liveUrl', () => {
    const d = distillReadme('# X\n\nSome intro prose for the project.\n\n**https://myapp.vercel.app**\n')
    expect(d.liveUrl).toBe('https://myapp.vercel.app')
  })
})

// ---------- stripMarkdownResidue at the push() choke point ----------

describe('S7 — the single line-emission gate strips markdown from EVERY line', () => {
  it('keeps C# but kills emphasis runs and heading hashes', () => {
    expect(stripMarkdownResidue('Shipped **fast** `pipeline` in C#')).toBe('Shipped fast pipeline in C#')
    expect(stripMarkdownResidue('## Heading text')).toBe('Heading text')
  })

  it('a polluted bullet cannot reach the page with asterisks (end-to-end through compile)', () => {
    const dirty: LedgerEntry = {
      ...(SEED_LEDGER.find((e) => e.kind === 'project' && e.tier === 'shipped') as LedgerEntry),
      id: 'proj-md-dirty',
      title: 'mdtest',
      bullets: [{ id: 'md1', text: 'Built a **guarded** compile pipeline with `evals`', keywords: ['python'] }],
    }
    const ledger = [...SEED_LEDGER, dirty]
    const decode = decodeJD('AI engineer. Must have: Python.')
    const resume = compileResume({
      identity: SEED_IDENTITY,
      ledger,
      decode,
      coverage: matchEvidence(decode, ledger),
      jobId: 'j',
      editorial: { order: ['proj-md-dirty'], bullets: {} },
    })
    for (const l of resume.lines) {
      expect(l.text).not.toMatch(/[*`]/)
      if (l.right) expect(l.right).not.toMatch(/[*`]/)
    }
  })
})

// ---------- Skills grouping (the selected-résumé canon: labeled category lines) ----------

describe('S7 — skills render as labeled category lines, AI & ML first', () => {
  it('his real skill titles map to sensible groups', () => {
    expect(categorizeSkill('RAG + Guardrails + Evals')).toBe('AI & ML')
    expect(categorizeSkill('LoRA Fine-Tuning')).toBe('AI & ML')
    expect(categorizeSkill('LangGraph / MCP Multi-Agent Systems')).toBe('AI & ML')
    expect(categorizeSkill('Python')).toBe('Languages')
    expect(categorizeSkill('JavaScript / TypeScript (working)')).toBe('Languages')
    expect(categorizeSkill('Git & GitHub')).toBe('Frameworks & Tools')
  })

  it('owner-set category always wins over the lexicon', () => {
    expect(categorizeSkill('Python', 'Frameworks & Tools')).toBe('Frameworks & Tools')
  })

  it('group order is AI & ML → Languages → Frameworks & Tools, preserving in-group order', () => {
    const groups = groupSkills([
      { id: 'a', title: 'Git & GitHub' },
      { id: 'b', title: 'Python' },
      { id: 'c', title: 'RAG + Guardrails + Evals' },
      { id: 'd', title: 'Transformers Internals' },
    ])
    expect(groups.map((g) => g.label)).toEqual(['AI & ML', 'Languages', 'Frameworks & Tools'])
    expect(groups[0].titles).toEqual(['RAG + Guardrails + Evals', 'Transformers Internals'])
  })

  it('the compiled resume carries labeled skills lines', () => {
    const decode = decodeJD('AI engineer. Must have: Python, RAG.')
    const resume = compileResume({
      identity: SEED_IDENTITY,
      ledger: SEED_LEDGER,
      decode,
      coverage: matchEvidence(decode, SEED_LEDGER),
      jobId: 'j',
    })
    const skillLines = resume.lines.filter((l) => l.kind === 'skills')
    expect(skillLines.length).toBeGreaterThanOrEqual(2)
    for (const l of skillLines) expect(l.text).toMatch(/^(AI & ML|Languages|Frameworks & Tools): /)
  })
})

// ---------- The classic layout contract (centered header, right dates, parse-back intact) ----------

describe('S7 — the classic layout keeps I5 parse-back at 100%', () => {
  it('contact block is exactly two centered lines (name + one contact line)', () => {
    const decode = decodeJD('AI engineer. Must have: Python.')
    const resume = compileResume({
      identity: SEED_IDENTITY,
      ledger: SEED_LEDGER,
      decode,
      coverage: matchEvidence(decode, SEED_LEDGER),
      jobId: 'j',
    })
    const contacts = resume.lines.filter((l, i) => i === 0 || l.kind === 'contact')
    expect(contacts.length).toBe(2)
    expect(contacts[1].text).toContain(SEED_IDENTITY.email)
    expect(contacts[1].text).toContain(SEED_IDENTITY.location)
  })

  it('headings estimate includes the rule allowance', () => {
    const h = estimateLineHeight({ kind: 'heading', text: 'PROJECTS', ledgerIds: [] })
    const b = estimateLineHeight({ kind: 'skills', text: 'PROJECTS', ledgerIds: [] })
    expect(h).toBeGreaterThan(b)
  })

  it('a resume with right-aligned dates parses back 100%, in order, dates included', async () => {
    const decode = decodeJD('AI engineer. Must have: Python, RAG, LLM.')
    const resume = compileResume({
      identity: SEED_IDENTITY,
      ledger: SEED_LEDGER,
      decode,
      coverage: matchEvidence(decode, SEED_LEDGER),
      jobId: 'j',
    })
    // The layout actually exercises the right-segment path:
    expect(resume.lines.some((l) => l.right)).toBe(true)
    const pdf = await renderResumePdf(resume)
    const result = await parsebackTest(resume, pdf)
    expect(result.missing).toEqual([])
    expect(result.outOfOrder).toEqual([])
    expect(result.ok).toBe(true)
  })
})

// ---------- WS-R2: the Selection Brain (dedupe + numbers guarantee) ----------

import { bulletOverlap, HARD_DUPLICATE } from '../src/lib/compile/overlap'

describe('S7 — two bullets making the same claim never share the page', () => {
  it('bulletOverlap flags lexical near-duplicates and passes distinct claims', () => {
    const a = 'Designed guardrails that reject uncited prose and guarantee 100% PDF round-trip fidelity'
    const aDup = 'Built guardrails rejecting uncited prose with guaranteed PDF round-trip fidelity'
    const distinct = 'Integrated fine-tuned Claude models with ROC-AUC 0.957 for chest X-ray screening'
    expect(bulletOverlap(a, aDup)).toBeGreaterThanOrEqual(HARD_DUPLICATE)
    expect(bulletOverlap(a, distinct)).toBeLessThan(HARD_DUPLICATE)
  })

  it('the compiler drops the twin and promotes the next distinct bullet', () => {
    const p: LedgerEntry = {
      ...(SEED_LEDGER.find((e) => e.kind === 'project' && e.tier === 'shipped') as LedgerEntry),
      id: 'proj-dup',
      title: 'duptest',
      bullets: [
        { id: 'd1', text: 'Designed guardrails that reject uncited prose and guarantee 100% PDF round-trip fidelity', keywords: ['python', 'guardrails'] },
        { id: 'd2', text: 'Built guardrails rejecting uncited prose with guaranteed PDF round-trip fidelity', keywords: ['python', 'guardrails'] },
        { id: 'd3', text: 'Shipped a live Vercel deployment with serverless functions and a keyless fallback', keywords: ['python'] },
      ],
    }
    const ledger = [...SEED_LEDGER, p]
    const decode = decodeJD('AI engineer. Must have: Python, guardrails.')
    const resume = compileResume({
      identity: SEED_IDENTITY, ledger, decode, coverage: matchEvidence(decode, ledger), jobId: 'j',
      editorial: { order: ['proj-dup'], bullets: {} },
    })
    const bullets = resume.lines.filter((l) => l.kind === 'bullet' && l.ledgerIds.includes('proj-dup')).map((l) => l.text)
    const hasD1 = bullets.some((t) => t.includes('Designed guardrails'))
    const hasD2 = bullets.some((t) => t.includes('Built guardrails rejecting'))
    expect(hasD1 && hasD2).toBe(false) // never both
    expect(bullets.some((t) => t.includes('Shipped a live Vercel deployment'))).toBe(true)
  })

  it('cross-project: a bullet nearly identical to another project\'s bullet is dropped page-wide', () => {
    const base = SEED_LEDGER.find((e) => e.kind === 'project' && e.tier === 'shipped') as LedgerEntry
    const p1: LedgerEntry = {
      ...base, id: 'proj-x1', title: 'xone',
      bullets: [{ id: 'x1a', text: 'Engineered a keyless fallback pipeline so every feature runs with zero API keys', keywords: ['python'] }],
    }
    const p2: LedgerEntry = {
      ...base, id: 'proj-x2', title: 'xtwo',
      bullets: [
        { id: 'x2a', text: 'Engineered keyless fallback pipelines so features run with zero API keys', keywords: ['python'] },
        { id: 'x2b', text: 'Implemented signed HMAC-SHA256 cookies with constant-time admin password checks', keywords: ['python'] },
      ],
    }
    const ledger = [...SEED_LEDGER, p1, p2]
    const decode = decodeJD('AI engineer. Must have: Python.')
    const resume = compileResume({
      identity: SEED_IDENTITY, ledger, decode, coverage: matchEvidence(decode, ledger), jobId: 'j',
      editorial: { order: ['proj-x1', 'proj-x2'], bullets: {} },
    })
    const p2bullets = resume.lines.filter((l) => l.kind === 'bullet' && l.ledgerIds.includes('proj-x2')).map((l) => l.text)
    expect(p2bullets.some((t) => t.includes('HMAC-SHA256'))).toBe(true)
    expect(p2bullets.some((t) => t.includes('zero API keys'))).toBe(false) // the twin died
  })
})

describe('S7 — the quantification GUARANTEE (a +2 tie-break was never a guarantee)', () => {
  it('an entry holding a digit-bearing bullet always renders at least one', () => {
    const base = SEED_LEDGER.find((e) => e.kind === 'project' && e.tier === 'shipped') as LedgerEntry
    const p: LedgerEntry = {
      ...base, id: 'proj-num', title: 'numtest',
      bullets: [
        { id: 'n1', text: 'Built an agentic retrieval pipeline with prompt engineering and evals for production LLM workloads', keywords: ['python', 'llm', 'rag', 'evals', 'agents'] },
        { id: 'n2', text: 'Designed guardrails with retrieval augmented generation across agent workflows and evals', keywords: ['python', 'llm', 'rag', 'evals', 'agents'] },
        { id: 'n3', text: 'Orchestrated multi-agent workflows with structured outputs and evaluation harnesses in production', keywords: ['python', 'llm', 'rag', 'evals', 'agents'] },
        { id: 'n4', text: 'Achieved ROC-AUC 0.957 on chest X-ray screening with calibrated risk bands', keywords: ['ml'] },
      ],
    }
    const ledger = [...SEED_LEDGER, p]
    const decode = decodeJD('AI engineer. Must have: Python, LLM, RAG, evals, agents.')
    const resume = compileResume({
      identity: SEED_IDENTITY, ledger, decode, coverage: matchEvidence(decode, ledger), jobId: 'j',
      editorial: { order: ['proj-num'], bullets: {} },
    })
    const bullets = resume.lines.filter((l) => l.kind === 'bullet' && l.ledgerIds.includes('proj-num')).map((l) => l.text)
    expect(bullets.length).toBeGreaterThan(0)
    expect(bullets.some((t) => /\d/.test(t))).toBe(true) // 0.957 kept its seat
  })
})
