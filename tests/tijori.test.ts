import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '../src/db/db'
import { seedIfEmpty } from '../src/db/seed'
import { autoBackup, restoreFromLatest, latestBackup, restoreOnEmptyIfNeeded } from '../src/db/tijori'

/**
 * Session-5 HEADLINE GATE — TIJORI: the persistence contract. Its ABSENCE is why the data-loss
 * bug shipped, so it exists now and must pass:
 *   • owner vault seeds from the REAL seed (owner is Shaurya, never the demo persona) — FIX-1
 *   • seed-once: an edit survives re-seeding, never overwritten — FIX-3
 *   • auto-backup snapshot round-trips; restore-on-empty brings data back — FIX-2
 */

async function clearOwnerStore() {
  await db.transaction('rw', [db.ledger, db.identity, db.voicebank, db.settings, db.backups], async () => {
    await db.ledger.clear()
    await db.identity.clear()
    await db.settings.clear()
    await db.backups.clear()
  })
}

describe('owner vault identity (FIX-1: the Arjun-in-owner bug is structurally impossible)', () => {
  beforeEach(clearOwnerStore)

  it('seeding the owner vault yields Shaurya — the demo persona cannot appear in owner mode', async () => {
    await seedIfEmpty()
    const id = await db.identity.get('me')
    expect(id?.name).toMatch(/shaurya/i)
    expect(id?.name).not.toMatch(/arjun|demo/i)
  })
})

describe('seed-once (FIX-3: edits are authoritative forever)', () => {
  beforeEach(clearOwnerStore)

  it('a second seedIfEmpty is a no-op and never overwrites an owner edit', async () => {
    await seedIfEmpty()
    // Owner edits their name.
    await db.identity.update('me', { name: 'Shaurya Verma (edited)' })
    const before = await db.ledger.count()
    // Re-run the boot seed path.
    const didSeed = await seedIfEmpty()
    expect(didSeed).toBe(false) // store non-empty → skipped
    expect((await db.identity.get('me'))?.name).toBe('Shaurya Verma (edited)') // edit survives
    expect(await db.ledger.count()).toBe(before)
  })
})

describe('the persistence contract (FIX-2: his work never vanishes)', () => {
  beforeEach(clearOwnerStore)

  it('auto-backup writes an encrypted snapshot; restore brings the exact data back', async () => {
    await seedIfEmpty()
    await db.identity.update('me', { headline: 'a headline the owner typed' })
    const count = await db.ledger.count()

    const snap = await autoBackup()
    expect(snap).toBeTruthy()
    expect(snap!.ledgerCount).toBe(count)
    // The stored snapshot is ciphertext — not readable plaintext.
    const stored = await latestBackup()
    expect(stored!.cipherB64).not.toContain('headline')

    // Simulate an eviction: the store empties.
    await db.ledger.clear()
    await db.identity.clear()
    expect(await db.ledger.count()).toBe(0)

    const counts = await restoreFromLatest()
    expect(counts).toBeTruthy()
    expect(await db.ledger.count()).toBe(count)
    expect((await db.identity.get('me'))?.headline).toBe('a headline the owner typed')
  })

  it('restore-on-empty runs only when the ledger is actually empty', async () => {
    await seedIfEmpty()
    await autoBackup()
    // Not empty → no restore needed.
    expect(await restoreOnEmptyIfNeeded()).toBe(false)
    // Now empty with a backup present → restores.
    await db.ledger.clear()
    expect(await restoreOnEmptyIfNeeded()).toBe(true)
    expect(await db.ledger.count()).toBeGreaterThan(0)
  })

  it('keeps at most the newest 5 snapshots (bounded growth)', async () => {
    await seedIfEmpty()
    for (let i = 0; i < 8; i++) {
      await db.identity.update('me', { headline: `edit ${i}` })
      await autoBackup()
    }
    expect(await db.backups.count()).toBeLessThanOrEqual(5)
  })
})
