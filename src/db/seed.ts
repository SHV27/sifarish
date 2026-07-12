import { db } from './db'
// DARBAAN (P16): a fresh browser is seeded with the FICTIONAL demo persona — a public
// visitor never receives real personal data. The owner's real ledger lives in his own
// browser + his encrypted backup (Settings → Darbaan), restorable via loadOwnerSeed().
import seedData from '../../seed/demo.seed.json'
import { withSeedAllowance } from '../lib/darbaan/lock'
import type { Identity, LedgerEntry, Settings, VisionProfile, VoiceBank } from '../types'
import { DEFAULT_RUBRIC } from '../lib/radar/rubric'
import { WATCHLIST_SEED } from '../lib/radar/watchlist.seed'
import { SEED_HUNTS } from '../lib/khabri/client'
import { BUDGET_DEFAULTS, monthKey } from '../lib/budget'

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

/** Idempotent: seeds only when the ledger is empty. The app opens already knowing Shaurya. */
export async function seedIfEmpty(): Promise<boolean> {
  const count = await db.ledger.count()
  if (count > 0) return false

  const entries = seedData.entries as unknown as LedgerEntry[]
  const identity = seedData.identity as Identity
  const voice = seedData.voiceBank as VoiceBank

  const settings: Settings = {
    id: 'app',
    onboarded: false,
    rubric: DEFAULT_RUBRIC,
    weeklyQuota: 10,
    weekKey: isoWeekKey(),
    appliedThisWeek: 0,
    visionProfile: DEFAULT_VISION,
    rubricChangelog: [{ at: new Date().toISOString(), summary: 'Initial rubric (v1 defaults).' }],
  }

  const mk = monthKey()
  await withSeedAllowance(() =>
    db.transaction(
      'rw',
      [db.ledger, db.identity, db.voicebank, db.settings, db.watchlist, db.savedHunts, db.budgets],
      async () => {
        await db.ledger.bulkPut(entries)
        await db.identity.put(identity)
        await db.voicebank.put(voice)
        await db.settings.put(settings)
        await db.watchlist.bulkPut(WATCHLIST_SEED)
        await db.savedHunts.bulkPut(SEED_HUNTS)
        await db.budgets.bulkPut(BUDGET_DEFAULTS.map((b) => ({ ...b, used: 0, monthKey: mk })))
      },
    ),
  )
  return true
}


/** For already-onboarded users upgrading to v2: backfill new tables without a reseed. */
export async function backfillV2(): Promise<void> {
  const s = await db.settings.get('app')
  if (!s) return
  await withSeedAllowance(async () => {
    if ((await db.savedHunts.count()) === 0) await db.savedHunts.bulkPut(SEED_HUNTS)
    if ((await db.budgets.count()) === 0) {
      const mk = monthKey()
      await db.budgets.bulkPut(BUDGET_DEFAULTS.map((b) => ({ ...b, used: 0, monthKey: mk })))
    }
    if (!s.visionProfile) await db.settings.update('app', { visionProfile: DEFAULT_VISION })
  })
}
