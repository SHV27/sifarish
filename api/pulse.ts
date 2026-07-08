import { config as edgeConfig, json, readJson } from './_shared'

/**
 * /api/pulse — the Industry Pulse (Tavily). A weekly news sweep on market topics that keeps
 * the app present-tense: "which AI skills are in demand", "agentic hiring trends". Returns
 * CITED briefs (I7). The client turns these into human-confirmed rubric/keyword suggestions
 * (the Nabz pattern, applied to the market). Keyless → { keyless:true }.
 */

export const config = edgeConfig

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

  const body = await readJson<PulseRequest>(req)
  const topics = (body?.topics ?? []).slice(0, 3)
  if (topics.length === 0) return json({ briefs: [], creditsSpent: 0 })

  const now = new Date().toISOString()
  const briefs: { topic: string; headline: string; url: string; insight: string; publishedAt?: string }[] = []
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
  void now
  return json({ keyless: false, briefs, creditsSpent })
}
