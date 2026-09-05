import { db } from './db'
import { getApiToken } from '../lib/darbaan/lock'
import { getMode } from '../lib/pehchaan'
import type { BackupSnapshot } from '../types'

/**
 * TIJORI vault operations — so the owner's work NEVER vanishes again (Session 5, FIX-2).
 *
 *  1. `requestDurableStorage()` — asks the browser to stop evicting our IndexedDB (the reproduced
 *     root cause: navigator.storage.persisted() was false → best-effort store → silent loss).
 *  2. `autoBackup()` — after owner edits (debounced by the caller), write an AES-256-GCM snapshot
 *     to the separate `backups` table; keep the newest N. Survives main-store corruption.
 *  3. `restoreFromLatest()` — if the owner store is unexpectedly empty but a backup exists, bring
 *     his data back before anything else.
 *
 * The encryption key derives from the owner's API token (already device-local, never in source).
 * Backups only ever run in owner mode; the demo store is disposable and never backed up.
 */

const KEEP = 5
const USER_TABLES = ['ledger', 'identity', 'voicebank', 'settings', 'jobs', 'packets', 'watchlist', 'savedHunts', 'suggestions', 'guruThreads'] as const
type UserTable = (typeof USER_TABLES)[number]
interface TableLike {
  toArray(): Promise<unknown[]>
  clear(): Promise<void>
  bulkPut(rows: unknown[]): Promise<unknown>
  count(): Promise<number>
}
const tbl = (n: UserTable) => db[n] as unknown as TableLike

function b64(buf: ArrayBuffer): string {
  const u = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
}

/** Key material: the device-local owner token, or a stable local fallback for self-hosted/dev. */
function keySeed(): string {
  return getApiToken() ?? 'sifarish-local-vault-key-v1'
}

async function aesKey(salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(keySeed()), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 150_000 },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Request durable (non-evictable) storage. Idempotent; honest about the result. */
export async function requestDurableStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function storagePersisted(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false
  } catch {
    return false
  }
}

export async function snapshotPayload(): Promise<Record<string, unknown[]>> {
  const payload: Record<string, unknown[]> = {}
  for (const t of USER_TABLES) payload[t] = await tbl(t).toArray()
  return payload
}

/**
 * v2 (05-Sep-2026, LIVE-CAUGHT on his vault): the cloud sync POST was answered 413 — the full
 * snapshot (≈800 discovered jobs, each carrying its whole description) had outgrown Vercel's
 * request-body limit, so cross-device sync was failing silently. The CLOUD snapshot now carries
 * his STORY, not the whole catch: every table whole, except `jobs`, which keeps (a) every job he
 * moved (status ≠ found), (b) every job with a packet, and (c) discoveries fetched in the last
 * SYNC_JOB_DAYS — with descriptions capped at SYNC_JD_CHARS. Local Dexie and the Tijori backups
 * stay complete; a re-sweep re-discovers anything older. The size is checked BEFORE the upload
 * and a named notice fires when even the trimmed snapshot would be refused.
 */
export const SYNC_JOB_DAYS = 45
export const SYNC_JD_CHARS = 6000
export const SYNC_MAX_BYTES = 4_200_000 // Vercel serverless body limit is 4.5 MB; base64 ciphertext grows ~33%
export async function syncPayload(): Promise<Record<string, unknown[]>> {
  const payload = await snapshotPayload()
  const cutoff = Date.now() - SYNC_JOB_DAYS * 86400000
  const jobs = (payload.jobs as { status?: string; packetId?: string; fetchedAt?: string; jd?: string; dismissed?: boolean; closed?: boolean }[]).filter((j) => {
    if (j.status && j.status !== 'found') return true
    if (j.packetId) return true
    if (j.dismissed || j.closed) return false
    const t = j.fetchedAt ? new Date(j.fetchedAt).getTime() : 0
    return Number.isFinite(t) && t >= cutoff
  })
  payload.jobs = jobs.map((j) => (typeof j.jd === 'string' && j.jd.length > SYNC_JD_CHARS ? { ...j, jd: j.jd.slice(0, SYNC_JD_CHARS) } : j))
  return payload
}

/** Write one encrypted snapshot; prune to the newest KEEP. Owner mode only. */
export async function autoBackup(): Promise<BackupSnapshot | null> {
  if (getMode() !== 'owner') return null
  try {
    const payload = await snapshotPayload()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const key = await aesKey(salt)
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(JSON.stringify(payload)) as BufferSource)
    const snap: BackupSnapshot = {
      id: new Date().toISOString(),
      at: new Date().toISOString(),
      saltB64: b64(salt.buffer),
      ivB64: b64(iv.buffer),
      cipherB64: b64(cipher),
      ledgerCount: (payload.ledger as unknown[]).length,
    }
    await db.backups.put(snap)
    const all = await db.backups.orderBy('at').reverse().toArray()
    for (const old of all.slice(KEEP)) await db.backups.delete(old.id)
    return snap
  } catch {
    return null // a backup failure must never break an edit
  }
}

async function decrypt(snap: BackupSnapshot): Promise<Record<string, unknown[]> | null> {
  try {
    const key = await aesKey(unb64(snap.saltB64))
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(snap.ivB64) as BufferSource }, key, unb64(snap.cipherB64) as BufferSource)
    return JSON.parse(new TextDecoder().decode(plain))
  } catch {
    return null // wrong key or tampered → fail closed
  }
}

export async function writePayload(payload: Record<string, unknown[]>): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  await db.transaction('rw', USER_TABLES.map((t) => db[t]), async () => {
    for (const t of USER_TABLES) {
      const rows = payload[t]
      if (!Array.isArray(rows)) continue
      await tbl(t).clear()
      if (rows.length > 0) await tbl(t).bulkPut(rows)
      counts[t] = rows.length
    }
  })
  return counts
}

export async function latestBackup(): Promise<BackupSnapshot | undefined> {
  return (await db.backups.orderBy('at').reverse().limit(1).toArray())[0]
}

/** Restore the newest backup (owner mode). Returns the row counts written, or null on failure. */
export async function restoreFromLatest(): Promise<Record<string, number> | null> {
  if (getMode() !== 'owner') return null
  const snap = await latestBackup()
  if (!snap) return null
  const payload = await decrypt(snap)
  if (!payload) return null
  return writePayload(payload)
}

/**
 * Safety net at boot: in owner mode, if the ledger is empty but a backup exists, the store was
 * likely evicted/corrupted — restore before the user notices. Returns true if a restore ran.
 */
export async function restoreOnEmptyIfNeeded(): Promise<boolean> {
  if (getMode() !== 'owner') return false
  try {
    if ((await db.ledger.count()) > 0) return false
    const restored = await restoreFromLatest()
    return restored !== null
  } catch {
    return false
  }
}
