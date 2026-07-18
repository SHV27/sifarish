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
 *   ?src=weworkremotely KEYLESS, global remote (Session 5.8). weworkremotely.com publishes a
 *                       public RSS feed of remote programming jobs (probed live 16-Jul-2026:
 *                       200, no CORS header → must be proxied like Working Nomads). Parsed
 *                       server-side, AI-filtered. Lawful public feed, zero credits.
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
  const rpp = Math.min(Math.max(Number(body.resultsPerPage) || 20, 1), 50) // I8: bounded payload (Adzuna serves up to 50/page, Law-12 verified 18-Jul-2026)

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(rpp),
    what,
    // Session 6 (P7, verified against Adzuna's own swagger 17-Jul-2026): freshest first, and
    // nothing older than 60 days — the staleness deduction (D65) would sink those anyway, so
    // requesting them wasted the per-country credit on postings the queue discards.
    sort_by: 'date',
    max_days_old: '60',
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
      .slice(0, 40)
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

// ---- We Work Remotely (keyless RSS; no CORS → must be proxied; Session 5.8) ----

/**
 * Deterministic RSS parser (edge runtime has no DOMParser). WWR item titles are
 * "Company: Job Title"; region/category/pubDate are plain child tags. Exported for the
 * keyless gate suite — the parser is testable without the network.
 */
export function parseWwrRss(xml: string): Array<Record<string, unknown>> {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  const tag = (block: string, name: string): string => {
    const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
    let v = m?.[1] ?? ''
    const cdata = v.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
    if (cdata) v = cdata[1]
    return stripHtml(v)
  }
  const now = new Date().toISOString()
  const jobs: Array<Record<string, unknown>> = []
  for (const block of items) {
    const rawTitle = tag(block, 'title')
    const link = tag(block, 'link')
    if (!link || !rawTitle) continue
    const sep = rawTitle.indexOf(':')
    const company = sep > 0 ? rawTitle.slice(0, sep).trim() : 'Unknown'
    const title = sep > 0 ? rawTitle.slice(sep + 1).trim() : rawTitle
    const desc = tag(block, 'description')
    const category = tag(block, 'category')
    // Filter on what the job IS (title/company/category), never the description — a translation
    // gig whose blurb mentions "AI training data" is not an AI role (live-caught 16-Jul: the
    // desc-inclusive filter admitted a Mandarin translation reviewer and a pen-tester). Same
    // discipline as the Working Nomads lane. Sniper, not spray (D6).
    if (!AI_RE.test(`${rawTitle} ${category}`)) continue
    let pub: string | undefined = tag(block, 'pubDate') || undefined
    if (pub) {
      const d = new Date(pub)
      pub = isNaN(d.getTime()) ? undefined : d.toISOString()
    }
    jobs.push({
      id: `weworkremotely:${link}`,
      source: 'weworkremotely',
      externalId: link,
      company,
      title,
      location: tag(block, 'region') || 'Remote',
      url: link,
      jd: desc.slice(0, 8000),
      publisher: 'We Work Remotely · global remote',
      updatedAt: pub,
      fetchedAt: now,
      status: 'found',
    })
    if (jobs.length >= 40) break // S7: free lane — breadth costs nothing here
  }
  return jobs
}

async function handleWeWorkRemotely(): Promise<Response> {
  try {
    const res = await fetch('https://weworkremotely.com/categories/remote-programming-jobs.rss', {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    })
    if (!res.ok) return json({ keyless: false, jobs: [], creditsSpent: 0, error: `weworkremotely ${res.status}` })
    const xml = await res.text()
    return json({ keyless: false, jobs: parseWwrRss(xml), creditsSpent: 0 })
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
  if (src === 'weworkremotely') return handleWeWorkRemotely()
  return json({ error: 'unknown src' }, 400)
}
