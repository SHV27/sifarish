import { isOwner } from './darbaan/lock'

/**
 * METERED-API GUARD (v4.1, D44) — "Darshak mode is structurally keyless."
 *
 * Every client that can reach a keyed serverless endpoint (Groq / Tavily / JSearch) asks this
 * module first. Locked (Darshak/demo) browsers get `false` and take their deterministic
 * keyless path — so a viral public URL can never spend a token of the owner's budget, by
 * construction, not by button-hiding. The Dexie write-block (I12) already stops data
 * mutations; this stops the SPEND that used to happen before the write.
 */
export function meteredCallsAllowed(): boolean {
  return isOwner()
}

const TOKEN_KEY = 'sifarish.apitoken'

/** Optional second wall: if SIFARISH_OWNER_TOKEN is set on Vercel, the API functions demand
 *  this header. The owner pastes the same value once in Settings; it lives only on his device. */
export function getApiToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setApiToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable — header simply won't be sent */
  }
}

/** Headers for every metered /api call: JSON + the owner token when present. */
export function meteredHeaders(): Record<string, string> {
  const t = getApiToken()
  return t ? { 'Content-Type': 'application/json', 'x-sifarish-token': t } : { 'Content-Type': 'application/json' }
}
