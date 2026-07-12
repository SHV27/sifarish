import { getApiToken, isOwner } from './darbaan/lock'

/**
 * METERED-API GUARD (D44/D46) — "only the verified owner can spend."
 *
 * Every client that can reach a keyed serverless endpoint (Groq / Tavily / JSearch) asks this
 * module first. Locked (Darshak/demo) browsers get `false` and take their deterministic
 * keyless path — a viral public URL can never spend a token of the owner's budget.
 *
 * Ownership itself is granted only by `authenticate()` (darbaan/lock.ts): server-verified
 * against SIFARISH_OWNER_PASSCODE. The token it issues (SHA-256 of the passcode) rides on
 * every metered call; the API functions refuse to spend without it. Belt AND suspenders:
 * even a tampered client state cannot spend, because the server checks the token again.
 */
export function meteredCallsAllowed(): boolean {
  return isOwner()
}

/** Headers for every metered /api call: JSON + the owner token when present. */
export function meteredHeaders(): Record<string, string> {
  const t = getApiToken()
  return t ? { 'Content-Type': 'application/json', 'x-sifarish-token': t } : { 'Content-Type': 'application/json' }
}

export { getApiToken, setApiToken } from './darbaan/lock'
