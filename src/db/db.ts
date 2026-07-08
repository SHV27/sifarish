import Dexie, { type EntityTable } from 'dexie'
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
} from '../types'

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

  constructor() {
    super('sifarish')
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
  }
}

export const db = new SifarishDB()
