import type {
  CompiledLine,
  CompiledResume,
  CoverageReport,
  GamePlan,
  Identity,
  JDDecode,
  LedgerEntry,
  SectionDef,
} from '../../types'
import { sectionLabel } from '../strategist/plan'
import { bannedSkillKeys, isBannedSkill } from '../dossier/skills'
import { headerStack } from '../dossier/tech'
import { entryRelevance, bulletRelevance } from '../match/evidence'
import { sentenceTrim, cleanUrlForDisplay, stripMarkdownResidue, groupSkills, sanitizePdfText } from './typeset'
import { bulletOverlap, bulletOverlapSameProject, HARD_DUPLICATE, REDUNDANCY_WEIGHT, isIdentityBullet } from './overlap'
// Re-brief Arc 2: the résumé register is TIMES (the campus-LaTeX canon) — the estimator
// measures with the Times AFM tables the renderer draws with (same D158/F1 discipline).
import { timesWidth as textWidth } from './times-metrics'
import { applyEmphasis, wrapCountRuns } from './emphasis'

/**
 * Stage 3: deterministic compile under the one-page budget.
 *
 * I1 — every content line carries ledgerIds; a bullet with none is a thrown CompileError.
 * I2 — in_forge material renders ONLY through the single dated "Currently Building" line.
 *
 * ONE-PAGE IS A CONSTRAINT THE COMPILER SOLVES, NOT AN ERROR IT THROWS (v3 hardening, D32).
 * As the ledger grows (Nabz keeps adding real shipped work — the self-strengthening loop),
 * a fixed render + timid trim overflowed and surfaced a CompileError at the user. Now the
 * compiler assembles at progressively tighter trim levels (fewer bullets → prune honors →
 * fewer projects) until the page fits. The sniper principle applies to the resume itself:
 * the strongest evidence makes the page; the rest waits on the shelf. CompileError remains
 * only for the practically-impossible case (a single project + contact block won't fit).
 *
 * Budget model shared with the PDF renderer (export/pdf.ts): A4, 48pt margins, Helvetica.
 * Closure F1: the compiler MEASURES with the same Helvetica AFM widths the renderer draws
 * with (helvetica-metrics.ts) — estimation is dead; the renderer's overflow guard remains as
 * the belt-and-braces hard error it should never again reach.
 */

export class CompileError extends Error {
  suggestions: string[]
  constructor(message: string, suggestions: string[] = []) {
    super(message)
    this.name = 'CompileError'
    this.suggestions = suggestions
  }
}

// -- Budget constants (points) --
// v2 THE PAGE (05-Sep-2026): 36pt (0.5in) margins — every one of the six campus-canon samples the
// owner supplied runs a full page at half-inch margins; the old 48pt frame was the first reason
// his page read "small". A4 stays (Indian campus canon prints A4).
export const PAGE = { width: 595.28, height: 841.89, margin: 36 }
export const USABLE_HEIGHT = PAGE.height - PAGE.margin * 2 // 769.89
export const NAME_SIZE = 19

/**
 * v2 — THE TIGHTEN LADDER. Before ANY true fact is dropped, spacing tightens (leading/before scale);
 * level 3 also drops body text by half a point. The canon samples tighten spacing to fit a full
 * page — they never trim achievements — so the solver does the same, in this order.
 */
export const TIGHTEN_SCALE = [1, 0.94, 0.88, 0.82] as const
export function metricsFor(kind: CompiledLine['kind'], tighten = 0): { size: number; leading: number; before: number; bold: boolean } {
  const m = LINE_METRICS[kind]
  const t = Math.max(0, Math.min(TIGHTEN_SCALE.length - 1, tighten))
  const k = TIGHTEN_SCALE[t]
  const size = t >= 3 && (kind === 'bullet' || kind === 'skills' || kind === 'forge' || kind === 'meta') ? m.size - 0.5 : m.size
  return { size, leading: Math.round(m.leading * k * 100) / 100, before: Math.round(m.before * k * 100) / 100, bold: m.bold }
}

export const LINE_METRICS: Record<CompiledLine['kind'], { size: number; leading: number; before: number; bold: boolean }> = {
  // OWNER-CAUGHT (05-Sep-2026): "ek ek line ka gap ye voh" — measured against the six LaTeX
  // samples: body leading ≈1.18×, bullets 1pt apart, titles 4pt above, headings 8pt above.
  contact: { size: 9.5, leading: 11.5, before: 1.5, bold: false },
  headline: { size: 10.5, leading: 12.5, before: 3, bold: true },
  summary: { size: 10, leading: 12, before: 3, bold: false },
  heading: { size: 10.5, leading: 12.5, before: 8, bold: true },
  'entry-title': { size: 10.5, leading: 12.6, before: 4, bold: true },
  meta: { size: 10, leading: 12, before: 0.5, bold: false },
  bullet: { size: 10.5, leading: 12.4, before: 1, bold: false },
  skills: { size: 10.5, leading: 12.6, before: 1, bold: false },
  forge: { size: 10.5, leading: 12.4, before: 1, bold: false },
}

/**
 * Closure F1 — ESTIMATION IS DEAD. The old estimator counted characters (88/line); the renderer
 * measures real Helvetica glyph widths — and the gap between the two is exactly how a cast
 * project could pass the estimate and then silently overflow (or over-trim) on the true page.
 * The compiler now MEASURES with the same AFM width tables pdf-lib draws with, mirrors the
 * renderer's wrap rules (centered contact, bold skills label + hanging indent, right-aligned
 * dates narrowing the left column, bullet indent), and sanitizes exactly as the PDF will.
 * The estimator and the renderer can no longer disagree about what fits.
 */
const MAXW = PAGE.width - PAGE.margin * 2

function wrapCount(text: string, size: number, font: 'reg' | 'bold' | 'obl', firstWidth: number, fullWidth = firstWidth): number {
  let count = 1
  let line = ''
  let onFirst = true
  for (const word of text.split(' ')) {
    const probe = line ? `${line} ${word}` : word
    const budget = onFirst ? firstWidth : fullWidth
    if (textWidth(probe, size, font) <= budget || line === '') {
      line = probe
    } else {
      count++
      onFirst = false
      line = word
    }
  }
  return count
}

