import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/db/db'
import { SEED_LEDGER, SEED_IDENTITY, fakeJob } from './helpers'
import { parseGlobal } from '../src/lib/agent/parse'
import { executeGlobalOp, type AgentContext } from '../src/lib/agent/ops'
import { addSample, canonForPrompt, listSamples, shapeOf, canonConventions } from '../src/lib/ustaad/canon'
import { composeLetter } from '../src/lib/atelier/letter'
import { readPostingHeuristic } from '../src/lib/strategist/reading'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { DEFAULT_SECTIONS } from '../src/lib/dossier/sections'

/**
 * v2 R2 — THE TEAM gates: talk-to-do-anything (edit / hide / page policy / rename / study a sample),
 * the canon as data the strategist reads, and a letter that opens on what THEY said they care about.
 */
const ctx = (): AgentContext => ({ hunts: [], jobs: [], ledger: SEED_LEDGER })

beforeEach(async () => {
  await db.ledger.clear()
  await db.ledger.bulkPut(SEED_LEDGER)
  await db.settings.put({ id: 'app', onboarded: true, rubric: { aiRelevance: 30, roleFit: 25, remoteIndia: 15, windowFit: 15, compSignal: 10, conviction: 5 }, weeklyQuota: 10, weekKey: 'w', appliedThisWeek: 0, sections: DEFAULT_SECTIONS, pagePolicy: 'two-ok' })
  await db.ustaad.clear()
})

describe('talk-to-do-anything', () => {
  it("\"change Braillix's summary to …\" edits the ledger through a proposal", async () => {
    const p = parseGlobal("change Braillix's summary to A refreshable Braille display for maths, built for blind students", ctx())
    expect(p?.proposals[0]?.op).toMatchObject({ kind: 'edit-entry', entryId: 'proj-braillix', field: 'summary' })
    await executeGlobalOp(p!.proposals[0].op)
    expect((await db.ledger.get('proj-braillix'))?.summary).toMatch(/refreshable Braille display for maths/)
  })
  it('Hinglish: "braillix ka title X kar do"', () => {
    const p = parseGlobal('braillix ka title Braillix — maths in braille, live kar do', ctx())
    expect(p?.proposals[0]?.op).toMatchObject({ kind: 'edit-entry', field: 'title' })
  })
  it('"hide GLOAMING from my résumé" hides (never deletes); "bring back GLOAMING" restores', async () => {
    const p = parseGlobal('hide GLOAMING from my résumé', ctx())
    expect(p?.proposals[0]?.op).toMatchObject({ kind: 'hide-entry', entryId: 'proj-gloaming', hide: true })
    await executeGlobalOp(p!.proposals[0].op)
    expect((await db.ledger.get('proj-gloaming'))?.resumeEligible).toBe(false)
    expect(await db.ledger.get('proj-gloaming')).toBeTruthy()
    const q = parseGlobal('bring back GLOAMING', { ...ctx(), ledger: await db.ledger.toArray() })
    expect(q?.proposals[0]?.op).toMatchObject({ kind: 'hide-entry', hide: false })
  })
  it('"one page only" / "two pages ok" set the page policy', async () => {
    await executeGlobalOp(parseGlobal('one page only', ctx())!.proposals[0].op)
    expect((await db.settings.get('app'))?.pagePolicy).toBe('one')
    await executeGlobalOp(parseGlobal('two pages ok', ctx())!.proposals[0].op)
    expect((await db.settings.get('app'))?.pagePolicy).toBe('two-ok')
  })
  it('"rename section sports to Athletics" renames the registry label', async () => {
    await executeGlobalOp(parseGlobal('create section Sports', ctx())!.proposals[0].op)
    await executeGlobalOp(parseGlobal('rename section sports to Athletics', ctx())!.proposals[0].op)
    expect((await db.settings.get('app'))?.sections?.find((s) => s.kind === 'sports')?.label).toBe('Athletics')
  })
  it('a résumé claim through the edit door is still not a résumé claim: "add Kubernetes to my resume" stays refused', () => {
    expect(parseGlobal('add Kubernetes to my resume', ctx())).toBeNull()
  })
})

describe('the canon as data he feeds', () => {
  const SAMPLE = `JAPNIT SINGH SAWHNEY\nEDUCATION\nThapar Institute of Engineering and Technology, Patiala — B.Tech in Computer Engineering — CGPA 9.10\nEXPERIENCE\nReliance Jio — AI/ML Intern\n- Built an LLM-based reasoning layer for an agentic network monitoring system with a 5-member team\n- Designed a RAG pipeline to retrieve network documentation and historical incidents\nPROJECTS\nAI Interview Coach — LangGraph multi-agent orchestration, ChromaDB, Groq\n- Built an AI-powered interview platform generating resume-aware questions and structured reports\nTECHNICAL SKILLS\nLanguages: C++, C, Python, Java\nAI/ML: Generative AI, LLMs, RAG, Agentic AI\nACHIEVEMENTS\n- Selected for Amazon ML Summer School 2026\n- Solved 400+ DSA problems on LeetCode`
  it('the measured canon exists as data with conventions', () => {
    expect(canonConventions().length).toBeGreaterThanOrEqual(6)
  })
  it('"study this résumé: …" stores a sample (shape measured), and the strategist prompt cites it', async () => {
    const p = parseGlobal(`study this résumé: ${SAMPLE}`, ctx())
    expect(p?.proposals[0]?.op.kind).toBe('add-sample')
    await executeGlobalOp(p!.proposals[0].op)
    const all = await listSamples()
    expect(all.length).toBe(1)
    expect(all[0].shape).toMatch(/EDUCATION/)
    expect(shapeOf(SAMPLE)).toMatch(/bullets/)
    const prompt = await canonForPrompt()
    expect(prompt).toMatch(/THE CANON/)
    expect(prompt).toMatch(/HIS OWN REFERENCE/)
    expect(prompt).toMatch(/Amazon ML Summer School/)
    await addSample(SAMPLE)
    expect((await listSamples()).length).toBe(2)
  })
})

describe('the letter opens on what THEY said they care about', () => {
  it('Babaclick: the first paragraph quotes their values and names one proof', () => {
    const jd = 'We care enormously about: logical reasoning · intellectual honesty · personal agency. We do not care about: certificates. Python, React.'
    const job = fakeJob('Babaclick', 'Growth Intern', jd)
    const reading = readPostingHeuristic(jd, 'Babaclick', 'Growth Intern')
    const decode = decodeJD(jd)
    const coverage = matchEvidence(decode, SEED_LEDGER)
    const letter = composeLetter({ job, identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, useSignature: false, reading })
    expect(letter.paragraphs[0].text).toMatch(/you wrote that you care about logical reasoning/i)
    expect(letter.paragraphs[0].text).toMatch(/is my proof/)
    expect(letter.paragraphs[0].ledgerIds.length).toBeGreaterThan(0)
  })
})
