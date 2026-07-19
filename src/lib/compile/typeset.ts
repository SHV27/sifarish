/**
 * Session 7 "The Taaj" — typesetting primitives for the classic selected-student layout.
 *
 * The owner's résumé must read like the canon that gets students hired (centered name,
 * section rules, right-aligned dates, grouped skills, sentence-complete descriptions).
 * These helpers are pure + deterministic so every rule is gate-testable.
 */

/**
 * Trim to a maximum length WITHOUT ever ending mid-thought (WS-R1, defect R2:
 * "…voice read-outs, and…"). Preference order: whole string → last sentence
 * boundary → last clause boundary → word boundary with ellipsis (rare last resort).
 */
export function sentenceTrim(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  // Last full sentence end within the window (keep it if it covers ≥40% of the budget).
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  if (sentenceEnd >= max * 0.4) return cut.slice(0, sentenceEnd + 1).trim()
  if (/[.!?]$/.test(cut.trim()) === false) {
    // Last clause boundary (comma/semicolon/dash) — a clause is a complete thought unit.
    const clauseEnd = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf('; '), cut.lastIndexOf(' — '), cut.lastIndexOf(' – '))
    if (clauseEnd >= max * 0.6) return `${cut.slice(0, clauseEnd).trim()}.`
  }
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\-–—]$/, '')}…`
}

/**
 * Evidence URLs are appended verbatim to the project meta line — and Session 6.1 proved the
 * ingestion side can hand us a URL wearing markdown residue ("…vercel.app**", the owner's own
 * résumé). Display cleaning at the choke point: whatever the vault holds, the page is clean.
 */
export function cleanUrlForDisplay(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[*_`~#)\]]+$/g, '') // markdown / bracket residue glued to the URL
    .replace(/[.,;]+$/g, '')
    .replace(/\/$/, '')
    .trim()
}

/** Markdown has no business on a résumé, whatever the data holds. Safe for real text:
 *  "C#" keeps its #; only leading markdown-heading hashes and emphasis runs die. */
export function stripMarkdownResidue(s: string): string {
  return (
    s
      // Final Jang W2 (matrix-found, seed 12648464): a markdown link renders as its TEXT — and a
      // link whose URL an upstream cleaner already ate ("[demo](") must not dangle. Before the
      // [*`] strip, which would otherwise orphan the brackets.
      .replace(/\[([^\]]{0,80})\]\(\S*\)?/g, '$1')
      .replace(/[*`]+/g, '')
      .replace(/~{2,}/g, '')
      .replace(/^#+\s+/, '')
      // W2 (matrix-found): the "▶" status marker is residue ANYWHERE, not only at line start.
      .replace(/▶\s*/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  )
}

// ---------- Skills grouping (WS-R1: labeled category lines, the selected-résumé canon) ----------

export interface SkillGroup {
  label: string
  ids: string[]
  titles: string[]
}

interface SkillLike {
  id: string
  title: string
  /** Owner-set category always wins over the lexicon (his call outranks our default, D59). */
  category?: string
}

const GROUP_ORDER = ['AI & ML', 'Languages', 'Frameworks & Tools'] as const
export type SkillCategory = (typeof GROUP_ORDER)[number]

/** Deterministic lexicon categorizer — keyword → group. Tested; owner category overrides. */
const AI_ML_RE =
  /\b(llms?|rag|retrieval|guardrails?|evals?|prompts?|agents?|agentic|langchain|langgraph|mcp|transformers?|pytorch|tensorflow|fine[- ]?tun\w*|lora|machine learning|deep learning|neural|models?|embeddings?|hugging ?face|whisper|scikit|ml math|nlp|computer vision|diffusion|rlhf|classifiers?)\b/i
const LANG_RE =
  /\b(python|javascript|typescript|java(?!script)|c\+\+|(?<![a-z])c(?![a-z+#])|c#|sql|bash|rust|golang|(?<![a-z])go(?![a-z])|kotlin|swift|(?<![a-z])r(?![a-z])|html|css)\b/i

export function categorizeSkill(title: string, category?: string): SkillCategory {
  if (category && (GROUP_ORDER as readonly string[]).includes(category)) return category as SkillCategory
  if (AI_ML_RE.test(title)) return 'AI & ML'
  if (LANG_RE.test(title)) return 'Languages'
  return 'Frameworks & Tools'
}

/**
 * Group skills into labeled lines, preserving the incoming (relevance-sorted) order inside
 * each group. AI & ML leads — this is an AI-engineer résumé; the market's own vocabulary
 * gets the first fixation (¶skills-grouped-exact, maximum-scoring truth D107).
 */
export function groupSkills(skills: SkillLike[]): SkillGroup[] {
  const buckets = new Map<SkillCategory, SkillLike[]>()
  for (const s of skills) {
    const g = categorizeSkill(s.title, s.category)
    if (!buckets.has(g)) buckets.set(g, [])
    buckets.get(g)!.push(s)
  }
  const out: SkillGroup[] = []
  for (const label of GROUP_ORDER) {
    const items = buckets.get(label)
    if (!items || items.length === 0) continue
    out.push({ label, ids: items.map((s) => s.id), titles: items.map((s) => s.title) })
  }
  return out
}

/**
 * WinAnsi-safe text (moved from export/pdf.ts in Closure F1 so the COMPILER can measure with
 * the exact strings the renderer draws — without dragging pdf-lib into the main bundle).
 * The strip's whitelist must name every glyph we keep, or the strip eats it silently (D139).
 */
export function sanitizePdfText(text: string): string {
  return text
    .replace(/₹/g, 'Rs.')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, '-')
    .replace(/[^ -~–—·×…]/g, '')
    .replace(/ {2,}/g, ' ')
}
