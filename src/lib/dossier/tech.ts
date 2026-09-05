import techJson from '../../../data/config/tech.json'
import type { LedgerEntry } from '../../types'

/**
 * THE TECH CANON (v2 R4, 05-Sep-2026) — the ONLY vocabulary that may appear on the page as a
 * skill, a project-header stack, or bold-inline tech. It is DATA (data/config/tech.json): the
 * owner extends it by editing the file, never by a code change (brief B.5).
 *
 * Why it exists: his real vault carries Nabz-forged tags and bullet keywords in his own shorthand
 * ("statistics", "speech", "inference", "gpt", "agents", "alignment"). Those are evidence for the
 * matcher; printed as "Frameworks & Libraries: statistics, speech, gpt, inference" they read as a
 * machine that never studied a company. One authority, one canonical name per technology, one
 * row per the six samples' labelled rows.
 */
export type TechRow = 'Languages' | 'AI & ML' | 'Frameworks & Libraries' | 'Databases' | 'Tools & Platforms' | 'Core CS'
export interface Tech {
  name: string
  row: TechRow
  aliases: string[]
}
interface TechFile {
  version: number
  rows: string[]
  tech: Tech[]
}

const FILE = techJson as TechFile
export const TECH: Tech[] = FILE.tech
export const TECH_ROWS = FILE.rows as TechRow[]

const normKey = (s: string) => s.toLowerCase().trim().replace(/\s*\(.*\)$/, '').replace(/[^a-z0-9+#./ -]/g, '').replace(/\s+/g, ' ').trim()

const BY_ALIAS = new Map<string, Tech>()
for (const t of TECH) {
  BY_ALIAS.set(normKey(t.name), t)
  for (const a of t.aliases) BY_ALIAS.set(normKey(a), t)
}

/** The canonical technology for any surface form ("typescript", "Postgres", "langgraph-mcp"), or null when it is not a technology. */
export function canonTech(term: string): Tech | null {
  const k = normKey(term)
  if (!k) return null
  const direct = BY_ALIAS.get(k)
  if (direct) return direct
  // "React (hooks)" / "Groq / Whisper API Integration" — the first alias-known token wins.
  for (const part of k.split(/\s*[\/,|+&]\s*|\s+-\s+/)) {
    const hit = BY_ALIAS.get(part.trim())
    if (hit) return hit
  }
  return null
}

export function isTech(term: string): boolean {
  return canonTech(term) !== null
}

/** Every technology an entry proves, canonical and deduped: README stack first, then tags, then bullet keywords. */
export function techOf(entry: LedgerEntry): Tech[] {
  const out: Tech[] = []
  const seen = new Set<string>()
  const take = (raw: string) => {
    const t = canonTech(raw)
    if (t && !seen.has(t.name)) {
      seen.add(t.name)
      out.push(t)
    }
  }
  for (const s of entry.context?.stack ?? []) take(s)
  for (const t of entry.tags ?? []) take(t)
  for (const b of entry.bullets ?? []) for (const k of b.keywords ?? []) take(k)
  return out
}

/** The header stack for a project: ≤ 4 canonical technologies, the ones the posting asks for first. */
export function headerStack(entry: LedgerEntry, askedFor: string[] = [], max = 4): string[] {
  const asked = new Set(askedFor.map((a) => canonTech(a)?.name).filter((x): x is string => !!x))
  const all = techOf(entry)
  const first = all.filter((t) => asked.has(t.name))
  const rest = all.filter((t) => !asked.has(t.name))
  return [...first, ...rest].slice(0, max).map((t) => t.name)
}

/** All alias surface forms (lowercase) — the emphasis pass bolds only these and numbers. */
export function techSurfaceForms(): string[] {
  const out = new Set<string>()
  for (const t of TECH) {
    out.add(t.name.toLowerCase())
    for (const a of t.aliases) if (a.length >= 3) out.add(a.toLowerCase())
  }
  return [...out]
}
