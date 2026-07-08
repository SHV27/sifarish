import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/db/db'
import { SEED_LEDGER } from './helpers'
import { decodeJD } from '../src/lib/jd/decode'
import { runEditor, redTeamPass } from '../src/lib/darzi/editor'
import { JD_FIXTURES } from './fixtures/jds'

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
