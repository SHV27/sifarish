import { config as edgeConfig, json, readJson, capRuns } from '../_shared'

/**
 * Khabri aggregator lane — JSearch (OpenWeb Ninja). Google-for-Jobs aggregation that
 * surfaces roles listed on LinkedIn, Indeed, Glassdoor, ZipRecruiter, Naukri-indexed
 * pages, etc. LAWFUL: this is an aggregator API, not scraping (I3/I9/D21).
 *
 * Key: JSEARCH_API_KEY (server-side, `ak_…`), sent as `X-API-Key` to api.openwebninja.com.
 * Keyless: returns { keyless:true } so the client falls back to HN/Remotive/RemoteOK.
 * Budget (I8): num_pages hard-capped at 1 per request.
 */

export const config = edgeConfig

interface JobsRequest {
  query: string
  country?: string
  remoteOnly?: boolean
  datePosted?: 'all' | 'today' | '3days' | 'week' | 'month'
  numPages?: number
}

interface JSearchJob {
  job_id: string
  job_title: string
  employer_name: string
  job_publisher: string
  job_apply_link: string
  job_description: string
  job_is_remote: boolean
  job_posted_at_datetime_utc?: string
  job_city?: string
  job_state?: string
  job_country?: string
  job_salary_string?: string
  job_employment_type?: string
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const key = process.env.JSEARCH_API_KEY
  if (!key) return json({ keyless: true, jobs: [], creditsSpent: 0 })

  const body = await readJson<JobsRequest>(req)
  if (!body?.query) return json({ jobs: [], creditsSpent: 0 })

  const pages = capRuns(body.numPages, 1) // I8: never fetch more than one page per run
  const params = new URLSearchParams({
    query: body.query,
    page: '1',
    num_pages: String(pages),
    date_posted: body.datePosted && body.datePosted !== 'all' ? body.datePosted : 'month',
  })
  if (body.country) params.set('country', body.country)
  if (body.remoteOnly) params.set('work_from_home', 'true')

  try {
    const res = await fetch(`https://api.openwebninja.com/jsearch/search?${params}`, {
      headers: { 'X-API-Key': key },
    })
    if (!res.ok) return json({ keyless: false, jobs: [], creditsSpent: pages, error: `jsearch ${res.status}` })
    const data = (await res.json()) as { data?: JSearchJob[] }
    const now = new Date().toISOString()
    const jobs = (data.data ?? []).map((j) => ({
      id: `jsearch:${j.job_id}`,
      source: 'jsearch' as const,
      externalId: j.job_id,
      company: j.employer_name ?? 'Unknown',
      title: j.job_title,
      location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', ') + (j.job_is_remote ? ' · Remote' : ''),
      url: j.job_apply_link,
      jd: (j.job_description ?? '').slice(0, 8000),
      publisher: j.job_publisher,
      salary: j.job_salary_string,
      updatedAt: j.job_posted_at_datetime_utc,
      fetchedAt: now,
      status: 'found' as const,
    }))
    return json({ keyless: false, jobs, creditsSpent: pages })
  } catch (e) {
    return json({ keyless: false, jobs: [], creditsSpent: 0, error: String(e).slice(0, 100) })
  }
}
