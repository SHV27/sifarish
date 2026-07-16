import type { Bullet, ProjectContext } from '../../types'
import { generate } from '../dimaag/core'
import { detectDrift } from '../polish/factGuard'
import { startsStrong } from '../ustaad/library'
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

/**
 * When the deterministic fallback must ship (keyless / over-budget / the LLM drifted), prefer the
 * lines that at least READ like accomplishments — a strong engineering verb up front (Ustaad
 * verb-strength-ladder) — over copula-led feature-doc lines ("X is the database"). If too few are
 * verb-led we keep everything (an entry with some bullets beats an empty one). The real fix is the
 * LLM reshaper above; this only stops the WORST feature-doc lines leading when it can't run.
 */
export function preferAccomplishments(bullets: string[]): string[] {
  const strong = bullets.filter((b) => startsStrong(b.replace(/^[-*•]\s*/, '')))
  return strong.length >= 2 ? strong : bullets
}

export interface ForgeResult {
  summary: string
  bullets: string[]
  /** 'dimaag' = reasoned reshaping (guarded); 'deterministic' = sanitized README material. */
  by: 'dimaag' | 'deterministic'
  /** Bullets the guard threw out — surfaced so the rejection is inspectable, never silent (L4). */
  rejected: string[]
}

/**
 * THE FORGE BRIEF (Session 5.6) — the token-efficiency innovation. The model does NOT need the whole
 * README (install steps, badges, TOC, license, decision logs); it needs the SUBSTANCE: the problem,
 * the feature notes to reshape, and the stack. This compact brief is ~700 tokens vs ~4000 for the raw
 * 14k README — 5× cheaper, so a multi-project re-forge stays inside Groq's free-tier per-minute budget
 * and never falls back to the keyless path. Quality is preserved because (a) the reasoning model still
 * runs, and (b) the drift guard still validates every bullet against the FULL README (see forgeBullets)
 * — so nothing the model can honestly say is lost, only the noise the model didn't need is dropped.
 */
export function forgeBrief(repo: GhRepo, distilled: ReadmeDistilled): string {
  return [
    `Project: ${repo.name}`,
    repo.description ? `What it is: ${repo.description}` : '',
    repo.language ? `Primary language: ${repo.language}` : '',
    distilled.stack.length ? `Stack: ${distilled.stack.join(', ')}` : '',
    '',
    distilled.problem ? `PROBLEM IT ATTACKS (his own words):\n${distilled.problem}` : '',
    '',
    'WHAT IT DOES (his own feature notes — RESHAPE each into an accomplishment bullet per the rules; never copy verbatim):',
    ...sanitizeBullets(distilled.bullets).slice(0, 10).map((f) => `- ${f}`),
  ]
    .filter(Boolean)
    .join('\n')
}

