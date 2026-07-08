import type { Rationale, VisionProfile } from '../../types'
import { ARCHETYPES } from '../darzi/archetypes'
import { decide } from '../dimaag/core'

/**
 * VISION ENGINE (P12). The hunt derives from the dream. On a vision edit, Dimaag derives
 * suggested hunt queries + role archetypes, each with a rationale (I10) and each human-confirmed
 * (Nabz pattern, forever). Deterministic core (so the derivation gate is reliable) + Dimaag polish.
 */

export interface DerivedHunt {
  query: string
  why: string
  remoteOnly: boolean
}

/** Keyphrase → canonical hunt queries. Encodes the market's role vocabulary. */
const PHRASE_RULES: { test: RegExp; queries: string[] }[] = [
  { test: /agent|agentic/i, queries: ['agent engineer', 'agentic AI intern'] },
  { test: /architect|solution|forward.?deployed|deploy/i, queries: ['AI solutions engineer', 'forward deployed engineer'] },
  { test: /applied|real.?world|real problem|ship|product/i, queries: ['applied AI intern'] },
  { test: /claude|anthropic|llm|language model/i, queries: ['Claude Code engineer', 'LLM engineer intern'] },
  { test: /research|paper|novel|model/i, queries: ['AI research intern'] },
  { test: /voice|speech|multimodal/i, queries: ['voice AI engineer intern'] },
  { test: /infra|platform|serving|deployment|mlops/i, queries: ['ML platform intern'] },
]

export function deriveHunts(vision: VisionProfile): DerivedHunt[] {
  const haystack = `${vision.dream} ${vision.targetRoles.join(' ')}`.toLowerCase()
  const seen = new Set<string>()
  const hunts: DerivedHunt[] = []

  for (const rule of PHRASE_RULES) {
    if (!rule.test.test(haystack)) continue
    for (const q of rule.queries) {
      if (seen.has(q.toLowerCase())) continue
      seen.add(q.toLowerCase())
      hunts.push({
        query: q,
        why: `Your vision mentions "${(haystack.match(rule.test) ?? [''])[0]}" — this role type is the market's name for that work.`,
        remoteOnly: vision.remoteInternational,
      })
    }
  }

  // Always include the explicit target roles the user named.
  for (const r of vision.targetRoles) {
    const q = r.toLowerCase()
    if (seen.has(q)) continue
    seen.add(q)
    hunts.push({ query: r, why: 'You named this target role directly in your Vision Profile.', remoteOnly: vision.remoteInternational })
  }

  return hunts
}

/** Derived role archetypes (from the library) that best match the vision. */
export function deriveArchetypes(vision: VisionProfile): { id: string; label: string; why: string }[] {
  const hay = `${vision.dream} ${vision.targetRoles.join(' ')}`.toLowerCase()
  return ARCHETYPES.map((a) => {
    const hits = a.cues.filter((c) => hay.includes(c.replace(/-/g, ' ')) || hay.includes(c))
    return { a, score: hits.length }
  })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map((x) => ({ id: x.a.id, label: x.a.label, why: `Matches ${x.score} cue(s) in your vision (${x.a.priorities[0]}).` }))
}

/**
 * The reasoned derivation — a single decide() over "which hunt queries best serve this vision",
 * with the deterministic derivation as the fallback ranking. Human confirms each hunt.
 */
export async function reasonedDerivation(vision: VisionProfile): Promise<{ hunts: DerivedHunt[]; rationale: Rationale }> {
  const hunts = deriveHunts(vision)
  const options = hunts.map((h, i) => ({ id: String(i), label: h.query, detail: h.why }))
  const rationale = await decide({
    feature: 'vision.derive',
    question: 'Given this candidate\'s dream and constraints, which hunt queries should lead the search?',
    options,
    criteria: ['matches the stated dream', 'is a real market role name', 'fits the internship window + remote constraint'],
    context: `Dream: ${vision.dream}. Target roles: ${vision.targetRoles.join(', ')}. Not interested: ${vision.notInterested.join(', ')}.`,
    heuristic: () => ({
      choice: options[0]?.id ?? '0',
      ranking: options.map((o) => o.id),
      why: 'Derived deterministically from the vision keyphrases mapped to the market\'s role vocabulary.',
      confidence: 0.6,
    }),
  })
  return { hunts, rationale }
}
