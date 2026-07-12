/**
 * /api/intel — Company Intel Pass (Tavily). Cited bullets (I7) about a company's
 * engineering culture, AI/LLM work, and hiring. Keyless → { keyless:true } and the compile
 * proceeds exactly as v1. Self-contained (no shared imports, edge-safe).
 */

export const config = { runtime: 'edge' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

interface IntelRequest {
  company: string
}
interface TavilyResult {
  title: string
  url: string
  content: string
}

/**
 * v4.1 request guard (D44) — two walls, zero mandatory setup:
 *  1. Origin must be THIS app (its own vercel.app hosts or localhost dev). Browsers attach
 *     Origin to every POST and enforce preflight, so third-party sites and raw curl/scripts
 *     are refused before any key is touched.
 *  2. Optional full lockdown: set SIFARISH_OWNER_TOKEN in the Vercel env and paste the same
 *     value once in Settings — then a missing/wrong x-sifarish-token header degrades the call
 *     to the keyless path (the app keeps working; the key does not spend).
 */
function guardRequest(req: Request): Response | null {
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
  const required = process.env.SIFARISH_OWNER_TOKEN
  if (required && req.headers.get('x-sifarish-token') !== required) {
    return json({ keyless: true, reason: 'owner token required' }, 200)
  }
  return null
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const guarded = guardRequest(req)
  if (guarded) return guarded
  const key = process.env.TAVILY_API_KEY
  if (!key) return json({ keyless: true, bullets: [], creditsSpent: 0 })

  let body: IntelRequest | null = null
  try {
    body = (await req.json()) as IntelRequest
  } catch {
    return json({ bullets: [], creditsSpent: 0 })
  }
  const company = (body?.company ?? '').trim()
  if (!company) return json({ bullets: [], creditsSpent: 0 })

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: `${company} engineering culture, AI/LLM work, and recent hiring — what a candidate should know`,
        search_depth: 'advanced',
        include_answer: false,
        max_results: 6,
      }),
    })
    if (!res.ok) return json({ keyless: false, bullets: [], creditsSpent: 2, error: `tavily ${res.status}` })
    const data = (await res.json()) as { results?: TavilyResult[] }
    const bullets = (data.results ?? [])
      .filter((r) => r.content && r.url)
      .slice(0, 8)
      .map((r) => ({ text: r.content.replace(/\s+/g, ' ').slice(0, 200).trim(), url: r.url }))
    return json({ keyless: false, bullets, creditsSpent: 2 })
  } catch (e) {
    return json({ keyless: false, bullets: [], creditsSpent: 0, error: String(e).slice(0, 100) })
  }
}
