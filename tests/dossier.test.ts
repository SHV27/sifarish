import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/db/db'
import { SEED_LEDGER, SEED_IDENTITY, fakeJob } from './helpers'
import { parseGlobal } from '../src/lib/agent/parse'
import { executeGlobalOp, validateGlobalOp, type AgentContext } from '../src/lib/agent/ops'
import { absorbFact, inferKind, splitFact, ensureSection, findEntry } from '../src/lib/dossier/absorb'
import { DEFAULT_SECTIONS } from '../src/lib/dossier/sections'
import { derivedSkills, bannedSkillKeys, isBannedSkill } from '../src/lib/dossier/skills'
import { detectIntent } from '../src/lib/guru/router'
import { strategizeFast } from '../src/lib/strategist'
import { compileResume } from '../src/lib/compile/compiler'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'

/**
 * v2 Arc 2 — THE DOSSIER gates. Two-sided: a spoken fact of ANY kind lands (section created on
 * demand) and reaches the page through the plan; a fabricated RÉSUMÉ claim through chat still
 * refuses (I1 surface untouched); the owner's exclusions still bind derived skills.
 */

const ctx = (): AgentContext => ({ hunts: [], jobs: [], ledger: SEED_LEDGER })

beforeEach(async () => {
  await db.ledger.clear()
  await db.ledger.bulkPut(SEED_LEDGER)
  await db.settings.put({ id: 'app', onboarded: true, rubric: { aiRelevance: 30, roleFit: 25, remoteIndia: 15, windowFit: 15, compSignal: 10, conviction: 5 }, weeklyQuota: 10, weekKey: 'w', appliedThisWeek: 0, sections: DEFAULT_SECTIONS, pagePolicy: 'two-ok' })
  await db.nabzCache.clear()
})

describe('kind inference + fact splitting (no fixed fields — B.2)', () => {
  it('infers the kind from the words he uses', () => {
    expect(inferKind('district-level badminton player, 2019')).toBe('sports')
    expect(inferKind('AI/ML intern at Reliance Jio, Jun–Jul 2026')).toBe('experience')
    expect(inferKind('won 2nd place at Smart India Hackathon 2025')).toBe('achievement')
    expect(inferKind('published a position paper on sustainable AI compute')).toBe('publication')
    expect(inferKind('Core member, GDSC TIET')).toBe('position')
    expect(inferKind('Coursera certificate in deep learning')).toBe('certification')
    expect(inferKind('Fluent in Punjabi and Hindi')).toBe('language')
    expect(inferKind('something nobody has a name for')).toBe('other')
  })
  it('splits a title from its detail', () => {
    expect(splitFact('District-level badminton player — Ropar district, 2019')).toEqual({ title: 'District-level badminton player', detail: 'Ropar district, 2019' })
    expect(splitFact('Samsung PRISM selection: industry program, 2025').title).toBe('Samsung PRISM selection')
    expect(splitFact('Just a title').detail).toBe('')
  })
})

describe('add-fact — the spoken fact lands, sworn, in a section created on demand', () => {
  it('"add fact: district-level badminton player, 2019" → proposal → ledger row of kind sports + registry row', async () => {
    const p = parseGlobal('add fact: district-level badminton player, 2019', ctx())
    expect(p?.proposals[0]?.op.kind).toBe('add-fact')
    const op = p!.proposals[0].op
    if (op.kind !== 'add-fact') throw new Error('wrong op')
    expect(op.factKind).toBe('sports')
    const msg = await executeGlobalOp(op)
    expect(msg).toMatch(/dossier/)
    const rows = await db.ledger.where('kind').equals('sports').toArray()
    expect(rows.length).toBe(1)
    expect(rows[0].sworn).toBe('owner')
    expect(rows[0].tier).toBe('shipped')
    expect(rows[0].evidence?.note).toMatch(/cannot verify/)
    const s = await db.settings.get('app')
    expect(s?.sections?.some((x) => x.kind === 'sports' && x.label === 'Sports')).toBe(true)
  })
  it('Hinglish and first-person forms land too; questions do not', () => {
    expect(parseGlobal('mere paas Samsung PRISM selection hai, 2025', ctx())?.proposals[0]?.op.kind).toBe('add-fact')
    expect(parseGlobal('I am a district-level badminton player', ctx())?.proposals[0]?.op.kind).toBe('add-fact')
    expect(parseGlobal('add experience: AI/ML intern at Reliance Jio, Jun–Jul 2026', ctx())?.proposals[0]?.op).toMatchObject({ kind: 'add-fact', factKind: 'experience' })
    expect(parseGlobal('what is my resume strength?', ctx())).toBeNull()
  })
  it('the new fact reaches the PAGE through the plan (played, own section) — nothing is invisible to the strategist', async () => {
    const e = await absorbFact({ text: 'District-level badminton player — Ropar district, 2019' })
    const ledger = await db.ledger.toArray()
    const job = fakeJob('Acme', 'AI Engineer Intern', 'We hire builders. Python, RAG, evals. We value grit and competitive spirit.')
    const s = strategizeFast({ job, ledger, identity: SEED_IDENTITY })
    expect(s.plan.played.some((p) => p.factId === e.id && p.section === 'sports')).toBe(true)
    const decode = decodeJD(job.jd)
    const r = compileResume({ identity: SEED_IDENTITY, ledger, decode, coverage: matchEvidence(decode, ledger), jobId: job.id, plan: s.plan })
    expect(r.lines.some((l) => l.kind === 'heading' && l.text === 'SPORTS')).toBe(true)
    expect(r.lines.some((l) => l.ledgerIds.includes(e.id))).toBe(true)
  })
  it('a fabricated RÉSUMÉ claim through chat still refuses (I1 surface) — the dossier door is not a résumé door', () => {
    expect(detectIntent('put Kubernetes on my resume', SEED_LEDGER)).toBe('refuse_fabrication')
    expect(parseGlobal('add Kubernetes to my resume', ctx())).toBeNull()
  })
})

