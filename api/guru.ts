import { config as edgeConfig, json, readJson } from './_shared'

/**
 * /api/guru — the Guru's LLM voice (Groq, streaming). The full read-context (ledger, vision,
 * pipeline) is compiled CLIENT-side and passed in as the system prompt, so the model already
 * knows Shaurya without a tool round-trip. Honesty-critical intents (guarantee-bait,
 * fabrication-bait) are intercepted by the client router BEFORE this is ever called, and the
 * client re-scans every streamed reply for guarantee language (I9). Keyless → { keyless:true }.
 */

export const config = edgeConfig

const MODEL = 'llama-3.3-70b-versatile'

interface GuruRequest {
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const key = process.env.GROQ_API_KEY
  if (!key) return json({ keyless: true })

  const body = await readJson<GuruRequest>(req)
  if (!body?.system || !Array.isArray(body.messages)) return json({ error: 'bad request' }, 400)

  const messages = [
    { role: 'system', content: body.system },
    ...body.messages.slice(-12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
  ]

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, temperature: 0.4, max_tokens: 700, stream: true, messages }),
    })
    if (!upstream.ok || !upstream.body) {
      return json({ keyless: false, error: `groq ${upstream.status}` }, 200)
    }
    // Proxy the SSE stream straight through to the client.
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
