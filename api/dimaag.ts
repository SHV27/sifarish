/**
 * /api/dimaag — the reasoning core's LLM tier, Session 7: THE FREE ROUTER.
 *
 * The owner has zero API budget by design — so the premium lane is a CHAIN of free tiers:
 *   reasoning → Gemini 3 Flash (preview, best free reasoning) → Gemini 3.1 Flash-Lite
 *               (stable, 30 RPM / 1M TPM) → Groq openai/gpt-oss-120b → (client heuristic, loud)
 *   classify  → Groq openai/gpt-oss-20b → Gemini 3.1 Flash-Lite → (client heuristic)
 * Three free brains chained: quota exhaustion degrades ONE hop, never to silence. A provider's
 * 429/4xx/non-JSON moves to the next; only when EVERY lane is rate-limited does the client see
 * rateLimited (and backs off + retries on the LLM path — never the deterministic one, D105).
 *
 * Law-12 notes (verified live 18-Jul-2026): Gemini model ids are PINNED (the `-latest` aliases
 * can silently jump models under a schema); gemini-2.5-flash is closed to new accounts; Groq
 * gpt-oss models are current (not deprecated) with 8K TPM — the historical choke the router
 * now routes around. Returns parsed JSON + token usage (Dimaag Ledger, I8). Keyless →
 * { keyless:true } so every caller falls back deterministically (I4). Self-contained (D22).
 */

export const config = { runtime: 'edge' }

const GROQ_MODELS = {
  reasoning: 'openai/gpt-oss-120b',
  classify: 'openai/gpt-oss-20b',
} as const

const GEMINI_REASONING = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite'] as const
const GEMINI_CLASSIFY = ['gemini-3.1-flash-lite'] as const

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
  /** JSON Schema for the expected result (D74/D80) — Groq gets json_schema strict mode,
   *  Gemini gets the converted responseSchema. Optional; without it, json_object/MIME-JSON. */
  schema?: Record<string, unknown>
}

/**
 * Gemini's responseSchema speaks an OpenAPI subset, not full JSON Schema: no
 * additionalProperties/strict, and nullable unions are `nullable: true`, never
 * `type: ["string","null"]` (the D80 lesson in reverse — each provider's dialect enforced
 * at the boundary, or the request 400s in a way indistinguishable from a dumb model).
 */
export function toGeminiSchema(s: unknown): Record<string, unknown> | undefined {
  if (!s || typeof s !== 'object') return undefined
  const src = s as Record<string, unknown>
  const out: Record<string, unknown> = {}
  let t = src.type
  if (Array.isArray(t)) {
    const nonNull = t.filter((x) => x !== 'null')
    if (nonNull.length !== t.length) out.nullable = true
    t = nonNull[0] ?? 'string'
  }
  if (typeof t === 'string') out.type = t.toUpperCase() === t ? t : t // Gemini accepts lowercase types
  if (typeof src.description === 'string') out.description = src.description
  if (Array.isArray(src.enum)) out.enum = src.enum
  if (Array.isArray(src.required)) out.required = src.required
  if (src.properties && typeof src.properties === 'object') {
    const props: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(src.properties as Record<string, unknown>)) {
      const conv = toGeminiSchema(v)
      if (conv) props[k] = conv
    }
    out.properties = props
  }
  if (src.items) out.items = toGeminiSchema(src.items)
  return out
}

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

type LaneResult =
  | { ok: true; content: string; tokens: number; model: string }
  | { ok: false; rateLimited?: boolean; error: string }

