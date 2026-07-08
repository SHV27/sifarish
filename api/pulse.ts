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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
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
