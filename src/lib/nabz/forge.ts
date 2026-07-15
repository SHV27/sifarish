import type { Bullet, ProjectContext } from '../../types'
import { generate } from '../dimaag/core'
import { detectDrift } from '../polish/factGuard'
import type { GhRepo, ReadmeDistilled } from './github'

/**
 * THE BULLET FORGE (Session 5.4, D56) — README material → resume-grade bullets.
 *
 * THE DISEASE IT CURES: Nabz treated every README list item ≥25 chars as a resume bullet, so
 * `- App: https://sehat-saarthi-punjab.vercel.app` and `- Docs: /docs` rendered on the resume as
 * if they were accomplishments. The compiler, the Editor's Desk and the Ustaad rubric were all
 * working correctly — they were faithfully rendering junk. Selection cannot fix supply: the tailor
 * chooses WHICH bullets run, it cannot invent good ones. So the fix belongs at the source.
 *
 * ARCHITECTURE (the D23/D37 pattern — deterministic core, LLM as amplifier):
 *   1. `isResumeBullet` deterministically REJECTS what can never be a bullet (link dumps, URL
 *      lines, fragments, headings). This alone removes the slop and needs no key.
 *   2. `forgeBullets` optionally asks the reasoning tier to reshape the surviving material into
 *      proper bullets (action verb → what he built → how → the engineering point).
 *   3. Every forged bullet is then GUARDED against the README text: a bullet carrying a number,
 *      technology or proper noun the README never claimed is DISCARDED, not shown. The LLM may
 *      only re-express what he already wrote about his own work (D45's trust boundary).
 *
 * I1 holds by construction: forged bullets live on a ledger entry, carry its id, and can state
 * nothing the README didn't. Keyless / over-budget / drifting → the sanitized deterministic
 * bullets ship instead. The forge always returns something honest.
 */

/** Label prefixes that mark a README line as a link/reference row, never an accomplishment. */
const LINK_LABEL =
  /^\s*(app|api|apis|docs?|documentation|live|demo|repo|repository|code|source|site|website|url|link|links|models?|dataset|deploy|deployment|download|install|installation|setup|run|usage|license|stack|built with|tech|contact|author|status)\s*[:\-–—]/i

/** Strip URLs so we can measure how much actual prose a line carries. */
const stripUrls = (s: string) => s.replace(/https?:\/\/\S+/gi, ' ').replace(/\b\S+\.(app|com|io|dev|org|net|space|sh)\b\S*/gi, ' ')

/** Fragment tell #1: the line ends on a function word — it was cut mid-phrase. */
const DANGLING_END = /\b(so|and|but|or|the|a|an|of|to|for|with|that|which|in|on|at|by|from|as|is|are|was|were|it|its)\s*$/i

/**
 * Fragment tell #2: a subordinate clause opens and never closes ("…updates, so the app").
 * That fragment ends on a NOUN, so tell #1 misses it — yet it is unmistakably a slice.
 * Requires conjunction + determiner + one final word, and only counts when the line carries no
 * terminal punctuation, so a complete sentence that legitimately ends "…runs the app." is safe.
 */
const CUT_CLAUSE = /\b(so|and|but|or|which|that|because|while|when|then|as|where)\s+(the|a|an|this|that|its|his|their|these|those)\s+[\w-]+\s*$/i

/**
 * Can this line stand on a resume as a claim about work done?
 * Deterministic, keyless, and the reason the slop disappears even with zero API keys.
 */
