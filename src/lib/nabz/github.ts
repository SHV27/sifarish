import { db } from '../../db/db'
import type { LedgerEntry, NabzSuggestion } from '../../types'
import { LEXICON } from '../jd/lexicon'

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

// ---- rate-limit backoff (D52.1) — once GitHub says 0-remaining or 403, we make ZERO further
// network calls until the reset, so a 403 can never surface as a browser console error. In normal
// owner use (≈15 calls, cached 7d) this never trips; it is a pure safety net. ----
const RL_KEY = 'ratelimit:github'

async function rateLimitedUntil(): Promise<number> {
  const row = await db.nabzCache.get(RL_KEY)
  return row ? Number(row.json) : 0
}
async function noteRateLimit(resetAtMs: number): Promise<void> {
  // Default to a 60-min backoff if the reset header was missing/zero.
  const until = resetAtMs > Date.now() ? resetAtMs : Date.now() + 60 * 60 * 1000
  await db.nabzCache.put({ key: RL_KEY, json: String(until), fetchedAt: new Date().toISOString() })
}
async function githubBlocked(): Promise<boolean> {
  return Date.now() < (await rateLimitedUntil())
}

export async function fetchRepos(force = false): Promise<SyncNabz> {
  const cacheKey = `repos:${USER}`
  const cached = await db.nabzCache.get(cacheKey)
  if (!force && cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL) {
    return { repos: JSON.parse(cached.json), budget: null, fromCache: true }
  }
  // Known rate-limited → never hit the network (zero console 403s). Serve cache or an empty list.
  if (await githubBlocked()) {
    return { repos: cached ? JSON.parse(cached.json) : [], budget: null, fromCache: true }
  }

  let res: Response
  try {
    res = await fetch(`https://api.github.com/users/${USER}/repos?sort=pushed&per_page=100`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
  } catch {
    // Offline / network error — serve cache, never throw at the user.
    return { repos: cached ? JSON.parse(cached.json) : [], budget: null, fromCache: true }
  }
  const budget: RateBudget = {
    remaining: Number(res.headers.get('x-ratelimit-remaining') ?? '0'),
    limit: Number(res.headers.get('x-ratelimit-limit') ?? '60'),
    resetAt: Number(res.headers.get('x-ratelimit-reset') ?? '0') * 1000,
  }
  if (!res.ok || budget.remaining <= 0) {
    await noteRateLimit(budget.resetAt) // back off so subsequent calls stay silent
    return { repos: cached ? JSON.parse(cached.json) : [], budget, fromCache: true }
  }
  const repos: GhRepo[] = await res.json()
  await db.nabzCache.put({ key: cacheKey, json: JSON.stringify(repos), fetchedAt: new Date().toISOString() })
  return { repos, budget, fromCache: false }
}

// ---------------- README deep-read (v4.1, D45) ----------------
// A repo's README is the richest, most truthful context the owner has already written about
// his own work. Nabz distills it into the draft entry so the Darzi tailors from substance,
// not a one-line description. Owner still confirms every draft (Nabz pattern, I1 intact).

const README_TTL = 7 * 86400000

export async function fetchReadme(repoName: string): Promise<string | null> {
  const cacheKey = `readme:${USER}/${repoName}`
  const cached = await db.nabzCache.get(cacheKey)
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < README_TTL) {
    return JSON.parse(cached.json)
  }
  // Known rate-limited → never hit the network (zero console 403s).
  if (await githubBlocked()) return cached ? JSON.parse(cached.json) : null
  try {
    const res = await fetch(`https://api.github.com/repos/${USER}/${repoName}/readme`, {
      headers: { Accept: 'application/vnd.github.raw+json' },
    })
    if (!res.ok) {
      if (res.status === 403 || Number(res.headers.get('x-ratelimit-remaining') ?? '1') <= 0) {
        await noteRateLimit(Number(res.headers.get('x-ratelimit-reset') ?? '0') * 1000)
      }
      return cached ? JSON.parse(cached.json) : null
    }
    const text = await res.text()
    await db.nabzCache.put({ key: cacheKey, json: JSON.stringify(text), fetchedAt: new Date().toISOString() })
    return text
  } catch {
    return cached ? JSON.parse(cached.json) : null
  }
}

