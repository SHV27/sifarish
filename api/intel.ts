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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
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
