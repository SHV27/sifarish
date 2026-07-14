import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { db } from '../src/db/db'
import { SEED_LEDGER } from './helpers'
import { establishSyncKey, clearSyncKey, hasSyncKey, markLocalEdit, pushVault, pullVault, syncConfigured } from '../src/lib/sync'

/**
 * CROSS-DEVICE SYNC gates (Session 5.3) — the vault follows the owner to any device, ANYWHERE,
 * while the cloud only ever holds ciphertext it cannot read. These prove the two things that make
 * the feature safe: SERVER-BLINDNESS (no plaintext leaves the device) and FAIL-SAFE (no failure
 * path ever wipes local data), plus last-write-wins and the wrong-key adversary case.
 */

type Cloud = { cipher: string; updatedAt: number } | null

/** An in-memory stand-in for /api/vault: stores exactly what the server stores — one ciphertext blob. */
function makeServer() {
  const state = { cloud: null as Cloud, configured: true, posts: [] as string[], lastHeaders: {} as Record<string, string> }
  const fetchMock = vi.fn(async (_url: string, opts?: RequestInit) => {
    state.lastHeaders = (opts?.headers ?? {}) as Record<string, string>
    if (!state.configured) return new Response(JSON.stringify({ configured: false }), { status: 200 })
    if (opts?.method === 'POST') {
      const body = JSON.parse(String(opts.body)) as { cipher: string; updatedAt: number }
      state.posts.push(body.cipher)
      state.cloud = { cipher: body.cipher, updatedAt: Number(body.updatedAt) }
      return new Response(JSON.stringify({ configured: true, ok: true }), { status: 200 })
    }
    if (!state.cloud) return new Response(JSON.stringify({ configured: true, empty: true }), { status: 200 })
    return new Response(JSON.stringify({ configured: true, cipher: state.cloud.cipher, updatedAt: state.cloud.updatedAt }), { status: 200 })
  })
  return { state, fetchMock }
}

let server: ReturnType<typeof makeServer>
const realFetch = globalThis.fetch

