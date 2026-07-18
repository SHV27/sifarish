import type { Bullet, ProjectContext } from '../../types'
import { generate } from '../dimaag/core'
import { detectDrift } from '../polish/factGuard'
import { bulletOverlapSameProject, HARD_DUPLICATE } from '../compile/overlap'
import { craftClauses, startsStrong } from '../ustaad/library'
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

/**
 * MAXIMUM-SCORING-TRUTH ORDERING (Session 5.7, owner: "sifarish ko keyless kyun promote kar rahe ho").
 * For an AI/ML-engineer résumé the AI/systems work must LEAD; a bullet that headlines a defensive
 * robustness feature ("keyless", "runs without API keys", "offline-first", "PAT limits") undersells the
 * exact wiring a recruiter screens for. Such bullets stay (still true) but sort to the BACK, so the
 * compiler's top-N cut drops them first and the AI engineering leads. Deterministic — the LLM can't be
 * trusted to never do it, so the guard makes it structural. A bullet is "defensive-led" only when the
 * robustness term appears in its opening clause (first ~60 chars); a mid-sentence mention is fine.
 */
const DEFENSIVE_LEAD = /\b(keyless|(with|runs?|works?|operat\w*)\s+(fully\s+)?(without|no)\s+(any\s+)?api\s*keys?|no\s+api\s*keys?|zero\s+api\s*keys?|offline[- ]first|pat\s+limits?)\b/i
export function isDefensiveLed(bullet: string): boolean {
  return DEFENSIVE_LEAD.test(bullet.replace(/^[-*•]\s*/, '').slice(0, 60))
}
export function rankBullets(bullets: string[]): string[] {
  return bullets.map((b, i) => ({ b, i })).sort((x, y) => Number(isDefensiveLed(x.b)) - Number(isDefensiveLed(y.b)) || x.i - y.i).map((o) => o.b)
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

/**
 * Session 6.1 — the forge's craft version. Bumped whenever the SYSTEM prompt / guard rules change
 * meaningfully; entries forged under an older version (or never LLM-forged at all) are what the
 * one-click vault repair re-forges. v2 = numbers rule mandatory + honest keyword mirroring +
 * reader test + library v1.2.0.
 * v3 (Session 7) = library v1.3.0 (24 canon patterns: bullet formula slots, no-duplicated-fact,
 * first-bullet-strongest), the clean-URL ingestion regex (no more `**` tails in evidence links),
 * and the Gemini-first reasoning router — a re-forge now writes with the stronger brain.
 * v4 (Session 7.1, owner-caught on his real page) = identity-restatement ban + one-theme-per-
 * bullet dedupe at the SOURCE, and the distiller no longer mistakes section headings
 * ("How it works") for taglines — his vault needs one more banner click to inherit this.
 */
export const FORGE_VERSION = 4

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

YOUR WHOLE JOB: turn the README into 3-4 ACCOMPLISHMENT bullets a recruiter INSTANTLY UNDERSTANDS.

THE READER TEST (rule zero): a recruiter who has NEVER seen this project must, from your bullets alone, understand (a) WHAT the project is, (b) WHAT it does for a user or system, and (c) why the engineering is impressive. If a bullet only makes sense to the person who built it, it FAILS. Compare:
  ✗ "Engineered a keyless core using agents, LLM, and PAT limits so every pillar runs without API keys" — a recruiter has NO IDEA what this app is or does; "keyless core", "pillars", "PAT limits" are private jargon; and it HEADLINES a defensive footnote instead of the AI work.
  ✓ "Built a personal AI job-hunt agent that compiles evidence-backed résumés and finds roles, powered by a two-tier LLM reasoning core (Groq) with agentic tailoring and fact-drift guardrails."
The second names WHAT IT IS, WHAT IT DOES, and features the real AI engineering.

MAXIMUM-SCORING TRUTH (the strategy — every fact true, but you choose WHICH true facts to feature): lead with the most impressive, ROLE-RELEVANT engineering. This candidate is an AI/ML engineer, so FEATURE the AI systems he built — LLM integration and orchestration, agents and tool-use, RAG and retrieval, evals and guardrails, reasoning pipelines, model routing, prompt/context engineering. That is the work a recruiter is hiring for; that is what must lead.
  Do NOT headline defensive or robustness asides — "runs offline", "no API keys", "keyless", "works without a server". A recruiter hiring an AI engineer wants to SEE the API/LLM/agent WIRING; leading with "keyless" UNDERSELLS exactly the skill they screen for. Such details may appear briefly, at most once, and NEVER as the lead of a bullet or the summary. Hiding his strongest true work to feature a footnote is a failure — show the maximum-scoring truth.

THE HUMAN STAKES (what separates him from AI slop): he builds things that help real people. Where the README shows WHO the project serves — a family getting a flood warning, a blind reader, a job-seeker who can't afford a lie on their résumé — keep that person visible in the bullet. One warm, CONCRETE clause of user value ("so a village gets the alert in its own language") beats any adjective; never manufacture a beneficiary or a feeling the README doesn't support.

EVERY BULLET:
1. LEADS WITH A STRONG PAST-TENSE VERB (Built, Architected, Engineered, Designed, Shipped, Implemented, Automated, Scaled) — then names, in PLAIN LANGUAGE, WHAT HE BUILT AND WHAT IT DOES for a real user or system ("a co-op board game where the board is the antagonist", "a flood-alert system for villages", "a résumé compiler"). The FIRST bullet of each project MUST establish what the whole project IS and its core purpose — someone reading only that line should get it.
2. BAN PRIVATE JARGON AND COINED NAMES the reader won't know — "keyless core", "the forge", "pillars", "phase→control ordering", "orphan-claim guardrail", "Pulse Loop", "the Dimaag". A bullet must NEVER OPEN with a project's internal codename ("Engineered a weekly Pulse Loop that…" FAILS — the reader has no idea what a Pulse Loop is); describe the CAPABILITY in market terms first ("Built a self-updating market-intelligence sweep that…") and let a codename appear in parentheses at most. Describe the REAL-WORLD EFFECT: "prevents illegal moves", "blocks any unproven claim from the résumé". Name concrete, well-known tech (React, TypeScript, LLMs, RAG, agents) — that a recruiter recognizes — but in service of explaining what was built, never as a buzzword dump.
2b. THE ARCHITECTURE IS THE HIGHEST-SCORING TRUTH: when the README documents the system's real engineering — the number of serverless functions, two-tier LLM model routing, retrieval/RAG, deterministic guardrails, evals, encryption, rate-limit architecture — those facts MUST surface in the bullets; they are exactly what an AI-engineer recruiter is buying. A résumé that mentions a news sweep but hides an 11-function serverless architecture with LLM routing has buried its best truth.
2c. NEVER claim scraping or crawling — this candidate's systems use lawful public APIs by principle; a scrape-claim is both false and disqualifying, and the app discards any bullet containing one.
3. States the HARD PART as an OUTCOME a non-builder grasps ("so a game runs entirely in the browser with no server", "so fabricated claims are impossible", "cutting export failures to zero").
4. ENDS with IMPACT woven into the sentence — never a bare label. THE NUMBERS RULE: when the README states a real figure (an accuracy, a %, a latency, a count — "ROC-AUC 0.957", "98.6%", "18 markets"), you MUST carry that exact figure into a bullet — a hired résumé's strongest lines are its numbered ones, and leaving a real number in the README is leaving proof on the table. Never invent, round, or infer a number the README doesn't state; when no figure exists, end with the real scale, the failure class eliminated, or the user value. Never end with a category word ("SCALE", "RELIABILITY") or a bracketed tag.
5. 15-28 words, plain and clear — a smart non-engineer should follow it. Never a terse fragment, never private jargon, never rambling past two lines.
6. ONE THEME PER BULLET, EVERY BULLET A DIFFERENT THEME. If bullet 1 covers truth-enforcement (guardrails/verification/citations), no other bullet may restate that theme in different words — cover a DIFFERENT dimension (the LLM architecture, the export pipeline, the deployment, the data layer). Two bullets saying one thing is padding a recruiter spots instantly; the app discards the twin.
7. NEVER name the project itself inside a bullet and NEVER write a bullet that re-describes what the app IS ("Developed <name>, an AI job-hunt assistant that…") — the title and description line above the bullets already say that. Every bullet is a specific engineering accomplishment, not an introduction.

HARD TRUTH RULES (breaking any makes the output useless — the app discards drifting bullets):
- State ONLY facts present in the README. Re-express, compress, sharpen — but NEVER add a number, metric, model name, company, or technology the README does not contain.
- Use the README's OWN tokens for technologies (if he wrote "RAG"/"LLM"/"agents"/"MCP", use those exact words). HONEST KEYWORD MIRRORING (the one permitted translation): when the README clearly DESCRIBES a standard market concept without naming it in the market's word, write the market's word — embedding search → "embeddings", coordinating multiple agents/pipelines → "orchestration", crafting/refining LLM prompts → "prompt engineering", SQL queries/schemas → "SQL". A JD and an ATS match on the market's vocabulary; describing his real work in its standard name is translation, not invention. NEVER mirror a term the README gives no basis for — that is fabrication and the bullet dies.
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

summary: one plain, JARGON-FREE sentence (max 200 chars) that tells a stranger exactly what the project IS and who it is for — e.g. "A personal job-hunt assistant that compiles truthful, evidence-linked résumés and finds AI roles." No private/coined terms.
bullets: 3-4 bullets, strongest first, EACH passing the READER TEST — a recruiter with no context understands what it is, what it does, and why it's impressive.`

/**
 * The system prompt AS SENT (Session 5.9): the static rules above + the Ustaad library's studied
 * forge patterns, so the researched craft actually reaches the model. The library is versioned,
 * cited DATA (I13) — a Pulse-accepted update deepens this prompt with zero code change.
 */
export function forgeSystem(): string {
  // Cap 12 (was 6): library v1.2.0 carries 11 forge patterns and every one must actually reach
  // the model — a studied rule that misses the payload is a library the firm never opens (D118).
  // ~350 extra tokens against the 16k system cap; the D105 discipline is the compact BRIEF, not
  // starving the craft.
  const craft = craftClauses('forge', undefined, 24)
  if (craft.length === 0) return SYSTEM
  return `${SYSTEM}\n\nSTUDIED CRAFT (patterns from résumés that got AI engineers hired — cited in-app):\n${craft.map((c) => `- ${c}`).join('\n')}`
}

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
    // Session 5.9 — the Ustaad library's studied patterns ride in the payload (data, not code:
    // a Pulse library update upgrades the forge's craft with zero code change, I13).
    system: forgeSystem(),
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
  // the FULL cleaned README (Session 6.1 — checking the capped `raw` was rejecting TRUE bullets
  // about content past the 14k cap on his richest projects) PLUS the repo metadata.
  const source = `${distilled.fullClean || distilled.raw}\n${repo.description ?? ''}\n${repo.language ?? ''}\n${repo.name}\n${distilled.stack.join(' ')}`
  const kept: string[] = []
  const rejected: string[] = []
  for (const b of out.bullets) {
    const text = String(b ?? '').trim().replace(/^[-*•]\s*/, '').replace(/\s+/g, ' ')
    if (!isResumeBullet(text)) {
      rejected.push(text)
      continue
    }
    // Session 6.1 REGISTER BAN: his systems use lawful APIs, never scraping — the live probe
    // caught the model writing "scrapes cited news sources" because the README says "never
    // scrape" and a drift guard cannot read negation. A scrape-claim dies deterministically.
    if (/\bscrap(e|es|ed|ing)\b/i.test(text)) {
      rejected.push(text)
      continue
    }
    if (!detectDrift(source, text).ok) {
      rejected.push(text)
      continue
    }
    kept.push(text)
  }

  // Session 7.1 (owner-caught on his REAL résumé — selection cannot fix supply, D56):
  // (1) IDENTITY BAN — a bullet naming the project itself ("Developed Sifarish, an agentic
  //     job-hunt chief of staff…") restates the description line; the slot must carry a distinct
  //     accomplishment. Dropped at the SOURCE whenever other bullets survive.
  // (2) THEME DEDUPE — two bullets whose primary concept matches are the same claim in
  //     different words (his exact guardrails/human-in-the-loop pair); the first-ranked stays.
  const nameToken = repo.name.replace(/[-_].*$/, '').toLowerCase()
  const nonIdentity = kept.filter((b) => !(nameToken.length >= 4 && b.toLowerCase().includes(nameToken)))
  const identityFiltered = nonIdentity.length > 0 ? nonIdentity : kept
  for (const b of kept) if (!identityFiltered.includes(b)) rejected.push(b)
  const themed: string[] = []
  for (const b of identityFiltered) {
    if (themed.some((t) => bulletOverlapSameProject(t, b) >= HARD_DUPLICATE)) {
      rejected.push(b)
      continue
    }
    themed.push(b)
  }

  // A forge that produced nothing usable is a forge that failed — ship the honest material.
  if (themed.length === 0) return { summary: fallbackSummary, bullets: deterministic, by: 'deterministic', rejected }

  const summaryRaw = String(out.summary ?? '').trim()
  const summary = summaryRaw && detectDrift(source, summaryRaw).ok ? summaryRaw.slice(0, 240) : fallbackSummary

  // AI/systems bullets lead; defensive-robustness bullets sink to the back (maximum-scoring truth).
  return { summary, bullets: rankBullets(themed).slice(0, 4), by: 'dimaag', rejected }
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
