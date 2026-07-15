import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import { dedupeKey, mergeDiscovered, withDedupeKey } from '../src/lib/khabri/normalize'
import { cleanAdzunaQuery, adzunaQueriesFromHunts, ADZUNA_COUNTRIES } from '../src/lib/khabri/client'
import aggregatorsHandler from '../api/khabri/aggregators'
import type { Job, SavedHunt } from '../src/types'

function j(id: string, company: string, title: string, location: string, source: Job['source'] = 'jsearch'): Job {
  return { id, source, company, title, location, url: `https://x/${id}`, jd: 'python llm', fetchedAt: new Date().toISOString(), status: 'found' }
}

/**
 * Khabri normalize + dedupe — the Jasoos gate. The same role from LinkedIn, Indeed, and the
 * company ATS must collapse to one card. Existing pipeline status must survive a re-sweep.
 */
describe('dedupe key — fuzzy company+title+location', () => {
  it('collapses the same role across publishers', () => {
    const a = dedupeKey('Anthropic', 'AI Engineer Intern', 'San Francisco, CA')
    const b = dedupeKey('Anthropic Inc', 'AI Engineer, Intern', 'San Francisco')
    expect(a).toBe(b)
  })
  it('separates genuinely different roles', () => {
    const a = dedupeKey('Anthropic', 'Research Scientist', 'London')
    const b = dedupeKey('Anthropic', 'Frontend Designer', 'London')
    expect(a).not.toBe(b)
  })
})

describe('mergeDiscovered', () => {
  it('drops cross-source duplicates, keeps one', () => {
    const discovered = [
      j('jsearch:1', 'OpenAI', 'ML Engineer Intern', 'Remote'),
      j('remotive:9', 'OpenAI', 'ML Engineer, Intern', 'Remote', 'remotive'),
    ]
    const res = mergeDiscovered(discovered, [])
    expect(res.found).toBe(2)
    expect(res.added).toBe(1)
    expect(res.duplicate).toBe(1)
    expect(res.toPersist).toHaveLength(1)
    expect(res.toPersist[0].isNew).toBe(true)
  })

  it('a job already in the queue is refreshed, not re-added, and keeps its status', () => {
    const existing = [{ ...withDedupeKey(j('jsearch:1', 'OpenAI', 'ML Eng Intern', 'Remote')), status: 'applied' as const, appliedAt: '2026-07-01' }]
    const discovered = [{ ...j('jsearch:1', 'OpenAI', 'ML Eng Intern', 'Remote'), jd: 'updated jd' }]
    const res = mergeDiscovered(discovered, existing)
    expect(res.added).toBe(0)
    const persisted = res.toPersist.find((x) => x.id === 'jsearch:1')
    expect(persisted?.status).toBe('applied') // status preserved — a re-sweep never resets the Morcha
    expect(persisted?.jd).toBe('updated jd') // volatile field refreshed
  })

  it('a discovered role matching an existing dedupeKey (different id) is a duplicate', () => {
    // Cross-source: an ATS listing already in the queue, re-surfaced by JSearch/LinkedIn.
    const existing = [withDedupeKey(j('greenhouse:anthropic:5', 'Anthropic', 'AI Engineer Intern', 'San Francisco, CA'))]
    const discovered = [j('jsearch:99', 'Anthropic Inc', 'AI Engineer, Intern', 'San Francisco')]
    const res = mergeDiscovered(discovered, existing)
    expect(res.added).toBe(0)
    expect(res.duplicate).toBe(1)
  })
})

describe('D90 — new keyless discovery corners (Arbeitnow + Jobicy)', () => {
  it('parses Arbeitnow into valid Jobs and filters to AI-relevant roles', async () => {
    const { fetchArbeitnow } = await import('../src/lib/khabri/keyless')
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            { slug: 'a1', title: 'GenAI / Agentic AI Solutions Architect', company_name: 'Accenture', location: 'Frankfurt', remote: true, url: 'https://x/a1', description: '<p>Build agents</p>', created_at: Math.floor(Date.now() / 1000), tags: ['AI'], job_types: [] },
            { slug: 'a2', title: 'Warehouse Packer', company_name: 'LogiCo', location: 'Kiel', remote: false, url: 'https://x/a2', description: 'lift boxes', created_at: 0, tags: [], job_types: [] },
          ],
        }),
        { status: 200 },
      ),
    ) as typeof fetch
    const jobs = await fetchArbeitnow()
    expect(jobs.length).toBe(1) // only the AI role survives the relevance filter
    expect(jobs[0].source).toBe('arbeitnow')
    expect(jobs[0].company).toBe('Accenture')
    expect(jobs[0].location).toMatch(/Remote/)
    expect(jobs[0].updatedAt).toBeTruthy() // freshness stamp present (feeds staleness scoring)
  })

  it('parses Jobicy into valid Jobs', async () => {
    const { fetchJobicy } = await import('../src/lib/khabri/keyless')
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ jobs: [{ id: 7, jobTitle: 'AI Engineer', companyName: 'Superside', jobGeo: 'LATAM', url: 'https://x/7', jobExcerpt: 'ex', jobDescription: '<p>ship AI</p>', pubDate: new Date().toISOString(), jobIndustry: ['AI'] }] }),
        { status: 200 },
      ),
    ) as typeof fetch
    const jobs = await fetchJobicy()
    expect(jobs.length).toBe(1)
    expect(jobs[0].source).toBe('jobicy')
    expect(jobs[0].jd).not.toContain('<p>') // HTML stripped
  })
})