export function isResumeBullet(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  if (LINK_LABEL.test(t)) return false // "App: https://…", "Docs: /docs"

  const prose = stripUrls(t).replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim()
  if (prose.length < 30) return false // the line was mostly a URL / a path / a badge
  if (prose.split(' ').length < 6) return false // a label, not a statement

  const terminated = /[.!?]\s*$/.test(t)
  if (DANGLING_END.test(t.replace(/[.!?]+$/, ''))) return false // sliced mid-phrase
  if (!terminated && CUT_CLAUSE.test(t)) return false // sliced mid-clause ("…so the app")
  if (/^#{1,6}\s/.test(t)) return false
  if (/^(table of )?contents\b/i.test(t)) return false
  return true
}

/** Keep only the material that could honestly render, in order, de-duplicated. */
export function sanitizeBullets(raw: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const b of raw) {
    const t = b.trim().replace(/\s+/g, ' ')
    if (!isResumeBullet(t)) continue
    const key = t.toLowerCase().slice(0, 60)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

export interface ForgeResult {
  summary: string
  bullets: string[]
  /** 'dimaag' = reasoned reshaping (guarded); 'deterministic' = sanitized README material. */
  by: 'dimaag' | 'deterministic'
  /** Bullets the guard threw out — surfaced so the rejection is inspectable, never silent (L4). */
  rejected: string[]
}

const SYSTEM = `You are a resume editor for a strong early-career AI/ML engineer. You are given the README the engineer wrote about his OWN project, plus repo metadata.

Rewrite the project into resume bullets of the quality a senior FAANG/AI-lab recruiter respects.

RULES — violating any one makes the output useless:
- Every bullet must state a FACT that is present in the README. You may re-express, compress, and sharpen. You may NOT add numbers, technologies, companies, or outcomes the README does not contain. If the README gives no metric, give no metric — do NOT invent one.
- Shape: strong past-tense action verb → what he built → how / with what → why it mattered technically. One sentence, 110-190 characters.
- Lead with engineering substance (architecture, constraint solved, tradeoff made), not marketing.
- Never write a bullet that is a link, a label ("App:", "Docs:"), an install step, or a list of URLs.
- Banned register: "results-driven", "passionate about leveraging", "dynamic professional", "proven track record", "spearheaded", "utilized", "synergies". Write like an engineer describing work, not a brochure.
- Never claim the project is used by anyone, funded, or award-winning unless the README says so.

Return JSON: {"summary": string, "bullets": string[]}
- "summary": one plain sentence (max 200 chars) saying what the project IS and what problem it attacks.
- "bullets": 3 to 4 bullets, strongest first.`

/**
 * Forge resume bullets for a repo. Falls back to sanitized README material on every failure
 * path (keyless, over budget, malformed JSON, guard rejection) — never to invented text.
 */
export async function forgeBullets(input: { repo: GhRepo; distilled: ReadmeDistilled | null }): Promise<ForgeResult> {
  const { repo, distilled } = input
  const deterministic = sanitizeBullets(distilled?.bullets ?? (repo.description ? [repo.description] : []))
  const fallbackSummary = distilled?.summary || repo.description || ''

  if (!distilled?.hasReadme || !distilled.raw) {
    return { summary: fallbackSummary, bullets: deterministic, by: 'deterministic', rejected: [] }
  }

  const user = [
    `Project: ${repo.name}`,
    repo.description ? `Repo description: ${repo.description}` : '',
    repo.language ? `Primary language: ${repo.language}` : '',
    distilled.stack.length ? `Detected stack: ${distilled.stack.join(', ')}` : '',
    '',
    'README (his own words — the ONLY source of facts you may use):',
    distilled.raw,
  ]
    .filter(Boolean)
    .join('\n')

  const out = await generate<{ summary?: string; bullets?: string[] }>({
    feature: 'forge',
    system: SYSTEM,
    user,
    maxTokens: 900,
  })

  if (!out || !Array.isArray(out.bullets) || out.bullets.length === 0) {
    return { summary: fallbackSummary, bullets: deterministic, by: 'deterministic', rejected: [] }
  }

  // THE GUARD: the README is the only permitted source of facts. A bullet that smuggles in a
  // number, technology or proper noun the README never claimed is dropped (I1). We check against
  // the README PLUS the repo metadata, since language/description/name are equally his own truth.
  const source = `${distilled.raw}\n${repo.description ?? ''}\n${repo.language ?? ''}\n${repo.name}\n${distilled.stack.join(' ')}`
  const kept: string[] = []
  const rejected: string[] = []
  for (const b of out.bullets) {
    const text = String(b ?? '').trim().replace(/^[-*•]\s*/, '').replace(/\s+/g, ' ')
    if (!isResumeBullet(text)) {
      rejected.push(text)
      continue
    }
    if (!detectDrift(source, text).ok) {
      rejected.push(text)
      continue
    }
    kept.push(text)
  }

  // A forge that produced nothing usable is a forge that failed — ship the honest material.
  if (kept.length === 0) return { summary: fallbackSummary, bullets: deterministic, by: 'deterministic', rejected }

  const summaryRaw = String(out.summary ?? '').trim()
  const summary = summaryRaw && detectDrift(source, summaryRaw).ok ? summaryRaw.slice(0, 240) : fallbackSummary

  return { summary, bullets: kept.slice(0, 4), by: 'dimaag', rejected }
}

/** Build the stored reading material the Darzi frames from (never rendered verbatim). */
export function buildContext(repo: GhRepo, distilled: ReadmeDistilled | null): ProjectContext | undefined {
  if (!distilled?.hasReadme) return undefined
  return {
    problem: distilled.problem || undefined,
    features: sanitizeBullets(distilled.bullets),
    stack: distilled.stack,
    readme: distilled.raw,
    source: { repo: repo.html_url, readAt: new Date().toISOString() },
  }
}

/** Shape forged texts into Bullet records carrying the entry's evidence keywords. */
export function toBullets(repoName: string, texts: string[], keywords: string[]): Bullet[] {
  return texts.map((text, i) => ({ id: `${repoName}-b${i + 1}`, text, keywords }))
}