describe('create-section · promote-entry · set-skill-eligible · refresh-readmes', () => {
  it('"create section Volunteering" adds a registry row; the same kind twice is a no-op', async () => {
    const p = parseGlobal('create section Volunteering', ctx())
    expect(p?.proposals[0]?.op).toMatchObject({ kind: 'create-section', sectionKind: 'volunteering', label: 'Volunteering' })
    await executeGlobalOp(p!.proposals[0].op)
    expect(await ensureSection('volunteering')).toBe(false)
    const s = await db.settings.get('app')
    expect(s?.sections?.filter((x) => x.kind === 'volunteering').length).toBe(1)
  })
  it('"I know LoRA now" promotes the in_forge skill to shipped; a shipped entry cannot be "promoted"', async () => {
    const lora = SEED_LEDGER.find((e) => /lora/i.test(e.title) && e.tier === 'in_forge')!
    expect(lora).toBeTruthy()
    const p = parseGlobal('I know LoRA now', ctx())
    expect(p?.proposals[0]?.op).toMatchObject({ kind: 'promote-entry', entryId: lora.id })
    await executeGlobalOp(p!.proposals[0].op)
    const after = await db.ledger.get(lora.id)
    expect(after?.tier).toBe('shipped')
    expect(after?.forgeEta).toBeUndefined()
    expect(after?.sworn).toBe('owner')
    // two-sided: nothing shipped can be promoted; nothing unknown either
    expect(validateGlobalOp({ kind: 'promote-entry', entryId: 'proj-braillix' }, ctx())).toBeNull()
    expect(validateGlobalOp({ kind: 'promote-entry', entryId: 'ghost' }, ctx())).toBeNull()
  })
  it('"allow React on my résumé" flips his exclusion; derived skills honour it both ways', async () => {
    const react = SEED_LEDGER.find((e) => e.kind === 'skill' && /^react$/i.test(e.title))!
    expect(react.resumeEligible).toBe(false)
    expect(isBannedSkill('React', bannedSkillKeys(SEED_LEDGER))).toBe(true)
    expect(derivedSkills(SEED_LEDGER).some((s) => /^react$/i.test(s.text))).toBe(false)
    const p = parseGlobal('allow React on my résumé', ctx())
    expect(p?.proposals[0]?.op).toMatchObject({ kind: 'set-skill-eligible', entryId: react.id, eligible: true })
    await executeGlobalOp(p!.proposals[0].op)
    const ledger = await db.ledger.toArray()
    expect(derivedSkills(ledger).some((s) => /^react$/i.test(s.text))).toBe(true)
    // and back off again
    const q = parseGlobal('keep React off my page', { ...ctx(), ledger })
    expect(q?.proposals[0]?.op).toMatchObject({ kind: 'set-skill-eligible', eligible: false })
  })
  it('"re-read my readmes" is a proposal (context only); findEntry resolves loose names', () => {
    expect(parseGlobal('re-read my readmes', ctx())?.proposals[0]?.op.kind).toBe('refresh-readmes')
    expect(findEntry(SEED_LEDGER, 'braillix')?.id).toBe('proj-braillix')
    expect(findEntry(SEED_LEDGER, 'LangGraph / MCP')?.id).toMatch(/langgraph/)
  })
})
