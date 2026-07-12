import { db } from './db'
import ownerSeedData from '../../seed/ledger.seed.json'
import type { Identity, LedgerEntry, VoiceBank } from '../types'

/**
 * Owner-only: replace the demo persona with the real owner seed (Darbaan-gated by the db
 * middleware — a locked browser cannot run this). Lives in its own lazily-loaded module so
 * the owner's data never ships in the public entry bundle.
 */
export async function loadOwnerSeed(): Promise<void> {
  const entries = ownerSeedData.entries as unknown as LedgerEntry[]
  const identity = ownerSeedData.identity as Identity
  const voice = ownerSeedData.voiceBank as VoiceBank
  await db.transaction('rw', [db.ledger, db.identity, db.voicebank], async () => {
    await db.ledger.clear()
    await db.ledger.bulkPut(entries)
    await db.identity.put(identity)
    await db.voicebank.put(voice)
  })
}
