/**
 * /api/polish — the ONLY serverless function. Groq narrator, keyless-degradable.
 *
 * Security (CLAUDE.md §10): GROQ_API_KEY is read from platform env ONLY — never VITE_-prefixed,
 * never in the client bundle. If the key is absent, this returns 200 with polished:null and the
 * client keeps the compiled text. The app is fully functional with no key (I4).
 *
 * Invariant (I1 for the LLM): the model may only rephrase for flow in Shaurya's register.
 * The authoritative fact-drift guard runs CLIENT-side on the response; this server-side
 * instruction is defense-in-depth, not the enforcement.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
// llama-3.3-70b-versatile deprecated by Groq 17-Jun-2026 (shutdown 16-Aug-2026) → gpt-oss-120b (D35).
const MODEL = 'openai/gpt-oss-120b'

interface PolishRequest {
  lines: string[]
  voiceSamples: string[]
}

export const config = { runtime: 'edge' }

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
  if (!key) return json({ polished: null, reason: 'keyless' }, 200)

  let body: PolishRequest
  try {
    body = (await req.json()) as PolishRequest
  } catch {
    return json({ error: 'bad json' }, 400)
  }
  const lines = Array.isArray(body.lines) ? body.lines.slice(0, 20) : []
  if (lines.length === 0) return json({ polished: null, reason: 'empty' }, 200)

  const voice = (body.voiceSamples ?? []).slice(0, 6).join('\n')
  const system = [
    'You are a resume line editor. You rephrase bullet points for flow and concision ONLY.',
    'ABSOLUTE RULES:',
    '- Never add a fact, number, metric, tool, company, or skill that is not already in the input line.',
    '- Never invent outcomes or scale. If the line has no number, your output has no number.',
    '- Keep every proper noun and technology exactly as written.',
    '- Match this writing voice (terse, concrete, no corporate filler):',
    voice || '(no samples; default to plain, concrete, active voice)',
    // D74/D79: the schema owns the STRUCTURE — spelling the JSON shape out in prose here fights
    // the json_schema response_format and reintroduces the 400s. Content rule only:
    'Rephrase every input line, same order, same count.',
  ].join('\n')

  const user = JSON.stringify({ lines })

  try {
    // D74 applied here too (Session 5.10 context audit): openai/gpt-oss-120b measured ~0/3 on
    // json_object — this function was the last call site on the broken mode, so the polish pass
    // was silently degrading to "keep as compiled" on most calls. json_schema + one retry.
    let res: Response | undefined
    for (let attempt = 1; attempt <= 2; attempt++) {
      res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.3,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'result',
              strict: true,
              schema: {
                type: 'object',
                properties: { lines: { type: 'array', items: { type: 'string' } } },
                required: ['lines'],
                additionalProperties: false,
              },
            },
          },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      })
      if (res.ok || res.status === 429) break
    }
    if (!res || !res.ok) return json({ polished: null, reason: `groq ${res?.status ?? 'no-response'}` }, 200)
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(content)
    const out: unknown = parsed.lines
    if (!Array.isArray(out) || out.length !== lines.length) return json({ polished: null, reason: 'shape' }, 200)
    return json({ polished: out.map(String) }, 200)
  } catch (e) {
    return json({ polished: null, reason: String(e).slice(0, 80) }, 200)
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
