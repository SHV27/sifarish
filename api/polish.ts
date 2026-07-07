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
const MODEL = 'llama-3.3-70b-versatile'

interface PolishRequest {
  lines: string[]
  voiceSamples: string[]
}

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

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
    'Return a JSON object {"lines": string[]} with one rephrased line per input line, same order, same count.',
  ].join('\n')

  const user = JSON.stringify({ lines })

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    if (!res.ok) return json({ polished: null, reason: `groq ${res.status}` }, 200)
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
