/**
 * /api/guru — the Guru's LLM voice (Groq, streaming). Full read-context is compiled
 * client-side and passed as the system prompt. Honesty-critical intents are intercepted by
 * the client router BEFORE this is called; the client re-scans every streamed reply for
 * guarantee language (I9). Keyless → { keyless:true }. Self-contained (edge-safe).
 */

export const config = { runtime: 'edge' }

// llama-3.3-70b-versatile was deprecated by Groq 17-Jun-2026 (shutdown 16-Aug-2026);
// openai/gpt-oss-120b is Groq's stated migration path (D35).
const MODEL = 'openai/gpt-oss-120b'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

interface GuruRequest {
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}

/**
 * v4.2 request guard (D46) — the owner is verified by the SERVER, never self-declared:
 *  1. Origin must be THIS app (its own vercel.app hosts or localhost dev). Browsers attach
 *     Origin to every POST and enforce preflight, so third-party sites and raw curl/scripts
 *     are refused before any key is touched.
 *  2. When SIFARISH_OWNER_PASSCODE is set (the production deployment), every metered call
 *     must carry x-sifarish-token = SHA-256(passcode) — issued only by /api/darbaan after a
 *     correct owner code. Missing/wrong token degrades to the keyless path: the app keeps
 *     working for everyone, the keys spend for no one but the owner.
 *  (Legacy SIFARISH_OWNER_TOKEN, if set, is honored as a raw shared token.)
 */
async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function guardRequest(req: Request): Promise<Response | null> {
  const origin = req.headers.get('origin') ?? ''
  let host = ''
  try {
    host = new URL(origin).hostname
  } catch {
    /* absent or garbled Origin → not a browser session on this app */
  }
  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? ''
  const originOk =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    (prodHost !== '' && host === prodHost) ||
    host === 'sifarish-shv-s-projects.vercel.app' ||
    host.endsWith('-shv-s-projects.vercel.app')
  if (!originOk) return json({ error: 'forbidden' }, 403)
  const header = req.headers.get('x-sifarish-token') ?? ''
  const legacy = process.env.SIFARISH_OWNER_TOKEN
  if (legacy) {
    return header === legacy ? null : json({ keyless: true, reason: 'owner token required' }, 200)
  }
  const passcode = process.env.SIFARISH_OWNER_PASSCODE
  if (passcode && header !== (await sha256Hex(passcode))) {
    return json({ keyless: true, reason: 'owner token required' }, 200)
  }
  return null
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const guarded = await guardRequest(req)
  if (guarded) return guarded
  const key = process.env.GROQ_API_KEY
  if (!key) return json({ keyless: true })

  let body: GuruRequest | null = null
  try {
    body = (await req.json()) as GuruRequest
  } catch {
    return json({ error: 'bad request' }, 400)
  }
  if (!body?.system || !Array.isArray(body.messages)) return json({ error: 'bad request' }, 400)

  const messages = [
    // 12000 (was 8000, Session 5.5) — the compiled dossier (vision + ledger + briefs + pulse) grows
    // as Nabz adds work; 8000 clipped the tail. gpt-oss-120b's context is far larger, so this is safe.
    { role: 'system', content: body.system.slice(0, 12000) },
    ...body.messages.slice(-12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
  ]

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, temperature: 0.4, max_tokens: 700, stream: true, messages }),
    })
    if (!upstream.ok || !upstream.body) return json({ keyless: false, error: `groq ${upstream.status}` }, 200)
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (e) {
    return json({ keyless: false, error: String(e).slice(0, 100) }, 200)
  }
}
