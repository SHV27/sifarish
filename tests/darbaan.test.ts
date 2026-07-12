import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// In-memory localStorage so the passcode record has somewhere to live under Node.
class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
  get length() {
    return this.m.size
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
}
;(globalThis as Record<string, unknown>).localStorage = new MemStorage()

import { setPasscode, unlock, lock, isOwner, hasPasscode, mutationAllowed, DarbaanLockedError } from '../src/lib/darbaan/lock'
import { exportBackup, importBackup } from '../src/lib/darbaan/backup'
import { db } from '../src/db/db'
import { SEED_IDENTITY, SEED_LEDGER } from './helpers'

/** P16 gates — Darbaan: owner lock, Darshak read-only, encrypted export/import, PII scrub. */

describe('Darbaan passcode (PBKDF2, stored hash only)', () => {
  beforeAll(async () => {
    await setPasscode('sher-e-punjab')
  })

  it('stores a salted hash, never the passcode', () => {
    const raw = localStorage.getItem('sifarish.darbaan')!
    expect(raw).toBeTruthy()
    expect(raw).not.toContain('sher-e-punjab')
    const rec = JSON.parse(raw)
    expect(rec.iterations).toBeGreaterThanOrEqual(100_000)
    expect(rec.saltB64.length).toBeGreaterThan(10)
  })

  it('wrong passcode stays locked; right passcode unlocks; lock() locks', async () => {
    lock()
    expect(isOwner()).toBe(false)
    expect(await unlock('wrong-pass')).toBe(false)
    expect(isOwner()).toBe(false)
    expect(await unlock('sher-e-punjab')).toBe(true)
    expect(isOwner()).toBe(true)
    lock()
    expect(isOwner()).toBe(false)
    await unlock('sher-e-punjab')
  })

  it('rejects passcodes under 4 characters', async () => {
    expect((await setPasscode('ab')).ok).toBe(false)
  })

  it('hasPasscode reflects the stored record', () => {
    expect(hasPasscode()).toBe(true)
  })
})

describe('Darshak mode — mutations blocked at the DATABASE level (I12, handler-level proof)', () => {
  it('mutationAllowed: story tables locked, infra tables open', () => {
    lock()
    expect(mutationAllowed('ledger')).toBe(false)
    expect(mutationAllowed('packets')).toBe(false)
    expect(mutationAllowed('settings')).toBe(false)
    expect(mutationAllowed('jobs')).toBe(false)
    expect(mutationAllowed('dimaagCache')).toBe(true) // showcase still thinks
    expect(mutationAllowed('budgets')).toBe(true) // and meters honestly
  })

  it('a locked write to the ledger rejects with DarbaanLockedError; unlocking allows it', async () => {
    lock()
    await expect(db.ledger.put(SEED_LEDGER[0])).rejects.toThrow(DarbaanLockedError)
    await unlock('sher-e-punjab')
    await expect(db.ledger.put(SEED_LEDGER[0])).resolves.toBeTruthy()
  })

  it('reads work fine while locked (the showcase is alive, not blank)', async () => {
    await db.ledger.put(SEED_LEDGER[0])
    lock()
    const rows = await db.ledger.toArray()
    expect(rows.length).toBeGreaterThan(0)
    await unlock('sher-e-punjab')
  })
})

describe('Encrypted export/import (round-trip + tamper chaos)', () => {
  it('round-trips the real tables through AES-GCM', async () => {
    await db.ledger.clear()
    await db.ledger.bulkPut(SEED_LEDGER.slice(0, 5))
    await db.identity.put(SEED_IDENTITY)
    const file = await exportBackup('sher-e-punjab')
    expect(file).not.toContain(SEED_IDENTITY.email) // ciphertext, not plaintext
    expect(file).not.toContain('GLOAMING')

    await db.ledger.clear()
    expect(await db.ledger.count()).toBe(0)
    const r = await importBackup(file, 'sher-e-punjab')
    expect(r.ok).toBe(true)
    expect(await db.ledger.count()).toBe(5)
    expect((await db.identity.get('me'))?.email).toBe(SEED_IDENTITY.email)
  })

  it('wrong passcode fails closed', async () => {
    const file = await exportBackup('sher-e-punjab')
    const r = await importBackup(file, 'galat-passcode')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/wrong passcode|integrity/i)
  })

  it('a tampered file fails the integrity check (GCM auth)', async () => {
    const file = await exportBackup('sher-e-punjab')
    const parsed = JSON.parse(file)
    const bytes = Uint8Array.from(atob(parsed.cipherB64), (c) => c.charCodeAt(0))
    bytes[Math.floor(bytes.length / 2)] ^= 0xff
    parsed.cipherB64 = btoa(String.fromCharCode(...bytes.subarray(0, 1000))) + parsed.cipherB64.slice(1400)
    const r = await importBackup(JSON.stringify(parsed), 'sher-e-punjab')
    expect(r.ok).toBe(false)
  })

  it('garbage input fails politely', async () => {
    expect((await importBackup('not json at all', 'x')).ok).toBe(false)
    expect((await importBackup('{"magic":"nope"}', 'x')).ok).toBe(false)
  })
})

describe('Public seed PII scan (the showcase never carries real personal data)', () => {
  const REAL_PII = ['shaurya.verma2705', '9041523296', '94a607329', 'Shaurya Verma']

  it('demo.seed.json (what a fresh browser receives) holds zero real PII', () => {
    const demo = readFileSync('seed/demo.seed.json', 'utf8')
    for (const pii of REAL_PII) {
      expect(demo.includes(pii), `demo seed leaks "${pii}"`).toBe(false)
    }
  })

  it('the boot seeding path uses the demo seed', () => {
    const seedTs = readFileSync('src/db/seed.ts', 'utf8')
    expect(seedTs).toMatch(/seedData from '..\/..\/seed\/demo.seed.json'/)
  })
})
