/**
 * DARBAAN (P16, I12) — owner lock. Every mutating action requires Owner Mode; without it the
 * app is a read-only showcase (Darshak Mode). Honestly stated: data is local-first — a public
 * visitor's browser holds only the demo seed, never Shaurya's live data. Darbaan gates the UI
 * (and, structurally, the database — see db.ts middleware) so the public URL behaves as a showcase.
 *
 * Passcode: PBKDF2-SHA-256 (210k iterations, random salt) — hash stored locally, never the
 * passcode. Unlock persists per device until locked from the header.
 */

const STORE_KEY = 'sifarish.darbaan'
const UNLOCK_KEY = 'sifarish.darbaan.unlocked'
const ITERATIONS = 210_000

interface PasscodeRecord {
  saltB64: string
  hashB64: string
  iterations: number
}

let ownerUnlocked = false
const listeners = new Set<() => void>()

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function notify() {
  for (const l of listeners) l()
}

export function onDarbaanChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}
function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

export async function deriveHash(passcode: string, salt: Uint8Array, iterations = ITERATIONS): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  )
  return toB64(bits)
}

export function hasPasscode(): boolean {
  return !!storage()?.getItem(STORE_KEY)
}

export async function setPasscode(passcode: string): Promise<{ ok: boolean; reason?: string }> {
  if (passcode.length < 4) return { ok: false, reason: 'At least 4 characters.' }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const rec: PasscodeRecord = { saltB64: toB64(salt.buffer), hashB64: await deriveHash(passcode, salt), iterations: ITERATIONS }
  storage()?.setItem(STORE_KEY, JSON.stringify(rec))
  ownerUnlocked = true
  storage()?.setItem(UNLOCK_KEY, '1')
  notify()
  return { ok: true }
}

export async function unlock(passcode: string): Promise<boolean> {
  const raw = storage()?.getItem(STORE_KEY)
  if (!raw) return false
  try {
    const rec = JSON.parse(raw) as PasscodeRecord
    const hash = await deriveHash(passcode, fromB64(rec.saltB64), rec.iterations)
    if (hash === rec.hashB64) {
      ownerUnlocked = true
      storage()?.setItem(UNLOCK_KEY, '1')
      notify()
      return true
    }
  } catch {
    /* corrupt record → stays locked */
  }
  return false
}

export function lock(): void {
  ownerUnlocked = false
  storage()?.removeItem(UNLOCK_KEY)
  notify()
}

/** Restore per-device unlock at boot. */
export function restoreDarbaan(): void {
  ownerUnlocked = hasPasscode() && storage()?.getItem(UNLOCK_KEY) === '1'
}

/**
 * Owner check. A browser with NO passcode record is a fresh/visitor browser: it runs in
 * Darshak mode until someone sets a passcode ("Enter Owner Mode" → first-run setup). That
 * visitor owns only their local demo copy — stated honestly in the UI.
 */
export function isOwner(): boolean {
  return ownerUnlocked
}

export class DarbaanLockedError extends Error {
  constructor(table: string) {
    super(`Darshak mode is read-only — unlock Owner Mode to change "${table}". (I12)`)
    this.name = 'DarbaanLockedError'
  }
}

/** Tables the showcase may still write (infra/caches — never his story). */
const INFRA_TABLES = new Set(['dimaagCache', 'dimaagUsage', 'nabzCache', 'budgets'])

/** Seeding runs before the UI exists; it may write while the module flag is up. */
let seedingAllowance = false
export async function withSeedAllowance<T>(fn: () => Promise<T>): Promise<T> {
  seedingAllowance = true
  try {
    return await fn()
  } finally {
    seedingAllowance = false
  }
}

/** The db middleware's single question (I12, enforced at the DBCore level). */
export function mutationAllowed(table: string): boolean {
  return ownerUnlocked || seedingAllowance || INFRA_TABLES.has(table)
}
