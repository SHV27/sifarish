import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { db } from '../src/db/db'
import { setJobStatus, markApplied, nudgeState } from '../src/lib/morcha'
import { recordUsage } from '../src/lib/dimaag/core'
import { buildApplyPlan } from '../src/lib/guru/applyPlan'
import { parseLetterUtterance } from '../src/lib/atelier/baithak'
import { getIntel } from '../src/lib/intel/client'
import { SEED_IDENTITY, SEED_LEDGER, fakeJob, compilePacketPure } from './helpers'
import { monthKey } from '../src/lib/budget'
import type { LedgerEntry, VisionProfile } from '../src/types'

/**
 * Session 7.2 "The Sanad" — WS-C gates: honest meters, no dead ends, ONE copy of every rule.
 */

const VISION: VisionProfile = {
  dream: 'Direct AI to build what one person alone never could.',
  targetRoles: ['Agentic AI Engineer'],
  notInterested: [],
  compFloorStipend: 20000,
  ppoFloorLpa: 16,
  windowStart: 'Feb 2027',
  windowEnd: 'Jun 2027',
  remoteInternational: true,
  openToOctoberStart: false,
}

describe('C1 — the Groq meter is honest; the ledger names WHICH brain answered', () => {
  it('streamGuru and both polish paths gate on the groq budget and record spend (source gates)', () => {
    const guru = readFileSync('src/lib/guru/client.ts', 'utf8')
    expect(guru).toContain("allowedThisRun('groq')")
    expect(guru).toContain("recordSpend('groq', 1)")
    const polish = readFileSync('src/lib/polish/client.ts', 'utf8')
    expect(polish.match(/allowedThisRun\('groq'\)/g)?.length).toBeGreaterThanOrEqual(2)
    expect(polish.match(/recordSpend\('groq', 1\)/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('recordUsage stores per-model call counts', async () => {
    const feature = `test.models.${Date.now()}`
    await recordUsage(feature, 'reasoning', 'call', 100, 'gemini-3-flash-preview')
    await recordUsage(feature, 'reasoning', 'call', 100, 'gemini-3-flash-preview')
    await recordUsage(feature, 'reasoning', 'call', 100, 'openai/gpt-oss-120b')
    const row = await db.dimaagUsage.get(`${feature}:${monthKey()}`)
    expect(row?.models?.['gemini-3-flash-preview']).toBe(2)
    expect(row?.models?.['openai/gpt-oss-120b']).toBe(1)
  })

  it('Settings knows every live provider key (Gemini + Adzuna finally listed)', () => {
    const s = readFileSync('src/screens/SettingsScreen.tsx', 'utf8')
    expect(s).toContain('GEMINI_API_KEY')
    expect(s).toContain('ADZUNA_APP_ID')
  })
})

describe('C2 — "Mark applied" marks applied, from EVERY door', () => {
  beforeEach(async () => {
    await db.jobs.clear()
    const existing = await db.settings.get('app')
    await db.settings.put({ ...(existing ?? { id: 'app', onboarded: true }), id: 'app', appliedThisWeek: 0 } as never)
  })

  it('setJobStatus(applied) stamps appliedAt + the weekly counter (the Morcha board path)', async () => {
    const job = { ...fakeJob('AppliedCo', 'AI Engineer', 'Python'), status: 'tailored' as const }
    await db.jobs.put(job)
    await setJobStatus(job.id, 'applied')
    const after = (await db.jobs.get(job.id))!
    expect(after.status).toBe('applied')
    expect(after.appliedAt, 'appliedAt must stamp — nudges/counters hang off it').toBeTruthy()
    expect(nudgeState(after).due).toBe(false) // day 0 — but the MATH now has a date to work with
    const s = await db.settings.get('app')
    expect(s?.appliedThisWeek).toBe(1)
  })

  it('walking a card back and forward keeps the ORIGINAL applied date (re-entry is not a new application)', async () => {
    const job = { ...fakeJob('BackCo', 'AI Engineer', 'Python'), status: 'tailored' as const }
    await db.jobs.put(job)
    await markApplied(job.id)
    const stamp = (await db.jobs.get(job.id))!.appliedAt
    await setJobStatus(job.id, 'ghosted')
    await setJobStatus(job.id, 'applied') // PREV walk-back
    const after = (await db.jobs.get(job.id))!
    expect(after.appliedAt).toBe(stamp)
    expect((await db.settings.get('app'))?.appliedThisWeek).toBe(1) // not double-counted
  })
})

describe('C3 — Guru remembers; citations survive the LLM voice (source gates)', () => {
  const guru = readFileSync('src/screens/Guru.tsx', 'utf8')
  it('the thread persists to db.guruThreads and restores on mount', () => {
    expect(guru).toContain('db.guruThreads.put')
    expect(guru).toContain('db.guruThreads.get')
  })
  it('citations ride along on BOTH reply paths (I7)', () => {
    expect(guru).toContain('citations: routed.citations')
    expect(guru).not.toContain('citations: finalText ? undefined')
  })
  it('the greeting reads the live identity — no hardcoded Namaste Shaurya (C7)', () => {
    expect(guru).not.toContain('Namaste Shaurya')
    expect(guru).toContain('greetingFor')
  })
})

describe('C4 — the letter Baithak shares the ONE evidence rule', () => {
  it('a fact from his own summary/README context is genuine on the letter surface too', () => {
    const entry: LedgerEntry = {
      ...(SEED_LEDGER.find((e) => e.kind === 'project' && e.tier === 'shipped') as LedgerEntry),
      id: 'proj-evi',
      title: 'GLOAM — a game',
      summary: 'A co-op board game with a Rust-powered physics core.',
      bullets: [{ id: 'b-e1', text: 'Built a browser co-op board game', keywords: ['game'] }],
      tags: ['game'],
    }
    const job = fakeJob('EviCo', 'AI Engineer', 'Python')
    const packet = compilePacketPure(job, [...SEED_LEDGER, entry])
    // "rust" lives ONLY in the entry summary — the old private hasEvidence searched
    // title/tags/bullets and would refuse it as a fabrication.
    const r = parseLetterUtterance('add that i know rust', packet, [...SEED_LEDGER, entry])
    expect(r.refused, 'a term he wrote about his own project must not be refused').toBeUndefined()
  })

  it('an unevidenced term still dies (the guard was widened, never loosened)', () => {
    const job = fakeJob('EviCo2', 'AI Engineer', 'Python')
    const packet = compilePacketPure(job)
    const r = parseLetterUtterance('add that i know kubernetes', packet, SEED_LEDGER)
    expect(r.refused).toBeDefined()
  })

  it('the private copy is gone (source gate)', () => {
    const src = readFileSync('src/lib/atelier/baithak.ts', 'utf8')
    expect(src).toContain("import { hasEvidence } from '../baithak/intent'")
    expect(src).not.toMatch(/function hasEvidence/)
  })
})

describe('C7 — drafted facts read the LIVE vision + identity', () => {
  const job = fakeJob('PlanCo', 'AI Engineer', 'Python, LLM.')
  it('the screening window answer follows the vision', () => {
    const plan = buildApplyPlan(job, undefined, SEED_LEDGER, { vision: VISION, identity: SEED_IDENTITY })
    const availability = plan.screeningAnswers.find((a) => /available/i.test(a.q))
    expect(availability?.a).toContain('Feb 2027–Jun 2027')
    expect(availability?.a).not.toContain('January–May 2027')
    expect(availability?.a).not.toContain('open to an October start') // vision says false
  })
  it('without a vision the safe defaults stand (backward compatible)', () => {
    const plan = buildApplyPlan(job, undefined, SEED_LEDGER)
    const availability = plan.screeningAnswers.find((a) => /available/i.test(a.q))
    expect(availability?.a).toContain('January–May 2027')
  })
  it('the export filename in the plan follows the identity, not a hardcode', () => {
    const arjun = { ...SEED_IDENTITY, name: 'Arjun Mehta' }
    const packet = compilePacketPure(job)
    const plan = buildApplyPlan(job, packet, SEED_LEDGER, { identity: arjun })
    expect(plan.steps.find((s) => /Attach/i.test(s.action))?.detail).toContain('Arjun_Mehta_Resume_')
  })
})

describe('C8/C9/C10/C11 — source gates for the wiring fixes', () => {
  it('C8: probeAlive routes his repos through /api/gh; the proxy has a repo probe', () => {
    const ex = readFileSync('src/lib/baithak/execute.ts', 'utf8')
    expect(ex).toContain('/api/gh?kind=repo')
    const gh = readFileSync('api/gh.ts', 'utf8')
    expect(gh).toContain("kind === 'repo'")
  })
  it('C9: an expired Gmail token surfaces as its own state, never "nothing new"', () => {
    const watch = readFileSync('src/lib/dak/watch.ts', 'utf8')
    expect(watch).toContain('GmailAuthError')
    expect(watch).toContain('authExpired: true')
    const panel = readFileSync('src/components/DakPanel.tsx', 'utf8')
    expect(panel).toContain('sweep.authExpired')
    expect(panel).toContain('Reconnect')
  })
  it('C10: lastReforgeAt stamps only when something actually upgraded (both writers)', () => {
    const banner = readFileSync('src/components/RepairBanner.tsx', 'utf8')
    expect(banner).toMatch(/if \(upgraded > 0\) await db\.settings\.update\('app', \{ lastReforgeAt/)
    const nabz = readFileSync('src/components/NabzPanel.tsx', 'utf8')
    expect(nabz).toMatch(/if \(fixed - degraded > 0\) await db\.settings\.update\('app', \{ lastReforgeAt/)
  })
  it('C11: onboarding honors the first-packet handoff (the L7 promise)', () => {
    const ob = readFileSync('src/screens/Onboarding.tsx', 'utf8')
    expect(ob).not.toContain('void onDone')
    expect(ob).toContain('onDone(first.id)')
  })
  it('C6: every declared Guru action executes (open_radar has legs)', () => {
    const guru = readFileSync('src/screens/Guru.tsx', 'utf8')
    expect(guru).toContain("routed.action === 'open_radar'")
    expect(guru).toContain("onNav?.('radar')")
  })
})

describe('C12 — the small lies, swept', () => {
  it('forceAddRepo is deleted (dead code lies — D125\'s own rule)', () => {
    const gh = readFileSync('src/lib/nabz/github.ts', 'utf8')
    expect(gh).not.toContain('export async function forceAddRepo')
  })
  it('no stale provider copy survives (the D144 router is the truth)', () => {
    expect(readFileSync('src/components/Why.tsx', 'utf8')).not.toContain('(gpt-oss-120b)')
    expect(readFileSync('src/lib/dimaag/health.ts', 'utf8')).not.toContain('check the Groq key,')
  })
  it('a keyless intel result leaves a short tombstone — no re-POST per buildPacket', async () => {
    await db.intel.clear()
    const calls: string[] = []
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (url: RequestInfo | URL) => {
      calls.push(String(url))
      return { ok: true, json: async () => ({ keyless: true, bullets: [] }) } as Response
    })
    try {
      await getIntel('TombstoneCo')
      await getIntel('TombstoneCo')
      expect(calls.filter((u) => u.includes('/api/intel')).length).toBe(1)
    } finally {
      vi.stubGlobal('fetch', realFetch)
      await db.intel.clear()
    }
  })
  it('the infra tables prune (kv.pruneAll wired from autopilot — Closure W3 widened C12)', () => {
    expect(readFileSync('src/lib/autopilot.ts', 'utf8')).toContain('pruneAll()')
    const kv = readFileSync('src/lib/kv.ts', 'utf8')
    expect(kv).toContain('dimaagCache')
    expect(kv).toContain('bulkDelete')
  })
  it('Guru\'s pulse digest filters dismissed proposals', () => {
    const g = readFileSync('src/lib/guru/client.ts', 'utf8')
    expect(g).toContain("p.status !== 'dismissed'")
  })
  it('the follow-up draft is reachable outside the nudge window; Retro links to Taleem', () => {
    const m = readFileSync('src/screens/Morcha.tsx', 'utf8')
    expect(m).toMatch(/\(job\.status === 'applied' \|\| job\.status === 'followup'\) &&[\s\S]{0,1600}copy draft/)
    expect(m).toContain('onOpenKhabri')
  })
})
