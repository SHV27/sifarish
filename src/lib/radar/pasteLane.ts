import type { Job } from '../../types'
import { stripHtml } from '../util/html'

/**
 * Paste Lane: how LinkedIn finds (and anything else) enter — a URL or raw JD text.
 * NO scraping, ever (I3/D3): known ATS URLs are resolved through their own public
 * JSON APIs; everything else is manual paste.
 */

interface UrlMatch {
  source: 'greenhouse' | 'lever' | 'ashby'
  token: string
  externalId: string
}

export function recognizeAtsUrl(url: string): UrlMatch | null {
  let m = url.match(/(?:job-)?boards?\.greenhouse\.io\/(?:embed\/job_app\?[^ ]*token=)?([\w-]+)\/jobs\/(\d+)/)
  if (m) return { source: 'greenhouse', token: m[1], externalId: m[2] }
  m = url.match(/jobs\.lever\.co\/([\w-]+)\/([\w-]{8,})/)
  if (m) return { source: 'lever', token: m[1], externalId: m[2] }
  m = url.match(/jobs\.ashbyhq\.com\/([\w.-]+)\/([0-9a-f-]{36})/i)
  if (m) return { source: 'ashby', token: m[1], externalId: m[2] }
  return null
}

export async function fetchJobFromUrl(url: string): Promise<Job | null> {
  const match = recognizeAtsUrl(url)
  if (!match) return null
  const now = new Date().toISOString()

  if (match.source === 'greenhouse') {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${match.token}/jobs/${match.externalId}`)
    if (!res.ok) return null
    const j = await res.json()
    return {
      id: `paste-gh-${match.externalId}`,
      source: 'paste',
      externalId: match.externalId,
      company: j.company_name ?? match.token,
      title: j.title,
      location: j.location?.name ?? '',
      url: j.absolute_url ?? url,
      jd: stripHtml(j.content ?? ''),
      updatedAt: j.updated_at,
      fetchedAt: now,
      status: 'found',
    }
  }

  if (match.source === 'lever') {
    const res = await fetch(`https://api.lever.co/v0/postings/${match.token}/${match.externalId}`)
    if (!res.ok) return null
    const j = await res.json()
    const lists = (j.lists ?? [])
      .map((l: { text: string; content: string }) => `${l.text}\n${stripHtml(l.content)}`)
      .join('\n\n')
    return {
      id: `paste-lv-${match.externalId}`,
      source: 'paste',
      externalId: match.externalId,
      company: match.token,
      title: j.text,
      location: j.categories?.location ?? '',
      url: j.hostedUrl ?? url,
      jd: [j.descriptionPlain ?? stripHtml(j.description ?? ''), lists].filter(Boolean).join('\n\n'),
      updatedAt: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
      fetchedAt: now,
      status: 'found',
    }
  }

  // Ashby: the public feed is board-level; find the posting inside it.
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${match.token}?includeCompensation=true`)
  if (!res.ok) return null
  const board = await res.json()
  const j = (board.jobs ?? []).find((x: { id: string }) => x.id === match.externalId)
  if (!j) return null
  return {
    id: `paste-ab-${match.externalId}`,
    source: 'paste',
    externalId: match.externalId,
    company: match.token,
    title: j.title,
    location: j.location ?? '',
    url: j.jobUrl ?? url,
    jd: j.descriptionPlain ?? stripHtml(j.descriptionHtml ?? ''),
    updatedAt: j.publishedAt,
    fetchedAt: now,
    status: 'found',
  }
}

/** Manual lane: raw JD text pasted in, with company/title typed by hand. */
export function makePastedJob(company: string, title: string, jd: string, url?: string): Job {
  return {
    id: `paste-manual-${Date.now()}`,
    source: 'paste',
    company: company.trim() || 'Unknown company',
    title: title.trim() || 'Untitled role',
    location: '',
    url: url?.trim() ?? '',
    jd: jd.trim(),
    fetchedAt: new Date().toISOString(),
    status: 'found',
  }
}
