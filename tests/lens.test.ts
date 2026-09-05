import { describe, it, expect } from 'vitest'
import { chooseLens, LENSES } from '../src/lib/strategist/lens'
import { readPostingHeuristic } from '../src/lib/strategist/reading'
import { planHeuristic } from '../src/lib/strategist/plan'
import { compileResume, clauseTrim, LINE_METRICS } from '../src/lib/compile/compiler'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { SEED_LEDGER, SEED_IDENTITY } from './helpers'

/**
 * v2 R5 — THE LENS: the angle a cunning team chooses before writing, as data (lenses.json).
 * The owner's own test: "what if the company is some NGO — Braillix should show over the AI-heavy
 * project even though it has less AI, because of the social angle."
 */
const NGO = `Programme Technology Fellow — Saksham Foundation (non-profit), Punjab. We work with rural government schools and community health workers in underserved districts. We care about who you have served and what changed for them. Tools are secondary; we value people who build for accessibility and inclusion with the community, not for the community. Python useful.`
const AI = `AI Engineer Intern — Acme Labs. Build LLM agents with RAG, LangGraph, PyTorch, evals. Must: Python, LLMs, RAG, Transformers.`
const BABACLICK = `We do not care about: your university's brand · LeetCode · certificates. We care enormously about: logical reasoning · intellectual honesty · independent research · personal agency. React, Python, FastAPI, PostgreSQL.`

describe('the lens is chosen from what the posting says', () => {
  it('an NGO posting → social impact; an AI lab → AI engineering; Babaclick → proof of mind', () => {
    expect(chooseLens(readPostingHeuristic(NGO, 'Saksham Foundation', 'Programme Technology Fellow')).lens.id).toBe('social-impact')
    expect(chooseLens(readPostingHeuristic(AI, 'Acme Labs', 'AI Engineer Intern')).lens.id).toBe('ai-engineering')
    expect(chooseLens(readPostingHeuristic(BABACLICK, 'Babaclick', 'Growth Intern')).lens.id).toBe('mind-first')
  })
  it('every lens in the catalogue is complete (data the owner can extend)', () => {
    for (const l of LENSES) {
      expect(l.cues.length).toBeGreaterThan(0)
      expect(l.leadRe.length).toBeGreaterThan(3)
      expect(l.framing.length).toBeGreaterThan(20)
      expect(l.sectionOrder).toContain('projects')
      expect(['lead', 'normal', 'after']).toContain(l.skills)
    }
  })
})

describe('the lens decides what leads', () => {
  it('NGO: Braillix and Sehat Saarthi outrank Sifarish; projects lead; volunteering is evidence; the plan names its lens', () => {
    const reading = readPostingHeuristic(NGO, 'Saksham Foundation', 'Programme Technology Fellow')
    const plan = planHeuristic(reading, SEED_LEDGER, SEED_IDENTITY)
    expect(plan.lens?.id).toBe('social-impact')
    const order = plan.projectOrder
    const idx = (id: string) => order.indexOf(id)
    expect(idx('proj-braillix')).toBeGreaterThanOrEqual(0)
    expect(idx('proj-braillix')).toBeLessThan(idx('proj-sifarish') === -1 ? 99 : idx('proj-sifarish'))
    expect(idx('proj-sehat-saarthi')).toBeLessThan(idx('proj-sifarish') === -1 ? 99 : idx('proj-sifarish'))
    expect(plan.sectionOrder[0]).toBe('projects')
    expect(plan.sectionOrder.indexOf('positions')).toBeLessThan(plan.sectionOrder.indexOf('skills'))
    const braillix = plan.played.find((p) => p.factId === 'proj-braillix')!
    expect(braillix.reason).toMatch(/social impact angle/)
    expect(braillix.framing).toMatch(/who it serves/)
    const vol = plan.played.find((p) => p.factId.startsWith('pos-bvp') || /volunteer/i.test(SEED_LEDGER.find((e) => e.id === p.factId)?.title ?? ''))
    expect(vol?.reason).toMatch(/community work is direct evidence/)
    expect(plan.threeLines.summary).toMatch(/builds for the people a problem actually hurts/)
  })
  it('AI lab: Sifarish leads, skills rows lead, the summary stays two lines', () => {
    const reading = readPostingHeuristic(AI, 'Acme Labs', 'AI Engineer Intern')
    const plan = planHeuristic(reading, SEED_LEDGER, SEED_IDENTITY)
    expect(plan.lens?.id).toBe('ai-engineering')
    expect(plan.projectOrder[0]).toBe('proj-sifarish')
    expect(plan.threeLines.summary.length).toBeLessThanOrEqual(240)
  })
})

