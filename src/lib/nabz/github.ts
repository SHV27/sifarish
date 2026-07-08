import { db } from '../../db/db'
import type { LedgerEntry, NabzSuggestion } from '../../types'

/**
 * GitHub Nabz — the pulse. Public REST, no key (CORS `*`, 60 req/hr unauth verified WS0).
 * Nabz DRAFTS; Shaurya DECIDES. Every mutation is a suggestion a human confirms (vision §P2).
 */

const USER = 'SHV27'
const CACHE_TTL = 1000 * 60 * 30 // 30 min — respect the 60 req/hr budget

export interface GhRepo {
  name: string
  html_url: string
  description: string | null
  pushed_at: string
  language: string | null
  fork: boolean
  size: number
  /** Live-demo URL (GitHub "homepage" field) — Nabz suggests attaching it as evidence. */
  homepage?: string | null
}

export interface RateBudget {
  remaining: number
  limit: number
  resetAt: number
}

export interface SyncNabz {
  repos: GhRepo[]
  budget: RateBudget | null
  fromCache: boolean
}

export async function fetchRepos(force = false): Promise<SyncNabz> {
  const cacheKey = `repos:${USER}`
  const cached = await db.nabzCache.get(cacheKey)
  if (!force && cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL) {
    return { repos: JSON.parse(cached.json), budget: null, fromCache: true }
  }

  const res = await fetch(`https://api.github.com/users/${USER}/repos?sort=pushed&per_page=100`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  const budget: RateBudget = {
    remaining: Number(res.headers.get('x-ratelimit-remaining') ?? '0'),
    limit: Number(res.headers.get('x-ratelimit-limit') ?? '60'),
    resetAt: Number(res.headers.get('x-ratelimit-reset') ?? '0') * 1000,
  }
  if (!res.ok) {
    // Rate-limited or offline: fall back to cache if we have it (I4 keyless resilience).
    if (cached) return { repos: JSON.parse(cached.json), budget, fromCache: true }
    throw new Error(`GitHub ${res.status}${res.status === 403 ? ' — rate limit; try again after reset' : ''}`)
  }
  const repos: GhRepo[] = await res.json()
  await db.nabzCache.put({ key: cacheKey, json: JSON.stringify(repos), fetchedAt: new Date().toISOString() })
  return { repos, budget, fromCache: false }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Slugified match: does a ledger entry plausibly correspond to this repo? */
function ledgerForRepo(repo: GhRepo, ledger: LedgerEntry[]): LedgerEntry | undefined {
  const repoSlug = repo.name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return ledger.find((e) => {
    const idSlug = e.id.replace(/^proj-/, '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const titleSlug = e.title.split('—')[0].trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    const linkedRepo = (e.evidence?.repo ?? '').toLowerCase()
    return (
      linkedRepo.includes(`/${repo.name.toLowerCase()}`) ||
      idSlug === repoSlug ||
      titleSlug === repoSlug ||
      (repoSlug.length >= 5 && (idSlug.includes(repoSlug) || repoSlug.includes(idSlug)))
    )
  })
}

/**
 * Diff engine: compare live repos against the ledger and draft suggestions.
 * - in_forge entry whose repo now exists (public) → promotion suggestion (the self-strengthening loop).
 * - repo with no ledger entry at all → new-entry suggestion.
 */
export async function computeSuggestions(repos: GhRepo[]): Promise<NabzSuggestion[]> {
  const ledger = await db.ledger.toArray()
  const existing = await db.suggestions.toArray()
  const liveSuggestions: NabzSuggestion[] = []
  const now = new Date().toISOString()

  const isDismissed = (repoName: string, type: NabzSuggestion['type']) =>
    existing.some((s) => s.repoName === repoName && s.type === type && s.status === 'dismissed')

  for (const repo of repos) {
    if (repo.fork) continue
    const match = ledgerForRepo(repo, ledger)

    if (match && match.tier === 'in_forge') {
      if (isDismissed(repo.name, 'promotion')) continue
      liveSuggestions.push({
        id: `sug-promo-${repo.name}`,
        type: 'promotion',
        repoName: repo.name,
        repoUrl: repo.html_url,
        why: `"${match.title.split('—')[0].trim()}" is in the forge, but its repo ${repo.name} is now public${repo.description ? ` — "${repo.description.slice(0, 80)}"` : ''}. The truth caught up: promote it.`,
        targetLedgerId: match.id,
        status: 'pending',
        createdAt: now,
      })
    } else if (match && match.tier === 'shipped' && repo.homepage && !match.evidence?.url?.includes(hostOf(repo.homepage))) {
      // Live-link discovery: repo has a homepage (live demo) not yet attached as evidence.
      if (isDismissed(repo.name, 'attach_link')) continue
      liveSuggestions.push({
        id: `sug-link-${repo.name}`,
        type: 'attach_link',
        repoName: repo.name,
        repoUrl: repo.homepage,
        why: `${repo.name} has a live demo at ${hostOf(repo.homepage)} that isn't linked on "${match.title.split('—')[0].trim()}". Attach it — a working link is your strongest evidence.`,
        targetLedgerId: match.id,
        status: 'pending',
        createdAt: now,
      })
    } else if (!match && repo.size > 0) {
      if (isDismissed(repo.name, 'new_entry')) continue
      liveSuggestions.push({
        id: `sug-new-${repo.name}`,
        type: 'new_entry',
        repoName: repo.name,
        repoUrl: repo.html_url,
        why: `New public repo ${repo.name}${repo.description ? ` — "${repo.description.slice(0, 90)}"` : ''} isn't in the ledger yet. Add it?`,
        draftEntry: {
          id: `proj-${repo.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          kind: 'project',
          title: repo.name,
          summary: repo.description ?? '',
          bullets: repo.description
            ? [{ id: `${repo.name}-b1`, text: repo.description, keywords: repo.language ? [repo.language.toLowerCase()] : [] }]
            : [],
          tier: 'shipped',
          evidence: { repo: repo.html_url, date: repo.pushed_at.slice(0, 7).replace('-', '/'), note: 'Public GitHub repo (via Nabz).' },
          tags: repo.language ? [repo.language.toLowerCase()] : [],
          resumeEligible: true,
        },
        status: 'pending',
        createdAt: now,
      })
    }
  }

  // Persist pending suggestions (upsert), preserving prior accept/dismiss decisions.
  await db.transaction('rw', db.suggestions, async () => {
    for (const s of liveSuggestions) {
      const prior = existing.find((e) => e.id === s.id)
      if (!prior) await db.suggestions.put(s)
    }
  })
  return liveSuggestions
}

export async function acceptSuggestion(s: NabzSuggestion): Promise<void> {
  await db.transaction('rw', [db.ledger, db.suggestions], async () => {
    if (s.type === 'promotion' && s.targetLedgerId) {
      const now = new Date()
      const entry = await db.ledger.get(s.targetLedgerId)
      await db.ledger.update(s.targetLedgerId, {
        tier: 'shipped',
        forgeEta: undefined,
        evidence: {
          repo: s.repoUrl,
          url: entry?.evidence?.url ?? s.repoUrl,
          date: `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
          note: 'Promoted via Nabz — repo went public.',
        },
      })
    } else if (s.type === 'new_entry' && s.draftEntry) {
      await db.ledger.put(s.draftEntry)
    } else if (s.type === 'attach_link' && s.targetLedgerId) {
      const entry = await db.ledger.get(s.targetLedgerId)
      if (entry) {
        await db.ledger.update(s.targetLedgerId, {
          evidence: { ...(entry.evidence ?? { date: '', note: '' }), url: s.repoUrl, note: entry.evidence?.note ?? 'Live demo attached via Nabz.' },
        })
      }
    }
    await db.suggestions.update(s.id, { status: 'accepted' })
  })
}

export async function dismissSuggestion(id: string): Promise<void> {
  await db.suggestions.update(id, { status: 'dismissed' })
}