async function callGemini(
  model: string,
  key: string,
  body: DimaagRequest,
  maxTokens: number,
): Promise<LaneResult> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: body.system.slice(0, 16000) }] },
        contents: [{ role: 'user', parts: [{ text: body.user.slice(0, 16000) }] }],
        generationConfig: {
          temperature: body.tier === 'classify' ? 0 : 0.2,
          // Thinking models spend output tokens on reasoning before the JSON — a tight cap
          // truncates the answer mid-object, which parses as "the model is dumb" (D80 class).
          maxOutputTokens: Math.max(2048, maxTokens * 2),
          responseMimeType: 'application/json',
          ...(body.schema ? { responseSchema: toGeminiSchema(body.schema) } : {}),
        },
      }),
    })
    if (res.status === 429) return { ok: false, rateLimited: true, error: 'gemini 429' }
    if (!res.ok) return { ok: false, error: `gemini ${res.status}` }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
      usageMetadata?: { totalTokenCount?: number }
    }
    const content = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
    if (!content) return { ok: false, error: 'gemini empty' }
    return { ok: true, content, tokens: data.usageMetadata?.totalTokenCount ?? 0, model }
  } catch (e) {
    return { ok: false, error: `gemini ${String(e).slice(0, 60)}` }
  }
}

async function callGroq(key: string, body: DimaagRequest, maxTokens: number): Promise<LaneResult> {
  const model = GROQ_MODELS[body.tier] ?? GROQ_MODELS.reasoning
  // SERVER-SIDE RETRY (D73): gpt-oss-120b fails json_object non-deterministically; a 400 costs
  // no output tokens, so re-asking is free. A 429 is NOT retried here — the router moves on.
  let res!: Response
  try {
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
            // 16k caps (Session 5.10): the truth must never be the first thing truncated.
            { role: 'system', content: body.system.slice(0, 16000) },
            { role: 'user', content: body.user.slice(0, 16000) },
          ],
        }),
      })
      if (res.ok || res.status === 429) break
      if (attempt < 3) await new Promise((r) => setTimeout(r, 200 * attempt))
    }
    if (res.status === 429) return { ok: false, rateLimited: true, error: 'groq 429' }
    if (!res.ok) return { ok: false, error: `groq ${res.status}` }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: { total_tokens?: number }
    }
    const content = data.choices?.[0]?.message?.content ?? ''
    if (!content) return { ok: false, error: 'groq empty' }
    return { ok: true, content, tokens: data.usage?.total_tokens ?? 0, model }
  } catch (e) {
    return { ok: false, error: `groq ${String(e).slice(0, 60)}` }
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const guarded = await guardRequest(req)
  if (guarded) return guarded
  const groqKey = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  if (!groqKey && !geminiKey) return json({ keyless: true })

  let body: DimaagRequest | null = null
  try {
    body = (await req.json()) as DimaagRequest
  } catch {
    return json({ error: 'bad request' }, 400)
  }
  if (!body?.system || !body?.user) return json({ error: 'bad request' }, 400)
  const maxTokens = Math.max(128, Math.min(Math.floor(Number(body.maxTokens) || 900), 2000))

  // Build the lane order for this tier from whatever keys exist.
  const lanes: (() => Promise<LaneResult>)[] = []
  if (body.tier === 'classify') {
    if (groqKey) lanes.push(() => callGroq(groqKey, body!, maxTokens))
    if (geminiKey) for (const m of GEMINI_CLASSIFY) lanes.push(() => callGemini(m, geminiKey, body!, maxTokens))
  } else {
    if (geminiKey) for (const m of GEMINI_REASONING) lanes.push(() => callGemini(m, geminiKey, body!, maxTokens))
    if (groqKey) lanes.push(() => callGroq(groqKey, body!, maxTokens))
  }

  let sawRateLimit = false
  let lastError = ''
  for (const lane of lanes) {
    const r = await lane()
    if (!r.ok) {
      sawRateLimit = sawRateLimit || !!r.rateLimited
      lastError = r.error
      continue
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(r.content)
    } catch {
      lastError = `${r.model} non-json`
      continue // a lane that answered garbage is a failed lane — the next brain gets its turn
    }
    return json({ keyless: false, result: parsed, tokens: r.tokens, model: r.model }, 200)
  }
  // Every lane failed. Rate-limited anywhere → tell the client to back off and RETRY the LLM
  // path (never the deterministic one); hard failure → an honest error the health badge shows.
  if (sawRateLimit) return json({ keyless: false, error: 'all lanes rate-limited', rateLimited: true }, 200)
  return json({ keyless: false, error: lastError || 'all lanes failed' }, 200)
}
