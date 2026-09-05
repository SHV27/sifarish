import { db } from '../../db/db'
import type { LedgerEntry, SectionDef } from '../../types'
import { DEFAULT_SECTIONS } from './sections'

/**
 * v2 THE DOSSIER — absorb a fact he says out loud.
 *
 * "buddy mere data mein jo jo hoga, bhale certification ho, achievement, work ex, even district-level
 * badminton player — app samjhdaar ho kab kya use karna." He will not maintain a fixed set of
 * fields: a fact arrives as a sentence, the kind is inferred, and if no section exists for it one
 * is created in the registry (persisted; the compiler renders any kind). Every fact is `sworn:
 * 'owner'` — his word is the oath; the app records that it cannot verify it (DECISIONS V2-2 §7).
 */

/** Kind inference — the market's shorthand for what a fact IS; the last resort is a custom kind. */
const KIND_RULES: { kind: string; re: RegExp }[] = [
  { kind: 'experience', re: /\b(intern(ship)?|worked at|working at|employed|job at|full[- ]time|part[- ]time|freelance|contract(or)?|research assistant|teaching assistant)\b/i },
  { kind: 'publication', re: /\b(paper|published|publication|preprint|arxiv|journal|conference paper|position paper|thesis)\b/i },
  { kind: 'certification', re: /\b(certif(icate|ication|ied)|course completed|nanodegree|specialization|udemy|coursera|nptel)\b/i },
  { kind: 'achievement', re: /\b(won|winner|1st|first place|2nd|3rd|runner[- ]up|finalist|award|prize|medal|scholar(ship)?|rank(ed)?|topper|selected for|qualified|olympiad|ntse|hackathon|competition|championship)\b/i },
  { kind: 'position', re: /\b(president|secretary|head|lead|core member|committee|coordinator|organi[sz]er|volunteer|mentor|captain|club|society|council)\b/i },
  { kind: 'sports', re: /\b(badminton|cricket|football|basketball|tennis|chess|athletics|swimming|player|tournament|district[- ]level|state[- ]level|national[- ]level)\b/i },
  { kind: 'project', re: /\b(built|shipped|deployed|created|developed|open[- ]source|repo|github\.com)\b/i },
  { kind: 'language', re: /\b(fluent|native speaker|speak(s)?|proficiency|hindi|punjabi|english|french|german|japanese)\b/i },
  { kind: 'skill', re: /^(?:skill|tool|framework|library)\b/i },
]

/** A short, honest kind for a fact; 'other' when nothing fits (still a section, still on the page if played). */
export function inferKind(text: string): string {
  const t = text.trim()
  for (const r of KIND_RULES) if (r.re.test(t)) return r.kind
  return 'other'
}

/** A section label for a kind (registry first, then title-case). */
export function labelFor(kind: string, sections?: SectionDef[]): string {
  const known = (sections ?? []).find((s) => s.kind === kind) ?? DEFAULT_SECTIONS.find((s) => s.kind === kind)
  if (known) return known.label
  const fixed: Record<string, string> = { sports: 'Sports', language: 'Languages', other: 'Additional', volunteering: 'Volunteering', award: 'Awards' }
  return fixed[kind] ?? kind.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Make sure the registry knows this kind (idempotent; persisted on Settings). Returns true if created. */
export async function ensureSection(kind: string, label?: string): Promise<boolean> {
  const s = await db.settings.get('app')
  if (!s) return false
  const sections = s.sections?.length ? s.sections : DEFAULT_SECTIONS
  if (sections.some((x) => x.kind === kind)) {
    if (label && sections.find((x) => x.kind === kind)!.label !== label) {
      await db.settings.update('app', { sections: sections.map((x) => (x.kind === kind ? { ...x, label } : x)) })
    }
    return false
  }
  const order = Math.max(0, ...sections.map((x) => x.order)) + 10
  await db.settings.update('app', { sections: [...sections, { kind, label: label ?? labelFor(kind), order }] })
  return true
}

export interface AbsorbInput {
  text: string
  kind?: string
  detail?: string
  /** MM/YYYY; defaults to now. */
  date?: string
  url?: string
}

/** Split "Title — detail" / "Title: detail" / "Title (detail)" into a title and a detail line. */
export function splitFact(text: string): { title: string; detail: string } {
  const t = text.trim().replace(/\s+/g, ' ').replace(/[.]+$/, '')
  const m = /^(.{6,120}?)\s*(?:—|–|:|\(|,\s(?=\d{4}))\s*(.{3,}?)\)?$/.exec(t)
  if (m) return { title: m[1].trim(), detail: m[2].trim() }
  return { title: t.slice(0, 160), detail: '' }
}

/** The ONE door for a spoken fact: infer → section → ledger row (sworn by owner). Returns the entry. */
export async function absorbFact(input: AbsorbInput): Promise<LedgerEntry> {
  const kind = (input.kind ?? inferKind(input.text)).toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const { title, detail } = splitFact(input.text)
  await ensureSection(kind)
  const now = new Date()
  const id = `${kind}-${Date.now()}`
  const entry: LedgerEntry = {
    id,
    kind,
    title,
    summary: input.detail ?? detail,
    bullets: kind === 'skill' ? [{ id: `${id}-b1`, text: title, keywords: [title.toLowerCase().replace(/[^a-z0-9]/g, '-')] }] : [],
    tier: 'shipped',
    evidence: {
      date: input.date ?? `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
      note: 'Sworn by the owner in conversation — the app cannot verify it; it is his oath (I1).',
      ...(input.url ? { url: input.url } : {}),
    },
    tags: [kind],
    resumeEligible: true,
    sworn: 'owner',
  }
  await db.ledger.put(entry)
  return entry
}

/** Find a ledger entry by loose name ("lora", "LangGraph / MCP", "react"). */
export function findEntry(ledger: LedgerEntry[], needle: string): LedgerEntry | undefined {
  const n = needle.trim().toLowerCase()
  if (n.length < 2) return undefined
  return (
    ledger.find((e) => e.title.toLowerCase() === n) ??
    ledger.find((e) => e.title.toLowerCase().split(/ — | – | \| /)[0].trim() === n) ??
    ledger.find((e) => e.title.toLowerCase().includes(n)) ??
    ledger.find((e) => n.includes(e.title.toLowerCase().split(/ — | – | \| /)[0].trim()) && e.title.length >= 3)
  )
}
