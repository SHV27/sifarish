/**
 * Khabri signal lane — Tavily web search for HIRING SIGNALS, not postings:
 * "X is hiring Claude engineers", new AI-role categories, internship-program announcements.
 * Every result carries a source URL (I7). Budget (I8): query fan-out + results capped.
 * Keyless: returns { keyless:true }. Self-contained (no shared imports, edge-safe).
 */

export const config = { runtime: 'edge' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/** Edge-safe base64 (no Node Buffer). */
function b64(s: string): string {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(s)))
  return s.replace(/\W/g, '').slice(0, 24)
}

interface SignalsRequest {
  queries: string[]
  maxResultsPerQuery?: number
}
interface TavilyResult {
  title: string
  url: string
  content: string
  published_date?: string
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
  if (!key) return json({ keyless: true, signals: [], creditsSpent: 0 })

  let body: SignalsRequest | null = null
  try {
    body = (await req.json()) as SignalsRequest
  } catch {
    return json({ signals: [], creditsSpent: 0 })
  }
  const queries = (body?.queries ?? []).slice(0, 4) // I8: cap query fan-out per sweep
  if (queries.length === 0) return json({ signals: [], creditsSpent: 0 })
  const perQuery = Math.max(1, Math.min(Math.floor(Number(body?.maxResultsPerQuery) || 4), 4))

  const now = new Date().toISOString()
  const signals: unknown[] = []
  let creditsSpent = 0
  const seenUrls = new Set<string>()

  for (const q of queries) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key, query: q, search_depth: 'basic', topic: 'news', days: 30, max_results: perQuery }),
      })
      creditsSpent += 1
      if (!res.ok) continue
      const data = (await res.json()) as { results?: TavilyResult[] }
      for (const r of data.results ?? []) {
        if (seenUrls.has(r.url)) continue
        seenUrls.add(r.url)
        signals.push({
          id: `tavily:${b64(r.url).slice(0, 24)}`,
          source: 'tavily',
          headline: r.title,
          url: r.url,
          publishedAt: r.published_date,
          whyItMatters: (r.content ?? '').replace(/\s+/g, ' ').slice(0, 180).trim(),
          seen: false,
          fetchedAt: now,
        })
      }
    } catch {
      /* one query failing never fails the sweep */
    }
  }

  return json({ keyless: false, signals, creditsSpent })
}
