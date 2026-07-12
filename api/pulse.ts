/**
 * /api/pulse — Industry Pulse (Tavily). Cited market briefs (I7) that keep the app
 * present-tense. Keyless → { keyless:true }. Self-contained (no shared imports, edge-safe).
 */

export const config = { runtime: 'edge' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

interface PulseRequest {
  topics: string[]
}
interface TavilyResult {
  title: string
  url: string
  content: string
  published_date?: string
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
  const key = process.env.TAVILY_API_KEY
  if (!key) return json({ keyless: true, briefs: [], creditsSpent: 0 })

  let body: PulseRequest | null = null
  try {
    body = (await req.json()) as PulseRequest
  } catch {
    return json({ briefs: [], creditsSpent: 0 })
  }
  const topics = (body?.topics ?? []).slice(0, 3)
  if (topics.length === 0) return json({ briefs: [], creditsSpent: 0 })

  const briefs: unknown[] = []
  let creditsSpent = 0
  for (const topic of topics) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key, query: topic, topic: 'news', days: 30, max_results: 2 }),
      })
      creditsSpent += 1
      if (!res.ok) continue
      const data = (await res.json()) as { results?: TavilyResult[] }
      const top = data.results?.[0]
      if (top) {
        briefs.push({
          topic,
          headline: top.title,
          url: top.url,
          insight: (top.content ?? '').replace(/\s+/g, ' ').slice(0, 200).trim(),
          publishedAt: top.published_date,
        })
      }
    } catch {
      /* one topic failing never fails the pulse */
    }
  }
  return json({ keyless: false, briefs, creditsSpent })
}
