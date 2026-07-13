import { describe, expect, it, beforeEach, afterAll, vi } from 'vitest'
import { db } from '../src/db/db'
import { overviewRepos, forceAddRepo, addRepoToLedger, dismissSuggestion, computeSuggestions, distillReadme, type GhRepo } from '../src/lib/nabz/github'
import { SEED_LEDGER } from './helpers'

/**
 * D47/D52 gates — "GitHub ka sab show hona chahiye": a dismissed/accepted suggestion must never
 * PERMANENTLY hide a repo from view; every repo is deeply read; the owner can always add any.
 */

const MOCK_README = `# सिफ़ारिश · SIFARISH
### A job-hunt chief of staff that refuses to lie.
Compiles an ATS-safe resume from an evidence ledger using RAG-style matching and Groq guardrails.
## Features
- Compiles a one-page resume from an evidence-linked ledger with a parse-back fidelity test
- Discovers live roles from keyless Greenhouse and Lever feeds and scores each against a rubric
## License
MIT`

// Offline + deterministic: no Nabz test ever touches the real GitHub network.
beforeEach(() => {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/readme')) return new Response(MOCK_README, { status: 200, headers: { 'x-ratelimit-remaining': '55' } })
    return new Response('{}', { status: 404, headers: { 'x-ratelimit-remaining': '55' } })
  }) as typeof fetch
})
afterAll(() => vi.restoreAllMocks())

function repo(name: string, overrides: Partial<GhRepo> = {}): GhRepo {
  return {
    name,
    html_url: `https://github.com/SHV27/${name}`,
    description: 'A public repo with real substance in it, more than thirty characters long.',
    pushed_at: '2026-07-12T00:00:00Z',
    language: 'TypeScript',
    fork: false,
    size: 120,
    homepage: null,
    ...overrides,
  }
}

beforeEach(async () => {
  await db.suggestions.clear()
  await db.ledger.clear()
  await db.nabzCache.clear()
  await db.ledger.bulkPut(SEED_LEDGER)
})

describe('overviewRepos — nothing is ever silently invisible (D47)', () => {
  it('lists every non-fork repo, forks excluded', async () => {
    const repos = [repo('sifarish'), repo('a-fork', { fork: true })]
    const ov = await overviewRepos(repos, false)
    expect(ov.map((o) => o.repo.name)).toEqual(['sifarish'])
  })

  it('a brand-new repo with no ledger entry shows as untracked, not hidden', async () => {
    const ov = await overviewRepos([repo('sifarish')], false)
    expect(ov[0].status).toBe('untracked')
  })

  it('REGRESSION: a repo dismissed once is still visible (as "dismissed"), never gone', async () => {
    const repos = [repo('sifarish')]
    await computeSuggestions(repos) // creates the pending sug-new-sifarish
    await dismissSuggestion('sug-new-sifarish')
    const ov = await overviewRepos(repos, false)
    expect(ov[0].status).toBe('dismissed')
    // The old behavior (the bug): computeSuggestions would `continue` past it forever and
    // it would never again appear ANYWHERE in the UI. overviewRepos must still list it.
    expect(ov).toHaveLength(1)
  })

  it('a matched shipped/in_forge ledger entry reports its real tier + title', async () => {
    const gloaming = SEED_LEDGER.find((e) => e.title.includes('GLOAMING'))!
    const ov = await overviewRepos([repo('GLOAMING')], false)
    expect(ov[0].status).toBe(gloaming.tier)
    expect(ov[0].ledgerTitle).toBeTruthy()
  })
})

describe('forceAddRepo — the manual override always works (D47)', () => {
  it('resurfaces a DISMISSED repo as a fresh pending suggestion', async () => {
    const repos = [repo('sifarish')]
    await computeSuggestions(repos)
    await dismissSuggestion('sug-new-sifarish')
    expect((await db.suggestions.get('sug-new-sifarish'))?.status).toBe('dismissed')

    await forceAddRepo(repos[0])
    const row = await db.suggestions.get('sug-new-sifarish')
    expect(row?.status).toBe('pending')
    expect(row?.draftEntry?.title).toBe('sifarish')
  })

  it('works even when no suggestion ever existed (fresh add)', async () => {
    const s = await forceAddRepo(repo('brand-new-thing'))
    expect(s.status).toBe('pending')
    expect((await db.suggestions.get('sug-new-brand-new-thing'))?.status).toBe('pending')
  })

  it('a repeated sync no longer re-hides a resurfaced repo (isDismissed sees "pending", not "dismissed")', async () => {
    const repos = [repo('sifarish')]
    await computeSuggestions(repos)
    await dismissSuggestion('sug-new-sifarish')
    await forceAddRepo(repos[0])
    const resynced = await computeSuggestions(repos)
    // computeSuggestions won't re-push (prior exists), but it must not be blocked from
    // showing in the live pending view — the record itself is 'pending' again.
    expect((await db.suggestions.get('sug-new-sifarish'))?.status).toBe('pending')
    expect(resynced.some((s) => s.repoName === 'sifarish')).toBe(true)
  })
})

