import { config as edgeConfig, json, readJson } from './_shared'

/**
 * /api/intel — Company Intel Pass (Tavily). Before compiling a packet, research the company:
 * careers/values, engineering blog, recent hiring news, tech-stack mentions. Returns 5–8
 * CITED bullets (I7 — every one carries a source URL). Keyless → { keyless:true }, and the
 * compile proceeds exactly as v1 (regression-safe).
 *
 * Budget (I8): one advanced search per company; the client caches the result 7 days.
 */

export const config = edgeConfig

interface IntelRequest {
  company: string
}
interface TavilyResult {
  title: string
  url: string
  content: string
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const key = process.env.TAVILY_API_KEY
  if (!key) return json({ keyless: true, bullets: [], creditsSpent: 0 })

  const body = await readJson<IntelRequest>(req)
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
      .map((r) => ({
        text: r.content.replace(/\s+/g, ' ').slice(0, 200).trim(),
        url: r.url,
      }))
    return json({ keyless: false, bullets, creditsSpent: 2 })
  } catch (e) {
    return json({ keyless: false, bullets: [], creditsSpent: 0, error: String(e).slice(0, 100) })
  }
}