beforeEach(async () => {
  server = makeServer()
  globalThis.fetch = server.fetchMock as unknown as typeof fetch
  await db.ledger.clear()
  for (const k of ['sifarish.synckey', 'sifarish.vaultUpdatedAt', 'sifarish.lastSyncAt']) localStorage.removeItem(k)
  await establishSyncKey('sher-e-punjab') // the owner's passcode → the sync key on this device
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('Round-trip + server-blindness', () => {
  it('pushes ciphertext (never plaintext) and restores it byte-for-byte on another device', async () => {
    await db.ledger.bulkPut(SEED_LEDGER.slice(0, 5))
    markLocalEdit()
    expect(await pushVault()).toBe(true)

    // SERVER-BLIND: the payload that left the device carries no ledger plaintext.
    expect(server.state.posts[0]).not.toContain('GLOAMING')
    expect(server.state.posts[0]).not.toContain('shaurya')
    // The owner token rides on every call so the server can gate the spend.
    expect(server.state.lastHeaders['x-sifarish-token']).toBe('test-token')

    // A fresh device (empty ledger) pulls and gets his real data back.
    await db.ledger.clear()
    expect(await db.ledger.count()).toBe(0)
    const r = await pullVault()
    expect(r.restored).toBe(true)
    expect(await db.ledger.count()).toBe(5)
  })

  it('establishSyncKey turns sync on for this device; clearSyncKey turns it off', async () => {
    expect(hasSyncKey()).toBe(true)
    clearSyncKey()
    expect(hasSyncKey()).toBe(false)
    // With no key, push/pull are no-ops that never touch local or the network.
    await db.ledger.bulkPut(SEED_LEDGER.slice(0, 3))
    expect(await pushVault()).toBe(false)
    expect((await pullVault()).restored).toBe(false)
    expect(await db.ledger.count()).toBe(3)
  })
})

describe('Fail-safe — no failure path ever wipes local data', () => {
  it('a network error leaves local data untouched', async () => {
    await db.ledger.bulkPut(SEED_LEDGER.slice(0, 5))
    markLocalEdit()
    server.fetchMock.mockImplementationOnce(async () => {
      throw new Error('offline')
    })
    const r = await pullVault()
    expect(r.restored).toBe(false)
    expect(await db.ledger.count()).toBe(5)
  })

  it('an empty cloud never blanks a populated device', async () => {
    server.state.cloud = null
    await db.ledger.bulkPut(SEED_LEDGER.slice(0, 5))
    const r = await pullVault()
    expect(r.restored).toBe(false)
    expect(await db.ledger.count()).toBe(5)
  })

  it('when sync is not provisioned, the app stays local-first', async () => {
    server.state.configured = false
    expect(await syncConfigured()).toBe(false)
    await db.ledger.bulkPut(SEED_LEDGER.slice(0, 5))
    expect(await pushVault()).toBe(false)
    expect((await pullVault()).restored).toBe(false)
    expect(await db.ledger.count()).toBe(5)
    server.state.configured = true
    expect(await syncConfigured()).toBe(true)
  })
})

describe('Adversary — a wrong key cannot read the vault or corrupt local', () => {
  it('cloud ciphertext written by another passcode fails closed (no restore, no wipe)', async () => {
    await db.ledger.bulkPut(SEED_LEDGER.slice(0, 5))
    markLocalEdit()
    await pushVault() // written under the real passcode

    // A device holding a DIFFERENT passcode-derived key tries to pull.
    clearSyncKey()
    await establishSyncKey('totally-different-guess')
    await db.ledger.clear() // fresh device → pull would attempt a restore
    const r = await pullVault()
    expect(r.restored).toBe(false) // AES-GCM auth fails → the wrong key learns nothing
    expect(await db.ledger.count()).toBe(0) // and never writes cloud garbage into local
  })
})

describe('Last-write-wins in both directions', () => {
  it('a newer local device is not overwritten by an older cloud; a newer cloud wins', async () => {
    await db.ledger.bulkPut(SEED_LEDGER.slice(0, 5))
    markLocalEdit()
    await pushVault() // cloud = 5-entry snapshot at v1

    // Local edits move ahead of the cloud.
    await db.ledger.put(SEED_LEDGER[5])
    await new Promise((r) => setTimeout(r, 5))
    markLocalEdit() // local v2 > cloud v1
    expect((await pullVault()).restored).toBe(false) // older cloud does not clobber newer local
    expect(await db.ledger.count()).toBe(6)

    // The OTHER device now writes something newer to the cloud.
    server.state.cloud!.updatedAt = Date.now() + 100_000
    expect((await pullVault()).restored).toBe(true) // newer cloud wins
    expect(await db.ledger.count()).toBe(5)
  })
})

describe('The vault endpoint is gated at the choke point (RC3) — structural', () => {
  const src = readFileSync('api/vault.ts', 'utf8')

  it('requires the owner token (401) and a trusted origin (403)', () => {
    expect(src).toMatch(/x-sifarish-token/)
    expect(src).toMatch(/401/)
    expect(src).toMatch(/originOk/)
    expect(src).toMatch(/403/)
  })

  it('stores only ciphertext — never a decrypted payload', () => {
    expect(src).toMatch(/cipher/)
    expect(src).not.toMatch(/JSON\.parse\(plain/) // the server never decrypts
  })

  it('uses the Node web-handler shape (regression: a bare default fn is the (req,res) handler)', () => {
    // The exact bug fixed in 5.3 — on the Node runtime @vercel/blob needs, the Web Request/Response
    // API only reaches the handler via the `{ fetch }` export, not a bare `export default function`.
    expect(src).toMatch(/export default \{ fetch:/)
    expect(src).toMatch(/runtime: 'nodejs'/)
  })
})