describe('the page breathes (owner-read: "too congested")', () => {
  it('metrics follow the LaTeX samples: ≥1.2× leading, ≥10pt above headings, 1.5pt between bullets', () => {
    expect(LINE_METRICS.bullet.leading / LINE_METRICS.bullet.size).toBeGreaterThanOrEqual(1.2)
    expect(LINE_METRICS.heading.before).toBeGreaterThanOrEqual(10)
    expect(LINE_METRICS.bullet.before).toBeGreaterThanOrEqual(1.5)
  })
  it('clauseTrim cuts a third clause at a boundary, never mid-word, never when the head is short', () => {
    const long = 'Built the on-device recognition pipeline that turns handwriting into Nemeth braille — Tesseract for English and Hindi, a 76 MB model for maths — with nothing leaving the room, verified on 400 pages'
    const t = clauseTrim(long, 120)
    expect(t.length).toBeLessThanOrEqual(120)
    expect(t).toMatch(/^Built the on-device recognition pipeline/)
    expect(t.endsWith('braille') || t.endsWith('maths')).toBe(true)
    expect(clauseTrim('short line — tail', 120)).toBe('short line — tail')
  })
  it('a project description is one line and a bullet is at most ~two lines on the compiled page', () => {
    const decode = decodeJD(AI)
    const reading = readPostingHeuristic(AI, 'Acme Labs', 'AI Engineer Intern')
    const plan = planHeuristic(reading, SEED_LEDGER, SEED_IDENTITY)
    const r = compileResume({ identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage: matchEvidence(decode, SEED_LEDGER), jobId: 'j', plan, pagePolicy: 'two-ok', summaryOn: true })
    for (const l of r.lines) {
      if (l.kind === 'meta' && l.text.includes(' · ')) expect(l.text.length, l.text).toBeLessThanOrEqual(200)
      if (l.kind === 'bullet') expect(l.text.length, l.text).toBeLessThanOrEqual(215)
    }
  })
})

describe('the catalogue covers the market, and the brain may name its own angle', () => {
  it('data analyst → data & analytics; embedded → hardware; consulting → business; design → users; mentor fellowship → teaching', () => {
    const pick = (t: string) => chooseLens(readPostingHeuristic(t, 'X', 'Role')).lens.id
    expect(pick('Data Analyst Intern — build dashboards in Power BI, SQL queries and reports, KPIs for the business.')).toBe('data-analytics')
    expect(pick('Embedded Systems Intern — firmware on ESP32 and Raspberry Pi, sensors, on-device inference.')).toBe('hardware-embedded')
    expect(pick('Business Analyst Intern — structured problem solving with stakeholders, market research, case studies, strategy.')).toBe('business-consulting')
    expect(pick('Product Design Intern — user research, usability, Figma prototypes, accessibility.')).toBe('design-users')
    expect(pick('Campus Mentor Fellowship — teaching workshops, curriculum, community of first-year students.')).toBe('teaching-community')
  })
  it('a posting with no angle falls to AI engineering and says so', () => {
    const c = chooseLens(readPostingHeuristic('Intern. Python.', 'X', 'Intern'))
    expect(c.lens.id).toBe('ai-engineering')
    expect(c.because).toMatch(/no stated angle/)
  })
})
