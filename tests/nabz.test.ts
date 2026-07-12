import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '../src/db/db'
import { overviewRepos, forceAddRepo, dismissSuggestion, computeSuggestions, type GhRepo } from '../src/lib/nabz/github'
import { SEED_LEDGER } from './helpers'

/**
 * D47 gates — "GitHub ka sab show hona chahiye": a dismissed/accepted suggestion must never
 * PERMANENTLY hide a repo from view, and the owner can always resurface any repo on demand.
 */

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
  await db.ledger.bulkPut(SEED_LEDGER)
})

describe('overviewRepos — nothing is ever silently invisible (D47)', () => {
  it('lists every non-fork repo, forks excluded', async () => {
    const repos = [repo('sifarish'), repo('a-fork', { fork: true })]
    const ov = await overviewRepos(repos)
    expect(ov.map((o) => o.repo.name)).toEqual(['sifarish'])
  })

  it('a brand-new repo with no ledger entry shows as untracked, not hidden', async () => {
    const ov = await overviewRepos([repo('sifarish')])
    expect(ov[0].status).toBe('untracked')
  })

  it('REGRESSION: a repo dismissed once is still visible (as "dismissed"), never gone', async () => {
    const repos = [repo('sifarish')]
    await computeSuggestions(repos) // creates the pending sug-new-sifarish
    await dismissSuggestion('sug-new-sifarish')
    const ov = await overviewRepos(repos)
    expect(ov[0].status).toBe('dismissed')
    // The old behavior (the bug): computeSuggestions would `continue` past it forever and
    // it would never again appear ANYWHERE in the UI. overviewRepos must still list it.
    expect(ov).toHaveLength(1)
  })

  it('a matched shipped/in_forge ledger entry reports its real tier + title', async () => {
    const gloaming = SEED_LEDGER.find((e) => e.title.includes('GLOAMING'))!
    const ov = await overviewRepos([repo('GLOAMING')])
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
