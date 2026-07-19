/**
 * Khabri aggregator lane — JSearch (OpenWeb Ninja). Google-for-Jobs aggregation that
 * surfaces roles listed on LinkedIn, Indeed, Glassdoor, ZipRecruiter, Naukri-indexed
 * pages, etc. LAWFUL: this is an aggregator API, not scraping (I3/I9/D21).
 *
 * Key: JSEARCH_API_KEY (server-side, `ak_…`), sent as `X-API-Key` to api.openwebninja.com.
 * Keyless: returns { keyless:true } so the client falls back to HN/Remotive/RemoteOK.
 * Budget (I8): num_pages hard-capped at 1 per request. Self-contained (no shared imports).
 */

export const config = { runtime: 'edge' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

interface JobsRequest {
  query: string
  country?: string
  remoteOnly?: boolean
  datePosted?: 'all' | 'today' | '3days' | 'week' | 'month'
  numPages?: number
  /** Session 7.2 (B3): page number for depth-promoted hunts (1-3; 1 credit per request). */
  page?: number
  /** Session 6 (P7): comma-sep JSearch employment types, owner-set per hunt. */
  employmentTypes?: string
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
  const key = process.env.JSEARCH_API_KEY
  if (!key) return json({ keyless: true, jobs: [], creditsSpent: 0 })

  let body: JobsRequest | null = null
  try {
    body = (await req.json()) as JobsRequest
  } catch {
    return json({ jobs: [], creditsSpent: 0 })
  }
  if (!body?.query) return json({ jobs: [], creditsSpent: 0 })

  // Session 7.2 (B3): a proven hunt may spend ONE extra credit as page 2 of the same query —
  // depth where it pays, still 1 credit per request (num_pages stays 1, D144's law).
  const page = String(Math.min(3, Math.max(1, Number(body.page ?? 1) || 1)))
  const params = new URLSearchParams({
    query: body.query,
    page,
    num_pages: '1', // I8: never more than one page per REQUEST
    // Session 7.2 (B5): the owner's explicit "any age" ('all') is honored — it used to be
    // silently narrowed to 'month'. Absent still defaults to 'month'.
    date_posted: body.datePosted ?? 'month',
  })
  if (body.country) params.set('country', body.country)
  if (body.remoteOnly) params.set('work_from_home', 'true')
  // Session 6 (P7): per-hunt employment-type filter, honored only when the owner set it on the
  // hunt. Sanitised to JSearch's documented enum; never applied by default (his vision spans
  // internships AND full roles, so a forced filter would LOSE coverage).
  const emp = String(body.employmentTypes ?? '')
    .toUpperCase()
    .split(',')
    .map((t) => t.trim())
    .filter((t) => ['FULLTIME', 'CONTRACTOR', 'PARTTIME', 'INTERN'].includes(t))
  if (emp.length > 0) params.set('employment_types', emp.join(','))

  try {
    // Final Jang W3 (Law 12, anti-obsolescence): OpenWeb Ninja's docs now lead with /jsearch/
    // search-v2 (cursor pagination); the legacy /search still serves us. If it ever deprecates,
    // the owner flips JSEARCH_PATH=/jsearch/search-v2 in the Vercel env — zero code, the seal
    // holds. Verified 19-Jul-2026: legacy path live; v2 not adopted blind (cursor semantics
    // unproven against our page param — the env lever exists for the day the provider forces it).
    const path = process.env.JSEARCH_PATH || '/jsearch/search'
    const res = await fetch(`https://api.openwebninja.com${path}?${params.toString()}`, {
      headers: { 'X-API-Key': key },
    })
    if (!res.ok) return json({ keyless: false, jobs: [], creditsSpent: 1, error: `jsearch ${res.status}` })
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
    return json({ keyless: false, jobs, creditsSpent: 1 })
  } catch (e) {
    return json({ keyless: false, jobs: [], creditsSpent: 0, error: String(e).slice(0, 100) })
  }
}
