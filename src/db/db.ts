import Dexie, { type EntityTable } from 'dexie'
import { getMode, storeName } from '../lib/pehchaan'
import type {
  LedgerEntry,
  Identity,
  VoiceBank,
  Job,
  Packet,
  WatchlistCompany,
  NabzSuggestion,
  NabzCacheRow,
  Settings,
  Signal,
  SavedHunt,
  CompanyIntel,
  Budget,
  PulseBrief,
  GuruThread,
  DimaagCacheRow,
  DimaagUsageRow,
  UstaadRow,
  DakCard,
  BackupSnapshot,
} from '../types'

/**
 * TIJORI (तिजोरी · the vault) — TWO physically separate Dexie databases that can never clobber
 * each other: `sifarish_owner` (Shaurya's real, authoritative data) and `sifarish_demo` (the
 * fictional showcase persona). PEHCHAAN picks exactly one per page load. The owner persona can
 * therefore never appear in demo mode, and the demo seed can never touch the owner store — the
 * whole "Arjun-in-owner / edits vanish" disease is cured by construction, not vigilance.
 */

// The DBCore write-block reads these two flags. Mode is frozen at boot (Pehchaan); the seeding
// window is opened only by the seed routine writing initial data into a fresh store.
let seedingAllowance = false
export function setSeedingAllowance(on: boolean): void {
  seedingAllowance = on
}
export async function withSeedAllowance<T>(fn: () => Promise<T>): Promise<T> {
  seedingAllowance = true
  try {
    return await fn()
  } finally {
    seedingAllowance = false
  }
}

/** Infra/cache tables the DEMO showcase may still write (reasoning cache, budgets — never his story). */
const INFRA_TABLES = new Set(['dimaagCache', 'dimaagUsage', 'nabzCache', 'budgets'])

export class DarbaanLockedError extends Error {
  constructor(table: string) {
    super(`Demo mode is read-only — this is the showcase store. (I12) [${table}]`)
    this.name = 'DarbaanLockedError'
  }
}

/** The demo store's story tables are read-only; the owner store is always fully writable. */
function mutationAllowed(table: string): boolean {
  return getMode() === 'owner' || seedingAllowance || INFRA_TABLES.has(table)
}

export class SifarishDB extends Dexie {
  ledger!: EntityTable<LedgerEntry, 'id'>
  identity!: EntityTable<Identity, 'id'>
  voicebank!: EntityTable<VoiceBank, 'id'>
  jobs!: EntityTable<Job, 'id'>
  packets!: EntityTable<Packet, 'id'>
  watchlist!: EntityTable<WatchlistCompany, 'id'>
  suggestions!: EntityTable<NabzSuggestion, 'id'>
  nabzCache!: EntityTable<NabzCacheRow, 'key'>
  settings!: EntityTable<Settings, 'id'>
  // v2
  signals!: EntityTable<Signal, 'id'>
  savedHunts!: EntityTable<SavedHunt, 'id'>
  intel!: EntityTable<CompanyIntel, 'company'>
  budgets!: EntityTable<Budget, 'id'>
  pulse!: EntityTable<PulseBrief, 'id'>
  guruThreads!: EntityTable<GuruThread, 'id'>
  // v3
  dimaagCache!: EntityTable<DimaagCacheRow, 'hash'>
  dimaagUsage!: EntityTable<DimaagUsageRow, 'id'>
  // v4
  ustaad!: EntityTable<UstaadRow, 'id'>
  dak!: EntityTable<DakCard, 'id'>
  // Session 5 — Tijori: encrypted backups live in their own table (survive main-store corruption).
  backups!: EntityTable<BackupSnapshot, 'id'>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      ledger: 'id, kind, tier',
      identity: 'id',
      voicebank: 'id',
      jobs: 'id, status, source, fetchedAt',
      packets: 'id, jobId, createdAt',
      watchlist: 'id, source',
      suggestions: 'id, status, repoName',
      nabzCache: 'key',
      settings: 'id',
    })
    // v2 "Jasoos Update" — additive tables + new job index for discovery dedupe.
    this.version(2).stores({
      jobs: 'id, status, source, fetchedAt, dedupeKey',
      signals: 'id, seen, fetchedAt',
      savedHunts: 'id, enabled',
      intel: 'company, fetchedAt',
      budgets: 'id',
      pulse: 'id, status, at',
      guruThreads: 'id, updatedAt',
    })
    // v3 "Dimaag Update" — reasoning cache + per-feature usage ledger (zero-wastage discipline).
    this.version(3).stores({
      dimaagCache: 'hash, at',
      dimaagUsage: 'id, feature, monthKey',
    })
    // v4 "Ustaad Update" — craft library as runtime-refreshable data (I13) + Dak Khana mail cards.
    this.version(4).stores({
      ustaad: 'id',
      dak: 'id, jobId, status, fetchedAt',
    })
    // Session 5 "Tijori" — encrypted backup snapshots.
    this.version(5).stores({
      backups: 'id, at',
    })
  }
}

// PEHCHAAN chooses the vault; this instance is fixed for the page load (transitions reload).
export const db = new SifarishDB(storeName())

// Owner-edit signal (Tijori auto-backup subscribes here). Fired after a successful story-table
// mutation in owner mode. Infra/cache tables are excluded — a cache write is not "his work."
const ownerMutationListeners = new Set<() => void>()
export function onOwnerMutation(fn: () => void): () => void {
  ownerMutationListeners.add(fn)
  return () => ownerMutationListeners.delete(fn)
}

// DARBAAN (I12), enforced at the DBCore level — structural impossibility beats vigilance:
// in DEMO mode every mutation to a story table is rejected at the database, no matter which
// button, chat, or code path asked for it. Infra caches stay writable so the showcase itself
// still works. The OWNER vault is always writable — it is his own data.
db.use({
  stack: 'dbcore',
  name: 'darbaan',
  create(down) {
    return {
      ...down,
      table(name: string) {
        const t = down.table(name)
        return {
          ...t,
          mutate(req) {
            if (!mutationAllowed(name)) return Promise.reject(new DarbaanLockedError(name))
            const p = t.mutate(req)
            if (getMode() === 'owner' && !seedingAllowance && !INFRA_TABLES.has(name)) {
              p.then(() => {
                for (const fn of ownerMutationListeners) fn()
              }).catch(() => {})
            }
            return p
          },
        }
      },
    }
  },
})
