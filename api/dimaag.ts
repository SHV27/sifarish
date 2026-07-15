/**
 * /api/dimaag — the reasoning core's LLM tier (Groq, JSON mode). Two models:
 *   reasoning → openai/gpt-oss-120b (decide / critique / casting / angle)
 *   classify  → openai/gpt-oss-20b  (archetype / extraction) — Groq deprecated llama-3.1-8b-instant
 *   on 17-Jun-2026 (shutdown 16-Aug-2026); gpt-oss-20b is Groq's stated migration path (D35).
 * Returns parsed JSON + token usage (for the Dimaag Ledger, I8). Keyless → { keyless:true }
 * so every caller falls back to a deterministic heuristic (I4). Self-contained (edge, no shared import).
 */

export const config = { runtime: 'edge' }

const MODELS = {
  reasoning: 'openai/gpt-oss-120b',
  classify: 'openai/gpt-oss-20b',
} as const

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

interface DimaagRequest {
  tier: 'reasoning' | 'classify'
  system: string
  user: string
  maxTokens?: number
  /**
   * JSON Schema for the expected result (D74). When present we ask Groq for `json_schema`
   * structured output instead of `json_object` — measured live 15-Jul-2026, json_object fails
   * on openai/gpt-oss-120b with HTTP 400 "Failed to generate JSON" on ~every call (0/6 across
   * both temperatures), while json_schema returns valid JSON ~2 of 3. Optional so a caller that
   * has no schema still works exactly as before.
   */
  schema?: Record<string, unknown>
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

  let body: DimaagRequest | null = null
  try {
    body = (await req.json()) as DimaagRequest
  } catch {
    return json({ error: 'bad request' }, 400)
  }
  if (!body?.system || !body?.user) return json({ error: 'bad request' }, 400)
  const model = MODELS[body.tier] ?? MODELS.reasoning
  const maxTokens = Math.max(128, Math.min(Math.floor(Number(body.maxTokens) || 900), 2000))

  /**
   * SERVER-SIDE RETRY (D73). openai/gpt-oss-120b fails `json_object` with HTTP 400
   * "Failed to generate JSON" on roughly 3 of 4 calls — measured live 15-Jul-2026, spaced to
   * exclude 429s. The failure is non-deterministic, so re-asking works; a 400 yields no
   * completion, so a retry costs no output tokens. Not every caller goes through the client's
   * dimaag core (the smart Baithak posts here directly), so the retry has to live HERE too —
   * the choke point is the function holding the key (RC3).
   * A 429 is NOT retried: rate limiting means back off, not push harder.
   */
  try {
    let res!: Response
    for (let attempt = 1; attempt <= 3; attempt++) {
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: body.tier === 'classify' ? 0 : 0.2,
          max_tokens: maxTokens,
          response_format: body.schema
            ? { type: 'json_schema', json_schema: { name: 'result', strict: true, schema: body.schema } }
            : { type: 'json_object' },
          messages: [
            { role: 'system', content: body.system.slice(0, 8000) },
            { role: 'user', content: body.user.slice(0, 12000) },
          ],
        }),
      })
      if (res.ok || res.status === 429) break
      if (attempt < 3) await new Promise((r) => setTimeout(r, 200 * attempt))
    }
    if (!res.ok) return json({ keyless: false, error: `groq ${res.status}` }, 200)
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: { total_tokens?: number }
    }
    const content = data.choices?.[0]?.message?.content ?? '{}'
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      return json({ keyless: false, error: 'non-json' }, 200)
    }
    return json({ keyless: false, result: parsed, tokens: data.usage?.total_tokens ?? 0, model }, 200)
  } catch (e) {
    return json({ keyless: false, error: String(e).slice(0, 100) }, 200)
  }
}
