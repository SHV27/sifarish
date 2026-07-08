import type { Job } from '../../types'
import { stripHtml } from '../util/html'

/**
 * Keyless discovery lanes (I4) — browser-direct, CORS-verified 08-Jul-2026.
 * The app must discover roles even with ZERO keys. These three cover remote-first and
 * startup hiring: Hacker News "Who is Hiring", Remotive, RemoteOK.
 */

const AI_RE = /\b(ai|ml|machine learning|llm|genai|generative|agent|agentic|rag|nlp|deep learning|data scien|prompt|research engineer|applied scien)\b/i
const INTERN_RE = /\b(intern|internship|new grad|graduate|entry|early career|junior|residen|apprentice)\b/i

function relevant(text: string): boolean {
  return AI_RE.test(text)
}

// ---- Hacker News: latest "Who is Hiring?" thread, top-level comments as postings ----

interface HNItem {
  id: number
  title?: string
  author?: string
  created_at?: string
  children?: HNItem[]
  text?: string
}

/** Find the newest "Ask HN: Who is hiring?" story id (author whoishiring). */
export async function latestWhoIsHiringId(): Promise<number | null> {
  const res = await fetch('https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=hiring&hitsPerPage=5')
  if (!res.ok) return null
  const data = await res.json()
  const hit = (data.hits ?? []).find((h: { title: string }) => /who is hiring/i.test(h.title))
  return hit ? Number(hit.objectID) : null
}

/** HN comment format convention: "Location | Company | Role | ... | apply link". */
function parseHNComment(text: string): { company: string; title: string; location: string; url: string } | null {
  const plain = stripHtml(text)
  const firstLine = plain.split('\n')[0]
  const parts = firstLine.split('|').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const url = (plain.match(/https?:\/\/[^\s)]+/) ?? [''])[0]
  // Heuristic: company is usually the part with a domain-ish / known-name, role has "engineer/intern".
  const roleIdx = parts.findIndex((p) => /engineer|intern|scientist|developer|research|designer|lead|manager|founding/i.test(p))
  const locIdx = parts.findIndex((p) => /remote|onsite|hybrid|[A-Z]{2}\b|,/.test(p))
  const company = parts[1] && !/remote|engineer|intern/i.test(parts[1]) ? parts[1] : parts[0]
  return {
    company: company.slice(0, 60),
    title: (roleIdx >= 0 ? parts[roleIdx] : parts[parts.length - 1]).slice(0, 80),
    location: locIdx >= 0 ? parts[locIdx] : parts[0],
    url,
  }
}

export async function fetchHackerNews(keywords: string[]): Promise<Job[]> {
  const id = await latestWhoIsHiringId()
  if (!id) return []
  const res = await fetch(`https://hn.algolia.com/api/v1/items/${id}`)
  if (!res.ok) return []
  const thread = await res.json()
  const now = new Date().toISOString()
  const kw = keywords.map((k) => k.toLowerCase())
  const jobs: Job[] = []
  for (const c of (thread.children ?? []) as HNItem[]) {
    if (!c.text) continue
    const plain = stripHtml(c.text)
    if (!relevant(plain)) continue
    if (kw.length && !kw.some((k) => plain.toLowerCase().includes(k)) && !INTERN_RE.test(plain)) continue
    const parsed = parseHNComment(c.text)
    if (!parsed || !parsed.company) continue
    jobs.push({
      id: `hn:${c.id}`,
      source: 'hackernews',
      externalId: String(c.id),
      company: parsed.company,
      title: parsed.title,
      location: parsed.location,
      url: parsed.url || `https://news.ycombinator.com/item?id=${c.id}`,
      jd: plain.slice(0, 4000),
      publisher: 'Hacker News · Who is Hiring',
      updatedAt: c.created_at,
      fetchedAt: now,
      status: 'found',
    })
  }
  return jobs.slice(0, 25)
}

// ---- Remotive ----

export async function fetchRemotive(query: string): Promise<Job[]> {
  const res = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=40`)
  if (!res.ok) return []
  const data = await res.json()
  const now = new Date().toISOString()
  return (data.jobs ?? [])
    .filter((j: { title: string; category: string }) => relevant(`${j.title} ${j.category}`))
    .slice(0, 25)
    .map(
      (j: {
        id: number
        title: string
        company_name: string
        candidate_required_location: string
        url: string
        description: string
        publication_date: string
        salary: string
      }): Job => ({
        id: `remotive:${j.id}`,
        source: 'remotive',
        externalId: String(j.id),
        company: j.company_name,
        title: j.title,
        location: j.candidate_required_location || 'Remote',
        url: j.url,
        jd: stripHtml(j.description ?? ''),
        publisher: 'Remotive',
        salary: j.salary || undefined,
        updatedAt: j.publication_date,
        fetchedAt: now,
        status: 'found',
      }),
    )
}

// ---- RemoteOK (row 0 is metadata) ----

export async function fetchRemoteOK(query: string): Promise<Job[]> {
  const res = await fetch('https://remoteok.com/api', { headers: { Accept: 'application/json' } })
  if (!res.ok) return []
  const data = await res.json()
  const now = new Date().toISOString()
  const q = query.toLowerCase()
  return (Array.isArray(data) ? data.slice(1) : [])
    .filter((j: { position?: string; tags?: string[] }) => {
      const hay = `${j.position ?? ''} ${(j.tags ?? []).join(' ')}`
      return relevant(hay) && (q.split(' ').some((w) => w.length > 2 && hay.toLowerCase().includes(w)) || AI_RE.test(hay))
    })
    .slice(0, 25)
    .map(
      (j: {
        id: string
        slug: string
        position: string
        company: string
        location: string
        url: string
        description: string
        date: string
        salary_min?: number
        salary_max?: number
      }): Job => ({
        id: `remoteok:${j.id}`,
        source: 'remoteok',
        externalId: String(j.id),
        company: j.company,
        title: j.position,
        location: j.location || 'Remote',
        url: j.url,
        jd: stripHtml(j.description ?? ''),
        publisher: 'RemoteOK',
        salary: j.salary_min ? `$${j.salary_min}–$${j.salary_max}` : undefined,
        updatedAt: j.date,
        fetchedAt: now,
        status: 'found',
      }),
    )
}
