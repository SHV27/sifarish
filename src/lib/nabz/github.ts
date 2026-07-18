import { db } from '../../db/db'
import type { LedgerEntry, NabzSuggestion } from '../../types'
import { LEXICON } from '../jd/lexicon'
import { buildContext, forgeBullets, sanitizeBullets, toBullets, FORGE_VERSION } from './forge'
import { meteredCallsAllowed } from '../apiGuard'
import { allowedThisRun } from '../budget'

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

  // Via /api/gh (D86): server-side fetch with the PAT, so the browser never touches api.github.com
  // and can never log a GitHub 403/404. A non-ok proxy reply falls back to cache exactly as before.
  let data: { ok?: boolean; repos?: GhRepo[]; budget?: RateBudget; rateLimited?: boolean } | null = null
  try {
    const res = await fetch(`/api/gh?kind=repos`)
    if (res.ok) data = await res.json()
  } catch {
    /* offline / no serverless (local vite dev) — serve cache below */
  }
  if (!data || !data.ok || !data.repos) {
    if (data?.rateLimited) await noteRateLimit(data.budget?.resetAt ?? 0)
    return { repos: cached ? JSON.parse(cached.json) : [], budget: data?.budget ?? null, fromCache: true }
  }
  await db.nabzCache.put({ key: cacheKey, json: JSON.stringify(data.repos), fetchedAt: new Date().toISOString() })
  return { repos: data.repos, budget: data.budget ?? null, fromCache: false }
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
  // Known rate-limited → never hit the network at all.
  if (await githubBlocked()) return cached ? JSON.parse(cached.json) : null
  try {
    // Via /api/gh (D86): a no-README repo comes back as { ok:true, readme:null } — a clean 200,
    // so the browser never logs the 404 that SHV27/demo used to throw on every Nabz mount.
    const res = await fetch(`/api/gh?kind=readme&repo=${encodeURIComponent(repoName)}`)
    if (!res.ok) return cached ? JSON.parse(cached.json) : null
    const data = (await res.json()) as { ok?: boolean; readme?: string | null; rateLimited?: boolean }
    if (!data.ok) {
      if (data.rateLimited) await noteRateLimit(0)
      return cached ? JSON.parse(cached.json) : null
    }
    // NEGATIVE CACHE (D72): tombstone a null README for the TTL so a README-less repo is asked
    // about once per week, not once per mount. The 404 no longer reaches the browser at all now
    // (D86), but the tombstone still saves the round-trip.
    const readme = data.readme ?? null
    await db.nabzCache.put({ key: cacheKey, json: JSON.stringify(readme), fetchedAt: new Date().toISOString() })
    return readme
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
  /** The problem the project attacks — the first substantive prose, in his own words. */
  problem: string
  /** Cleaned README prose (capped) — the tailor's full reading material (Session 5.4). */
  raw: string
  /**
   * Session 6.1 — the UNCAPPED cleaned README, for the drift guard only. The guard used to check
   * against the capped `raw`, so a TRUE bullet about content past the 14k cap was rejected as an
   * invention — thinning the kept pool on his richest projects. Never stored, never in a payload.
   */
  fullClean: string
}

