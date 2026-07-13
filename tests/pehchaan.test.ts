import { describe, expect, it, afterEach } from 'vitest'
import { resolveBoot, ownerRemembered, getMode, storeName, isOwnerMode } from '../src/lib/pehchaan'

/**
 * Session-5 gate — PEHCHAAN: the single identity resolver. (FIX-1: owner was greeted as the demo
 * persona because identity was a boolean flag over one shared store.) These assert the resolution
 * logic directly; `getMode()`/`storeName()` are frozen at module load (the test process booted as
 * owner via setup.ts), which is exactly the boot-once contract.
 */

const UNLOCK = 'sifarish.darbaan.unlocked'
const TOKEN = 'sifarish.apitoken'
const PASS = 'sifarish.darbaan'
const GATE = 'sifarish.gate'

afterEach(() => {
  // Restore the owner-unlock state the rest of the suite depends on.
  localStorage.setItem(UNLOCK, '1')
  localStorage.setItem(TOKEN, 'test-token')
  sessionStorage.removeItem(GATE)
})

describe('resolveBoot — the three doors', () => {
  it('owner iff a remembered unlock AND a credential are present', () => {
    localStorage.setItem(UNLOCK, '1')
    localStorage.setItem(TOKEN, 'tok')
    expect(ownerRemembered()).toBe(true)
    expect(resolveBoot()).toBe('owner')
  })

  it('unlock flag WITHOUT any credential is NOT owner (a stray flag cannot self-appoint)', () => {
    localStorage.setItem(UNLOCK, '1')
    localStorage.removeItem(TOKEN)
    localStorage.removeItem(PASS)
    expect(ownerRemembered()).toBe(false)
    expect(resolveBoot()).toBe('gate')
  })

  it('a chosen demo session resolves to darshak, never owner', () => {
    localStorage.removeItem(UNLOCK)
    localStorage.removeItem(TOKEN)
    localStorage.removeItem(PASS)
    sessionStorage.setItem(GATE, 'demo')
    expect(resolveBoot()).toBe('darshak')
  })

  it('a fresh visitor (nothing remembered, no choice) lands on the gate', () => {
    localStorage.removeItem(UNLOCK)
    localStorage.removeItem(TOKEN)
    localStorage.removeItem(PASS)
    sessionStorage.removeItem(GATE)
    expect(resolveBoot()).toBe('gate')
  })
})

describe('frozen mode → physical store (the two-vault split)', () => {
  it('the test process booted as owner and mounts the owner vault', () => {
    expect(getMode()).toBe('owner')
    expect(isOwnerMode()).toBe(true)
    expect(storeName()).toBe('sifarish_owner')
  })

  it('store names are physically distinct — owner and demo can never clobber', () => {
    // Documented contract: demo mode → 'sifarish_demo', owner → 'sifarish_owner'.
    // (Different Dexie DB names = different IndexedDB databases.)
    expect(storeName()).not.toBe('sifarish_demo')
  })
})
