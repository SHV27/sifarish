import type { LedgerEntry } from '../../types'
import type { SkillCategory } from '../compile/typeset'
import { canonTech, techOf, type TechRow } from './tech'

/**
 * v2 THE DOSSIER — `derivedSkills()` is THE authority on "what is true about him, skill-wise"
 * (ARCHITECTURE v2, authority 4). The owner killed the maintained skills list ("jd ke hisab se
 * khud daaldiya kar skills"): the page's skills rows are ASSEMBLED per posting from what the
 * evidence proves — project stacks, bullet keywords, tags, sworn facts, and the old skill
 * entries (which remain evidence, never a rendered list).
 *
 * Every derived skill carries the fact ids that prove it (I1). A JD skill with no fact behind it
 * can never render — it goes to the gap note.
 */

export interface DerivedSkill {
  /** Display text ("LangGraph", "Python", "RAG"). */
  text: string
  /** Lowercase match key. */
  key: string
  factIds: string[]
  category: SkillCategory
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#.]/g, '')

/** Tags that are organisational, not skills — never a skills-row item. */
/** Known skill display forms for canonical lexicon/tag keys the ledger speaks. */
/** Keys of skills the OWNER marked resumeEligible:false — his call, honored everywhere (D59). */
export function bannedSkillKeys(ledger: LedgerEntry[]): Set<string> {
  return new Set(ledger.filter((e) => e.kind === 'skill' && !e.resumeEligible).map((e) => norm(e.title.split('—')[0])))
}
export function isBannedSkill(text: string, banned: Set<string>): boolean {
  const k = norm(text)
  if (!k) return false
  for (const b of banned) if (b && (k === b || k.startsWith(b) || b.startsWith(k)) && Math.min(k.length, b.length) >= 4) return true
  return false
}

/** The market's vocabulary: a tag/keyword becomes a skill only if the JD lexicon knows it. */
/**
 * The union of every skill the dossier proves. Order: skill entries first (his hand-curated
 * names win the display form), then project stacks, then keywords/tags.
 */
export function derivedSkills(ledger: LedgerEntry[]): DerivedSkill[] {
  // v2 R4 (owner-caught: "statistics, speech, gpt, inference" printed as skills): ONLY the tech
  // canon (data/config/tech.json) names a skill. His stack, tags and bullet keywords are surface
  // forms; each is mapped to its canonical technology or dropped — never printed raw.
  const map = new Map<string, DerivedSkill>()
  const banned = bannedSkillKeys(ledger)
  const eligible = ledger.filter((e) => e.resumeEligible && e.tier === 'shipped')
  const take = (raw: string, factId: string) => {
    const t = canonTech(raw)
    if (!t) return
    if (isBannedSkill(t.name, banned) || isBannedSkill(raw, banned)) return
    const key = norm(t.name)
    const existing = map.get(key)
    if (existing) {
      if (!existing.factIds.includes(factId)) existing.factIds.push(factId)
      return
    }
    map.set(key, { text: t.name, key, factIds: [factId], category: rowCategory(t.row) })
  }
  for (const e of eligible.filter((x) => x.kind === 'skill')) take(e.title.split('—')[0].trim(), e.id)
  for (const e of eligible.filter((x) => x.kind !== 'skill')) for (const t of techOf(e)) take(t.name, e.id)
  return [...map.values()]
}

/** The canon's row for a technology, in the compile layer's category vocabulary. */
function rowCategory(row: TechRow): SkillCategory {
  if (row === 'Languages' || row === 'AI & ML') return row
  return 'Frameworks & Tools'
}

/** The canon row of a derived skill (the six samples' labelled rows). */
export function skillRow(s: DerivedSkill): TechRow {
  return canonTech(s.text)?.row ?? (s.category === 'Languages' ? 'Languages' : s.category === 'AI & ML' ? 'AI & ML' : 'Frameworks & Libraries')
}

/** Find a derived skill by any surface form of a JD term ("langgraph", "LangGraph", "lang graph"). */
export function findSkill(skills: DerivedSkill[], term: string): DerivedSkill | undefined {
  const k = norm(term)
  if (!k) return undefined
  return skills.find((s) => s.key === k) ?? skills.find((s) => s.key.includes(k) || k.includes(s.key))
}
