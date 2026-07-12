/**
 * /api/darbaan — THE DOORKEEPER'S DESK (D46). Ownership is decided by the SERVER:
 * the owner passcode lives in the Vercel env (SIFARISH_OWNER_PASSCODE), never in any
 * browser. A correct POST returns the owner token (SHA-256 of the passcode) that every
 * metered endpoint demands before spending a key. A stranger cannot "set a new lock" —
 * there is nothing to set; the lock is not in their browser.
 *
 * GET → { configured } so the gate screen knows which flow to show (self-hosted clones
 * without the env fall back to the local-passcode flow; their deployment, their keys).
 * Self-contained (edge, no shared imports — D22).
 */

export const config = { runtime: 'edge' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
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
    /* absent or garbled Origin */
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

export default async function handler(req: Request): Promise<Response> {
  const passcode = process.env.SIFARISH_OWNER_PASSCODE

  if (req.method === 'GET') return json({ configured: !!passcode })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!originOk(req)) return json({ error: 'forbidden' }, 403)
  if (!passcode) return json({ configured: false })

  let attempt = ''
  try {
    attempt = String(((await req.json()) as { passcode?: string }).passcode ?? '')
  } catch {
    return json({ error: 'bad request' }, 400)
  }

  // Constant-ish time compare via hashes; a wrong code also eats a delay (brute-force tax).
  const [attemptHash, realHash] = await Promise.all([sha256Hex(attempt), sha256Hex(passcode)])
  if (attemptHash !== realHash) {
    await new Promise((r) => setTimeout(r, 600))
    return json({ configured: true, ok: false })
  }
  return json({ configured: true, ok: true, token: realHash })
}
