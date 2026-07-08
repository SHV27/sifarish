/**
 * /api/guru — the Guru's LLM voice (Groq, streaming). Full read-context is compiled
 * client-side and passed as the system prompt. Honesty-critical intents are intercepted by
 * the client router BEFORE this is called; the client re-scans every streamed reply for
 * guarantee language (I9). Keyless → { keyless:true }. Self-contained (edge-safe).
 */

export const config = { runtime: 'edge' }

const MODEL = 'llama-3.3-70b-versatile'

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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
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
    { role: 'system', content: body.system.slice(0, 8000) },
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
