import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/db/db'
import { SEED_LEDGER } from './helpers'
import { decodeJD } from '../src/lib/jd/decode'
import { runEditor, redTeamPass, castingPass, surgeryPass, ARCHETYPES } from '../src/lib/darzi/editor'
import { entryRelevance, bulletRelevance } from '../src/lib/match/evidence'
import { JD_FIXTURES } from './fixtures/jds'
import type { CompanyIntel, JDDecode, LedgerEntry } from '../src/types'

/**
 * The Editor's Desk (Darzi v3). Heuristic fallbacks in the test env. Asserts: every pass carries
 * a rationale (I10), casting ≤3 with benched reasons, and — critically — the angle bullet plan
 * can only SELECT/ORDER real bullets, never invent (I1 by construction).
 */
describe('runEditor — four passes, rationaled', () => {
  beforeEach(async () => {
    await db.dimaagCache.clear()
    await db.dimaagUsage.clear()
  })

  const projects = SEED_LEDGER.filter((e) => e.resumeEligible && e.tier === 'shipped' && e.kind === 'project')

  it('produces archetype + casting + chosen(≤3) + benched, each with reasons (I10)', async () => {
    const decode = decodeJD(JD_FIXTURES[0].jd)
    const { plan, order, bullets } = await runEditor({ projects, decode, jd: JD_FIXTURES[0].jd })
    expect(plan.archetype.id).toBeTruthy()
    expect(plan.archetype.priorities.length).toBeGreaterThan(0)
    expect(plan.casting.why.length).toBeGreaterThan(10) // casting rationale present
    expect(plan.chosen.length).toBeGreaterThan(0)
    expect(plan.chosen.length).toBeLessThanOrEqual(3)
    for (const b of plan.benched) expect(b.why.length).toBeGreaterThan(5)
    for (const c of plan.chosen) expect(c.angleRationale.why.length).toBeGreaterThan(5)
    expect(order.length).toBe(plan.chosen.length)
    // I1 by construction: every planned bullet id is a REAL bullet of that project.
    for (const [ledgerId, ids] of Object.entries(bullets)) {
      const project = projects.find((p) => p.id === ledgerId)!
      const realIds = new Set(project.bullets.map((b) => b.id))
      for (const id of ids) expect(realIds.has(id), `${id} is not a real bullet of ${ledgerId}`).toBe(true)
    }
  })

  it('a benched project only has shipped projects; chosen are distinct from benched', async () => {
    const decode = decodeJD(JD_FIXTURES[1].jd)
    const { plan } = await runEditor({ projects, decode, jd: JD_FIXTURES[1].jd })
    const chosenIds = new Set(plan.chosen.map((c) => c.ledgerId))
    for (const b of plan.benched) expect(chosenIds.has(b.ledgerId)).toBe(false)
  })
})

describe('redTeamPass — the ready gate', () => {
  beforeEach(async () => await db.dimaagCache.clear())
  it('clean resume text → PASS', async () => {
    const rt = await redTeamPass('Shaurya Verma\nPROJECTS\n- Built and shipped a flood-alert pipeline for Rupnagar, live and evaluated.')
    expect(rt.verdict).toBe('PASS')
  })
  it('slop in resume text → REVISE with a fix', async () => {
    const rt = await redTeamPass('Shaurya Verma\n- A results-driven self-starter with a passion for synergies.')
    expect(rt.verdict).toBe('REVISE')
    expect(rt.fixes.length).toBeGreaterThan(0)
  })
})

// ============================================================================================
// Session 5.5 — deeper per-JD tailoring: intel→casting, JD/intel→angle, prominence weighting,
// JD-aware red-team. All emphasis/ordering only — never mints a fact (I1, compiler is authority).
// ============================================================================================

describe('JD prominence weighting (evidence.ts)', () => {
  it('a high-prominence must-have outweighs a one-mention one', () => {
    const decode: JDDecode = { mustHave: ['agents', 'python'], niceToHave: [], seniority: '', locationHints: [], compHints: [], mustHaveWeights: { agents: 4, python: 2 } }
    const agentEntry = { tags: ['agents'], bullets: [] } as unknown as LedgerEntry
    const pyEntry = { tags: ['python'], bullets: [] } as unknown as LedgerEntry
    expect(entryRelevance(agentEntry, decode)).toBe(4)
    expect(entryRelevance(pyEntry, decode)).toBe(2)
  })
  it('falls back to flat +2 when weights are absent (backward compatible)', () => {
    const decode: JDDecode = { mustHave: ['agents'], niceToHave: [], seniority: '', locationHints: [], compHints: [] }
    expect(bulletRelevance(['agents'], decode)).toBe(2)
    expect(bulletRelevance(['unrelated'], decode)).toBe(0)
  })
})

