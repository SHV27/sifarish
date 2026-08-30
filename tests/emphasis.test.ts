import { describe, expect, it } from 'vitest'
import { deriveBulletRuns, layoutRuns, wordsOfRuns } from '../src/lib/compile/emphasis'
import { timesWidth } from '../src/lib/compile/times-metrics'
import { sanitizePdfText } from '../src/lib/compile/typeset'
import { compileResume } from '../src/lib/compile/compiler'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { SEED_IDENTITY, SEED_LEDGER } from './helpers'

/**
 * Arc 2 gates — the canon register's emphasis layer.
 * The CONTRACT: concat(runs.text) === sanitizePdfText(line.text) on every line carrying runs,
 * so I5 extraction order is untouched and renderers draw runs verbatim.
 */

describe('deriveBulletRuns — deterministic, metric-first, capped', () => {
  it('bolds numbers with units and lexicon tech terms; text is reconstructable', () => {
    const text = 'Integrated fine-tuned Claude models with ROC-AUC 0.957 across 40% of pipelines using LangChain'
    const runs = deriveBulletRuns(text)!
    expect(runs.map((r) => r.text).join('')).toBe(text)
    const bolded = runs.filter((r) => r.bold).map((r) => r.text.toLowerCase())
    expect(bolded.join(' ')).toContain('0.957')
    expect(bolded.join(' ')).toContain('40%')
    expect(bolded.some((b) => b.includes('langchain'))).toBe(true)
  })
  it('same input → same runs (deterministic), and a term-free line gets none', () => {
    const t = 'Worked with the team on planning the quarter'
    expect(deriveBulletRuns(t)).toBeUndefined()
    const a = deriveBulletRuns('Cut latency 40% with RAG caching')
    const b = deriveBulletRuns('Cut latency 40% with RAG caching')
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
  it('emphasis is capped — a keyword-stuffed line never bolds more than 6 intervals', () => {
    const t = 'RAG LangChain PyTorch LLM embeddings evals guardrails inference transformers 99% 40ms 10K'
    const runs = deriveBulletRuns(t)!
    expect(runs.filter((r) => r.bold).length).toBeLessThanOrEqual(6)
  })
})

describe('applyEmphasis — the compile-time contract', () => {
  it('every runs line satisfies concat(runs) === sanitizePdfText(text) on a REAL compile', () => {
    const decode = decodeJD('We need RAG, LangChain, Python and evals experience for our LLM platform')
    const coverage = matchEvidence(decode, SEED_LEDGER)
    const resume = compileResume({ identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, jobId: 'j' })
    const withRuns = resume.lines.filter((l) => l.runs && l.runs.length > 0)
    expect(withRuns.length).toBeGreaterThan(0) // the register is ON the default path
    for (const l of withRuns) {
      expect(l.runs!.map((r) => r.text).join('')).toBe(sanitizePdfText(l.text))
    }
  })
  it('project headers carry the canon formula: NAME bold, `| stack` roman', () => {
    const decode = decodeJD('python')
    const coverage = matchEvidence(decode, SEED_LEDGER)
    const resume = compileResume({ identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, jobId: 'j' })
    const header = resume.lines.find((l) => l.kind === 'entry-title' && l.text.includes(' | '))
    if (header) {
      expect(header.runs?.[0]?.bold).toBe(true)
      expect(header.runs?.[1]?.bold).toBeFalsy()
      expect(header.runs!.map((r) => r.text).join('')).toBe(sanitizePdfText(header.text))
    }
    // Bullets never bold their list marker.
    for (const b of resume.lines.filter((l) => l.kind === 'bullet' && l.runs)) {
      expect(b.runs![0].bold).toBeFalsy()
      expect(b.runs![0].text.startsWith('- ')).toBe(true)
    }
  })
})

describe('layoutRuns — ONE wrap algorithm, measure-parameterized', () => {
  const measure = (t: string, b: boolean) => timesWidth(t, 10.5, b ? 'bold' : 'reg')
  it('wraps greedily; concat of visual lines equals the words joined by spaces', () => {
    const runs = [
      { text: 'Engineered a ' },
      { text: 'RAG', bold: true },
      { text: ' pipeline that cut retrieval latency ' },
      { text: '40%', bold: true },
      { text: ' across three services in production' },
    ]
    const lines = layoutRuns(runs, measure, 180, 180)
    expect(lines.length).toBeGreaterThan(1)
    const rebuilt = lines.map((segs) => segs.map((s) => s.text).join('')).join(' ').replace(/\s+/g, ' ').trim()
    const original = wordsOfRuns(runs).map((w) => w.text).join(' ')
    expect(rebuilt).toBe(original)
    // No visual line exceeds its budget (measured with the same tables).
    for (const segs of lines) {
      const w = segs.reduce((n, s) => n + measure(s.text, s.bold), 0)
      expect(w).toBeLessThanOrEqual(184) // small tolerance for the leading-space accounting
    }
  })
  it('bold segments measure wider than roman — the estimator cannot ignore weight', () => {
    expect(timesWidth('LangChain orchestration', 10.5, 'bold')).toBeGreaterThan(timesWidth('LangChain orchestration', 10.5, 'reg'))
  })
})
