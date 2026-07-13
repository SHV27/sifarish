import { useSyncExternalStore } from 'react'

/**
 * PEHCHAAN (पहचान · identity) — THE SINGLE SOURCE OF "who is here." (Session 5, RC1 cure.)
 *
 * No component, store, or guard may infer the mode any other way. Resolution is SYNCHRONOUS at
 * module load (before any screen renders → no flash of the wrong identity), and the DB layer picks
 * its physical store from this. A mode never changes silently mid-session: every transition
 * (unlock, lock, choose-demo) persists the choice and does a FULL RELOAD, so the store, the
 * identity, and every gate are recomputed from one truth. That crisp boundary is the whole point —
 * it makes the "Arjun-in-owner" and "stale store" classes of bug impossible by construction.
 */

export type Mode = 'owner' | 'darshak'
export type BootState = 'owner' | 'darshak' | 'gate'

const UNLOCK_KEY = 'sifarish.darbaan.unlocked'
const TOKEN_KEY = 'sifarish.apitoken'
const PASSCODE_KEY = 'sifarish.darbaan'
const GATE_KEY = 'sifarish.gate' // sessionStorage: 'demo' once the visitor chose the showcase

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}
function ss(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null
  }
}

/** True iff this device has a remembered, valid owner unlock (local record OR issued API token). */
export function ownerRemembered(): boolean {
  const unlocked = ls()?.getItem(UNLOCK_KEY) === '1'
  const hasCredential = !!ls()?.getItem(TOKEN_KEY) || !!ls()?.getItem(PASSCODE_KEY)
  return unlocked && hasCredential
}

/** The three boot states. `gate` = undecided visitor → show the Owner/Demo door. */
export function resolveBoot(): BootState {
  if (ownerRemembered()) return 'owner'
  if (ss()?.getItem(GATE_KEY) === 'demo') return 'darshak'
  return 'gate'
}

/**
 * THE mode, frozen for this page load. `gate` resolves to `darshak` here because the store the
 * gate screen mounts (it reads no owner data) is the safe demo store. Any code asking "which
 * physical store / can I spend / can I mutate" gets a definitive answer with zero ambiguity.
 */
const BOOT: BootState = resolveBoot()
export function getMode(): Mode {
  return BOOT === 'owner' ? 'owner' : 'darshak'
}
export function getBootState(): BootState {
  return BOOT
}
export function isOwnerMode(): boolean {
  return getMode() === 'owner'
}

/** The physical Dexie database name for this session (Tijori's two-vault split). */
export function storeName(): string {
  return getMode() === 'owner' ? 'sifarish_owner' : 'sifarish_demo'
}

// ---------------- transitions (each persists, then reloads to recompute everything) ----------------

function reload() {
  try {
    location.reload()
  } catch {
    /* non-browser (tests) — caller observes the storage change instead */
  }
}

/** Called after a successful owner authentication. Remembers the unlock and reloads into the owner vault. */
export function enterOwnerMode(): void {
  ls()?.setItem(UNLOCK_KEY, '1')
  ss()?.removeItem(GATE_KEY)
  reload()
}

/** Visitor chose the showcase. */
export function chooseDemoMode(): void {
  ss()?.setItem(GATE_KEY, 'demo')
  reload()
}

/** Lock: forget the unlock flag (NOT the passcode/token record) and return to the gate. */
export function lockToGate(): void {
  ls()?.removeItem(UNLOCK_KEY)
  ss()?.removeItem(GATE_KEY)
  reload()
}

// ---------------- React binding (state is page-load-frozen; the hook exists for symmetry) ----------------

export function usePehchaan(): { mode: Mode; boot: BootState } {
  const mode = useSyncExternalStore(
    () => () => {},
    () => getMode(),
    () => 'darshak' as Mode,
  )
  return { mode, boot: BOOT }
}