// ============================================================================================
// Session 5.5 — infra-scale discovery: Adzuna (keyed, global) + Working Nomads (keyless, proxied)
// ============================================================================================

describe('Adzuna query derivation — global net, high-signal (Session 5.5)', () => {
  it('keeps the AI-core and strips location/seniority/date noise so Adzuna returns results', () => {
    expect(cleanAdzunaQuery('AI engineer intern India remote')).toBe('ai engineer')
    expect(cleanAdzunaQuery('agentic AI intern')).toBe('agentic ai')
    expect(cleanAdzunaQuery('ML research intern remote India')).toBe('ml research')
    expect(cleanAdzunaQuery('LLM engineer intern')).toBe('llm engineer')
  })
  it('caps at three words (an all-words match on a long query returns nothing)', () => {
    expect(cleanAdzunaQuery('applied AI intern startup founding team').split(' ').length).toBeLessThanOrEqual(3)
  })
  it('never returns empty — a location-only query falls back to a real AI query', () => {
    expect(cleanAdzunaQuery('India remote 2026')).toBe('AI engineer')
  })
  it('derives distinct cores from hunts, falls back to a curated set when none', () => {
    const hunts = [
      { id: 'a', query: 'AI engineer intern India', remoteOnly: false, enabled: true },
      { id: 'b', query: 'LLM engineer intern', remoteOnly: true, enabled: true },
    ] as SavedHunt[]
    const qs = adzunaQueriesFromHunts(hunts)
    expect(qs).toContain('ai engineer')
    expect(qs).toContain('llm engineer')
    expect(adzunaQueriesFromHunts([])).toContain('AI engineer') // curated fallback
  })
  it('the country set leads with India and spans multiple markets', () => {
    expect(ADZUNA_COUNTRIES[0]).toBe('in')
    expect(ADZUNA_COUNTRIES.length).toBeGreaterThanOrEqual(6)
    expect(new Set(ADZUNA_COUNTRIES).size).toBe(ADZUNA_COUNTRIES.length) // no dup requests
  })
})

