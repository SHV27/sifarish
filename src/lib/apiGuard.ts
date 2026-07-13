import { getApiToken } from './darbaan/lock'
import { isOwnerMode } from './pehchaan'

/**
 * METERED-API GUARD (D44/D46, Session-5 rewire) — "only the verified owner can spend."
 *
 * Every client that can reach a keyed serverless endpoint (Groq / Tavily / JSearch) asks this
 * first. In DEMO mode `meteredCallsAllowed()` is false → the deterministic keyless path runs, so
 * a viral public URL can never spend a token. Ownership is PEHCHAAN's single answer; the
 * server-issued token rides on every call and the API functions refuse to spend without it. Belt
 * AND suspenders: even tampered client state cannot spend, because the server re-checks the token.
 */
export function meteredCallsAllowed(): boolean {
  return isOwnerMode()
}

/** Headers for every metered /api call: JSON + the owner token when present. */
export function meteredHeaders(): Record<string, string> {
  const t = getApiToken()
  return t ? { 'Content-Type': 'application/json', 'x-sifarish-token': t } : { 'Content-Type': 'application/json' }
}

export { getApiToken, setApiToken } from './darbaan/lock'
