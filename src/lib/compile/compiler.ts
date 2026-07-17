import type {
  CompiledLine,
  CompiledResume,
  CoverageReport,
  Identity,
  JDDecode,
  LedgerEntry,
} from '../../types'
import { entryRelevance, bulletRelevance } from '../match/evidence'

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
 * Estimates here are conservative (chars-per-line 88 vs real ~95), and the renderer
 * re-asserts the page bound with true font metrics as a hard error.
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
export const PAGE = { width: 595.28, height: 841.89, margin: 48 }
export const USABLE_HEIGHT = PAGE.height - PAGE.margin * 2 // 745.89
const CHARS_PER_LINE = 88

export const LINE_METRICS: Record<CompiledLine['kind'], { size: number; leading: number; before: number; bold: boolean }> = {
  contact: { size: 9.5, leading: 12.5, before: 2, bold: false },
  summary: { size: 10, leading: 13, before: 6, bold: false },
  heading: { size: 11, leading: 14, before: 10, bold: true },
  'entry-title': { size: 10.5, leading: 13.5, before: 5, bold: true },
  meta: { size: 10, leading: 13, before: 1, bold: false },
  bullet: { size: 10.5, leading: 13.5, before: 1.5, bold: false },
  skills: { size: 10.5, leading: 13.5, before: 1.5, bold: false },
  forge: { size: 10.5, leading: 13.5, before: 1.5, bold: false },
}
// Name line rides on 'entry-title' metrics scaled up; handled explicitly:
const NAME_HEIGHT = 24

export function estimateLineHeight(line: CompiledLine): number {
  const m = LINE_METRICS[line.kind]
  const wrapped = Math.max(1, Math.ceil(line.text.length / CHARS_PER_LINE))
  return m.before + wrapped * m.leading
}

