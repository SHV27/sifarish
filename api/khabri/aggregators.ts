/**
 * Khabri aggregator proxy — two upstreams that cannot be fetched browser-direct, behind ONE
 * self-contained edge function (D22: no shared imports; Vercel Hobby caps functions at 12):
 *
 *   ?src=adzuna         KEYED, global. api.adzuna.com aggregates LinkedIn/Indeed/company sites
 *                       across 18 country markets (in/us/gb/ca/de/sg/au/nl/…) with real salaries.
 *                       Keys ADZUNA_APP_ID + ADZUNA_APP_KEY are server-side only (§10 — never in
 *                       the client bundle even though Adzuna sends CORS `*`). No key → keyless.
 *   ?src=workingnomads  KEYLESS, global remote. workingnomads.com has NO CORS header, so the
 *                       browser can't read it — the proxy relays it. Costs no external credits.
 *
 * Guard (D46, the choke point — RC1/RC3): Origin must be this app AND, when a passcode env is
 * set, x-sifarish-token must equal SHA-256(passcode). A raw curl / foreign site is refused before
 * any key is touched. The keyless WorkingNomads path is guarded identically so the proxy can
 * never be abused as an open CORS-bypass. Both paths normalize server-side to the app's Job shape.
 * Lawful aggregator APIs only — no scraping (I3/I9/D21).
 */

export const config = { runtime: 'edge' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

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
    /* absent/garbled Origin → not a browser session on this app */
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

/** Minimal HTML strip — the edge file is self-contained, so it can't import src/lib/util/html. */
function stripHtml(s: string): string {
  return String(s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39|#x27);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Same relevance vocabulary the keyless lanes + the JD decoder speak (D45) — so a WorkingNomads
// role that survives is one the tailor can actually match evidence against.
const AI_RE =
  /\b(ai|ml|machine learning|llm|genai|generative|agent|agentic|rag|nlp|deep learning|data scien|prompt|research engineer|applied scien|mlops|computer vision|artificial intelligence)\b/i

interface AggRequest {
  country?: string
  query?: string
  resultsPerPage?: number
}

// ---- Adzuna ----

const ADZUNA_CCY: Record<string, string> = {
  in: '₹', us: '$', gb: '£', ca: 'C$', au: 'A$', nz: 'NZ$', sg: 'S$', za: 'R', pl: 'zł', br: 'R$', mx: 'MX$',
  de: '€', nl: '€', fr: '€', es: '€', it: '€', at: '€', be: '€',
}

interface AdzunaJob {
  id: string
  title?: string
  description?: string
  redirect_url?: string
  created?: string
  salary_min?: number
  salary_max?: number
  salary_is_predicted?: string
  company?: { display_name?: string }
  location?: { display_name?: string }
}

function adzunaSalary(j: AdzunaJob, country: string): string | undefined {
  if (!j.salary_min) return undefined
  const sym = ADZUNA_CCY[country] ?? ''
  const r = (n: number) => Math.round(n).toLocaleString('en-US')
  const min = r(j.salary_min)
  const max = j.salary_max && j.salary_max !== j.salary_min ? `–${sym}${r(j.salary_max)}` : ''
  const est = j.salary_is_predicted === '1' ? ' est.' : ''
  return `${sym}${min}${max}${est}`
}

async function handleAdzuna(req: Request): Promise<Response> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) return json({ keyless: true, jobs: [], creditsSpent: 0 })

  let body: AggRequest = {}
  try {
    body = (await req.json()) as AggRequest
  } catch {
    /* empty body → defaults */
  }
  const country = (String(body.country ?? 'in').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2)) || 'in'
  const what = String(body.query ?? 'AI engineer').slice(0, 120)
  const rpp = Math.min(Math.max(Number(body.resultsPerPage) || 20, 1), 30) // I8: bounded payload

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(rpp),
    what,
    'content-type': 'application/json',
  })
  try {
    const res = await fetch(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`)
    if (!res.ok) return json({ keyless: false, jobs: [], creditsSpent: 1, error: `adzuna ${res.status}` })
    const data = (await res.json()) as { results?: AdzunaJob[] }
    const now = new Date().toISOString()
    const jobs = (data.results ?? [])
      .filter((j) => j.redirect_url) // I3: a packet must end at a real apply URL
      .map((j) => ({
        id: `adzuna:${country}:${j.id}`,
        source: 'adzuna' as const,
        externalId: String(j.id),
        company: j.company?.display_name ?? 'Unknown',
        title: j.title ? stripHtml(j.title) : 'Role',
        location: j.location?.display_name ?? country.toUpperCase(),
        url: j.redirect_url as string,
        jd: stripHtml(j.description ?? '').slice(0, 8000),
        publisher: `Adzuna · ${country.toUpperCase()}`,
        salary: adzunaSalary(j, country),
        updatedAt: j.created,
        fetchedAt: now,
        status: 'found' as const,
      }))
    return json({ keyless: false, jobs, creditsSpent: 1 })
  } catch (e) {
    return json({ keyless: false, jobs: [], creditsSpent: 0, error: String(e).slice(0, 100) })
  }
}

// ---- Working Nomads (keyless; no CORS → must be proxied) ----

interface WNJob {
  url?: string
  title?: string
  description?: string
  company_name?: string
  category_name?: string
  tags?: string
  location?: string
  pub_date?: string
}

async function handleWorkingNomads(): Promise<Response> {
  try {
    const res = await fetch('https://www.workingnomads.com/api/exposed_jobs/', { headers: { Accept: 'application/json' } })
    if (!res.ok) return json({ keyless: false, jobs: [], creditsSpent: 0, error: `workingnomads ${res.status}` })
    const data = (await res.json()) as WNJob[] | { jobs?: WNJob[] }
    const list = Array.isArray(data) ? data : (data.jobs ?? [])
    const now = new Date().toISOString()
    const jobs = list
      .filter((j) => !!j.url && AI_RE.test(`${j.title ?? ''} ${j.category_name ?? ''} ${j.tags ?? ''}`))
      .slice(0, 25)
      .map((j) => ({
        id: `workingnomads:${j.url}`,
        source: 'workingnomads' as const,
        externalId: String(j.url),
        company: j.company_name ?? 'Unknown',
        title: j.title ? stripHtml(j.title) : 'Role',
        location: j.location || 'Remote',
        url: j.url as string,
        jd: stripHtml(j.description ?? '').slice(0, 8000),
        publisher: 'Working Nomads · global remote',
        updatedAt: j.pub_date,
        fetchedAt: now,
        status: 'found' as const,
      }))
    return json({ keyless: false, jobs, creditsSpent: 0 })
  } catch (e) {
    return json({ keyless: false, jobs: [], creditsSpent: 0, error: String(e).slice(0, 100) })
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const guarded = await guardRequest(req)
  if (guarded) return guarded
  const src = new URL(req.url).searchParams.get('src')
  if (src === 'adzuna') return handleAdzuna(req)
  if (src === 'workingnomads') return handleWorkingNomads()
  return json({ error: 'unknown src' }, 400)
}
