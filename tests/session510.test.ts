import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/db/db'
import { reconcileClosures } from '../src/lib/radar/feeds'
import { proposeHuntEdits } from '../src/lib/khabri/client'
import { acceptPulse } from '../src/lib/pulse/client'
import { buildBriefing } from '../src/lib/briefing'
import { deriveHunts } from '../src/lib/vision/derive'
import { fakeJob, SEED_LEDGER } from './helpers'
import type { Job, Settings, VisionProfile } from '../src/types'
import { DEFAULT_RUBRIC } from '../src/lib/radar/rubric'

/**
 * Session 5.10 — closed postings leave the queue, dormant boards are visible, and the Pulse
 * proposes hunt RETIREMENTS when the vision changes (the other half of D99; closes D68).
 */

// ---------- 1 · Closed postings ----------

describe('reconcileClosures — "jisne hiring band kar di wo company na aaye"', () => {
  const known: Pick<Job, 'id' | 'status' | 'closed'>[] = [
    { id: 'lever:netomi:a', status: 'found', closed: false },
    { id: 'lever:netomi:b', status: 'found', closed: false },
    { id: 'lever:netomi:c', status: 'applied', closed: false }, // his pipeline record
    { id: 'lever:netomi:d', status: 'found', closed: true }, // was closed, board relisted it
    { id: 'ashby:kantiv:x', status: 'found', closed: false }, // different board — untouched
  ]

  it('a posting the board no longer lists is closed; a relisted one reopens', () => {
    const r = reconcileClosures(known, ['lever:netomi:a', 'lever:netomi:d'], 'lever:netomi:')
    expect(r.close).toEqual(['lever:netomi:b'])
    expect(r.reopen).toEqual(['lever:netomi:d'])
  })

  it('pipeline statuses are HIS record — a scan never closes an applied job', () => {
    const r = reconcileClosures(known, [], 'lever:netomi:')
    expect(r.close).not.toContain('lever:netomi:c')
  })

  it('another board’s scan cannot close this board’s postings', () => {
    const r = reconcileClosures(known, [], 'lever:netomi:')
    expect(r.close).not.toContain('ashby:kantiv:x')
  })
})

describe('a closed posting cannot occupy a slot anywhere', () => {
  const settings = { rubric: DEFAULT_RUBRIC, visionProfile: undefined } as unknown as Settings

  it('the briefing never surfaces a closed role', () => {
    const open = { ...fakeJob('OpenCo', 'AI Engineer', 'LLM agents RAG Python'), updatedAt: new Date().toISOString() }
    const closed = { ...fakeJob('ClosedCo', 'AI Engineer', 'LLM agents RAG Python'), closed: true, updatedAt: new Date().toISOString() }
    const b = buildBriefing([open, closed], SEED_LEDGER, settings)
    expect(b.topMatches.some((m) => m.job.company === 'ClosedCo')).toBe(false)
    expect(b.topMatches.some((m) => m.job.company === 'OpenCo')).toBe(true)
  })

  it('the Radar queue filter excludes closed (source gate on the one eligibility line)', () => {
    const radar = require('node:fs').readFileSync('src/screens/Radar.tsx', 'utf8')
    expect(radar).toMatch(/j\.status === 'found' && !j\.closed/)
  })
})

// ---------- 2 · Pulse proposes hunt retirements on vision change ----------

const VISION_A: VisionProfile = {
  dream: 'Agentic AI engineer building LLM agents and RAG.',
  targetRoles: ['Agentic AI Engineer', 'LLM Engineer'],
  notInterested: [],
  compFloorStipend: 35000,
  ppoFloorLpa: 16,
  windowStart: 'Jan 2027',
  windowEnd: 'May 2027',
  remoteInternational: true,
  openToOctoberStart: true,
}