// Session 7.1 (owner-caught: SPARK-CORE's résumé description read "How it works" — a README
// SECTION HEADING the tagline picker mistook for a descriptive line). Every common section-y
// heading phrase is named here; a tagline must also be ≥18 chars (a real tagline describes).
const SECTION_WORDS = /^(installation|install|usage|getting started|setup|features|table of contents|contents|license|contributing|contributors|acknowledg|prerequisites|requirements|demo|screenshots?|tech stack|built with|about|overview|run it|make it yours|art direction|how it works|how to|what('|’)s inside|quick ?start|project structure|folder structure|architecture|deployment|configuration|config|environment|roadmap|faq|credits|testing|tests|status|why|examples?)\b/i

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
  // Session 7 (defect R1, his real résumé): a bare URL wrapped in markdown bold captured the
  // trailing `**` into the stored evidence URL — markdown emphasis chars are never URL chars.
  const urls = [...noCode.matchAll(/(https?:\/\/[^\s)"'\]*`]+)/gi)].map((m) => m[1].replace(/[*_`~.,;]+$/, ''))
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
    // ≥18 chars: a real tagline DESCRIBES ("The Board That Plays Back"); a 3-word section
    // heading ("How it works") never reaches 18 with meaning (Session 7.1).
    if (c.length >= 18 && !SECTION_WORDS.test(c) && /[a-z]/i.test(c)) {
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

  // Feature bullets: up to 8 substantive list items (what it does / how it's built). Widened
  // from 5 (owner-requested, Session 5.4) — this is SOURCE MATERIAL for the tailor's reasoning
  // (ProjectContext.features, D58), not what renders on the page. The compiler still trims to
  // 1-3 per project at compile time regardless of how many the ledger holds (D28's one-page
  // law is unaffected); a deeper ledger only gives the Editor's Desk more to choose from.
  //
  // A markdown list item may WRAP across physical lines. Reading only the matched line sliced
  // real sentences mid-clause ("…updates, so the app") and shipped the fragment to the resume.
  // So a match consumes its continuation lines until a blank line / new item / heading.
  const bullets: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < lines.length && bullets.length < 8; i++) {
    const m = /^\s*[-*+]\s+(.*)$/.exec(lines[i])
    if (!m) continue
    let text = m[1]
    for (let j = i + 1; j < lines.length; j++) {
      const nxt = lines[j]
      if (!nxt.trim() || /^\s*[-*+]\s/.test(nxt) || /^\s*\d+\.\s/.test(nxt) || /^#{1,6}\s/.test(nxt.trim()) || /^\s*\|/.test(nxt)) break
      text += ' ' + nxt.trim()
      i = j
    }
    const c = cleanMd(text)
    const key = c.toLowerCase()
    if (c.length >= 25 && c.length <= 400 && /[a-z]/i.test(c) && !/(license|contribut|^install|clone|npm i |git clone|©|copyright)/i.test(c) && !seen.has(key)) {
      seen.add(key)
      bullets.push(c)
    }
  }

  const hay = ` ${cleanMd(noCode).toLowerCase()} `
  const matched = LEXICON.filter((l) => l.patterns.some((p) => hay.includes(p)))
  const keywords = matched.map((l) => l.canonical)
  // Tech stack = human-readable subset of the matched keywords (languages/frameworks/tools).
  const stack = [...new Set(keywords.map((k) => k.replace(/-/g, ' ')))].slice(0, 8)

  // The problem statement: the first substantive prose paragraphs (what it attacks and why).
  // Widened from 2 sentences/400 chars (owner-requested, Session 5.4): the tailor's angle
  // reasoning reads this brief, and a one-liner gave it nothing specific to reach for.
  const proseLines: string[] = []
  for (const raw of lines) {
    const t = raw.trim()
    if (!t || /^#{1,6}\s/.test(t) || /^[-*+]\s/.test(t) || /^\d+\.\s/.test(t) || /^\|/.test(t)) continue
    const c = cleanMd(t)
    if (c.length >= 40 && /[a-z]/i.test(c) && !SECTION_WORDS.test(c)) proseLines.push(c)
    if (proseLines.length >= 5) break
  }
  const problem = proseLines.join(' ').slice(0, 1200).trim()

  // Full cleaned reading material for the tailor. Capped so a huge README can't blow the LLM
  // context or the IndexedDB row. 12k chars covers even a long, detailed README with room to
  // spare (was 6k — deepened per the owner's founding requirement that ledger depth drives
  // framing quality). This is source material for REASONING, never rendered on a resume, so a
  // deep cap costs nothing at the one-page law (D28: the compiler is the sole authority there).
  // 14k (was 12k, Session 5.6): the forge feeds this to the model AND uses it as the drift-guard
  // source, so a real number the model correctly used ("29 boards", "18 markets") must be inside the
  // cap or the guard wrongly flags it as invented and nukes a good bullet. 14k holds his READMEs'
  // substance while keeping each forge call within Groq's free-tier per-minute token budget.
  const fullClean = cleanMd(noCode)
  const raw = fullClean.slice(0, 14000)

  return { summary, bullets, keywords, stack, liveUrl, hasReadme: fullClean.length > 20, problem, raw, fullClean }
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
  const langKw = repo.language ? [repo.language.toLowerCase()] : []
  const keywords = [...new Set([...(distilled?.keywords ?? []), ...langKw])]

  // THE BULLET FORGE (D56): README material becomes resume-GRADE bullets. During a bulk sync we
  // stay deterministic (zero budget, zero latency across ~17 repos); when the owner actually adds
  // the repo, the reasoning tier reshapes it — guarded against the README, so no fact is minted.
  const forged = deep
    ? await forgeBullets({ repo, distilled }).catch(() => null)
    : { summary: distilled?.summary || repo.description || '', bullets: sanitizeBullets(distilled?.bullets ?? []), by: 'deterministic' as const, rejected: [] }
  const summary = forged?.summary || distilled?.summary || repo.description || ''
  const bulletTexts =
    forged && forged.bullets.length > 0
      ? forged.bullets
      : sanitizeBullets(distilled?.bullets ?? []).length > 0
        ? sanitizeBullets(distilled?.bullets ?? [])
        : repo.description
          ? [repo.description]
          : []
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
      bullets: toBullets(repo.name, bulletTexts, keywords),
      tier: 'shipped',
      evidence: {
        repo: repo.html_url,
        url: repo.homepage || distilled?.liveUrl || undefined,
        date: repo.pushed_at.slice(0, 7).replace('-', '/'),
        note: 'Public GitHub repo (via Nabz).',
      },
      // The deep-read README rides along as SOURCE MATERIAL — the tailor frames from it (D56).
      context: buildContext(repo, distilled),
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

// (forceAddRepo deleted in Session 7.2 — superseded by addRepoToLedger since D52, zero callers.
// D125's own rule: dead code lies.)

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

/**
 * REMOVE REPO-LESS PROJECTS (D91) — owner-requested cleanup. Projects with no linked GitHub repo
 * (DARYA, MUNSHI, …) can't be forged, so they render as thin one-liners and drag the resume down.
 * He wants only real, repo-backed shipped work in the ledger for now; the thin ones come back the
 * moment their repo exists (Nabz add + re-forge). Local-first: only he can trigger this, and it
 * touches ONLY `kind:'project'` entries with no evidence.repo — skills/education/etc. are never
 * removed, and any project that DID match a repo (its evidence.repo is set) is kept.
 */
export async function removeRepolessProjects(): Promise<{ removed: string[] }> {
  const ledger = await db.ledger.toArray()
  const repoless = ledger.filter((e) => e.kind === 'project' && !(e.evidence?.repo && e.evidence.repo.trim()))
  if (repoless.length > 0) await db.ledger.bulkDelete(repoless.map((e) => e.id))
  return { removed: repoless.map((e) => e.title.split('—')[0].trim()) }
}

/** How many projects would `removeRepolessProjects` remove — for a confirm prompt. */
export async function repolessProjectNames(): Promise<string[]> {
  const ledger = await db.ledger.toArray()
  return ledger.filter((e) => e.kind === 'project' && !(e.evidence?.repo && e.evidence.repo.trim())).map((e) => e.title.split('—')[0].trim())
}

export interface RefreshResult {
  ok: boolean
  by: 'dimaag' | 'deterministic'
  bullets: number
  rejected: string[]
  note: string
}

/**
 * RE-READ & RE-FORGE an entry already in the ledger (D56).
 *
 * The forge fixes what Nabz drafts from today onward — but the entries already in the vault were
 * drafted by the old paste-the-README-scraps path and still carry `- App: https://…` as resume
 * bullets. Local-first means no migration can reach them; the owner's data is his. So the repair
 * is a one-click, owner-confirmed re-read: pull the README fresh, forge proper bullets, attach the
 * full context, and keep everything he curated by hand (title, tier, resumeEligible, tags, dates).
 *
 * Only bullets / summary / context / live-URL are replaced — the fields Nabz owns. His edits stand.
 */
export async function refreshEntryFromRepo(repo: GhRepo): Promise<RefreshResult> {
  const ledger = await db.ledger.toArray()
  const entry = ledgerForRepo(repo, ledger)
  if (!entry) return { ok: false, by: 'deterministic', bullets: 0, rejected: [], note: 'That repo has no ledger entry yet — add it first.' }

  const readme = await fetchReadme(repo.name).catch(() => null)
  const distilled = readme ? distillReadme(readme) : null
  if (!distilled?.hasReadme) {
    return { ok: false, by: 'deterministic', bullets: 0, rejected: [], note: `No README found for ${repo.name} — nothing to re-read. Your entry is untouched.` }
  }

  const forged = await forgeBullets({ repo, distilled }).catch(() => null)

  // Session 6.1 — THE SILENT-DOWNGRADE GUARD (how the slop got into his vault): a batch re-forge
  // used to trip the free-tier TPM mid-run, the later repos fell to the deterministic path, and
  // this function PERSISTED those README scraps over his existing bullets — a rate limit quietly
  // rewrote his résumé downward. The rule now: when intelligence was EXPECTED (owner mode, budget
  // available) and the entry already holds real bullets, a deterministic result never overwrites
  // them. Context + evidence still refresh (safe source material); bullets wait for the real forge.
  const expectedDimaag = meteredCallsAllowed() && (await allowedThisRun('dimaag')) > 0
  if (forged?.by !== 'dimaag' && expectedDimaag && entry.bullets.length >= 2) {
    await db.ledger.update(entry.id, { context: buildContext(repo, distilled) })
    return {
      ok: false,
      by: 'deterministic',
      bullets: 0,
      rejected: forged?.rejected ?? [],
      note: `Dimaag was busy (rate-limit) for ${repo.name} — your bullets are UNTOUCHED. Re-run in a minute; the forge never downgrades your entry silently.`,
    }
  }

  const texts = forged && forged.bullets.length > 0 ? forged.bullets : sanitizeBullets(distilled.bullets)
  if (texts.length === 0) {
    return { ok: false, by: 'deterministic', bullets: 0, rejected: forged?.rejected ?? [], note: 'The README had no material that could honestly become a resume bullet. Your entry is untouched.' }
  }

  const langKw = repo.language ? [repo.language.toLowerCase()] : []
  const keywords = [...new Set([...distilled.keywords, ...langKw])]
  await db.ledger.update(entry.id, {
    summary: forged?.summary || distilled.summary || entry.summary,
    bullets: toBullets(repo.name, texts, keywords),
    context: buildContext(repo, distilled),
    // Stamped only on a REAL forge pass — the repair banner keys off this (Session 6.1).
    forgeVersion: forged?.by === 'dimaag' ? FORGE_VERSION : entry.forgeVersion,
    evidence: {
      ...(entry.evidence ?? { date: repo.pushed_at.slice(0, 7).replace('-', '/'), note: 'Public GitHub repo (via Nabz).' }),
      repo: entry.evidence?.repo ?? repo.html_url,
      url: entry.evidence?.url || repo.homepage || distilled.liveUrl || undefined,
    },
  })

  const by = forged?.by ?? 'deterministic'
  return {
    ok: true,
    by,
    bullets: texts.length,
    rejected: forged?.rejected ?? [],
    note:
      by === 'dimaag'
        ? `Re-read ${repo.name}'s README and forged ${texts.length} resume-grade bullets${forged?.rejected.length ? ` (${forged.rejected.length} rejected by the fact guard)` : ''}.`
        : `Re-read ${repo.name}'s README — kept ${texts.length} bullet(s) from your own words (keyless/deterministic path).`,
  }
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