describe('decodeJD computes prominence weights', () => {
  it('a repeated requirement outweighs a single mention', () => {
    const jd = 'Requirements: LangChain, LangChain, LangChain, LangChain experience. One mention of LangGraph.'
    const d = decodeJD(jd)
    expect(d.mustHaveWeights).toBeTruthy()
    expect(d.mustHaveWeights!['langchain']).toBeGreaterThan(d.mustHaveWeights!['langgraph'])
    expect(d.mustHaveWeights!['langgraph']).toBe(2) // one mention → the historic flat weight
  })
})

describe('casting is company-intel-aware (Session 5.5)', () => {
  beforeEach(async () => {
    await db.dimaagCache.clear()
    await db.dimaagUsage.clear()
  })
  const mk = (id: string, tags: string[]): LedgerEntry =>
    ({ id, title: id, summary: `${id} summary`, kind: 'project', tier: 'shipped', resumeEligible: true, tags, bullets: [{ id: `${id}-b1`, text: 'x', keywords: tags, ledgerIds: [id] }] } as unknown as LedgerEntry)
  const A = mk('proj-a', ['alpha', 'bravo'])
  const B = mk('proj-b', ['charlie', 'delta'])
  const arch = ARCHETYPES.find((a) => a.id === 'applied-ai')!
  const emptyDecode: JDDecode = { mustHave: [], niceToHave: [], seniority: '', locationHints: [], compHints: [] }

  it('with no intel, a tie breaks to input order (proj-a leads)', async () => {
    const { chosenIds } = await castingPass([A, B], arch, emptyDecode)
    expect(chosenIds[0]).toBe('proj-a')
  })
  it("company intel naming project B's domain pulls it to the LEAD (was citation-only)", async () => {
    const intel: CompanyIntel = { company: 'X', keyless: false, fetchedAt: new Date().toISOString(), bullets: [{ text: 'We build charlie and delta systems at scale.', url: 'https://x' }] }
    const { chosenIds } = await castingPass([A, B], arch, emptyDecode, intel)
    expect(chosenIds[0]).toBe('proj-b') // intel changed which project leads
  })
})

describe('surgery offers a JD-driven angle (Session 5.5)', () => {
  beforeEach(async () => await db.dimaagCache.clear())
  const projects = SEED_LEDGER.filter((e) => e.resumeEligible && e.tier === 'shipped' && e.kind === 'project')
  it('when the JD has must-haves, a JD-focus angle option reaches the reasoner', async () => {
    const decode: JDDecode = { mustHave: ['agents', 'rag'], niceToHave: [], seniority: '', locationHints: [], compHints: [], mustHaveWeights: { agents: 2, rag: 2 } }
    const arch = ARCHETYPES.find((a) => a.id === 'applied-ai')!
    const { choice } = await surgeryPass(projects[0], arch, decode)
    expect((choice.angleRationale.optionsConsidered ?? []).some((o) => /stated priorities/i.test(o))).toBe(true)
  })
})

describe('redTeamPass is JD-aware (Session 5.5)', () => {
  beforeEach(async () => await db.dimaagCache.clear())
  const clean = 'Shaurya Verma\nPROJECTS\n- Built and shipped a flood-alert pipeline for Rupnagar, evaluated live with real users daily.'
  it('flags a resume whose lead does not answer the JD must-haves', async () => {
    const decode: JDDecode = { mustHave: ['kubernetes'], niceToHave: [], seniority: '', locationHints: [], compHints: [], mustHaveWeights: { kubernetes: 2 } }
    const rt = await redTeamPass(clean, decode, { label: 'Platform Engineer', priorities: ['serving'] })
    expect(rt.verdict).toBe('REVISE')
    expect(rt.fixes.some((f) => /must-have|kubernetes/i.test(f))).toBe(true)
  })
  it('the same clean resume with NO decode → PASS (backward compatible)', async () => {
    const rt = await redTeamPass(clean)
    expect(rt.verdict).toBe('PASS')
  })
})
