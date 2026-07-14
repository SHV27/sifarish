import { enterOwnerMode } from '../pehchaan'
import { establishSyncKey } from '../sync'

/**
 * DARBAAN — the AUTHENTICATION + TOKEN layer only (Session 5 split; RC1/RC3 cure). "Who is here"
 * is answered by PEHCHAAN; "may this call spend" by the server-issued token. This module just
 * verifies the owner and holds the token. Two cleanly separated gates that must never re-merge:
 *   • LOCAL UNLOCK gates VIEW/EDIT of local data (a device convenience, not a spend credential).
 *   • SERVER OWNER TOKEN gates every METERED SPEND (verified by /api/darbaan vs the Vercel env).
 */

const PASSCODE_KEY = 'sifarish.darbaan'
const TOKEN_KEY = 'sifarish.apitoken'
const ITERATIONS = 210_000

interface PasscodeRecord {
  saltB64: string
  hashB64: string
  iterations: number
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}
function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

export async function deriveHash(passcode: string, salt: Uint8Array, iterations = ITERATIONS): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256)
  return toB64(bits)
}

export function hasPasscode(): boolean {
  return !!storage()?.getItem(PASSCODE_KEY)
}

/** Local (self-hosted/dev) passcode set — no server secret present. */
export async function setPasscode(passcode: string): Promise<{ ok: boolean; reason?: string }> {
  if (passcode.length < 4) return { ok: false, reason: 'At least 4 characters.' }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const rec: PasscodeRecord = { saltB64: toB64(salt.buffer), hashB64: await deriveHash(passcode, salt), iterations: ITERATIONS }
  storage()?.setItem(PASSCODE_KEY, JSON.stringify(rec))
  return { ok: true }
}

async function unlockLocal(passcode: string): Promise<boolean> {
  const raw = storage()?.getItem(PASSCODE_KEY)
  if (!raw) return false
  try {
    const rec = JSON.parse(raw) as PasscodeRecord
    return (await deriveHash(passcode, fromB64(rec.saltB64), rec.iterations)) === rec.hashB64
  } catch {
    return false
  }
}

// ---------------- owner API token (grants the metered endpoints) ----------------

export function getApiToken(): string | null {
  return storage()?.getItem(TOKEN_KEY) ?? null
}
export function setApiToken(token: string): void {
  if (token) storage()?.setItem(TOKEN_KEY, token)
  else storage()?.removeItem(TOKEN_KEY)
}

// ---------------- authentication ----------------

export type GateMode = 'remote' | 'local'

/** Is this deployment owner-locked server-side? (fresh dev/preview/self-hosted → 'local') */
export async function gateMode(): Promise<GateMode> {
  try {
    const r = await fetch('/api/darbaan')
    if (r.ok && (await r.json())?.configured) return 'remote'
  } catch {
    /* no serverless here → local */
  }
  return 'local'
}

/**
 * The ONLY door into Owner Mode. Remote-first: the passcode is verified by /api/darbaan against
 * the Vercel env — a stranger can never "set a new lock", the lock does not live in their browser.
 * On success we issue the token and hand off to PEHCHAAN.enterOwnerMode() (which reloads into the
 * owner vault). Local PBKDF2 flow is used ONLY when the deployment has no server secret.
 *
 * Returns before the reload takes effect; `reason:'local-setup'` asks the UI for a confirm field.
 */
export async function authenticate(passcode: string, confirm?: string): Promise<{ ok: boolean; reason?: string }> {
  if (!passcode) return { ok: false, reason: 'Enter the owner code.' }
  try {
    const r = await fetch('/api/darbaan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    })
    if (r.ok) {
      const d = (await r.json()) as { configured?: boolean; ok?: boolean; token?: string }
      if (d.configured !== false) {
        if (d.ok && d.token) {
          setApiToken(d.token)
          await establishSyncKey(passcode) // cross-device sync key (server-blind) — before the reload
          enterOwnerMode() // persists unlock + reloads into sifarish_owner
          return { ok: true }
        }
        return { ok: false, reason: 'Wrong owner code.' }
      }
    }
  } catch {
    /* endpoint unreachable → local fallback below */
  }

  // Local fallback (no server secret): self-hosted users still get an owner lock.
  if (hasPasscode()) {
    if (await unlockLocal(passcode)) {
      await establishSyncKey(passcode)
      enterOwnerMode()
      return { ok: true }
    }
    return { ok: false, reason: 'Wrong passcode.' }
  }
  if (confirm === undefined) return { ok: false, reason: 'local-setup' }
  if (passcode !== confirm) return { ok: false, reason: 'Passcodes do not match.' }
  const set = await setPasscode(passcode)
  if (set.ok) {
    await establishSyncKey(passcode)
    enterOwnerMode()
  }
  return set
}
