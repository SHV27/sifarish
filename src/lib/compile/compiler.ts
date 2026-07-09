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
  }
}

/** Progressive trim levels — applied in order until the page fits (sniper over spray). */
interface TrimLevel {
  bulletsPerProject: number
  maxProjects: number
  maxAchievements: number
  includePositions: boolean
  includeCerts: boolean
}
const TRIM_LEVELS: TrimLevel[] = [
  { bulletsPerProject: 3, maxProjects: 4, maxAchievements: 99, includePositions: true, includeCerts: true },
  { bulletsPerProject: 3, maxProjects: 3, maxAchievements: 3, includePositions: true, includeCerts: true },
  { bulletsPerProject: 2, maxProjects: 3, maxAchievements: 3, includePositions: true, includeCerts: true },
  { bulletsPerProject: 2, maxProjects: 3, maxAchievements: 2, includePositions: false, includeCerts: true },
  { bulletsPerProject: 2, maxProjects: 3, maxAchievements: 2, includePositions: false, includeCerts: false },
  { bulletsPerProject: 1, maxProjects: 3, maxAchievements: 1, includePositions: false, includeCerts: false },
  { bulletsPerProject: 1, maxProjects: 2, maxAchievements: 1, includePositions: false, includeCerts: false },
  { bulletsPerProject: 1, maxProjects: 1, maxAchievements: 0, includePositions: false, includeCerts: false },
]

export function compileResume(input: CompileInput): CompiledResume {
  const { identity, ledger, decode, coverage, jobId } = input
  const eligible = ledger.filter((e) => e.resumeEligible)
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
  const education = shipped.filter((e) => e.kind === 'education')
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
    return p.bullets
      .slice()
      .sort((a, b) => bulletRelevance(b.keywords, decode) - bulletRelevance(a.keywords, decode))
      .slice(0, cap)
  }

  const assemble = (lv: TrimLevel): CompiledLine[] => {
    const lines: CompiledLine[] = []

    // Contact block (fixed)
    push(lines, { kind: 'contact', text: identity.name, ledgerIds: [] })
    push(lines, {
      kind: 'contact',
      text: `${identity.email} | ${identity.phone} | ${identity.github} | ${identity.linkedin}`,
      ledgerIds: [],
    })
    push(lines, { kind: 'contact', text: identity.location, ledgerIds: [] })

    // Education (fixed)
    if (education.length > 0) {
      push(lines, { kind: 'heading', text: 'EDUCATION', ledgerIds: education.map((e) => e.id) })
      for (const e of education) {
        push(lines, { kind: 'entry-title', text: e.title, ledgerIds: [e.id] })
        if (e.summary) push(lines, { kind: 'meta', text: e.summary, ledgerIds: [e.id] })
      }
    }

    // Skills: shipped only (I2 keeps in_forge out of here)
    if (skills.length > 0) {
      push(lines, { kind: 'heading', text: 'SKILLS', ledgerIds: skills.map((e) => e.id) })
      push(lines, { kind: 'skills', text: skills.map((e) => e.title).join(' | '), ledgerIds: skills.map((e) => e.id) })
    }

    // Projects
    const projects = projectPool.slice(0, lv.maxProjects)
    if (projects.length > 0) {
      push(lines, { kind: 'heading', text: 'PROJECTS', ledgerIds: projects.map((e) => e.id) })
      for (const p of projects) {
        const evidenceUrl = p.evidence?.url ?? p.evidence?.repo ?? ''
        push(lines, {
          kind: 'entry-title',
          text: `${p.title}${p.evidence?.date ? ` (${p.evidence.date})` : ''}`,
          ledgerIds: [p.id],
        })
        if (evidenceUrl) push(lines, { kind: 'meta', text: evidenceUrl.replace(/^https?:\/\//, ''), ledgerIds: [p.id] })
        for (const b of bulletsFor(p, lv.bulletsPerProject)) {
          push(lines, { kind: 'bullet', text: `- ${b.text}${b.metrics ? ` (${b.metrics})` : ''}`, ledgerIds: [p.id] })
        }
      }
    }

    // Currently Building: THE ONLY rendering of in_forge material (I2)
    if (forgeEntries.length > 0) {
      const eta = forgeEntries[0].forgeEta ?? 'July 2026'
      const names = forgeEntries.map((e) => e.title.split('—')[0].trim()).join(', ')
      push(lines, { kind: 'forge', text: `Currently Building (${eta}): ${names}`, ledgerIds: forgeEntries.map((e) => e.id) })
    }

    // Achievements (+ positions on one compact line)
    const keptAch = achievements.slice(0, lv.maxAchievements)
    const keptPos = lv.includePositions ? positions : []
    if (keptAch.length > 0 || keptPos.length > 0) {
      push(lines, { kind: 'heading', text: 'ACHIEVEMENTS', ledgerIds: [...keptAch, ...keptPos].map((e) => e.id) })
      for (const h of keptAch) {
        push(lines, { kind: 'bullet', text: `- ${h.title}${h.summary ? ` — ${h.summary}` : ''}`, ledgerIds: [h.id] })
      }
      if (keptPos.length > 0) {
        push(lines, { kind: 'bullet', text: `- ${keptPos.map((p) => p.title).join('; ')}`, ledgerIds: keptPos.map((p) => p.id) })
      }
    }

    // Certifications
    if (lv.includeCerts && certs.length > 0) {
      push(lines, { kind: 'heading', text: 'CERTIFICATIONS', ledgerIds: certs.map((e) => e.id) })
      for (const c of certs) {
        push(lines, { kind: 'bullet', text: `- ${c.title}${c.summary ? ` (${c.summary})` : ''}`, ledgerIds: [c.id] })
      }
    }

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
