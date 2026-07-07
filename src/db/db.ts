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
  }
}

export const db = new SifarishDB()
