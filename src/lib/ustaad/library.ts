import bundledJson from '../../../data/ustaad/library.json'
import { db } from '../../db/db'

/**
 * THE USTAAD LIBRARY (P13, I13) — all resume-craft knowledge lives as versioned, dated,
 * CITED data (data/ustaad/library.json), never hardcoded in components. This module is the
 * single typed gateway: the Darzi passes, the Compile Quality estimator, Baithak, and the
 * Guru's path briefs all consult it here.
 *
 * Runtime-refreshable: Pulse can propose a newer library (diff + citations, owner confirms —
 * Nabz pattern); an accepted update is stored in Dexie and wins over the bundled copy when
 * its version is higher. Entries carry access dates; stale entries are FLAGGED, never
 * silently trusted (staleSources below).
 */

export interface UstaadSource {
  id: string
  title: string
  url: string
  accessed: string // YYYY-MM-DD
}

export type UstaadPass = 'archetype' | 'casting' | 'surgery' | 'redteam' | 'estimator'

export interface UstaadPattern {
  id: string
  rule: string
  why: string
  sourceIds: string[]
  /** Archetype ids this applies to, or ['*'] for all. */
  archetypes: string[]
  passes: UstaadPass[]
  exemplar: string
}

export interface ArchetypeGuide {
  archetype: string
  sectionOrder: string[]
  leadSignals: string[]
  skillsGroups: string[]
  sourceIds: string[]
}

export interface PathBrief {
  id: string
  label: string
  summary: string
  timeline: string
  referralWeight: string
  portfolioVsDsa: string
  conversionNorms: string
  indiaVsRemote: string
  sourceIds: string[]
}

export interface UstaadLibrary {
  version: string
  updatedAt: string
  honestyNote: string
  sources: UstaadSource[]
  patterns: UstaadPattern[]
  archetypeGuides: ArchetypeGuide[]
  pathBriefs: PathBrief[]
}

const bundled = bundledJson as UstaadLibrary

/** In-memory active library — bundled by default, replaced by an accepted Pulse update. */
let active: UstaadLibrary = bundled

/** Load a Dexie-stored library update if it's newer than the bundled copy (call at boot). */
export async function loadLibraryOverride(): Promise<void> {
  try {
    const row = await db.ustaad.get('library')
    if (!row) return
    const parsed = JSON.parse(row.json) as UstaadLibrary
    if (isValidLibrary(parsed) && compareVersions(parsed.version, bundled.version) > 0) active = parsed
  } catch {
    // corrupt override → bundled copy stands (the library can never blank the app)
  }
}

/** Validate + store a proposed library update (owner-confirmed via Pulse). */
export async function applyLibraryUpdate(json: string): Promise<{ ok: boolean; reason?: string }> {
  let parsed: UstaadLibrary
  try {
    parsed = JSON.parse(json) as UstaadLibrary
  } catch {
    return { ok: false, reason: 'not valid JSON' }
  }
  if (!isValidLibrary(parsed)) return { ok: false, reason: 'schema check failed (sources/patterns/citations)' }
  if (compareVersions(parsed.version, active.version) <= 0) return { ok: false, reason: `version ${parsed.version} is not newer than ${active.version}` }
  await db.ustaad.put({ id: 'library', json, version: parsed.version, updatedAt: parsed.updatedAt })
  active = parsed
  return { ok: true }
}

