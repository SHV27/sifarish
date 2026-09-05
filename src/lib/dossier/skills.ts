import type { LedgerEntry } from '../../types'
import { displayTech } from '../compile/compiler'
import { categorizeSkill, type SkillCategory } from '../compile/typeset'
import { LEXICON } from '../jd/lexicon'

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
const NOT_SKILL = new Set([
  'shipped', 'deployment', 'deployed', 'win', 'hackathon', 'national', 'scholarship', 'leadership', 'organizing',
  'education', 'cse', 'thapar', 'game', 'agentic-ai', 'volunteer', 'social', 'mentorship', 'analytics', 'ai',
  'ml', 'llm', 'fallback', 'degradation', 'narrative', 'agent', 'serverless',
])

/** Known skill display forms for canonical lexicon/tag keys the ledger speaks. */
const DISPLAY: Record<string, string> = {
  'tool-use': 'Tool use / function calling',
  'prompt-engineering': 'Prompt engineering',
  embeddings: 'Embeddings & vector search',
  'fine-tuning': 'Fine-tuning',
  orchestration: 'Agent orchestration',
  agents: 'Agentic systems',
  llm: 'LLMs',
  rag: 'RAG',
  mcp: 'MCP',
  evals: 'Evals',
  guardrails: 'Guardrails',
}

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
const LEXICON_KEYS = new Set(LEXICON.map((l) => norm(l.canonical)))

function add(map: Map<string, DerivedSkill>, text: string, factId: string, category?: string, banned?: Set<string>) {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (!clean || clean.length > 40) return
  const key = norm(clean)
  if (!key || NOT_SKILL.has(clean.toLowerCase())) return
  if (banned && isBannedSkill(clean, banned)) return
  const existing = map.get(key)
  if (existing) {
    if (!existing.factIds.includes(factId)) existing.factIds.push(factId)
    return
  }
  // Near-duplicates merge into the earlier (hand-named) form: "Agentic AI" ⊃ "Agentic" ⊃ "Agentic systems".
  for (const [k, v] of map) {
    if (Math.min(k.length, key.length) >= 6 && (k.startsWith(key) || key.startsWith(k))) {
      if (!v.factIds.includes(factId)) v.factIds.push(factId)
      return
    }
  }
  map.set(key, { text: clean, key, factIds: [factId], category: categorizeSkill(clean, category) })
}

/**
 * The union of every skill the dossier proves. Order: skill entries first (his hand-curated
 * names win the display form), then project stacks, then keywords/tags.
 */
export function derivedSkills(ledger: LedgerEntry[]): DerivedSkill[] {
  const map = new Map<string, DerivedSkill>()
  const banned = bannedSkillKeys(ledger)
  const eligible = ledger.filter((e) => e.resumeEligible && e.tier === 'shipped')
  for (const e of eligible.filter((x) => x.kind === 'skill')) add(map, e.title.split('—')[0].trim(), e.id, e.category, banned)
  for (const e of eligible) {
    for (const s of e.context?.stack ?? []) add(map, s.replace(/\s*\(.*\)$/, ''), e.id, undefined, banned)
  }
  // Tags/keywords are competencies in his own shorthand ("verification", "ci") — only the ones the
  // market's lexicon names become skills; the rest stay evidence for the matcher, never page text.
  for (const e of eligible) {
    for (const b of e.bullets) for (const k of b.keywords) if (LEXICON_KEYS.has(norm(k))) add(map, DISPLAY[k] ?? displayTech(k), e.id, undefined, banned)
    for (const t of e.tags) if (LEXICON_KEYS.has(norm(t))) add(map, DISPLAY[t] ?? displayTech(t), e.id, undefined, banned)
  }
  return [...map.values()]
}

/** Find a derived skill by any surface form of a JD term ("langgraph", "LangGraph", "lang graph"). */
export function findSkill(skills: DerivedSkill[], term: string): DerivedSkill | undefined {
  const k = norm(term)
  if (!k) return undefined
  return skills.find((s) => s.key === k) ?? skills.find((s) => s.key.includes(k) || k.includes(s.key))
}
