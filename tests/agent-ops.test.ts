import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '../src/db/db'
import { validateGlobalOp, executeGlobalOp, type AgentContext } from '../src/lib/agent/ops'
import { parseGlobal } from '../src/lib/agent/parse'
import { looksActionish } from '../src/lib/agent/smart'
import { detectIntent } from '../src/lib/guru/router'
import type { Job, SavedHunt, VisionProfile } from '../src/types'

/**
 * EK BAAT gates (re-brief Pillar 1) — the global op registry: one vocabulary, validated
 * against real state, executed through the existing single doors. Two-sided honesty on the
 * router boundary: resume-fabrication still refuses; ledger-adds propose.
 */

const vision: VisionProfile = {
  dream: 'agentic AI',
  targetRoles: ['AI Engineer Intern'],
  notInterested: ['Pure frontend'],
  compFloorStipend: 35000,
  ppoFloorLpa: 16,
  windowStart: 'Jan 2027',
  windowEnd: 'May 2027',
  remoteInternational: true,
  openToOctoberStart: true,
}
const hunts: SavedHunt[] = [{ id: 'h1', query: 'RAG engineer intern', remoteOnly: true, datePosted: 'week', enabled: true }]
const jobs: Job[] = [
  { id: 'j1', source: 'greenhouse', company: 'Netomi', title: 'AI Engineer', location: 'Remote', url: 'https://x', jd: '', fetchedAt: '2026-08-30', status: 'tailored' },
]
const ctx: AgentContext = { hunts, jobs, vision }

describe('deterministic parser — the keyless core (English + Hinglish cues)', () => {
  it('ledger adds', () => {
    expect(parseGlobal('add achievement: Won Smart India Hackathon 2026', ctx)?.proposals[0].op).toMatchObject({ kind: 'add-entry', entryKind: 'achievement' })
    expect(parseGlobal('skill jodo: LangGraph', ctx)?.proposals[0].op).toMatchObject({ kind: 'add-entry', entryKind: 'skill', title: 'LangGraph' })
    expect(parseGlobal('add cert - AWS Cloud Practitioner', ctx)?.proposals[0].op).toMatchObject({ kind: 'add-entry', entryKind: 'certification' })
  })
  it('mark applied — fuzzy company match into the real pipeline', () => {
    const p = parseGlobal('mark Netomi as applied', ctx)!
    expect(p.proposals[0].op).toMatchObject({ kind: 'mark-applied', jobId: 'j1' })
    expect(parseGlobal('netomi pe apply kar diya', ctx)?.proposals[0].op).toMatchObject({ kind: 'mark-applied', jobId: 'j1' })
    // Unknown company: an honest miss, never a wrong stamp.
    const miss = parseGlobal('mark Google as applied', ctx)!
    expect(miss.proposals).toHaveLength(0)
    expect(miss.reply).toContain("couldn't find")
  })
  it('hunts + vision + navigation', () => {
    expect(parseGlobal('hunt for agentic AI engineer Europe', ctx)?.proposals[0].op).toMatchObject({ kind: 'add-hunt' })
    expect(parseGlobal('pause hunt RAG engineer intern', ctx)?.proposals[0].op).toMatchObject({ kind: 'toggle-hunt', huntId: 'h1', enabled: false })
    expect(parseGlobal('add "LLM Platform Engineer" to my target roles', ctx)?.proposals[0].op).toMatchObject({ kind: 'vision-add-role' })
    expect(parseGlobal('not interested in devops', ctx)?.proposals[0].op).toMatchObject({ kind: 'vision-add-avoid', term: 'devops' })
    expect(parseGlobal('open radar', ctx)?.proposals[0].op).toMatchObject({ kind: 'navigate', screen: 'radar' })
    expect(parseGlobal('morcha kholo', ctx)?.proposals[0].op).toMatchObject({ kind: 'navigate', screen: 'morcha' })
  })
  it('questions never parse as ops', () => {
    expect(parseGlobal('why is my hunt not finding anything', ctx)).toBeNull()
    expect(parseGlobal('kya main data science try karun?', ctx)).toBeNull()
  })
})