describe('proposeHuntEdits — the vision retires what it no longer implies (human-confirmed)', () => {
  beforeEach(async () => {
    await db.savedHunts.clear()
    await db.pulse.clear()
  })

  it('a derived hunt the current vision no longer implies becomes a retirement proposal', async () => {
    await db.savedHunts.put({ id: 'vh-old-lane', query: 'blockchain ML engineer', remoteOnly: true, datePosted: 'week', enabled: true, derived: true })
    const n = await proposeHuntEdits(VISION_A)
    expect(n).toBe(1)
    const brief = await db.pulse.get('pulse-huntedit-vh-old-lane')
    expect(brief?.proposedHuntRemoval?.huntId).toBe('vh-old-lane')
    expect(brief?.status).toBe('pending')
  })

  it('a hunt he set or touched by hand is NEVER proposed (D59/D88)', async () => {
    await db.savedHunts.put({ id: 'h-manual', query: 'quantum annealing intern', remoteOnly: true, datePosted: 'week', enabled: true })
    await db.savedHunts.put({ id: 'vh-owner-touched', query: 'robotics perception', remoteOnly: true, datePosted: 'today', enabled: true, derived: true, ownerSetDate: true })
    expect(await proposeHuntEdits(VISION_A)).toBe(0)
    expect(await db.pulse.count()).toBe(0)
  })

  it('a derived hunt the vision STILL implies is left alone', async () => {
    const implied = deriveHunts(VISION_A)[0]
    await db.savedHunts.put({ id: 'vh-still-good', query: implied.query, remoteOnly: implied.remoteOnly, datePosted: 'week', enabled: true, derived: true })
    expect(await proposeHuntEdits(VISION_A)).toBe(0)
  })

  it('proposed once — his accept/dismiss stands, repeat vision edits add nothing', async () => {
    await db.savedHunts.put({ id: 'vh-old-lane', query: 'blockchain ML engineer', remoteOnly: true, datePosted: 'week', enabled: true, derived: true })
    await proposeHuntEdits(VISION_A)
    await db.pulse.update('pulse-huntedit-vh-old-lane', { status: 'dismissed' })
    expect(await proposeHuntEdits(VISION_A)).toBe(0)
    expect((await db.pulse.get('pulse-huntedit-vh-old-lane'))?.status).toBe('dismissed')
  })

  it('accepting the retirement DISABLES the hunt — never deletes it', async () => {
    await db.savedHunts.put({ id: 'vh-old-lane', query: 'blockchain ML engineer', remoteOnly: true, datePosted: 'week', enabled: true, derived: true })
    await proposeHuntEdits(VISION_A)
    const brief = (await db.pulse.get('pulse-huntedit-vh-old-lane'))!
    await acceptPulse(brief)
    const h = await db.savedHunts.get('vh-old-lane')
    expect(h).toBeDefined()
    expect(h!.enabled).toBe(false)
    expect(h!.ownerSetDate).toBe(true) // his confirmed choice — no future sync flips it back
    expect((await db.pulse.get('pulse-huntedit-vh-old-lane'))?.status).toBe('accepted')
  })

  it('the vision-edit path in Settings fires both halves (source gate)', () => {
    const s = require('node:fs').readFileSync('src/screens/SettingsScreen.tsx', 'utf8')
    expect(s).toMatch(/syncVisionHunts\(next\)\s*\n?\s*\.then\(\(\) => proposeHuntEdits\(next\)\)/)
  })
})

// ---------- 3 · Context-audit fixes: what was gathered must reach the model ----------

describe('payload boundary (S5.10 context audit) — truncation can no longer eat the truth', () => {
  const read = (p: string) => require('node:fs').readFileSync(p, 'utf8') as string

  it('the dimaag server system cap fits the Baithak (16k, was 8k)', () => {
    expect(read('api/dimaag.ts')).toMatch(/body\.system\.slice\(0, 16000\)/)
  })

  it("the Baithak's ledger digest sits ABOVE the resume echo — truncation cuts the echo, never the ids", () => {
    const smart = read('src/lib/baithak/smart.ts')
    const ledgerAt = smart.indexOf('LEDGER (the ONLY source of truth')
    const resumeAt = smart.indexOf('THE RESUME AS IT STANDS RIGHT NOW')
    expect(ledgerAt).toBeGreaterThan(0)
    expect(resumeAt).toBeGreaterThan(0)
    expect(ledgerAt).toBeLessThan(resumeAt)
  })

  it('archetypePass puts keywords + intel BEFORE the JD so a long JD cannot push them off', () => {
    expect(read('src/lib/darzi/editor.ts')).toMatch(/`Keywords: \$\{decode\.mustHave\.join\(', '\)\}\\n\\nCompany intel: \$\{intelText\}\\n\\n\$\{jd\}`/)
  })

  it('decide() serializes craft BEFORE evidence — the evidence tail is the sacrificial field', () => {
    const core = read('src/lib/dimaag/core.ts')
    const block = core.slice(core.indexOf('const user = JSON.stringify'), core.indexOf('const call = await callDimaag'))
    expect(block.indexOf('craft: input.craft')).toBeLessThan(block.indexOf('evidence: input.evidence'))
  })

  it('api/polish uses json_schema (the last json_object call site is gone — D74 everywhere)', () => {
    const polish = read('api/polish.ts')
    expect(polish).not.toMatch(/type: 'json_object'/)
    expect(polish).toMatch(/type: 'json_schema'/)
    // and no prose shape instruction fighting the schema (D79)
    expect(polish).not.toMatch(/Return a JSON object/)
  })

  it('the reframer can see what it reframes toward (problem line, context-only)', () => {
    expect(read('src/lib/polish/reframe.ts')).toMatch(/entry\.context\?\.problem \? `What it attacks/)
  })
})