export interface ReadmeDistilled {
  /** A rich 1–2 sentence description (prefers the repo's own tagline). */
  summary: string
  /** Up to 5 substantive feature/what-it-does bullets. */
  bullets: string[]
  /** Lexicon keywords → drive evidence matching. */
  keywords: string[]
  /** Human-readable tech stack line ("React · TypeScript · Groq"). */
  stack: string[]
  /** Best live/demo URL found in the README. */
  liveUrl?: string
  /** Whether a README was actually read (vs. nothing available). */
  hasReadme: boolean
}

const SECTION_WORDS = /^(installation|install|usage|getting started|setup|features|table of contents|contents|license|contributing|contributors|acknowledg|prerequisites|requirements|demo|screenshots?|tech stack|built with|about|overview|run it|make it yours|art direction)\b/i

function cleanMd(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images/badges
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '') // linked badges
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → their text
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`>#~|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Pure distiller (deep, D52): markdown → rich {summary, bullets, stack, keywords, liveUrl}. */
export function distillReadme(md: string): ReadmeDistilled {
  const noCode = md.replace(/```[\s\S]*?```/g, ' ').replace(/~~~[\s\S]*?~~~/g, ' ')
  const lines = noCode.split('\n')

  // Best live URL: prefer a deployment host; else any http link that isn't github/shields.
  const urls = [...noCode.matchAll(/(https?:\/\/[^\s)"'\]]+)/gi)].map((m) => m[1])
  const liveUrl =
    urls.find((u) => /(vercel\.app|netlify\.app|github\.io|pages\.dev|\.web\.app|streamlit\.app|onrender\.com|railway\.app)/i.test(u)) ??
    urls.find((u) => !/github\.com|shields\.io|img\.|badge/i.test(u))

  // Summary: prefer a descriptive tagline (a sub-heading that reads like a phrase, not a section
  // word), then enrich with the first prose sentence. Falls back to the first prose paragraph.
  let tagline = ''
  for (const raw of lines) {
    const h = /^#{2,4}\s+(.*)$/.exec(raw.trim())
    if (!h) continue
    const c = cleanMd(h[1])
    if (c.length >= 12 && !SECTION_WORDS.test(c) && /[a-z]/i.test(c)) {
      tagline = c
      break
    }
  }
  let prose = ''
  for (const raw of lines) {
    const t = raw.trim()
    if (!t || /^#{1,6}\s/.test(t) || /^[-*+]\s/.test(t) || /^\d+\.\s/.test(t) || /^\|/.test(t) || /^!\[/.test(t) || /^\[!\[/.test(t)) continue
    const c = cleanMd(t)
    if (c.length >= 40 && /[a-z]/i.test(c) && !SECTION_WORDS.test(c)) {
      prose = c
      break
    }
  }
  let summary = tagline && prose ? `${tagline.replace(/[.:]$/, '')} — ${prose}` : tagline || prose
  summary = summary.slice(0, 320).trim()

  // Feature bullets: up to 5 substantive list items (what it does / how it's built).
  const bullets: string[] = []
  const seen = new Set<string>()
  for (const raw of lines) {
    const m = /^\s*[-*+]\s+(.*)$/.exec(raw)
    if (!m) continue
    const c = cleanMd(m[1])
    const key = c.toLowerCase()
    if (c.length >= 25 && c.length <= 200 && /[a-z]/i.test(c) && !/(license|contribut|^install|clone|npm i |git clone|©|copyright)/i.test(c) && !seen.has(key)) {
      seen.add(key)
      bullets.push(c)
      if (bullets.length >= 5) break
    }
  }

  const hay = ` ${cleanMd(noCode).toLowerCase()} `
  const matched = LEXICON.filter((l) => l.patterns.some((p) => hay.includes(p)))
  const keywords = matched.map((l) => l.canonical)
  // Tech stack = human-readable subset of the matched keywords (languages/frameworks/tools).
  const stack = [...new Set(keywords.map((k) => k.replace(/-/g, ' ')))].slice(0, 8)

  return { summary, bullets, keywords, stack, liveUrl, hasReadme: cleanMd(noCode).length > 20 }
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
    } else if (match && match.tier === 'shipped' && !repo.homepage && repo.description && !match.evidence?.url) {
      // Deep-scan (v4): a live URL written into the repo DESCRIPTION also counts as discoverable evidence.
      const descUrl = /(https?:\/\/[^\s)"']+)/.exec(repo.description)?.[1]
      if (descUrl && !isDismissed(repo.name, 'attach_link')) {
        liveSuggestions.push({
          id: `sug-link-${repo.name}`,
          type: 'attach_link',
          repoName: repo.name,
          repoUrl: descUrl,
          why: `${repo.name}'s description mentions ${hostOf(descUrl)} and "${match.title.split('—')[0].trim()}" has no live link yet. Attach it (it will be liveness-probed first)?`,
          targetLedgerId: match.id,
          status: 'pending',
          createdAt: now,
        })
      }
    } else if (!match && repo.size > 0) {
      if (isDismissed(repo.name, 'new_entry')) continue
      liveSuggestions.push(await buildNewEntrySuggestion(repo, false)) // lightweight during sync
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

/**
 * Build a fresh new_entry suggestion for a repo (README-distilled draft, D45). Shared by
 * `computeSuggestions` (auto sync) and `forceAddRepo` (manual override, D47).
 */
async function buildNewEntrySuggestion(repo: GhRepo, deep = true): Promise<NabzSuggestion> {
  const now = new Date().toISOString()
  // Lightweight during a bulk sync (deep=false → cached README only, no new network call);
  // deep=true when the owner actually adds the repo, so its draft carries full README substance.
  const cacheKey = `readme:${USER}/${repo.name}`
  const cachedReadme = await db.nabzCache.get(cacheKey)
  const readme = deep ? await fetchReadme(repo.name).catch(() => null) : cachedReadme ? (JSON.parse(cachedReadme.json) as string) : null
  const distilled = readme ? distillReadme(readme) : null
  const summary = distilled?.summary || repo.description || ''
  const langKw = repo.language ? [repo.language.toLowerCase()] : []
  const keywords = [...new Set([...(distilled?.keywords ?? []), ...langKw])]
  const bulletTexts = distilled && distilled.bullets.length > 0 ? distilled.bullets : repo.description ? [repo.description] : []
  return {
    id: `sug-new-${repo.name}`,
    type: 'new_entry',
    repoName: repo.name,
    repoUrl: repo.html_url,
    why: `New public repo ${repo.name}${summary ? ` — "${summary.slice(0, 90)}"` : ''} isn't in the ledger yet.${
      distilled?.summary ? ' Drafted from its README (your own words — richer context for the tailor).' : ''
    } Add it?`,
    draftEntry: {
      id: `proj-${repo.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      kind: 'project',
      title: repo.name,
      summary,
      bullets: bulletTexts.map((text, i) => ({ id: `${repo.name}-b${i + 1}`, text, keywords })),
      tier: 'shipped',
      evidence: {
        repo: repo.html_url,
        url: repo.homepage || distilled?.liveUrl || undefined,
        date: repo.pushed_at.slice(0, 7).replace('-', '/'),
        note: 'Public GitHub repo (via Nabz).',
      },
      tags: keywords.slice(0, 6),
      resumeEligible: true,
    },
    status: 'pending',
    createdAt: now,
  }
}

// ---------------- full visibility (v4.3, D47) ----------------
// "GitHub ka sab show hona chahiye" — a dismissed or already-decided suggestion should
// never PERMANENTLY hide a repo from view. This gives an unfiltered list of every public
// repo with its live status, and a manual override that resurfaces ANY repo on demand —
// regardless of what a past sync/dismiss/accept did.

export type RepoStatus = 'shipped' | 'in_forge' | 'pending' | 'dismissed' | 'untracked'

export interface RepoOverview {
  repo: GhRepo
  status: RepoStatus
  ledgerTitle?: string
  ledgerId?: string
  /** Deep README detail (D52) — every repo is shown richly, nothing hidden. */
  distilled?: ReadmeDistilled
}

/**
 * "YOUR GITHUB, DEEPLY READ" (D52) — every non-fork public repo, ALWAYS, with its ledger status
 * AND a deep README distillation. This is the primary Nabz surface: nothing is ever hidden by a
 * past dismiss. `readReadmes` fetches missing READMEs (cached 7d, capped per call for the 60/hr
 * unauth budget); cached ones render instantly.
 */
export async function overviewRepos(repos: GhRepo[], readReadmes = true, budgetRemaining?: number): Promise<RepoOverview[]> {
  const ledger = await db.ledger.toArray()
  const suggestions = await db.suggestions.toArray()
  const out: RepoOverview[] = []
  // Never fire a network README fetch we expect to fail: only fetch as many as the known
  // remaining rate-limit budget safely allows (minus a margin), and none at all if blocked.
  const blocked = await githubBlocked()
  const safeFetches = blocked ? 0 : budgetRemaining === undefined ? 8 : Math.max(0, budgetRemaining - 4)
  let fetched = 0
  const nonFork = repos.filter((r) => !r.fork).sort((a, b) => (b.pushed_at ?? '').localeCompare(a.pushed_at ?? ''))
  for (const repo of nonFork) {
    const match = ledgerForRepo(repo, ledger)
    let distilled: ReadmeDistilled | undefined
    if (readReadmes) {
      const cacheKey = `readme:${USER}/${repo.name}`
      const cached = await db.nabzCache.get(cacheKey)
      let md: string | null = cached ? (JSON.parse(cached.json) as string) : null
      if (md === null && fetched < safeFetches) {
        md = await fetchReadme(repo.name).catch(() => null)
        fetched += 1
      }
      if (md) distilled = distillReadme(md)
    }
    if (match) {
      out.push({ repo, status: match.tier, ledgerTitle: match.title.split('—')[0].trim(), ledgerId: match.id, distilled })
    } else {
      const sug = suggestions.find((s) => s.repoName === repo.name && s.type === 'new_entry')
      out.push({ repo, status: sug?.status === 'dismissed' ? 'dismissed' : sug?.status === 'pending' ? 'pending' : 'untracked', distilled })
    }
  }
  return out
}

/**
 * Manual override (D47): re-surface a new-entry suggestion for ANY repo, ignoring prior
 * dismiss/accept history — an `upsert`, not a `put-if-absent`.
 */
export async function forceAddRepo(repo: GhRepo): Promise<NabzSuggestion> {
  const s = await buildNewEntrySuggestion(repo)
  await db.suggestions.put(s)
  return s
}

/**
 * ONE-CLICK ADD (D52): build the deep README-distilled draft and write it straight to the ledger,
 * recording an accepted suggestion for the trail. Works for ANY untracked/dismissed repo — the
 * owner's right to add his own project never expires. Returns the created ledger entry id.
 */
export async function addRepoToLedger(repo: GhRepo): Promise<string> {
  const s = await buildNewEntrySuggestion(repo)
  await db.transaction('rw', [db.ledger, db.suggestions], async () => {
    if (s.draftEntry) await db.ledger.put(s.draftEntry)
    await db.suggestions.put({ ...s, status: 'accepted' })
  })
  return s.draftEntry?.id ?? ''
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
