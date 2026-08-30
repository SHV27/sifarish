import Dexie from 'dexie'
import { db, withSeedAllowance } from './db'
// A fresh DEMO store is seeded with the FICTIONAL persona (statically imported — it is public,
// PII-free, and small). The OWNER store is seeded from the real seed, DYNAMICALLY imported only
// in owner mode so a demo visitor never downloads it.
import demoSeed from '../../seed/demo.seed.json'
import type { Identity, LedgerEntry, Settings, VisionProfile, VoiceBank } from '../types'
import { DEFAULT_RUBRIC } from '../lib/radar/rubric'
import { WATCHLIST_SEED, WATCHLIST_ADDITIONS_V58 } from '../lib/radar/watchlist.seed'
import { SEED_HUNTS, migrateHuntFreshness } from '../lib/khabri/client'
import { BUDGET_DEFAULTS, monthKey } from '../lib/budget'
import { getMode } from '../lib/pehchaan'
import { assessEligibility } from '../lib/khabri/eligibility'

export const DEFAULT_VISION: VisionProfile = {
  // FINAL-BAR (30-Aug-2026) — the owner's heart-statement, dictated verbatim-close in the founder
  // channel. This text DRIVES ranking, hunts, headline voice, and letters; edit it and everything
  // re-derives.
  dream:
    'Understand a real problem deeply, then direct AI to build the thing that solves it — and ship it. ' +
    'Building agents, RAG, orchestration, evals, guardrails — production systems, not model training. ' +
    'Small teams with end-to-end ownership, ambiguity as normal, variety over grinding one narrow thing; ' +
    'work that visibly helps actual people. Not a generic candidate — someone who finds the real problem ' +
    'and ships the thing that solves it. The long arc: build my own things, so judgement, ownership and ' +
    'range beat a bigger title.',
  targetRoles: [
    'AI Engineer',
    'Agentic AI Engineer',
    'AI Agent Engineer',
    'Applied AI Engineer',
    'LLM Systems Engineer',
    'AI Solutions Architect',
    'Forward Deployed Engineer',
    'AI Engineer Intern',
  ],
  notInterested: [
    'DSA-gated pure SDE',
    'Frontend-heavy',
    'SQL / data-pipeline work',
    'Research / thesis-style positions',
    'Generic SDE / mass-MNC roles',
    'Non-AI QA/support',
  ],
  compFloorStipend: 35000,
  ppoFloorLpa: 16,
  windowStart: 'Jan 2027',
  windowEnd: 'May 2027',
  remoteInternational: true,
  openToOctoberStart: true,
  // Re-brief Pillar 3 (Haq filter): India-based, no foreign work authorization — a role that
  // provably needs authorization outside this list never surfaces (VISION-BRIEF law).
  workAuth: { home: 'india', authorizedIn: ['india'], remoteOk: true },
}

export function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function freshSettings(): Settings {
  return {
    id: 'app',
    onboarded: false,
    rubric: DEFAULT_RUBRIC,
    weeklyQuota: 10,
    weekKey: isoWeekKey(),
    appliedThisWeek: 0,
    visionProfile: DEFAULT_VISION,
    rubricChangelog: [{ at: new Date().toISOString(), summary: 'Initial rubric (v1 defaults).' }],
  }
}

/** Resolve the seed for the ACTIVE vault: owner store → real seed (lazy), demo store → demo persona. */
async function seedForActiveStore(): Promise<{ entries: LedgerEntry[]; identity: Identity; voice: VoiceBank }> {
  if (getMode() === 'owner') {
    const { OWNER_SEED } = await import('./ownerSeed')
    return { entries: OWNER_SEED.entries, identity: OWNER_SEED.identity, voice: OWNER_SEED.voice }
  }
  return {
    entries: demoSeed.entries as unknown as LedgerEntry[],
    identity: demoSeed.identity as Identity,
    voice: demoSeed.voiceBank as VoiceBank,
  }
}