export function estimateLineHeight(line: CompiledLine, isName = false, tighten = 0): number {
  const m = metricsFor(line.kind, tighten)
  const size = isName ? NAME_SIZE : m.size
  const font: 'reg' | 'bold' | 'obl' = isName || m.bold ? 'bold' : line.kind === 'meta' || line.kind === 'forge' ? 'obl' : 'reg'
  const text = sanitizePdfText(line.text)
  const right = line.right ? sanitizePdfText(line.right) : ''
  const lead = isName ? NAME_SIZE + 4 : m.before + m.leading
  const extraLead = isName ? m.leading : m.leading

  if (isName || line.kind === 'contact' || line.kind === 'headline') {
    return lead + (wrapCount(text, size, font, MAXW) - 1) * extraLead
  }
  if (line.kind === 'heading') {
    return lead + 4 // + the hairline rule's room (mirrors pdf.ts)
  }
  if (line.kind === 'skills') {
    const idx = text.indexOf(': ')
    if (idx > 0 && idx < 40) {
      const labelW = textWidth(text.slice(0, idx + 1), size, 'bold') + size * 0.45
      return lead + (wrapCount(text.slice(idx + 2), size, 'reg', MAXW - labelW, MAXW) - 1) * m.leading
    }
  }
  const rightW = right ? textWidth(right, m.size, 'reg') : 0
  const leftWidth = (right ? MAXW - rightW - 14 : MAXW) - (line.kind === 'bullet' ? 9 : 0)
  // Runs line (re-brief): bold segments are wider — count wrapped lines over the styled words
  // with the SAME shared layout algorithm the renderer uses (emphasis.ts, authority 2).
  if (line.runs && line.runs.length > 0) {
    return lead + (wrapCountRuns(line.runs, size, leftWidth, leftWidth) - 1) * m.leading
  }
  return lead + (wrapCount(text, size, font, leftWidth) - 1) * m.leading
}

export function estimateHeight(lines: CompiledLine[], tighten = 0): number {
  let h = 0
  for (let i = 0; i < lines.length; i++) h += estimateLineHeight(lines[i], i === 0, tighten)
  return h
}

/**
 * v2 — ONE pagination rule for the estimator AND the renderer (authority 2 extended to pages):
 * a heading or an entry title never ends a page (keep-with-next); a page starts at the top margin.
 * Returns the 1-based page of every line.
 */
export function paginate(lines: CompiledLine[], tighten = 0): number[] {
  const pages: number[] = []
  let y = 0
  let page = 1
  for (let i = 0; i < lines.length; i++) {
    const h = estimateLineHeight(lines[i], i === 0, tighten)
    const keep = lines[i].kind === 'heading' || lines[i].kind === 'entry-title'
    const next = keep && lines[i + 1] ? estimateLineHeight(lines[i + 1], false, tighten) : 0
    if (y > 0 && y + h + next > USABLE_HEIGHT) {
      page++
      y = 0
    }
    y += h
    pages.push(page)
  }
  return pages
}
/** Share of page 2 relative to page 1, by line count — the guard against an orphan second page. */
export function pageTwoWeight(r: CompiledResume): number {
  const pages = paginate(r.lines, r.tighten ?? 0)
  const p1 = pages.filter((p) => p === 1).length
  const p2 = pages.filter((p) => p === 2).length
  return p1 === 0 ? 0 : p2 / p1
}

export function estimatePages(lines: CompiledLine[], tighten = 0): number {
  const p = paginate(lines, tighten)
  return p.length ? p[p.length - 1] : 1
}

/**
 * Session 6 (Defect 3 — "ek line mein kahin kuch kahin kuch"): truncation must never cut a word
 * in half. The owner's own résumé showed "…hand-authored fallba · gloaming-murex…" — a raw
 * `.slice(0,160)` mid-word. Cut at the last word boundary and close with an ellipsis so the line
 * reads as deliberately shortened, never as broken.
 */
/**
 * Session 6.1 (owner's own résumé screenshot): his vault's summaries carry raw README artifacts —
 * markdown bold (`**`), "▶ Live:"/"Code:" link labels, full URLs, status emoji — and the compiler
 * printed them verbatim ("… · sifarish-shv-s-projects.vercel.app**"). The evidence URL already
 * renders separately on the same line; everything link-shaped or markdown-shaped in the summary is
 * pure noise to a recruiter AND to an ATS parser. Strip it at render time, whatever the data holds.
 */