export const SYSTEM = `You are a senior engineering-résumé editor writing bullets for a strong early-career AI/ML engineer, from the README he wrote about his OWN shipped project. A senior AI-lab recruiter must respect every line.

YOUR WHOLE JOB: turn the README into 3-4 ACCOMPLISHMENT bullets. A README sentence that merely states a fact, a config detail, or lists a feature ("X is the database", "Has offline support", "Pulse Loop — a weekly sweep") is NOT a bullet — reshape it into an accomplishment, or drop it. Never copy a feature-list line onto the résumé.

EVERY BULLET, NO EXCEPTIONS — the five-part shape:
1. STARTS with a strong past-tense engineering verb: Built, Architected, Engineered, Designed, Shipped, Implemented, Automated, Orchestrated, Instrumented, Integrated, Reduced, Cut, Scaled. NEVER start with a system name, a noun, or a config fact. NEVER "Responsible for", "Worked on", "Helped", "Utilized", "Used".
2. Names WHAT he built + the KEY TECH in the object — specific, not a buzzword dump ("a git-backed content system", "a RAG pipeline over the corpus", "a deterministic line-by-line PDF renderer").
3. Surfaces the HARD PART — the constraint solved, the architecture, the tradeoff ("so the whole app runs with zero API keys", "a parse-back-verified text layer", "an invariant that makes orphan claims structurally impossible").
4. ENDS with IMPACT woven into the sentence — NOT a label. Convey magnitude through the real detail: the scale (data volume, corpus size, #screens/services), a failure class eliminated, the hard constraint solved, or a named mechanism/eval/guardrail he built. Use a NUMBER only if that EXACT number appears in the README — never invent, round, or infer one. A credible concrete outcome beats a fabricated number.
   CRITICAL: never end a bullet with a bare category word like "SCALE", "RELIABILITY", "NOVELTY", "DIFFICULTY", or "IMPACT" — those are internal categories, not résumé words. Write the actual detail, in normal prose.
5. 15-25 words, one idea. Descriptive but tight — never a terse fragment, never rambling past two lines. Do NOT append an em-dash tag or a bracketed label at the end.

HARD TRUTH RULES (breaking any makes the output useless — the app discards drifting bullets):
- State ONLY facts present in the README. Re-express, compress, sharpen — but NEVER add a number, metric, model name, company, or technology the README does not contain.
- Use the README's OWN tokens for technologies (if he wrote "RAG"/"LLM"/"agents"/"MCP", use those exact words — do not introduce new tech names).
- No superlatives you can't back ("100% accuracy", "best-in-class"). No brochure register ("passionate about leveraging", "results-driven", "proven track record", "spearheaded synergies").
- For AI/agent projects, prefer bullets that show DEPTH where the README supports it: the agent architecture (tools/orchestration/MCP), an eval or guardrail he built, or a cost/production concern.

RESHAPING EXAMPLES — a README fact → a bullet:
- "GitHub is the database. manifest.json holds curation." → "Architected a git-backed content system that uses the repository itself as the datastore, with a manifest.json curation layer — no server or DB to run, versioned and diffable by design."
- "Has offline support and works without an API key." → "Engineered an offline-first, keyless architecture so every feature runs with zero API keys — deterministic core logic with the LLM as an optional amplifier, never a dependency."
- "The resume is compiled from a ledger, not written." → "Built a compiler-style résumé engine that compiles single-source-of-truth ledger data into ATS-safe PDF and DOCX, enforcing that every rendered line links to verifiable evidence."

STYLE REFERENCE — the shape and register of real bullets that got AI/ML engineers hired (EMULATE the structure and specificity; NEVER copy their facts — use only HIS README):
- "Shipped a production retrieval system over 220k support tickets with hybrid retrieval and a reranker, lifting Recall@10 from 0.61 to 0.87 at p95 < 400ms."
- "Built an MCP server exposing 14 internal tools to a customer-facing agent, replacing 3 bespoke integration layers."
- "Cut inference cost per document via prompt caching and model routing, keeping quality while collapsing spend."
Notice: strong verb first, the specific system + tech named, the hard part surfaced, an outcome at the end — that is the target for HIS bullets, in his own facts.

summary: one plain sentence (max 200 chars) — what the project IS and the problem it attacks, in his own words.
bullets: 3 to 4 bullets, strongest first, each obeying the five-part shape.`

/**
 * Forge resume bullets for a repo. Falls back to sanitized README material on every failure
 * path (keyless, over budget, malformed JSON, guard rejection) — never to invented text.
 */
export async function forgeBullets(input: { repo: GhRepo; distilled: ReadmeDistilled | null }): Promise<ForgeResult> {
  const { repo, distilled } = input
  const deterministic = preferAccomplishments(sanitizeBullets(distilled?.bullets ?? (repo.description ? [repo.description] : [])))
  const fallbackSummary = distilled?.summary || repo.description || ''

  if (!distilled?.hasReadme || !distilled.raw) {
    return { summary: fallbackSummary, bullets: deterministic, by: 'deterministic', rejected: [] }
  }

  // Token-efficiency (Session 5.6): the model reads the compact BRIEF, not the raw 14k README. The
  // guard below still checks against the full README, so facts aren't lost — only tokens are saved.
  const user = forgeBrief(repo, distilled)

  const out = await generate<{ summary?: string; bullets?: string[] }>({
    feature: 'forge',
    system: SYSTEM,
    user,
    maxTokens: 1400, // summary + 4 bullets need ~350 tokens; smaller output keeps calls under free-tier TPM
    // D74: without a schema this call uses json_object, which gpt-oss-120b fails on ~every attempt.
    schema: {
      type: 'object',
      properties: { summary: { type: 'string' }, bullets: { type: 'array', items: { type: 'string' } } },
      required: ['summary', 'bullets'],
      additionalProperties: false,
    },
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
