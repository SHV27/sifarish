/**
 * /api/dimaag — the reasoning core's LLM tier (Groq, JSON mode). Two models:
 *   reasoning → openai/gpt-oss-120b  (decide / critique / casting / angle)
 *   classify  → llama-3.1-8b-instant (archetype / extraction)
 * Returns parsed JSON + token usage (for the Dimaag Ledger, I8). Keyless → { keyless:true }
 * so every caller falls back to a deterministic heuristic (I4). Self-contained (edge, no shared import).
 */

export const config = { runtime: 'edge' }

const MODELS = {
  reasoning: 'openai/gpt-oss-120b',
  classify: 'llama-3.1-8b-instant',
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
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
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

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: body.tier === 'classify' ? 0 : 0.2,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: body.system.slice(0, 8000) },
          { role: 'user', content: body.user.slice(0, 12000) },
        ],
      }),
    })
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
