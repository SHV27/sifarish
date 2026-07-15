import Dexie from 'dexie'
import { db, withSeedAllowance } from './db'
// A fresh DEMO store is seeded with the FICTIONAL persona (statically imported — it is public,
// PII-free, and small). The OWNER store is seeded from the real seed, DYNAMICALLY imported only
// in owner mode so a demo visitor never downloads it.
import demoSeed from '../../seed/demo.seed.json'
import type { Identity, LedgerEntry, Settings, VisionProfile, VoiceBank } from '../types'
import { DEFAULT_RUBRIC } from '../lib/radar/rubric'
import { WATCHLIST_SEED } from '../lib/radar/watchlist.seed'
import { SEED_HUNTS } from '../lib/khabri/client'
import { BUDGET_DEFAULTS, monthKey } from '../lib/budget'
import { getMode } from '../lib/pehchaan'

export const DEFAULT_VISION: VisionProfile = {
  dream:
    'Break into agentic-AI engineering by building real tools that solve Indian public problems — ' +
    'ship things people actually use, learn the hard ML underneath, and land at a team that builds ' +
    'with LLMs seriously.',
  targetRoles: ['AI Engineer Intern', 'Agentic AI Intern', 'LLM Engineer Intern', 'Applied AI Intern', 'AI Residency'],
  notInterested: ['Generic SDE / mass-MNC roles', 'Pure frontend', 'Non-AI QA/support'],
  compFloorStipend: 35000,
  ppoFloorLpa: 16,
  windowStart: 'Jan 2027',
  windowEnd: 'May 2027',
  remoteInternational: true,
  openToOctoberStart: true,
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
    const { migrateHuntFreshness } = await import('../lib/khabri/client')
    await migrateHuntFreshness().catch(() => 0)
    if ((await db.budgets.count()) === 0) {
      const mk = monthKey()
      await db.budgets.bulkPut(BUDGET_DEFAULTS.map((b) => ({ ...b, used: 0, monthKey: mk })))
    }
    if (!s.visionProfile) await db.settings.update('app', { visionProfile: DEFAULT_VISION })
  })
}
