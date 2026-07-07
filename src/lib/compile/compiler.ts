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
 * Budget model shared with the PDF renderer (export/pdf.ts): A4, 48pt margins,
 * Helvetica. Estimates here are conservative (chars-per-line 88 vs real ~95), and the
 * renderer re-asserts the page bound with true font metrics as a hard error.
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
const USABLE_HEIGHT = PAGE.height - PAGE.margin * 2 // 745.89
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
}

export function compileResume(input: CompileInput): CompiledResume {
  const { identity, ledger, decode, coverage, jobId } = input
  const eligible = ledger.filter((e) => e.resumeEligible)
  const shipped = eligible.filter((e) => e.tier === 'shipped')
  const lines: CompiledLine[] = []

  // -- Contact block (fixed) --
  push(lines, { kind: 'contact', text: identity.name, ledgerIds: [] })
  push(lines, {
    kind: 'contact',
    text: `${identity.email} | ${identity.phone} | ${identity.github} | ${identity.linkedin}`,
    ledgerIds: [],
  })
  push(lines, { kind: 'contact', text: identity.location, ledgerIds: [] })

  // -- Education (fixed) --
  const education = shipped.filter((e) => e.kind === 'education')
  if (education.length > 0) {
    push(lines, { kind: 'heading', text: 'EDUCATION', ledgerIds: education.map((e) => e.id) })
    for (const e of education) {
      push(lines, { kind: 'entry-title', text: e.title, ledgerIds: [e.id] })
      if (e.summary) push(lines, { kind: 'meta', text: e.summary, ledgerIds: [e.id] })
    }
  }

  // -- Skills: shipped only, ordered by JD relevance (I2 keeps in_forge out of here) --
  const skills = shipped
    .filter((e) => e.kind === 'skill')
    .sort((a, b) => entryRelevance(b, decode) - entryRelevance(a, decode))
  if (skills.length > 0) {
    push(lines, { kind: 'heading', text: 'SKILLS', ledgerIds: skills.map((e) => e.id) })
    push(lines, {
      kind: 'skills',
      text: skills.map((e) => e.title).join(' | '),
      ledgerIds: skills.map((e) => e.id),
    })
  }

  // -- Projects: ranked per-JD, greedy under budget --
  const projects = shipped
    .filter((e) => e.kind === 'project')
    .sort(
      (a, b) =>
        entryRelevance(b, decode) - entryRelevance(a, decode) ||
        (b.evidence?.date ?? '').localeCompare(a.evidence?.date ?? ''),
    )
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
      const chosen = p.bullets
        .slice()
        .sort((a, b) => bulletRelevance(b.keywords, decode) - bulletRelevance(a.keywords, decode))
        .slice(0, 3)
      for (const b of chosen) {
        push(lines, { kind: 'bullet', text: `- ${b.text}${b.metrics ? ` (${b.metrics})` : ''}`, ledgerIds: [p.id] })
      }
    }
  }

  // -- Currently Building: THE ONLY rendering of in_forge material (I2) --
  const forgeIds = new Set(coverage.building.flatMap((h) => h.ledgerIds))
  const forgeEntries = eligible.filter((e) => e.tier === 'in_forge' && forgeIds.has(e.id))
  if (forgeEntries.length > 0) {
    const eta = forgeEntries[0].forgeEta ?? 'July 2026'
    const names = forgeEntries.map((e) => e.title.split('—')[0].trim()).join(', ')
    push(lines, {
      kind: 'forge',
      text: `Currently Building (${eta}): ${names}`,
      ledgerIds: forgeEntries.map((e) => e.id),
    })
  }

  // -- Achievements & Certifications: greedy by relevance, compact --
  const honors = shipped.filter((e) => e.kind === 'achievement' || e.kind === 'position')
  if (honors.length > 0) {
    push(lines, { kind: 'heading', text: 'ACHIEVEMENTS', ledgerIds: honors.map((e) => e.id) })
    for (const h of honors.filter((e) => e.kind === 'achievement')) {
      push(lines, { kind: 'bullet', text: `- ${h.title}${h.summary ? ` — ${h.summary}` : ''}`, ledgerIds: [h.id] })
    }
    const positions = honors.filter((e) => e.kind === 'position')
    if (positions.length > 0) {
      push(lines, {
        kind: 'bullet',
        text: `- ${positions.map((p) => p.title).join('; ')}`,
        ledgerIds: positions.map((p) => p.id),
      })
    }
  }

  const certs = shipped.filter((e) => e.kind === 'certification')
  if (certs.length > 0) {
    push(lines, { kind: 'heading', text: 'CERTIFICATIONS', ledgerIds: certs.map((e) => e.id) })
    for (const c of certs) {
      push(lines, { kind: 'bullet', text: `- ${c.title}${c.summary ? ` (${c.summary})` : ''}`, ledgerIds: [c.id] })
    }
  }

  // -- One-page budget: trim from the bottom of the flexible sections, legibly --
  let height = estimateHeight(lines)
  if (height > USABLE_HEIGHT) {
    // Drop the least relevant project bullets first (from last project upward), then certs summaries.
    const cuts: string[] = []
    for (let i = lines.length - 1; i >= 0 && height > USABLE_HEIGHT; i--) {
      const line = lines[i]
      if (line.kind === 'bullet' && line.text.length > 120) {
        cuts.push(`Shorten: "${line.text.slice(0, 70)}…"`)
      }
    }
    // Greedy removal: last project's 3rd bullet, then 2nd-to-last's, etc.
    const projectHeadingIdx = lines.findIndex((l) => l.kind === 'heading' && l.text === 'PROJECTS')
    for (let pass = 0; pass < 3 && height > USABLE_HEIGHT; pass++) {
      for (let i = lines.length - 1; i > projectHeadingIdx && height > USABLE_HEIGHT; i--) {
        if (lines[i].kind === 'bullet') {
          const prev = lines[i - 1]
          const next = lines[i + 1]
          const isLastBulletOfEntry = !next || next.kind !== 'bullet'
          const hasSibling = prev && prev.kind === 'bullet'
          if (isLastBulletOfEntry && hasSibling) {
            cuts.push(`Dropped for space: "${lines[i].text.slice(0, 70)}…"`)
            lines.splice(i, 1)
            height = estimateHeight(lines)
          }
        }
      }
    }
    if (height > USABLE_HEIGHT) {
      throw new CompileError(
        `Page overflow: compiled resume needs ${Math.ceil(height)}pt of ${Math.floor(USABLE_HEIGHT)}pt available.`,
        cuts.length > 0 ? cuts : ['Reduce project bullets in the Ledger, or trim skill titles.'],
      )
    }
  }

  return { lines, jobId }
}
