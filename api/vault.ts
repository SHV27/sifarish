import { put, list } from '@vercel/blob'

/**
 * /api/vault — CROSS-DEVICE SYNC, SERVER-BLIND (Session 5.3). Stores the owner's vault so it stays
 * up to date on every device he opens Owner Mode from, ANYWHERE. The server only ever sees CIPHERTEXT:
 * the vault is AES-256-GCM encrypted client-side with a key derived from his passcode (PBKDF2) — and the
 * server only holds SHA-256(passcode) as the token, which is one-way, so it can never derive the key.
 *
 * Access is token-gated (the same owner token the metered functions require) and origin-checked. The blob
 * lives at a passcode-derived, unguessable path. If BLOB_READ_WRITE_TOKEN isn't configured, this returns
 * {configured:false} and the client silently falls back to local-only — sync never breaks the app.
 *
 * Node runtime (the @vercel/blob SDK needs Node's APIs — it can fail in Edge, vercel/storage#440).
 * On the Node runtime a bare default-export function is treated as the (req, res) Express handler, so
 * we export the Web-standard `{ fetch }` form (Vercel Node docs) to keep the Web Request/Response API.
 */

export const config = { runtime: 'nodejs' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function originOk(req: Request): boolean {
  const origin = req.headers.get('origin') ?? ''
  let host = ''
  try {
    host = new URL(origin).hostname
  } catch {
    /* absent/garbled */
  }
  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? ''
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    (prodHost !== '' && host === prodHost) ||
    host === 'sifarish-shv-s-projects.vercel.app' ||
    host.endsWith('-shv-s-projects.vercel.app')
  )
}

/** The vault is OWNER-ONLY: the header token must equal SHA-256(the server passcode). */
async function authToken(req: Request): Promise<string | null> {
  const header = req.headers.get('x-sifarish-token') ?? ''
  if (!header) return null
  const passcode = process.env.SIFARISH_OWNER_PASSCODE
  if (passcode) return header === (await sha256Hex(passcode)) ? header : null
  return header // self-hosted (no server passcode): the token itself is the key namespace
}

async function handler(req: Request): Promise<Response> {
  if (!originOk(req)) return json({ error: 'forbidden' }, 403)
  const token = await authToken(req)
  if (!token) return json({ error: 'unauthorized' }, 401)

  const rw = process.env.BLOB_READ_WRITE_TOKEN
  if (!rw) return json({ configured: false }) // sync not provisioned → client stays local-only

  const path = `vault/${token}.json`

  try {
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: path, token: rw, limit: 1 })
      const hit = blobs.find((b) => b.pathname === path)
      if (!hit) return json({ configured: true, empty: true })
      const res = await fetch(hit.url, { cache: 'no-store' })
      if (!res.ok) return json({ configured: true, empty: true })
      const data = (await res.json()) as { cipher?: string; updatedAt?: number }
      return json({ configured: true, cipher: data.cipher ?? null, updatedAt: data.updatedAt ?? 0 })
    }
    if (req.method === 'POST') {
      const body = (await req.json()) as { cipher?: string; updatedAt?: number }
      if (typeof body?.cipher !== 'string' || body.cipher.length < 8) return json({ error: 'bad request' }, 400)
      await put(path, JSON.stringify({ cipher: body.cipher, updatedAt: Number(body.updatedAt) || Date.now() }), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        token: rw,
      })
      return json({ configured: true, ok: true })
    }
    return json({ error: 'method' }, 405)
  } catch (e) {
    // Never surface an error to the client — sync is best-effort; the app is local-first regardless.
    return json({ configured: true, error: String(e).slice(0, 100) }, 200)
  }
}

export default { fetch: handler }
