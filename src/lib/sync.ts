import { db } from '../db/db'
import { getMode } from './pehchaan'
import { meteredHeaders } from './apiGuard'
import { snapshotPayload, writePayload } from '../db/tijori'

/**
 * CROSS-DEVICE SYNC (Session 5.3) — open Owner Mode from any device, anywhere, and your ledger is
 * up to date. SERVER-BLIND: the vault is AES-256-GCM encrypted with a key derived from your passcode
 * (PBKDF2) that the server never sees, so the cloud holds only ciphertext it cannot read.
 *
 * FAIL-SAFE BY CONSTRUCTION (the paramount rule — never lose data, never break the app): every sync
 * op is best-effort. A missing key, a decrypt failure, a network error, an empty cloud, a malformed
 * payload → the function returns quietly and LOCAL DATA STANDS. Restore only happens when the cloud
 * copy authentically decrypts (AES-GCM auth guarantees it was written by this owner) AND is strictly
 * newer, or the local store is empty (a fresh device). Push never touches local state.
 */

const KEY_LS = 'sifarish.synckey'
const UPDATED_LS = 'sifarish.vaultUpdatedAt'
const LASTSYNC_LS = 'sifarish.lastSyncAt'
const SALT = new TextEncoder().encode('sifarish-sync-key-v1') // fixed so the same passcode → same key on every device

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}
function b64(buf: ArrayBuffer): string {
  const u = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
}

/** Derive the sync key from the passcode and remember it on THIS device (called at owner login). */
export async function establishSyncKey(passcode: string): Promise<void> {
  try {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: SALT as BufferSource, iterations: 200_000 }, base, 256)
    ls()?.setItem(KEY_LS, b64(bits))
  } catch {
    /* crypto unavailable → sync simply stays off */
  }
}

export function hasSyncKey(): boolean {
  return !!ls()?.getItem(KEY_LS)
}
export function clearSyncKey(): void {
  ls()?.removeItem(KEY_LS)
}
export function lastSyncAt(): number {
  return Number(ls()?.getItem(LASTSYNC_LS) ?? '0')
}

async function loadKey(): Promise<CryptoKey | null> {
  const raw = ls()?.getItem(KEY_LS)
  if (!raw) return null
  try {
    return await crypto.subtle.importKey('raw', unb64(raw) as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  } catch {
    return null
  }
}

/** Bump the local vault version on an owner edit (drives last-write-wins). */
export function markLocalEdit(): void {
  ls()?.setItem(UPDATED_LS, String(Date.now()))
}
function localUpdatedAt(): number {
  return Number(ls()?.getItem(UPDATED_LS) ?? '0')
}

async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(plaintext) as BufferSource)
  return `${b64(iv.buffer)}.${b64(ct)}`
}
async function decrypt(key: CryptoKey, cipher: string): Promise<string | null> {
  try {
    const [ivB64, ctB64] = cipher.split('.')
    if (!ivB64 || !ctB64) return null
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivB64) as BufferSource }, key, unb64(ctB64) as BufferSource)
    return new TextDecoder().decode(plain)
  } catch {
    return null // wrong key or tampered → fail closed (no restore)
  }
}

/** Upload the local vault (encrypted). Owner-only, best-effort, never throws. Returns true on success. */
export async function pushVault(): Promise<boolean> {
  if (getMode() !== 'owner') return false
  const key = await loadKey()
  if (!key) return false
  try {
    const payload = await snapshotPayload()
    if (!Array.isArray(payload.ledger)) return false
    const cipher = await encrypt(key, JSON.stringify(payload))
    const updatedAt = localUpdatedAt() || Date.now()
    const res = await fetch('/api/vault', { method: 'POST', headers: meteredHeaders(), body: JSON.stringify({ cipher, updatedAt }) })
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean; configured?: boolean }
    if (data.ok) {
      // Pin the local version to what we uploaded so boots don't needlessly re-restore identical data.
      ls()?.setItem(UPDATED_LS, String(updatedAt))
      ls()?.setItem(LASTSYNC_LS, String(Date.now()))
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Pull the cloud vault and restore it IF it authentically decrypts AND (is strictly newer OR local is
 * empty). Owner-only, best-effort. NEVER wipes local on any failure.
 */
export async function pullVault(): Promise<{ restored: boolean }> {
  if (getMode() !== 'owner') return { restored: false }
  const key = await loadKey()
  if (!key) return { restored: false }
  try {
    const res = await fetch('/api/vault', { headers: meteredHeaders() })
    if (!res.ok) return { restored: false }
    const data = (await res.json()) as { configured?: boolean; empty?: boolean; cipher?: string | null; updatedAt?: number }
    if (!data.configured || data.empty || !data.cipher) return { restored: false }
    const cloudAt = Number(data.updatedAt) || 0
    const localAt = localUpdatedAt()
    const ledgerCount = await db.ledger.count()
    if (!(cloudAt > localAt || ledgerCount === 0)) return { restored: false }

    const plain = await decrypt(key, data.cipher)
    if (!plain) return { restored: false } // decrypt failed → authentic-only guarantee: do nothing
    let payload: Record<string, unknown[]>
    try {
      payload = JSON.parse(plain)
    } catch {
      return { restored: false }
    }
    // Sanity: a real vault has a ledger array. (AES-GCM already proved authenticity.)
    if (!payload || !Array.isArray(payload.ledger)) return { restored: false }
    await writePayload(payload)
    ls()?.setItem(UPDATED_LS, String(cloudAt))
    ls()?.setItem(LASTSYNC_LS, String(Date.now()))
    return { restored: true }
  } catch {
    return { restored: false }
  }
}

/** Is cross-device sync provisioned on this deployment? (client hint for Settings copy) */
export async function syncConfigured(): Promise<boolean> {
  try {
    const res = await fetch('/api/vault', { headers: meteredHeaders() })
    if (!res.ok) return false
    const data = (await res.json()) as { configured?: boolean }
    return data.configured === true
  } catch {
    return false
  }
}
