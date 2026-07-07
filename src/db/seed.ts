import { db } from './db'
import seedData from '../../seed/ledger.seed.json'
import type { Identity, LedgerEntry, Settings, VoiceBank } from '../types'
import { DEFAULT_RUBRIC } from '../lib/radar/rubric'
import { WATCHLIST_SEED } from '../lib/radar/watchlist.seed'

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
  }

  await db.transaction('rw', [db.ledger, db.identity, db.voicebank, db.settings, db.watchlist], async () => {
    await db.ledger.bulkPut(entries)
    await db.identity.put(identity)
    await db.voicebank.put(voice)
    await db.settings.put(settings)
    await db.watchlist.bulkPut(WATCHLIST_SEED)
  })
  return true
}