describe('aggregator proxy — normalization, guard, budget shape (Session 5.5)', () => {
  const ENV_KEYS = ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'SIFARISH_OWNER_PASSCODE', 'SIFARISH_OWNER_TOKEN', 'VERCEL_PROJECT_PRODUCTION_URL']
  const saved: Record<string, string | undefined> = {}
  for (const k of ENV_KEYS) saved[k] = process.env[k]

  afterEach(() => {
    vi.unstubAllGlobals()
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  function post(src: string, body: unknown, origin = 'http://localhost'): Request {
    return new Request(`http://localhost/api/khabri/aggregators?src=${src}`, {
      method: 'POST',
      headers: origin ? { origin, 'content-type': 'application/json' } : { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('normalizes Adzuna results into valid Jobs with a formatted salary + apply URL (I3)', async () => {
    delete process.env.SIFARISH_OWNER_PASSCODE
    delete process.env.SIFARISH_OWNER_TOKEN
    process.env.ADZUNA_APP_ID = 'id'
    process.env.ADZUNA_APP_KEY = 'key'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            results: [
              { id: '123', title: 'Machine Learning Engineer', description: '<p>Build production ML</p>', redirect_url: 'https://adzuna/123', created: '2026-07-14T00:00:00Z', salary_min: 2500000, salary_max: 3500000, salary_is_predicted: '0', company: { display_name: 'Weekday' }, location: { display_name: 'Bengaluru' } },
              { id: '124', title: 'AI Engineer', description: 'no apply link', redirect_url: '', company: {}, location: {} },
            ],
          }),
          { status: 200 },
        ),
      ),
    )
    const res = await aggregatorsHandler(post('adzuna', { country: 'in', query: 'machine learning' }))
    const data = (await res.json()) as { keyless: boolean; jobs: Job[]; creditsSpent: number }
    expect(data.keyless).toBe(false)
    expect(data.creditsSpent).toBe(1) // I8: one country = one credit
    expect(data.jobs).toHaveLength(1) // the URL-less row is dropped (I3 — a packet needs a real apply URL)
    const j = data.jobs[0]
    expect(j.id).toBe('adzuna:in:123')
    expect(j.source).toBe('adzuna')
    expect(j.company).toBe('Weekday')
    expect(j.location).toBe('Bengaluru')
    expect(j.url).toBe('https://adzuna/123')
    expect(j.jd).not.toContain('<p>') // HTML stripped
    expect(j.salary).toContain('₹') // country-correct currency
    expect(j.publisher).toBe('Adzuna · IN')
  })

  it('Working Nomads keeps only AI-relevant roles and strips HTML (no key needed)', async () => {
    delete process.env.SIFARISH_OWNER_PASSCODE
    delete process.env.SIFARISH_OWNER_TOKEN
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            { url: 'https://wn/1', title: 'Senior AI Engineer (LLM)', description: '<p>ship agents</p>', company_name: 'Proxify', category_name: 'Development', tags: 'ai, llm', location: 'CET', pub_date: '2026-07-14' },
            { url: 'https://wn/2', title: 'Regional Sales Manager', description: 'sell things', company_name: 'AcmeCo', category_name: 'Sales', tags: 'b2b', location: 'US', pub_date: '2026-07-14' },
          ]),
          { status: 200 },
        ),
      ),
    )
    const res = await aggregatorsHandler(post('workingnomads', {}))
    const data = (await res.json()) as { keyless: boolean; jobs: Job[]; creditsSpent: number }
    expect(data.creditsSpent).toBe(0) // keyless — spends nothing
    expect(data.jobs).toHaveLength(1) // the sales role is filtered out
    expect(data.jobs[0].source).toBe('workingnomads')
    expect(data.jobs[0].title).toContain('AI Engineer')
    expect(data.jobs[0].jd).not.toContain('<p>')
  })

  it('MONEY GUARD: a foreign Origin is refused with 403 before any key is touched (RC1/RC3)', async () => {
    process.env.ADZUNA_APP_ID = 'id'
    process.env.ADZUNA_APP_KEY = 'key'
    const spy = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', spy)
    const res = await aggregatorsHandler(post('adzuna', { country: 'us' }, 'https://evil.example.com'))
    expect(res.status).toBe(403)
    expect(spy).not.toHaveBeenCalled() // never reached Adzuna → no spend
  })

  it('MONEY GUARD: with a passcode set, a missing owner token degrades to keyless (never spends)', async () => {
    process.env.SIFARISH_OWNER_PASSCODE = 'secret'
    process.env.ADZUNA_APP_ID = 'id'
    process.env.ADZUNA_APP_KEY = 'key'
    const spy = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', spy)
    const res = await aggregatorsHandler(post('adzuna', { country: 'us' })) // no x-sifarish-token
    const data = (await res.json()) as { keyless: boolean }
    expect(data.keyless).toBe(true)
    expect(spy).not.toHaveBeenCalled() // no token → no upstream call → no spend
  })

  it('MONEY GUARD: the correct server-issued owner token is accepted', async () => {
    process.env.SIFARISH_OWNER_PASSCODE = 'secret'
    process.env.ADZUNA_APP_ID = 'id'
    process.env.ADZUNA_APP_KEY = 'key'
    const token = createHash('sha256').update('secret').digest('hex')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 })))
    const req = new Request('http://localhost/api/khabri/aggregators?src=adzuna', {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json', 'x-sifarish-token': token },
      body: JSON.stringify({ country: 'us' }),
    })
    const res = await aggregatorsHandler(req)
    const data = (await res.json()) as { keyless: boolean }
    expect(data.keyless).toBe(false) // authentic token → the lane runs
  })

  it('no Adzuna key configured → keyless (I4: the app still works, keys spend for no one)', async () => {
    delete process.env.SIFARISH_OWNER_PASSCODE
    delete process.env.SIFARISH_OWNER_TOKEN
    delete process.env.ADZUNA_APP_ID
    delete process.env.ADZUNA_APP_KEY
    const res = await aggregatorsHandler(post('adzuna', { country: 'in' }))
    const data = (await res.json()) as { keyless: boolean; jobs: Job[] }
    expect(data.keyless).toBe(true)
    expect(data.jobs).toHaveLength(0)
  })
})
