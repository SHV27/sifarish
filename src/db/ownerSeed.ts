import ownerSeedData from '../../seed/ledger.seed.json'
import type { Identity, LedgerEntry, VoiceBank } from '../types'

/**
 * The owner's real seed, isolated in its own module so it is DYNAMICALLY imported only in owner
 * mode (see seed.ts). A demo visitor's browser never downloads this chunk → his PII stays off the
 * public path. This module no longer mutates the DB — seeding is import-IF-EMPTY only (FIX-3: the
 * old loadOwnerSeed() cleared the ledger on every click and destroyed edits).
 */
export const OWNER_SEED = {
  entries: ownerSeedData.entries as unknown as LedgerEntry[],
  identity: ownerSeedData.identity as Identity,
  voice: ownerSeedData.voiceBank as VoiceBank,
}
