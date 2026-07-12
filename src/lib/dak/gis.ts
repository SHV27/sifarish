/**
 * DAK KHANA — Google Identity Services token flow (P15).
 *
 * SECURITY MODEL (verified against GIS docs, 12-Jul-2026 — RESEARCH.md §7):
 *   • Scope is gmail.readonly ONLY — sending mail is STRUCTURALLY impossible (I3). There is no
 *     code path, scope, or endpoint in this app that can compose, send, or modify mail.
 *   • The Client ID is public-safe configuration (no secret exists in this flow).
 *   • Access tokens live in MEMORY only — never localStorage, never Dexie, never a server.
 *   • Mail is read in-browser and never sent to any server of ours.
 *   • The Google Cloud app stays in Testing mode with Shaurya as the sole test user — exempt
 *     from Google verification for personal, <100-user apps (expect the "unverified app" interstitial).
 */

export const GOOGLE_CLIENT_ID: string =
  (import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined) ??
  '166073365717-v1vt918pnof22r2s1odo9qq04hr1tf35.apps.googleusercontent.com'

/** READ-ONLY. Changing this string is a certification-blocking defect (I3 gate greps for it). */
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

interface TokenState {
  accessToken: string
  expiresAt: number
}

let token: TokenState | null = null

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void }
          revoke: (accessToken: string, done?: () => void) => void
        }
      }
    }
  }
}

let gisLoading: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisLoading) return gisLoading
  gisLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load Google Identity Services (offline?)'))
    document.head.appendChild(s)
  })
  return gisLoading
}

export function isConnected(): boolean {
  return !!token && token.expiresAt > Date.now() + 30_000
}

export function getAccessToken(): string | null {
  return isConnected() ? token!.accessToken : null
}

/** Interactive connect: opens the Google consent flow; resolves with a live token. */
export async function connectGmail(): Promise<{ ok: boolean; error?: string }> {
  try {
    await loadGis()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  return new Promise((resolve) => {
    try {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GMAIL_SCOPE,
        callback: (resp) => {
          if (resp.error || !resp.access_token) {
            resolve({ ok: false, error: resp.error ?? 'no token granted' })
            return
          }
          token = { accessToken: resp.access_token, expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000 }
          resolve({ ok: true })
        },
      })
      client.requestAccessToken()
    } catch (e) {
      resolve({ ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  })
}

/** Forget the in-memory token and revoke the grant. */
export function disconnectGmail(): void {
  const t = token?.accessToken
  token = null
  if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t)
}