/**
 * One-time migration (owner mode only): the pre-Session-5 build kept ONE store named `sifarish`.
 * If it holds the owner's REAL data (identity looks like Shaurya, not the demo persona), move it
 * into the new owner vault so nothing he did is lost. Demo-polluted old stores are ignored.
 */
async function migrateLegacyOwnerData(): Promise<boolean> {
  try {
    const exists = (await Dexie.exists('sifarish')) === true
    if (!exists) return false
    const legacy = new Dexie('sifarish')
    // Open with whatever schema is there (dynamic) by declaring the tables we read.
    legacy.version(5).stores({
      ledger: 'id, kind, tier',
      identity: 'id',
      voicebank: 'id',
      jobs: 'id',
      packets: 'id',
      watchlist: 'id',
      savedHunts: 'id',
      suggestions: 'id',
      guruThreads: 'id',
      settings: 'id',
    })
    await legacy.open()
    const identity = (await legacy.table('identity').get('me')) as Identity | undefined
    const isRealOwner = !!identity && /shaurya/i.test(identity.name) && !/demo/i.test(identity.name)
    if (!isRealOwner) {
      legacy.close()
      return false
    }
    const tables = ['ledger', 'identity', 'voicebank', 'jobs', 'packets', 'watchlist', 'savedHunts', 'suggestions', 'guruThreads', 'settings']
    const data: Record<string, unknown[]> = {}
    for (const t of tables) {
      try {
        data[t] = await legacy.table(t).toArray()
      } catch {
        data[t] = []
      }
    }
    legacy.close()
    await withSeedAllowance(() =>
      db.transaction('rw', [db.ledger, db.identity, db.voicebank, db.jobs, db.packets, db.watchlist, db.savedHunts, db.suggestions, db.guruThreads, db.settings], async () => {
        for (const t of tables) {
          const rows = data[t]
          if (Array.isArray(rows) && rows.length > 0) await (db as unknown as Record<string, { bulkPut(r: unknown[]): Promise<unknown> }>)[t].bulkPut(rows)
        }
      }),
    )
    return (await db.ledger.count()) > 0
  } catch {
    return false
  }
}

/**
 * Idempotent, SEED-ONCE (FIX-3): fills the active vault only when its ledger is empty. Never
 * clears or overwrites existing entries. The owner's edits are authoritative forever.
 */
export async function seedIfEmpty(): Promise<boolean> {
  if ((await db.ledger.count()) > 0) return false

  // Owner mode: try to rescue pre-Session-5 real data before seeding fresh.
  if (getMode() === 'owner') {
    const migrated = await migrateLegacyOwnerData()
    if (migrated) {
      await withSeedAllowance(async () => {
        if (!(await db.settings.get('app'))) await db.settings.put(freshSettings())
      })
      return true
    }
  }

  const { entries, identity, voice } = await seedForActiveStore()
  const mk = monthKey()
  await withSeedAllowance(() =>
    db.transaction(
      'rw',
      [db.ledger, db.identity, db.voicebank, db.settings, db.watchlist, db.savedHunts, db.budgets],
      async () => {
        await db.ledger.bulkPut(entries)
        await db.identity.put(identity)
        await db.voicebank.put(voice)
        await db.settings.put(freshSettings())
        await db.watchlist.bulkPut(WATCHLIST_SEED)
        await db.savedHunts.bulkPut(SEED_HUNTS)
        await db.budgets.bulkPut(BUDGET_DEFAULTS.map((b) => ({ ...b, used: 0, monthKey: mk })))
      },
    ),
  )
  return true
}