describe('registry validation — the schema shapes, the data authorizes', () => {
  it('rejects unknown kinds, bad ids, no-op toggles, duplicates', () => {
    expect(validateGlobalOp({ kind: 'delete-everything' }, ctx)).toBeNull()
    expect(validateGlobalOp({ kind: 'toggle-hunt', huntId: 'nope', enabled: false }, ctx)).toBeNull()
    expect(validateGlobalOp({ kind: 'toggle-hunt', huntId: 'h1', enabled: true }, ctx)).toBeNull() // already enabled
    expect(validateGlobalOp({ kind: 'add-hunt', query: 'RAG engineer intern' }, ctx)).toBeNull() // dupe
    expect(validateGlobalOp({ kind: 'vision-add-role', role: 'AI Engineer Intern' }, ctx)).toBeNull() // already there
    expect(validateGlobalOp({ kind: 'mark-applied', jobId: 'zz' }, ctx)).toBeNull()
    expect(validateGlobalOp({ kind: 'navigate', screen: 'admin' }, ctx)).toBeNull()
    expect(validateGlobalOp({ kind: 'add-entry', entryKind: 'project', title: 'X' }, ctx)).toBeNull() // projects come via Nabz, not chat
  })
})

describe('execution — through the existing single doors', () => {
  beforeEach(async () => {
    await db.jobs.clear()
    await db.ledger.clear()
    await db.settings.clear()
    await db.savedHunts.clear()
    await db.settings.put({ id: 'app', onboarded: true, rubric: { aiRelevance: 30, roleFit: 25, remoteIndia: 15, windowFit: 15, compSignal: 10, conviction: 5 }, weeklyQuota: 10, weekKey: '2026-W35', appliedThisWeek: 0, visionProfile: vision } as never)
  })

  it('add-entry mirrors the Shelf Quick-add shape exactly (shipped, dated, evidence note)', async () => {
    await executeGlobalOp({ kind: 'add-entry', entryKind: 'achievement', title: 'Won X', detail: 'note' })
    const rows = await db.ledger.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'achievement', tier: 'shipped', resumeEligible: true })
    expect(rows[0].evidence?.date).toMatch(/^\d{2}\/\d{4}$/)
  })
  it('mark-applied goes through the ONE markApplied door (appliedAt + weekly counter)', async () => {
    await db.jobs.put(jobs[0])
    await executeGlobalOp({ kind: 'mark-applied', jobId: 'j1' })
    const j = await db.jobs.get('j1')
    expect(j?.status).toBe('applied')
    expect(j?.appliedAt).toBeTruthy()
    expect((await db.settings.get('app'))?.appliedThisWeek).toBe(1)
  })
  it('vision edit persists and leaves hand-set state intact', async () => {
    await executeGlobalOp({ kind: 'vision-add-avoid', term: 'devops' })
    const v = (await db.settings.get('app'))?.visionProfile
    expect(v?.notInterested).toContain('devops')
    expect(v?.targetRoles).toEqual(vision.targetRoles)
  })
})

describe('two-sided honesty at the router boundary', () => {
  it('resume-fabrication still REFUSES (both phrasings)', () => {
    expect(detectIntent('add kubernetes to my resume', [])).toBe('refuse_fabrication')
    expect(detectIntent('say i know rust in the interview', [])).toBe('refuse_fabrication')
  })
  it('a plain ledger-add falls through to the op lanes (freeform), never a false refusal', () => {
    expect(detectIntent('add skill kubernetes', [])).toBe('freeform')
    expect(detectIntent('add achievement: won the IIT Ropar hackathon', [])).toBe('freeform')
  })
  it('guarantee-bait outranks everything, still', () => {
    expect(detectIntent('add a hunt and guarantee me a job offer', [])).toBe('refuse_guarantee')
  })
  it('actionish detector: actions yes, questions no', () => {
    expect(looksActionish('remove pure frontend from my vision')).toBe(true)
    expect(looksActionish('how are you')).toBe(false)
  })
})