/** Every pattern must cite resolvable sources — the library's own I7. */
export function isValidLibrary(lib: UstaadLibrary): boolean {
  if (!lib.version || !lib.updatedAt || !Array.isArray(lib.sources) || !Array.isArray(lib.patterns)) return false
  if (lib.sources.length < 25) return false
  const ids = new Set(lib.sources.map((s) => s.id))
  if (lib.sources.some((s) => !s.url || !s.accessed || !s.title)) return false
  const allCited = (xs: { sourceIds: string[] }[]) => xs.every((x) => x.sourceIds.length > 0 && x.sourceIds.every((id) => ids.has(id)))
  return (
    lib.patterns.every((p) => !!p.rule && !!p.why && !!p.exemplar) &&
    allCited(lib.patterns) &&
    allCited(lib.archetypeGuides ?? []) &&
    allCited(lib.pathBriefs ?? [])
  )
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

// ---------- accessors ----------

export function getLibrary(): UstaadLibrary {
  return active
}

export function patternById(id: string): UstaadPattern | undefined {
  return active.patterns.find((p) => p.id === id)
}

/** Patterns a given pass should consult for a given archetype. */
export function patternsFor(pass: UstaadPass, archetypeId?: string): UstaadPattern[] {
  return active.patterns.filter(
    (p) => p.passes.includes(pass) && (p.archetypes.includes('*') || (archetypeId ? p.archetypes.includes(archetypeId) : true)),
  )
}

export function guideFor(archetypeId: string): ArchetypeGuide | undefined {
  return active.archetypeGuides.find((g) => g.archetype === archetypeId)
}

export function pathBriefs(): PathBrief[] {
  return active.pathBriefs
}

export function sourcesOf(p: { sourceIds: string[] }): UstaadSource[] {
  return p.sourceIds.map((id) => active.sources.find((s) => s.id === id)).filter((s): s is UstaadSource => !!s)
}

/** Citations in Rationale shape for a set of pattern ids (deduped, capped). */
export function citePatterns(ids: string[], cap = 3): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    const p = patternById(id)
    if (!p) continue
    for (const s of sourcesOf(p)) {
      if (seen.has(s.url)) continue
      seen.add(s.url)
      out.push({ title: `Ustaad ¶${id}: ${s.title}`, url: s.url })
      if (out.length >= cap) return out
    }
  }
  return out
}

/** Sources not re-verified in >12 months — flagged in Settings, never silently trusted. */
export function staleSources(now = new Date()): UstaadSource[] {
  const cutoff = now.getTime() - 365 * 86400000
  return active.sources.filter((s) => new Date(s.accessed).getTime() < cutoff)
}

/** Library refresh is due when any source is stale or the library itself is >30 days unreviewed. */
export function libraryRefreshDue(now = new Date()): boolean {
  if (staleSources(now).length > 0) return true
  return now.getTime() - new Date(active.updatedAt).getTime() > 30 * 86400000
}

// ---------- section order (archetype guide → compiler tokens) ----------

export type SectionKey = 'education' | 'skills' | 'projects' | 'forge' | 'achievements' | 'certs'

/**
 * Maps a guide's section order to compiler section tokens. 'honors' expands to
 * achievements + certs; the forge line always follows projects (I2: it is dated momentum,
 * read right after the work it extends). Contact is always first (not a token).
 */
export function sectionOrderFor(archetypeId: string): SectionKey[] {
  const guide = guideFor(archetypeId)
  const fallback: SectionKey[] = ['education', 'skills', 'projects', 'forge', 'achievements', 'certs']
  if (!guide) return fallback
  const out: SectionKey[] = []
  for (const s of guide.sectionOrder) {
    if (s === 'contact') continue
    if (s === 'education') out.push('education')
    else if (s === 'skills') out.push('skills')
    else if (s === 'projects') out.push('projects', 'forge')
    else if (s === 'honors') out.push('achievements', 'certs')
  }
  for (const k of fallback) if (!out.includes(k)) out.push(k)
  return out
}

// ---------- verb craft (consulted by surgery/red-team/estimator) ----------

/** Strong engineering verbs (Ustaad ¶verb-strength-ladder, cited in the library). */
export const STRONG_VERBS = [
  'built', 'shipped', 'engineered', 'designed', 'cut', 'reduced', 'automated', 'benchmarked',
  'instrumented', 'implemented', 'launched', 'optimized', 'deployed', 'created', 'developed',
  'led', 'wrote', 'composed', 'solved', 'achieved', 'won', 'ranked', 'scored', 'published',
  'integrated', 'architected', 'compiled', 'trained', 'fine-tuned', 'evaluated', 'probed',
]

/** Weak openers that fail the 6-second skim (Ustaad ¶action-verb-lead). */
export const WEAK_OPENERS = ['worked on', 'helped', 'was responsible for', 'responsible for', 'participated in', 'assisted', 'involved in']

export function startsWeak(bulletText: string): string | null {
  const t = bulletText.replace(/^[-•]\s*/, '').toLowerCase()
  for (const w of WEAK_OPENERS) if (t.startsWith(w)) return w
  return null
}

export function startsStrong(bulletText: string): boolean {
  const t = bulletText.replace(/^[-•]\s*/, '').toLowerCase()
  return STRONG_VERBS.some((v) => t.startsWith(v + ' ') || t.startsWith(v + ','))
}
