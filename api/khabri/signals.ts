import { config as edgeConfig, json, readJson, capRuns } from '../_shared'

/**
 * Khabri signal lane — Tavily web search for HIRING SIGNALS, not postings:
 * "X is hiring Claude engineers", new AI-role categories, internship-program announcements.
 * Every result carries a source URL (I7). Budget (I8): max_results capped per run.
 *
 * Keyless: returns { keyless:true } and the client shows the signal feed's teach-state.
 */

export const config = edgeConfig

interface SignalsRequest {
  queries: string[]
  maxResultsPerQuery?: number
}

interface TavilyResult {
  title: string
  url: string
  content: string
  published_date?: string
  score?: number
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const key = process.env.TAVILY_API_KEY
  if (!key) return json({ keyless: true, signals: [], creditsSpent: 0 })

  const body = await readJson<SignalsRequest>(req)
  const queries = (body?.queries ?? []).slice(0, 4) // I8: cap query fan-out per sweep
  if (queries.length === 0) return json({ signals: [], creditsSpent: 0 })
  const perQuery = capRuns(body?.maxResultsPerQuery, 4)

  const now = new Date().toISOString()
  const signals: {
    id: string
    source: 'tavily'
    headline: string
    url: string
    publishedAt?: string
    whyItMatters: string
    seen: boolean
    fetchedAt: string
  }[] = []
  let creditsSpent = 0
  const seenUrls = new Set<string>()

  for (const q of queries) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: key,
          query: q,
          search_depth: 'basic',
          topic: 'news',
          days: 30,
          max_results: perQuery,
        }),
      })
      creditsSpent += 1
      if (!res.ok) continue
      const data = (await res.json()) as { results?: TavilyResult[] }
      for (const r of data.results ?? []) {
        if (seenUrls.has(r.url)) continue
        seenUrls.add(r.url)
        signals.push({
          id: `tavily:${Buffer.from(r.url).toString('base64').slice(0, 24)}`,
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