/** Backfill new tables without a reseed (both stores). */
export async function backfillV2(): Promise<void> {
  const s = await db.settings.get('app')
  if (!s) return
  await withSeedAllowance(async () => {
    if ((await db.savedHunts.count()) === 0) await db.savedHunts.bulkPut(SEED_HUNTS)
    // D66: existing vaults still ask JSearch for a MONTH of postings every sweep. Retune once.
    await migrateHuntFreshness().catch(() => 0)
    if ((await db.budgets.count()) === 0) {
      const mk = monthKey()
      await db.budgets.bulkPut(BUDGET_DEFAULTS.map((b) => ({ ...b, used: 0, monthKey: mk })))
    }
    if (!s.visionProfile) await db.settings.update('app', { visionProfile: DEFAULT_VISION })
    else if (!s.visionProfile.workAuth) await db.settings.update('app', { visionProfile: { ...s.visionProfile, workAuth: DEFAULT_VISION.workAuth } })
    // Session 5.8 — additive watchlist migration (the D59 lesson: a seed change reaches nobody
    // with an existing vault). Flag-guarded so it runs ONCE: if he later deletes one of these
    // boards, it never comes back uninvited.
    await migrateWatchlistV58().catch(() => 0)
    // Re-brief (Haq filter): stamp eligibility on vault jobs that predate the filter — the
    // D59 lesson again: an ingest-time verdict reaches nobody's existing vault without this.
    await backfillEligibility().catch(() => 0)
    // FINAL-BAR (30-Aug-2026): the owner dictated his vision in the founder channel — the ONE
    // authority above D59's hands-off rule is his own word. Flag-guarded (runs once); roles and
    // avoids he added by hand are UNION-merged, never dropped; dream is replaced with his text.
    await migrateVisionFinalBar().catch(() => 0)
  })
}

export async function migrateVisionFinalBar(): Promise<boolean> {
  const FLAG = 'migrated:vision-final-bar'
  if (await db.nabzCache.get(FLAG)) return false
  const s = await db.settings.get('app')
  if (s?.visionProfile) {
    const v = s.visionProfile
    const union = (a: string[], b: string[]) => {
      const seen = new Set(a.map((x) => x.toLowerCase()))
      return [...a, ...b.filter((x) => !seen.has(x.toLowerCase()))]
    }
    await db.settings.update('app', {
      visionProfile: {
        ...v,
        dream: DEFAULT_VISION.dream,
        targetRoles: union(DEFAULT_VISION.targetRoles, v.targetRoles),
        notInterested: union(DEFAULT_VISION.notInterested, v.notInterested),
      },
    })
  }
  await db.nabzCache.put({ key: FLAG, json: 'true', fetchedAt: new Date().toISOString() })
  return true
}

/**
 * Hunter finding #6 (the D116 law applied to work-auth): editing `vision.workAuth` must
 * re-verdict the EXISTING catch now, not whenever each JD happens to change. Owner overrides
 * are never touched — his word outranks the classifier, permanently.
 */
export async function reassessAllEligibility(): Promise<number> {
  const s = await db.settings.get('app')
  const auth = s?.visionProfile?.workAuth ?? undefined
  const jobs = await db.jobs.toArray()
  let changed = 0
  for (const j of jobs) {
    if (j.eligibilityOverride) continue
    const next = assessEligibility(j, auth)
    if (next.verdict !== j.eligibility?.verdict || next.reason !== j.eligibility?.reason) {
      await db.jobs.update(j.id, { eligibility: next })
      changed++
    }
  }
  return changed
}

export async function backfillEligibility(): Promise<number> {
  const s = await db.settings.get('app')
  const auth = s?.visionProfile?.workAuth
  const jobs = await db.jobs.toArray()
  let stamped = 0
  for (const j of jobs) {
    if (j.eligibility) continue
    await db.jobs.update(j.id, { eligibility: assessEligibility(j, auth ?? undefined) })
    stamped++
  }
  return stamped
}

export async function migrateWatchlistV58(): Promise<number> {
  const FLAG = 'migrated:watchlist-v58'
  if (await db.nabzCache.get(FLAG)) return 0
  let added = 0
  for (const id of WATCHLIST_ADDITIONS_V58) {
    if (await db.watchlist.get(id)) continue
    const row = WATCHLIST_SEED.find((w) => w.id === id)
    if (row) {
      await db.watchlist.put(row)
      added++
    }
  }
  await db.nabzCache.put({ key: FLAG, json: 'true', fetchedAt: new Date().toISOString() })
  return added
}
