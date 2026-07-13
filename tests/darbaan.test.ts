import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { setPasscode, hasPasscode } from '../src/lib/darbaan/lock'
import { exportBackup, importBackup } from '../src/lib/darbaan/backup'
import { db } from '../src/db/db'
import { SEED_IDENTITY, SEED_LEDGER } from './helpers'

/** P16 gates — Darbaan: local passcode storage + encrypted export/import + PII scrub.
 *  (Identity resolution moved to pehchaan.test.ts; the vault to tijori.test.ts.) */

describe('Darbaan local passcode (PBKDF2, stored hash only)', () => {
  it('stores a salted hash, never the passcode', async () => {
    await setPasscode('sher-e-punjab')
    const raw = localStorage.getItem('sifarish.darbaan')!
    expect(raw).toBeTruthy()
    expect(raw).not.toContain('sher-e-punjab')
    const rec = JSON.parse(raw)
    expect(rec.iterations).toBeGreaterThanOrEqual(100_000)
    expect(rec.saltB64.length).toBeGreaterThan(10)
    expect(hasPasscode()).toBe(true)
  })

  it('rejects passcodes under 4 characters', async () => {
    expect((await setPasscode('ab')).ok).toBe(false)
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

describe('Public seed PII scan (the demo persona never carries real personal data)', () => {
  const REAL_PII = ['shaurya.verma2705', '9041523296', '94a607329', 'Shaurya Verma']

  it('demo.seed.json (what a demo visitor receives) holds zero real PII', () => {
    const demo = readFileSync('seed/demo.seed.json', 'utf8')
    for (const pii of REAL_PII) {
      expect(demo.includes(pii), `demo seed leaks "${pii}"`).toBe(false)
    }
  })

  it('the demo vault is seeded from the demo seed; the owner vault from the real seed', () => {
    const seedTs = readFileSync('src/db/seed.ts', 'utf8')
    expect(seedTs).toMatch(/demoSeed from '\.\.\/\.\.\/seed\/demo\.seed\.json'/)
    // Owner seed is DYNAMICALLY imported (owner mode only) so demo visitors never download his PII.
    expect(seedTs).toMatch(/await import\('\.\/ownerSeed'\)/)
  })
})