export function estimateHeight(lines: CompiledLine[]): number {
  let h = NAME_HEIGHT // name is always line 0 at 16pt bold
  for (let i = 1; i < lines.length; i++) h += estimateLineHeight(lines[i])
  return h
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

function push(lines: CompiledLine[], line: CompiledLine) {
  if (line.kind === 'bullet' && line.ledgerIds.length === 0) {
    throw new CompileError(`I1 violation: bullet "${line.text.slice(0, 60)}…" has no ledger evidence link.`)
  }
  lines.push(line)
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
}

export type SectionKey = 'education' | 'skills' | 'projects' | 'forge' | 'achievements' | 'certs'
const DEFAULT_SECTION_ORDER: SectionKey[] = ['education', 'skills', 'projects', 'forge', 'achievements', 'certs']

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

export function compileResume(input: CompileInput): CompiledResume {
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

  const bulletsFor = (p: LedgerEntry, cap: number) => {
    const plan = input.editorial?.bullets[p.id]
    if (plan && plan.length > 0) {
      const byId = new Map(p.bullets.map((b) => [b.id, b]))
      const chosen = plan.map((id) => byId.get(id)).filter((b): b is (typeof p.bullets)[number] => !!b)
      if (chosen.length > 0) return chosen.slice(0, cap)
    }
    // Session 6 (Defect 1): the same numbered-bullet bonus as the Editor's Desk — a real number
    // the ledger holds must not lose its seat to a numberless bullet with equal keyword overlap.
    const numBonus = (b: (typeof p.bullets)[number]) => (/\d/.test(b.text) || (b.metrics ? /\d/.test(b.metrics) : false) ? 2 : 0)
    return p.bullets
      .slice()
      .sort((a, b) => bulletRelevance(b.keywords, decode) + numBonus(b) - (bulletRelevance(a.keywords, decode) + numBonus(a)))
      .slice(0, cap)
  }

  const sectionOrder = input.editorial?.sectionOrder?.length ? input.editorial.sectionOrder : DEFAULT_SECTION_ORDER

  const assemble = (lv: TrimLevel): CompiledLine[] => {
    const lines: CompiledLine[] = []

    // Contact block (always first — the skim starts here)
    push(lines, { kind: 'contact', text: identity.name, ledgerIds: [] })
    push(lines, {
      kind: 'contact',
      text: `${identity.email} | ${identity.phone} | ${identity.github} | ${identity.linkedin}`,
      ledgerIds: [],
    })
    push(lines, { kind: 'contact', text: identity.location, ledgerIds: [] })

    // Professional summary (top-third, first fixation) — evidence-linked, orchestrator-compiled.
    if (input.summaryLine && input.summaryLine.text.trim()) push(lines, input.summaryLine)

    // Sections render in the archetype guide's order (Ustaad P13); default order otherwise.
    const sections: Record<SectionKey, () => void> = {
      education: () => {
        if (education.length === 0) return
        push(lines, { kind: 'heading', text: 'EDUCATION', ledgerIds: education.map((e) => e.id) })
        for (const e of education) {
          // Session 6 (Defect 3): one coherent line per qualification — title and its year/score
          // joined, never a bold degree line followed by an orphan "2021" floating alone.
          const text = e.summary ? `${e.title} · ${e.summary.replace(/\s+/g, ' ').trim()}` : e.title
          push(lines, { kind: 'entry-title', text, ledgerIds: [e.id] })
        }
      },
      skills: () => {
        // Shipped only (I2 keeps in_forge out of here). Capped per trim level (relevance-sorted, so
        // the JD-relevant skills survive) so the skills line can shrink before project bullets do.
        if (skills.length === 0) return
        const shown = skills.slice(0, lv.skillsCap)
        push(lines, { kind: 'heading', text: 'SKILLS', ledgerIds: shown.map((e) => e.id) })
        push(lines, { kind: 'skills', text: shown.map((e) => e.title).join(' | '), ledgerIds: shown.map((e) => e.id) })
      },
      projects: () => {
        const projects = projectPool.slice(0, lv.maxProjects)
        if (projects.length === 0) return
        push(lines, { kind: 'heading', text: 'PROJECTS', ledgerIds: projects.map((e) => e.id) })
        for (const p of projects) {
          const evidenceUrl = p.evidence?.url ?? p.evidence?.repo ?? ''
          push(lines, {
            kind: 'entry-title',
            text: `${displayTitle(p.title)}${p.evidence?.date ? ` (${displayDate(p.evidence.date)})` : ''}`,
            ledgerIds: [p.id],
          })
          // Session 5.7 (owner: "these are not app descriptions") — a project's bullets are engineering
          // ACHIEVEMENTS; without a one-line "what it IS" a recruiter can't tell that sifarish is a
          // job-hunt assistant. Render the project's own summary (its product description) + the live
          // link on one line, so the achievements below have context. Never trimmed away (it IS the point).
          const desc = truncateAtWord(cleanSummaryForDisplay(p.summary ?? ''), 160)
          const metaText = [desc, evidenceUrl.replace(/^https?:\/\//, '')].filter(Boolean).join(' · ')
          if (metaText) push(lines, { kind: 'meta', text: metaText, ledgerIds: [p.id] })
          for (const b of bulletsFor(p, lv.bulletsPerProject)) {
            // A Baithak rephrasing renders in place of the original, under the SAME evidence link.
            const text = input.bulletOverrides?.[b.id] ?? b.text
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
          push(lines, { kind: 'bullet', text: `- ${h.title}${h.summary ? ` — ${h.summary}` : ''}`, ledgerIds: [h.id] })
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
          const detail = c.summary ? ` (${c.summary.trim().replace(/\.$/, '')})` : ''
          push(lines, { kind: 'bullet', text: `- ${c.title}${detail}`, ledgerIds: [c.id] })
        }
      },
    }
    for (const key of sectionOrder) sections[key]?.()

    return lines
  }

  // -- Solve the one-page constraint: tighten until it fits --
  for (const lv of TRIM_LEVELS) {
    const lines = assemble(lv)
    if (estimateHeight(lines) <= USABLE_HEIGHT) return { lines, jobId }
  }

  // Practically unreachable: even 1 project × 1 bullet + contact + education won't fit.
  const minimal = assemble(TRIM_LEVELS[TRIM_LEVELS.length - 1])
  throw new CompileError(
    `Page overflow even at maximum trim: ${Math.ceil(estimateHeight(minimal))}pt of ${Math.floor(USABLE_HEIGHT)}pt available.`,
    ['A single entry in the Ledger is extremely long — shorten its title or bullets.'],
  )
}