describe('D52 — "Your GitHub, deeply read": every repo always shown + one-click add', () => {
  it('THE REPORTED REGRESSION: SIFARISH (dismissed) is STILL in the overview with an add path', async () => {
    const repos = [repo('sifarish'), repo('gloaming'), repo('spark-core')]
    await computeSuggestions(repos)
    await dismissSuggestion('sug-new-sifarish') // simulate the migrated dismissed record
    const ov = await overviewRepos(repos, false)
    const sif = ov.find((o) => o.repo.name === 'sifarish')
    expect(sif).toBeTruthy() // never hidden — the whole point
    expect(sif!.status).toBe('dismissed') // shown, and still addable in the UI
  })

  it('addRepoToLedger writes a RICH README-distilled draft, ignoring dismiss history', async () => {
    const r = repo('sifarish', { description: 'A job-hunt chief of staff that refuses to lie.' })
    await computeSuggestions([r])
    await dismissSuggestion('sug-new-sifarish')
    const id = await addRepoToLedger(r)
    expect(id).toBe('proj-sifarish')
    const entry = await db.ledger.get('proj-sifarish')
    expect(entry?.tier).toBe('shipped')
    expect(entry?.evidence?.repo).toContain('sifarish')
    // Rich: the draft carries README-distilled bullets + summary (not just the one-line description).
    expect(entry?.summary.toLowerCase()).toContain('refuses to lie')
    expect(entry!.bullets.length).toBeGreaterThanOrEqual(2)
    expect(entry!.tags).toContain('rag')
    // and the suggestion is now accepted (trail), not blocking
    expect((await db.suggestions.get('sug-new-sifarish'))?.status).toBe('accepted')
  })
})

describe('D52.1 — rate-limit backoff: a 403 can never surface (zero console errors)', () => {
  it('once GitHub returns 403 / 0-remaining, further calls serve cache and make NO network request', async () => {
    const { fetchRepos } = await import('../src/lib/nabz/github')
    // First call: GitHub says rate-limited (403, 0 remaining).
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600) } })) as typeof fetch
    const r1 = await fetchRepos(true)
    expect(Array.isArray(r1.repos)).toBe(true) // never throws at the user
    // Second call must NOT hit the network at all (backoff recorded).
    const spy = vi.fn(async () => new Response('[]', { status: 200 }))
    globalThis.fetch = spy as unknown as typeof fetch
    await fetchRepos(true)
    expect(spy).not.toHaveBeenCalled() // structurally silent — no request, no console 403
  })
})

describe('D52 — deep README distillation (rich, not a one-liner)', () => {
  const SIFARISH_README = `# सिफ़ारिश · SIFARISH

### A job-hunt chief of staff that refuses to lie.

**▶ Live: https://sifarish-shv-s-projects.vercel.app** · Code: https://github.com/SHV27/sifarish

> The Design Law: Compile truth. Draft everything. Send nothing.

SIFARISH compiles an ATS-safe resume from an evidence ledger, discovers roles via lawful ATS feeds,
and never presses send — the human clicks apply.

## Features
- Compiles a one-page resume from an evidence-linked ledger with a parse-back fidelity test
- Discovers live roles from keyless Greenhouse / Lever / Ashby feeds and scores each against a rubric
- A reasoning core (Dimaag) using Groq gpt-oss models with RAG-style evidence matching and guardrails
- Owner vault with encrypted backups; demo mode is structurally keyless

## Installation
- npm install and run
## License
MIT`

  it('captures the tagline + a real sentence as the summary (not "Installation")', () => {
    const d = distillReadme(SIFARISH_README)
    expect(d.summary.toLowerCase()).toContain('refuses to lie')
    expect(d.summary.length).toBeGreaterThan(40)
    expect(d.summary).not.toMatch(/installation|license/i)
  })

  it('pulls multiple feature bullets, filtering install/license noise', () => {
    const d = distillReadme(SIFARISH_README)
    expect(d.bullets.length).toBeGreaterThanOrEqual(3)
    expect(d.bullets.join(' ')).not.toMatch(/npm install|license|MIT/i)
    expect(d.bullets.join(' ')).toMatch(/resume|discover|reasoning/i)
  })

  it('detects the live URL and a real tech stack / keywords', () => {
    const d = distillReadme(SIFARISH_README)
    expect(d.liveUrl).toContain('sifarish-shv-s-projects.vercel.app')
    expect(d.keywords).toContain('rag')
    expect(d.keywords).toContain('groq')
    expect(d.keywords).toContain('guardrails')
    expect(d.stack.length).toBeGreaterThan(0)
    expect(d.hasReadme).toBe(true)
  })
})