export function cleanSummaryForDisplay(s: string): string {
  return s
    .replace(/https?:\/\/\S+/gi, ' ') // raw URLs (the evidence link renders separately)
    .replace(/\b[\w.-]+\.(?:app|dev|io|com|org|net|in|co)\/?\S*/gi, ' ') // bare domains
    .replace(/[*_`~#]+/g, ' ') // markdown residue
    .replace(/[▶►⮕➡️‍]|\p{Extended_Pictographic}/gu, ' ') // ▶ / emoji markers
    .replace(/\b(?:live|demo|code|repo|app|site|docs?)\s*[:\-–—]\s*(?=\s|·|$)/gi, ' ') // orphaned link labels
    .replace(/^\s*(?:live|demo|beta|alpha|wip)\s*(?:\([^)]*\))?\s*[—–:-]\s*/i, '') // "Live (proof-of-concept) —" status prefixes
    .replace(/\s*[·|]\s*(?=[·|]|$)/g, ' ') // separators left holding nothing
    .replace(/\s+/g, ' ')
    .replace(/^[\s·|—–-]+|[\s·|—–-]+$/g, '')
    .trim()
}

/**
 * Session 6.1: Nabz-added entries carry raw repo slugs as titles ("sifarish", "spark-core") and
 * machine dates ("2026/07"). A recruiter reads "SIFARISH (Jul 2026)" — his own naming convention
 * (GLOAMING, DARYA), and Month-Year is the date format that parsed 8/8 in the ATS test (¶single-
 * column-ats). Display-only: his ledger data is never edited (D59).
 */
export function displayTitle(title: string): string {
  const head = title.split('—')[0].trim()
  // A slug title has no uppercase and no spaces — lift it to his project-name convention.
  if (head && !/[A-Z]/.test(head) && !/\s/.test(head)) {
    return title.replace(head, head.toUpperCase())
  }
  return title
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function displayDate(d?: string): string {
  if (!d) return ''
  let m = /^(\d{4})[/-](\d{1,2})$/.exec(d.trim()) // 2026/07, 2026-07
  if (m) {
    const mon = MONTHS[Number(m[2]) - 1]
    return mon ? `${mon} ${m[1]}` : d
  }
  m = /^(\d{1,2})[/-](\d{4})$/.exec(d.trim()) // 07/2026
  if (m) {
    const mon = MONTHS[Number(m[1]) - 1]
    return mon ? `${mon} ${m[2]}` : d
  }
  return d
}

export function truncateAtWord(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\-–—]$/, '')}…`
}

/**
 * Session 7 — THE single line-emission gate. Every compiled line passes through here, so
 * markdown residue is structurally impossible on the page (WS-R2: the `**` on his real
 * résumé survived because sanitization was fragmented across call sites; now a new code
 * path CANNOT emit an unsanitized line — it has no other door).
 */
function push(lines: CompiledLine[], line: CompiledLine) {
  if (line.kind === 'bullet' && line.ledgerIds.length === 0) {
    throw new CompileError(`I1 violation: bullet "${line.text.slice(0, 60)}…" has no ledger evidence link.`)
  }
  let text = stripMarkdownResidue(line.text)
  // Terminal punctuation is consistent across the page (¶blt-no-first-person-fragments):
  // bullets render without trailing periods — mixed ./no-. is a careless tell in the skim.
  if (line.kind === 'bullet') text = text.replace(/(?<!\.)\.$/, '')
  const right = line.right ? stripMarkdownResidue(line.right) : undefined
  lines.push(right ? { ...line, text, right } : { ...line, text, right: undefined })
}

/**
 * Re-brief Arc 2: tag slugs on a project HEADER read as data, not craft ("typescript",
 * "agentic-ai"). Lift them to the market's casing; unknown tokens just capitalize.
 */
const TECH_CASE: Record<string, string> = {
  typescript: 'TypeScript', javascript: 'JavaScript', python: 'Python', react: 'React',
  nodejs: 'Node.js', node: 'Node.js', nextjs: 'Next.js', langchain: 'LangChain',
  langgraph: 'LangGraph', pytorch: 'PyTorch', tensorflow: 'TensorFlow', llm: 'LLM',
  rag: 'RAG', mcp: 'MCP', api: 'API', ai: 'AI', ml: 'ML', groq: 'Groq', gemini: 'Gemini',
  claude: 'Claude', dexie: 'Dexie', vite: 'Vite', vercel: 'Vercel', serverless: 'Serverless',
  tailwind: 'Tailwind', docker: 'Docker', sql: 'SQL', mongodb: 'MongoDB', fastapi: 'FastAPI',
}
/** The first title word (≥ 5 letters, hyphen-split) — "PRANA-Sustainable-AI" and "PRANA — A Layered …" share a stem. */
function titleStem(title: string): string {
  // Only a NAME-like first token dedupes (PRANA, GLOAMING): all-caps, ≥ 4 letters. "Winner 1" / "Winner 2" are two facts.
  const w = title.split(/[\s—–|:]+/)[0]?.split('-')[0] ?? ''
  return /^[A-Z][A-Z0-9]{3,}$/.test(w) ? w.toLowerCase() : ''
}
/** Same stem → keep the richer entry (longest summary + bullets); the page never says one thing twice. */
export function dedupeByTitleStem<T extends { entry: { title: string; summary?: string; bullets: unknown[] } }>(items: T[]): T[] {
  const best = new Map<string, T>()
  const order: string[] = []
  for (const it of items) {
    const k = titleStem(it.entry.title) || `#${order.length}:${it.entry.title}`
    const cur = best.get(k)
    const weight = (x: T) => (x.entry.summary?.length ?? 0) + x.entry.bullets.length * 40
    if (!cur) {
      best.set(k, it)
      order.push(k)
    } else if (weight(it) > weight(cur)) best.set(k, it)
  }
  return order.map((k) => best.get(k)!)
}

/** Drop a summary that only restates the title (≥ 60% of its words already in the title) — keep the tail that adds something. */
export function trimRestatement(title: string, summary: string): string {
  if (!summary) return ''
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
  const t = new Set(words(title))
  const parts = summary.split(/ — | with /)
  const head = words(parts[0])
  if (head.length === 0) return summary
  const overlap = head.filter((x) => t.has(x)).length / head.length
  if (overlap < 0.5) return summary
  // The head restates the title. Keep a tail that adds something ("… with Sifarish, the evidence-compiled job-hunt system").
  const tail = parts.slice(1).join(' ').trim()
  const tw = words(tail)
  return tw.length >= 3 && tw.filter((x) => !t.has(x)).length / tw.length >= 0.5 ? tail[0].toUpperCase() + tail.slice(1) : ''
}

export function displayTech(tag: string): string {
  return tag
    .split(/[-_\s]+/)
    .map((w) => TECH_CASE[w.toLowerCase()] ?? (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
}

export interface CompileInput {
  identity: Identity
  ledger: LedgerEntry[]
  decode: JDDecode
  coverage: CoverageReport
  jobId: string
  /**
   * Optional Darzi v3 editorial override: the Editor's Desk casts which projects LEAD.
   * Benched means benched — under an editorial plan ONLY the cast lineup renders (the
   * Casting Sheet shows why each benched project sat out, and one click promotes it).
   * The compiler remains final authority for I1/I2/one-page. Absent → v1 relevance sort.
   */
  editorial?: {
    order: string[] // ledger ids, best-first (the cast lineup)
    bullets: Record<string, string[]> // ledgerId → bullet ids in chosen order
    /** Ustaad archetype guide (P13): section order for THIS reviewer. Absent → default order. */
    sectionOrder?: SectionKey[]
  }
  /**
   * Professional summary (Session 5.2) — a targeted, evidence-dense line rendered at the top
   * (the 6-second skim's first fixation, Ustaad ¶headline-mirrors-role). Compiled from the vision
   * + real ledger evidence by the orchestrator, so it carries ledgerIds and mints no claim (I1).
   */
  summaryLine?: CompiledLine
  /**
   * Baithak suppressions (Session 5.4): ledger ids to leave off THIS resume ("ye skill hata").
   * Applied at the eligibility gate, so a suppressed entry cannot leak through any section.
   */
  excludedIds?: string[]
  /**
   * Baithak rephrasings (Session 5.4): bulletId → re-expressed text. The caller is responsible
   * for having passed each override through the fact-drift guard; the compiler still renders it
   * under the SAME evidence link as the original bullet, so I1 holds either way (the line carries
   * the entry's ledgerId, and the guard has already frozen the facts).
   */
  bulletOverrides?: Record<string, string>
  /**
   * Nazar verdicts (Session 7.1): specific bullet ids the page-level judge removed (twin
   * claims). Excluded from the candidate pool so the selector backfills with the next DISTINCT
   * bullet — the judge can only remove/swap real ledger bullets, never write (I1).
   */
  excludedBulletIds?: string[]
  /**
   * v2 THE STRATEGIST — when a GAME PLAN is present the compiler EXECUTES it (section order,
   * played facts, skills rows, the three lines, the reveal) and the page-solver tightens spacing
   * before any content step; page 2 is allowed under `pagePolicy` 'two-ok' before any true fact
   * is dropped. Without a plan the pre-v2 path runs unchanged (fixtures, keyless floors).
   */
  plan?: GamePlan
  pagePolicy?: 'one' | 'two-ok'
  sections?: SectionDef[]
  summaryOn?: boolean
}

export type SectionKey = 'education' | 'skills' | 'projects' | 'forge' | 'achievements' | 'certs'
// Session 7 (¶anat-student-section-order): a project-strong student leads with Skills +
// Projects — the projects ARE the experience; Education places him afterward. An archetype
// guide's sectionOrder still overrides per-reviewer (Ustaad P13).
const DEFAULT_SECTION_ORDER: SectionKey[] = ['skills', 'projects', 'forge', 'education', 'achievements', 'certs']

/** Progressive trim levels — applied in order until the page fits (sniper over spray). */
interface TrimLevel {
  bulletsPerProject: number
  maxProjects: number
  maxAchievements: number
  includePositions: boolean
  includeCerts: boolean
  skillsCap: number
}
/**
 * Session 5.6 (owner: "resume mein kanjoosi kyun") — the résumé was collapsing to ONE bullet per
 * project under page pressure because bulletsPerProject was the FIRST thing dropped. Research says
 * 2-4 bullets/project is the density recruiters expect; 1 reads as thin. So bullet richness is now
 * protected: the trim shrinks the (untrimmed-before) SKILLS line, then achievements, positions,
 * certs, and project COUNT — and only drops to 2, then 1 bullet as the last resorts. A strong résumé
 * with 3 fewer skills beats a sparse one with a wall of skills.
 */
const TRIM_LEVELS: TrimLevel[] = [
  // Session 7.2 (owner: "kanjoosi nahi — jitni required description deni hai denge"): the
  // richest level tries FOUR bullets per project first — the forge produces up to 4 real
  // accomplishments, and a strong ledger deserves the space. The one-page solver remains the
  // final authority: if it doesn't fit, the ladder steps down exactly as before.
  { bulletsPerProject: 4, maxProjects: 4, maxAchievements: 99, includePositions: true, includeCerts: true, skillsCap: 99 },
  { bulletsPerProject: 3, maxProjects: 4, maxAchievements: 99, includePositions: true, includeCerts: true, skillsCap: 99 },
  { bulletsPerProject: 3, maxProjects: 4, maxAchievements: 4, includePositions: true, includeCerts: true, skillsCap: 99 },
  { bulletsPerProject: 3, maxProjects: 3, maxAchievements: 3, includePositions: true, includeCerts: true, skillsCap: 18 },
  { bulletsPerProject: 3, maxProjects: 3, maxAchievements: 2, includePositions: false, includeCerts: true, skillsCap: 16 },
  { bulletsPerProject: 3, maxProjects: 3, maxAchievements: 2, includePositions: false, includeCerts: false, skillsCap: 14 },
  { bulletsPerProject: 2, maxProjects: 3, maxAchievements: 2, includePositions: false, includeCerts: false, skillsCap: 14 },
  { bulletsPerProject: 2, maxProjects: 3, maxAchievements: 1, includePositions: false, includeCerts: false, skillsCap: 12 },
  { bulletsPerProject: 2, maxProjects: 2, maxAchievements: 1, includePositions: false, includeCerts: false, skillsCap: 12 },
  { bulletsPerProject: 1, maxProjects: 3, maxAchievements: 1, includePositions: false, includeCerts: false, skillsCap: 10 },
  { bulletsPerProject: 1, maxProjects: 2, maxAchievements: 0, includePositions: false, includeCerts: false, skillsCap: 10 },
]

/**
 * Session 7.2 (owner-caught: the casting sheet said "Leading: 3 projects", the page showed 2 —
 * GLOAMING silently vanished): THE CAST IS A CONTRACT. Under an editorial plan, the trim ladder
 * used to drop PROJECT COUNT while richer descriptions/bullets survived — a project the Editor
 * cast (and the owner saw cast) could be eaten by another project's description length. His law:
 * "kisi ki description ki wajah se ek project reh hi jaye — that's wrong." So every ladder level
 * now keeps AT LEAST the cast count; bullets, descriptions, achievements, positions, certs and
 * skills all shrink FIRST, and only the two absolute-last-resort levels (the practically-
 * impossible single-entry-too-long case) may ever break the contract instead of erroring.
 */
function trimLevelsFor(castCount: number): TrimLevel[] {
  if (castCount <= 0) return TRIM_LEVELS
  const n = Math.min(castCount, 4)
  return [...TRIM_LEVELS.map((lv) => ({ ...lv, maxProjects: Math.max(lv.maxProjects, n) })), ...TRIM_LEVELS.slice(-2)]
}

/**
 * v2 — ONE bullet picker for the pre-v2 compile and the plan compile (the second copy of a rule
 * is a fork of its bugs). Ranked by relevance (+ the plan's bullet order, + a framing hint),
 * MMR-deduped page-wide, digit-bearing bullet guaranteed when the entry holds one.
 */
function createBulletPicker(input: CompileInput) {
  const { decode } = input
  type PBullet = LedgerEntry['bullets'][number]
  const renderText = (b: PBullet) => input.bulletOverrides?.[b.id] ?? b.text
  const hasNumber = (b: PBullet) => /\d/.test(renderText(b)) || (b.metrics ? /\d/.test(b.metrics) : false)

  /** Ranked candidate list: the editorial plan leads (D28 — Dimaag proposes), relevance backfills. */
  const excludedBullets = new Set(input.excludedBulletIds ?? [])
  const rankedBullets = (p: LedgerEntry): PBullet[] => {
    const numBonus = (b: PBullet) => (hasNumber(b) ? 4 : 0) // v2: the canon front-loads numbers (Ustaad ¶quantify-everything-honest)
    // v2 — the plan's framing for this project ("lead with the innovation angle") nudges bullets
    // that speak that angle upward. A hint on ORDER only — never new text (I1).
    const framing = (input.plan?.played.find((f) => f.factId === p.id)?.framing ?? '').toLowerCase()
    const frameWords = framing.split(/[^a-z0-9]+/).filter((w) => w.length >= 4)
    const frameBonus = (b: PBullet) => (frameWords.length ? frameWords.filter((w) => renderText(b).toLowerCase().includes(w)).length : 0)
    const pool = p.bullets.filter((b) => !excludedBullets.has(b.id))
    const base = pool
      .slice()
      .sort((a, b) => bulletRelevance(b.keywords, decode) + numBonus(b) + frameBonus(b) - (bulletRelevance(a.keywords, decode) + numBonus(a) + frameBonus(a)))
    const plan = input.plan?.bulletPlan?.[p.id] ?? input.editorial?.bullets[p.id]
    if (plan && plan.length > 0) {
      const byId = new Map(pool.map((b) => [b.id, b]))
      const planned = plan.map((id) => byId.get(id)).filter((b): b is PBullet => !!b)
      if (planned.length > 0) {
        const inPlan = new Set(planned.map((b) => b.id))
        return [...planned, ...base.filter((b) => !inPlan.has(b.id))]
      }
    }
    return base
  }

  /**
   * Session 7 (WS-R2, defect R3 — two near-identical bullets on his real résumé): greedy
   * MMR selection. Every candidate is scored by its ranked position MINUS its redundancy
   * against everything already on the page (this project AND earlier ones). A hard duplicate
   * (same claim, different words) never renders — fewer bullets beat repeated ones. And the
   * quantification GUARANTEE (defect R4): if the entry holds a digit-bearing bullet, at least
   * one digit-bearing bullet makes the cut — a +2 tie-break was never a guarantee.
   */
  const bulletsFor = (p: LedgerEntry, cap: number, pageTexts: string[]): PBullet[] => {
    // Session 7.1 (owner-caught): a bullet that names the project itself ("Developed Sifarish,
    // an agentic job-hunt chief of staff…") is an IDENTITY RESTATEMENT — the title + description
    // line already say what it is; the bullet slot must carry a distinct accomplishment. Dropped
    // whenever the entry has other usable bullets.
    // Session 7.2 (A8): the shared identity-ban heuristic — one rule, compiler + forge.
    const isIdentity = (b: PBullet) => isIdentityBullet(displayTitle(p.title), renderText(b))
    const allRanked = rankedBullets(p)
    const nonIdentity = allRanked.filter((b) => !isIdentity(b))
    const ranked = nonIdentity.length > 0 ? nonIdentity : allRanked
    const chosen: PBullet[] = []
    const overlapMax = (b: PBullet) => {
      let m = 0
      for (const t of pageTexts) m = Math.max(m, bulletOverlap(renderText(b), t))
      // Within one project the comparison is concept-aware: two bullets on the SAME theme are
      // the same claim even with near-zero shared words (Session 7.1, his real SIFARISH pair).
      for (const c of chosen) m = Math.max(m, bulletOverlapSameProject(renderText(b), renderText(c)))
      return m
    }
    const baseScore = new Map(ranked.map((b, i) => [b.id, ranked.length - i]))
    const remaining = ranked.slice()
    while (chosen.length < cap && remaining.length > 0) {
      let bestIdx = -1
      let best = -Infinity
      for (let i = 0; i < remaining.length; i++) {
        const o = overlapMax(remaining[i])
        if (o >= HARD_DUPLICATE) continue // the same claim never renders twice
        const s = (baseScore.get(remaining[i].id) ?? 0) - REDUNDANCY_WEIGHT * o
        if (s > best) {
          best = s
          bestIdx = i
        }
      }
      if (bestIdx === -1) break // everything left is a duplicate of the page — stop short
      chosen.push(remaining.splice(bestIdx, 1)[0])
    }
    if (chosen.length > 0 && !chosen.some(hasNumber)) {
      const numbered = remaining.find((b) => hasNumber(b) && overlapMax(b) < HARD_DUPLICATE)
      if (numbered) {
        // Swap out the weakest non-numbered pick — the ledger's real number keeps its seat.
        let weakest = chosen.length - 1
        for (let i = chosen.length - 1; i >= 0; i--) {
          if ((baseScore.get(chosen[i].id) ?? 0) <= (baseScore.get(chosen[weakest].id) ?? 0)) weakest = i
        }
        chosen[weakest] = numbered
      }
    }
    return chosen
  }

  return { bulletsFor, renderText }
}

export function compileResume(input: CompileInput): CompiledResume {
  if (input.plan) return compileFromPlan(input)

  const { identity, ledger, decode, coverage, jobId } = input
  // Suppression is a single gate at the top: whatever he told the tailor to drop for this role
  // cannot reappear through the project pool, the skills line, or any other section.
  const excluded = new Set(input.excludedIds ?? [])
  const eligible = ledger.filter((e) => e.resumeEligible && !excluded.has(e.id))
  const shipped = eligible.filter((e) => e.tier === 'shipped')

  // -- Project pool: the cast lineup under an editorial plan, else v1 relevance sort --
  const allProjects = shipped.filter((e) => e.kind === 'project')
  const relevanceSorted = () =>
    allProjects
      .slice()
      .sort(
        (a, b) =>
          entryRelevance(b, decode) - entryRelevance(a, decode) ||
          (b.evidence?.date ?? '').localeCompare(a.evidence?.date ?? ''),
      )
  let projectPool: LedgerEntry[]
  if (input.editorial && input.editorial.order.length > 0) {
    const byId = new Map(allProjects.map((p) => [p.id, p]))
    projectPool = input.editorial.order.map((id) => byId.get(id)).filter((p): p is LedgerEntry => !!p)
    if (projectPool.length === 0) projectPool = relevanceSorted()
  } else {
    projectPool = relevanceSorted()
  }

  // -- Fixed + trimmable content pools --
  // Education newest-first (Session 6, caught in the live proof): Dexie returns rows in
  // primary-key order, which put Class X above Class XII. Degrees read reverse-chronological.
  // Dates arrive as "MM/YYYY" or "YYYY[-MM]" — normalize to YYYYMM so the sort is real.
  const eduKey = (d?: string): string => {
    const m = /^(\d{1,2})\/(\d{4})$/.exec(d ?? '')
    if (m) return `${m[2]}${m[1].padStart(2, '0')}`
    return (d ?? '').replace(/[^0-9]/g, '').padEnd(6, '0').slice(0, 6)
  }
  const education = shipped
    .filter((e) => e.kind === 'education')
    .sort((a, b) => eduKey(b.evidence?.date).localeCompare(eduKey(a.evidence?.date)))
  const skills = shipped
    .filter((e) => e.kind === 'skill')
    .sort((a, b) => entryRelevance(b, decode) - entryRelevance(a, decode))
  const achievements = shipped
    .filter((e) => e.kind === 'achievement')
    .sort((a, b) => entryRelevance(b, decode) - entryRelevance(a, decode))
  const positions = shipped.filter((e) => e.kind === 'position')
  const certs = shipped.filter((e) => e.kind === 'certification')
  const forgeIds = new Set(coverage.building.flatMap((h) => h.ledgerIds))
  const forgeEntries = eligible.filter((e) => e.tier === 'in_forge' && forgeIds.has(e.id))

  const { bulletsFor, renderText } = createBulletPicker(input)
  const legacyBanned = bannedSkillKeys(ledger)

  const sectionOrder = input.editorial?.sectionOrder?.length ? input.editorial.sectionOrder : DEFAULT_SECTION_ORDER

  const assemble = (lv: TrimLevel): CompiledLine[] => {
    const lines: CompiledLine[] = []

    // Contact block (always first — the skim starts here). Session 7: the classic canon —
    // centered name, ONE contact line under it (renderers center both by kind).
    push(lines, { kind: 'contact', text: identity.name, ledgerIds: [] })
    push(lines, {
      kind: 'contact',
      text: `${identity.email} | ${identity.phone} | ${identity.github} | ${identity.linkedin} | ${identity.location}`,
      ledgerIds: [],
    })

    // Professional summary (top-third, first fixation) — evidence-linked, orchestrator-compiled.
    if (input.summaryLine && input.summaryLine.text.trim()) push(lines, input.summaryLine)

    // Sections render in the archetype guide's order (Ustaad P13); default order otherwise.
    const sections: Record<SectionKey, () => void> = {
      education: () => {
        if (education.length === 0) return
        push(lines, { kind: 'heading', text: 'EDUCATION', ledgerIds: education.map((e) => e.id) })
        for (const e of education) {
          // Session 7 typesetter: qualification left, its years/score right-aligned — the
          // classic canon (Session 6's one-coherent-line rule preserved: nothing orphans).
          // Session 7.2 (A7): the same hygiene as project descriptions — a vault summary
          // carrying a raw URL or "Live:" label must not render on an education line either.
          const meta = e.summary ? cleanSummaryForDisplay(e.summary) : displayDate(e.evidence?.date)
          push(lines, { kind: 'entry-title', text: e.title, right: meta || undefined, ledgerIds: [e.id] })
        }
      },
      skills: () => {
        // Shipped only (I2 keeps in_forge out of here). Capped per trim level (relevance-sorted, so
        // the JD-relevant skills survive) so the skills line can shrink before project bullets do.
        if (skills.length === 0) return
        const shown = skills.slice(0, lv.skillsCap)
        push(lines, { kind: 'heading', text: 'SKILLS', ledgerIds: shown.map((e) => e.id) })
        // Session 7: labeled category lines (AI & ML first — the market's vocabulary leads),
        // the selected-résumé canon instead of one undifferentiated pipe-run.
        for (const g of groupSkills(shown.map((e) => ({ id: e.id, title: e.title, category: e.category })))) {
          push(lines, { kind: 'skills', text: `${g.label}: ${g.titles.join(', ')}`, ledgerIds: g.ids })
        }
      },
      projects: () => {
        const projects = projectPool.slice(0, lv.maxProjects)
        if (projects.length === 0) return
        push(lines, { kind: 'heading', text: 'PROJECTS', ledgerIds: projects.map((e) => e.id) })
        // Cross-project redundancy state: every emitted bullet repels near-duplicates page-wide.
        const pageTexts: string[] = []
        for (const p of projects) {
          const evidenceUrl = p.evidence?.url ?? p.evidence?.repo ?? ''
          // Re-brief Arc 2 (¶the canon's project-header formula): `NAME | Tech, Tech, Tech` —
          // the stack rides the HEADER (every strong sample the owner supplied does this), from
          // his own deep-read stack (D58) or tags. Emphasis pass keeps NAME bold, stack roman.
          const stack = headerStack(p, [...decode.mustHave, ...decode.niceToHave])
            .filter((x) => !isBannedSkill(x, legacyBanned))
            .join(', ')
          const baseTitle = displayTitle(p.title)
          const headerText = stack && (baseTitle.length + stack.length) < 90 ? `${baseTitle} | ${stack}` : baseTitle
          push(lines, {
            kind: 'entry-title',
            text: headerText,
            right: p.evidence?.date ? displayDate(p.evidence.date) : undefined,
            ledgerIds: [p.id],
          })
          // Session 5.7 (owner: "these are not app descriptions") — a project's bullets are engineering
          // ACHIEVEMENTS; without a one-line "what it IS" a recruiter can't tell that sifarish is a
          // job-hunt assistant. Render the project's own summary (its product description) + the live
          // link on one line, so the achievements below have context. Never trimmed away (it IS the point).
          // Session 7 (defect R2): SENTENCE-boundary trim — the page never ends a thought mid-clause.
          // 230 → 280 (S7.2, "required description" over stinginess): a two-sentence product
          // description survives whole more often; the sentence-boundary trim still governs.
          const desc = sentenceTrim(cleanSummaryForDisplay(p.summary ?? ''), 280)
          const metaText = [desc, cleanUrlForDisplay(evidenceUrl)].filter(Boolean).join(' · ')
          if (metaText) push(lines, { kind: 'meta', text: metaText, ledgerIds: [p.id] })
          for (const b of bulletsFor(p, lv.bulletsPerProject, pageTexts)) {
            // A Baithak rephrasing renders in place of the original, under the SAME evidence link.
            const text = renderText(b)
            pageTexts.push(text)
            push(lines, { kind: 'bullet', text: `- ${text}${b.metrics ? ` (${b.metrics})` : ''}`, ledgerIds: [p.id] })
          }
        }
      },
      forge: () => {
        // Currently Building: THE ONLY rendering of in_forge material (I2)
        if (forgeEntries.length === 0) return
        const eta = forgeEntries[0].forgeEta ?? 'July 2026'
        const names = forgeEntries.map((e) => e.title.split('—')[0].trim()).join(', ')
        push(lines, { kind: 'forge', text: `Currently Building (${eta}): ${names}`, ledgerIds: forgeEntries.map((e) => e.id) })
      },
      achievements: () => {
        const keptAch = achievements.slice(0, lv.maxAchievements)
        const keptPos = lv.includePositions ? positions : []
        if (keptAch.length === 0 && keptPos.length === 0) return
        push(lines, { kind: 'heading', text: 'ACHIEVEMENTS', ledgerIds: [...keptAch, ...keptPos].map((e) => e.id) })
        for (const h of keptAch) {
          const hs = h.summary ? cleanSummaryForDisplay(h.summary) : '' // A7: same hygiene gate
          push(lines, { kind: 'bullet', text: `- ${h.title}${hs ? ` — ${hs}` : ''}`, ledgerIds: [h.id] })
        }
        // Session 6 (Defect 3): each position on its own bullet — the old `;`-joined single line
        // crammed three leadership roles into one unreadable run-on. The trim ladder still drops
        // positions entirely under page pressure, so page-fit is unaffected.
        for (const p of keptPos) {
          push(lines, { kind: 'bullet', text: `- ${p.title}`, ledgerIds: [p.id] })
        }
      },
      certs: () => {
        if (!lv.includeCerts || certs.length === 0) return
        push(lines, { kind: 'heading', text: 'CERTIFICATIONS', ledgerIds: certs.map((e) => e.id) })
        for (const c of certs) {
          // Trailing period stripped before wrapping in parens — "(Certificate ID X.)" read broken.
          const detail = c.summary ? ` (${cleanSummaryForDisplay(c.summary).replace(/\.$/, '')})` : '' // A7
          push(lines, { kind: 'bullet', text: `- ${c.title}${detail}`, ledgerIds: [c.id] })
        }
      },
    }
    for (const key of sectionOrder) sections[key]?.()

    return lines
  }

  // -- Solve the one-page constraint: tighten until it fits --
  // The cast is a contract (S7.2): every level keeps at least the cast count; richness yields first.
  // Closure F3 (the last judge's input): if a last-resort level ever DOES bench a cast project,
  // that is declared on the result — never silent (the GLOAMING class, structurally dead).
  const castIds = input.editorial?.order ?? []
  const benchNote = (lines: CompiledLine[]): string[] | undefined => {
    if (castIds.length === 0) return undefined
    const missing = castIds.filter((id) => !lines.some((l) => l.kind === 'entry-title' && l.ledgerIds.includes(id)))
    if (missing.length === 0) return undefined
    return missing.map((id) => displayTitle(ledger.find((e) => e.id === id)?.title ?? id).split('—')[0].trim())
  }
  for (const lv of trimLevelsFor(castIds.length)) {
    // Emphasis BEFORE the fit check: bold segments are wider, and a page that fits must fit
    // with its real (styled) widths — the estimator sees exactly what the renderer draws.
    const lines = applyEmphasis(assemble(lv), decode)
    if (estimateHeight(lines) <= USABLE_HEIGHT) return { lines, jobId, benchedByPage: benchNote(lines) }
  }

  // Practically unreachable: even 1 project × 1 bullet + contact + education won't fit.
  const minimal = applyEmphasis(assemble(TRIM_LEVELS[TRIM_LEVELS.length - 1]), decode)
  throw new CompileError(
    `Page overflow even at maximum trim: ${Math.ceil(estimateHeight(minimal))}pt of ${Math.floor(USABLE_HEIGHT)}pt available.`,
    ['A single entry in the Ledger is extremely long — shorten its title or bullets.'],
  )
}

// =============================================================================================
// v2 THE STRATEGIST → THE PAGE: the compiler EXECUTES the game plan (ARCHITECTURE v2, authority 1).
// Everything visible traces to a plan line: section order, played facts (in plan order), skills
// rows, the three lines, the reveal. The compiler may TIGHTEN spacing and (under 'two-ok') add a
// page; it may not bench. If even the last resort must drop a played project, it is DECLARED on
// the result (benchedByPage) — never silent.
// =============================================================================================

const asUrl = (handle: string): string => {
  const h = handle.trim()
  if (!h) return ''
  if (/^https?:\/\//i.test(h)) return h
  if (/^mailto:/i.test(h)) return h
  return `https://${h.replace(/^\/+/, '')}`
}

function compileFromPlan(input: CompileInput): CompiledResume {
  const { identity, ledger, decode, coverage, jobId } = input
  const plan = input.plan as GamePlan
  const excluded = new Set(input.excludedIds ?? [])
  const eligible = ledger.filter((e) => e.resumeEligible && !excluded.has(e.id))
  const byId = new Map(eligible.map((e) => [e.id, e]))
  const { bulletsFor, renderText } = createBulletPicker(input)
  const banned = bannedSkillKeys(ledger)

  type Played = GamePlan['played'][number] & { entry: LedgerEntry }
  const played: Played[] = plan.played
    .map((p) => ({ ...p, entry: byId.get(p.factId) as LedgerEntry }))
    .filter((p) => !!p.entry && p.entry.tier === 'shipped')
  const inSection = (key: string) => played.filter((p) => p.section === key)
  const forgeIds = new Set(coverage.building.flatMap((h) => h.ledgerIds))
  const forgeEntries = eligible.filter((e) => e.tier === 'in_forge' && forgeIds.has(e.id))
  const sifarish = played.find((p) => p.section === 'projects' && /sifarish/i.test(p.entry.title))
  const revealOn = plan.reveal.on && !!sifarish

  const projectOrderIds = plan.projectOrder.length ? plan.projectOrder : inSection('projects').map((p) => p.factId)
  const projectsOrdered: Played[] = projectOrderIds
    .map((id) => played.find((p) => p.factId === id && p.section === 'projects'))
    .filter((p): p is Played => !!p)
  for (const p of inSection('projects')) if (!projectsOrdered.includes(p)) projectsOrdered.push(p)

  const eduKey = (d?: string): string => {
    const m = /^(\d{1,2})\/(\d{4})$/.exec(d ?? '')
    if (m) return `${m[2]}${m[1].padStart(2, '0')}`
    return (d ?? '').replace(/[^0-9]/g, '').padEnd(6, '0').slice(0, 6)
  }

  const assemble = (bulletsPerProject: number, projectCap: number, descCap = 280, withSummary = true): CompiledLine[] => {
    const lines: CompiledLine[] = []

    // Letterhead: name (links to GitHub), one contact line with clickable handles (visible text
    // stays a readable handle — parsers read anchor text, RESEARCH v2 verdict 1).
    const github = identity.github?.trim()
    push(lines, { kind: 'contact', text: identity.name, ledgerIds: [], ...(github ? { link: asUrl(github) } : {}) })
    const handles = [identity.email, identity.phone, identity.github, identity.linkedin, identity.location].map((x) => (x ?? '').trim()).filter(Boolean)
    const links: { text: string; url: string }[] = []
    if (identity.email) links.push({ text: identity.email, url: `mailto:${identity.email}` })
    if (github) links.push({ text: github, url: asUrl(github) })
    if (identity.linkedin) links.push({ text: identity.linkedin, url: asUrl(identity.linkedin) })
    push(lines, { kind: 'contact', text: handles.join(' | '), ledgerIds: [], links })

    // The three lines (the plan's, evidence-cited).
    const threeIds = plan.threeLines.factIds.filter((id) => byId.has(id))
    if (plan.threeLines.headline.trim()) push(lines, { kind: 'headline', text: plan.threeLines.headline.trim(), ledgerIds: threeIds })
    if (withSummary && input.summaryOn !== false && plan.threeLines.summary.trim()) push(lines, { kind: 'summary', text: plan.threeLines.summary.trim(), ledgerIds: threeIds })

    const pageTexts: string[] = []
    const heading = (key: string, ids: string[]) => push(lines, { kind: 'heading', text: sectionLabel(key, input.sections), ledgerIds: ids })

    const entryWithBullets = (p: Played, cap: number, withStack: boolean) => {
      const e = p.entry
      const evidenceUrl = e.evidence?.url ?? e.evidence?.repo ?? ''
      // The header's stack: his own README stack (parenthetical notes stripped), minus any skill he
      // marked not-interview-safe (resumeEligible:false is his call, honored everywhere).
      // OWNER-CAUGHT: "SIFARISH | agents, llm, gpt, rag" — raw keyword tags are not a stack. The
      // header carries the README's own stack, else only tags the lexicon knows as real tech, else nothing.
      // v2 R4: the header stack is the TECH CANON's word for what this project proves (README stack
      // first, the posting's asks first among those) — never raw tags ("agents, llm, gpt, rag").
      const baseTitle = displayTitle(e.title)
      const stackItems = withStack ? headerStack(e, [...decode.mustHave, ...decode.niceToHave]).filter((x) => !isBannedSkill(x, banned)) : []
      // Keep as many canonical stack names as fit beside the title on ONE line (~104 chars at 10.5pt).
      while (stackItems.length && baseTitle.length + stackItems.join(', ').length + 3 > 104) stackItems.pop()
      const stack = stackItems.join(', ')
      const headerText = stack ? `${baseTitle} | ${stack}` : baseTitle
      push(lines, {
        kind: 'entry-title',
        text: headerText,
        right: e.evidence?.date ? displayDate(e.evidence.date) : undefined,
        ledgerIds: [e.id],
        ...(evidenceUrl ? { link: evidenceUrl } : {}),
      })
      let desc = sentenceTrim(cleanSummaryForDisplay(e.summary ?? ''), descCap)
      if (revealOn && sifarish && p.factId === sifarish.factId) desc = `${desc.replace(/\.$/, '')} — this résumé was compiled by it`
      const shownUrl = evidenceUrl ? cleanUrlForDisplay(evidenceUrl) : ''
      const metaText = [desc, shownUrl].filter(Boolean).join(' · ')
      if (metaText) push(lines, { kind: 'meta', text: metaText, ledgerIds: [e.id], ...(shownUrl ? { links: [{ text: shownUrl, url: evidenceUrl }] } : {}) })
      for (const b of bulletsFor(e, cap, pageTexts)) {
        const text = renderText(b)
        pageTexts.push(text)
        push(lines, { kind: 'bullet', text: `- ${text}${b.metrics ? ` (${b.metrics})` : ''}`, ledgerIds: [e.id] })
      }
    }

    const bulletSection = (key: string) => {
      const items = dedupeByTitleStem(inSection(key))
      if (items.length === 0) return
      heading(key, items.map((p) => p.factId))
      for (const p of items) {
        const e = p.entry
        const hs0 = e.summary ? cleanSummaryForDisplay(e.summary).replace(/\.$/, '') : ''
        // OWNER-READ: "1st Place — Agentic & GenAI Showcase … — Won first place in the Agentic & GenAI
        // showcase at …" restated its own title. A summary that repeats the title's words is trimmed
        // to the part that adds something; an identical one is dropped.
        const hs = trimRestatement(e.title, hs0)
        const text = key === 'certs' ? `- ${e.title}${hs ? ` (${hs})` : ''}` : `- ${e.title}${hs ? ` — ${hs}` : ''}`
        const url = e.evidence?.url
        push(lines, { kind: 'bullet', text, ledgerIds: [e.id], ...(url ? { link: url } : {}) })
      }
    }

    const sections: Record<string, () => void> = {
      education: () => {
        const items = inSection('education').slice().sort((a, b) => eduKey(b.entry.evidence?.date).localeCompare(eduKey(a.entry.evidence?.date)))
        if (items.length === 0) return
        heading('education', items.map((p) => p.factId))
        for (const p of items) {
          const e = p.entry
          // The canon (all six samples): INSTITUTION bold with the years right; the degree in italics
          // beneath with the score right. "B.Tech X — Institute" splits on the dash; "2023–2027 · CGPA
          // 7.7" splits on the middot. A school line without a degree stays one line.
          const [degreeRaw, instRaw] = e.title.split(/ — | – /)
          // Split only when the tail is an institution NAME (words), not a score ("Class XII, CBSE — 90%").
          const tailIsName = !!instRaw && /[A-Za-z]{3,}/.test(instRaw) && !/^\s*[\d.]+\s*%?\s*$/.test(instRaw)
          const institution = tailIsName ? instRaw.trim() : e.title.trim()
          const degree = tailIsName ? degreeRaw.trim() : ''
          const meta = e.summary ? cleanSummaryForDisplay(e.summary) : displayDate(e.evidence?.date)
          const [when, score] = meta.split(/ · /)
          push(lines, { kind: 'entry-title', text: institution, right: (when || meta).trim() || undefined, ledgerIds: [e.id] })
          if (degree || score) push(lines, { kind: 'meta', text: degree || institution, right: score?.trim() || undefined, ledgerIds: [e.id] })
        }
      },
      experience: () => {
        const items = inSection('experience')
        if (items.length === 0) return
        heading('experience', items.map((p) => p.factId))
        for (const p of items) entryWithBullets(p, bulletsPerProject, false)
      },
      projects: () => {
        const items = projectsOrdered.slice(0, projectCap)
        if (items.length === 0) return
        heading('projects', items.map((p) => p.factId))
        for (const p of items) entryWithBullets(p, bulletsPerProject, true)
        if (forgeEntries.length > 0) {
          // A dated momentum line (I2) — but a date already in the past reads as a broken promise,
          // so a stale ETA is dropped and the line says "in progress" instead.
          const eta = forgeEntries[0].forgeEta
          const etaMs = eta ? Date.parse(`1 ${eta}`) : NaN
          const fresh = eta && (Number.isNaN(etaMs) ? true : etaMs > Date.now())
          const names = forgeEntries.map((e) => e.title.split('—')[0].trim()).join(', ')
          push(lines, { kind: 'forge', text: `Currently Building${fresh ? ` (${eta})` : ''}: ${names}`, ledgerIds: forgeEntries.map((e) => e.id) })
        }
      },
      skills: () => {
        const rows = plan.skills.map((r) => ({ ...r, items: r.items.filter((i) => i.factIds.some((id) => byId.has(id))) })).filter((r) => r.items.length > 0)
        if (rows.length === 0) return
        heading('skills', [...new Set(rows.flatMap((r) => r.items.flatMap((i) => i.factIds)))])
        for (const r of rows) {
          push(lines, { kind: 'skills', text: `${r.label}: ${r.items.map((i) => i.text).join(', ')}`, ledgerIds: [...new Set(r.items.flatMap((i) => i.factIds.filter((id) => byId.has(id))))] })
        }
      },
    }
    for (const key of plan.sectionOrder) {
      if (sections[key]) sections[key]()
      else bulletSection(key)
    }
    return lines
  }

  // -- THE PAGE-SOLVER: spacing tightens before content; page 2 before any true fact is dropped. --
  const policy = input.pagePolicy ?? 'two-ok'
  const total = projectsOrdered.length
  // FACT-NEUTRAL steps, in order: richer bullets → fewer bullets → shorter project descriptions
  // (sentence-trimmed, never mid-thought) → no summary paragraph (the headline stays). Every step
  // keeps every played fact on the page; only the page-2 fallback and the declared last resort
  // change WHAT is on it.
  type Variant = { bpp: number; desc: number; summary: boolean }
  const ONE_PAGE: Variant[] = [
    { bpp: 4, desc: 280, summary: true },
    { bpp: 3, desc: 280, summary: true },
    { bpp: 3, desc: 170, summary: true },
    { bpp: 2, desc: 280, summary: true },
    { bpp: 2, desc: 170, summary: true },
    { bpp: 2, desc: 170, summary: false },
  ]
  const TWO_PAGE: Variant[] = [
    { bpp: 4, desc: 280, summary: true },
    { bpp: 3, desc: 280, summary: true },
  ]
  const fit = (maxPages: number, projectCap: number, variants: Variant[]): CompiledResume | null => {
    for (const v of variants) {
      for (let tighten = 0; tighten < TIGHTEN_SCALE.length; tighten++) {
        const lines = applyEmphasis(assemble(v.bpp, projectCap, v.desc, v.summary), decode)
        const pages = estimatePages(lines, tighten)
        if (pages <= maxPages) {
          const dropped = projectsOrdered.slice(projectCap).map((p) => displayTitle(p.entry.title).split('—')[0].trim())
          return { lines, jobId, pages, tighten, benchedByPage: dropped.length ? dropped : undefined }
        }
      }
    }
    return null
  }
  const maxPages = policy === 'two-ok' ? 2 : 1
  // HUNTER-CAUGHT (05-Sep-2026, R3): under 'two-ok' the solver still walked every one-page
  // degradation (2 bullets, no summary) before trying page 2 — the small page he rebuilt to escape.
  // Now: the richest one-page variants; then a FULL two-pager (accepted only when page 2 carries
  // real weight, never three orphan lines); only then the leaner one-page steps.
  const richOne = fit(1, total, maxPages === 2 ? ONE_PAGE.slice(0, 2) : ONE_PAGE)
  if (richOne) return richOne
  if (maxPages === 2) {
    const two = fit(2, total, TWO_PAGE)
    if (two && pageTwoWeight(two) >= 0.25) return two
    const leanOne = fit(1, total, ONE_PAGE.slice(2))
    if (leanOne) return leanOne
    if (two) return two
  }
  // Last resort: bench played projects from the END of the plan's order, declared.
  for (let cap = total - 1; cap >= 1; cap--) {
    const r = fit(maxPages, cap, [{ bpp: 2, desc: 170, summary: false }])
    if (r) return r
  }
  const minimal = applyEmphasis(assemble(1, 1), decode)
  throw new CompileError(
    `Page overflow even at maximum tighten: ${Math.ceil(estimateHeight(minimal, 3))}pt of ${Math.floor(USABLE_HEIGHT * maxPages)}pt available.`,
    ['A single entry in the Ledger is extremely long — shorten its title or bullets.'],
  )
}
