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

/**
 * Keyphrase → canonical hunt queries. Encodes the market's role vocabulary — expanded (D85) so the
 * net catches roles from far more corners than the original 7 rules. Each matched theme adds the
 * exact query strings a job board indexes on, which is how "kone kone se" coverage actually happens.
 */
const PHRASE_RULES: { test: RegExp; queries: string[] }[] = [
  { test: /agent|agentic|tool.?use|orchestrat/i, queries: ['AI agent engineer', 'agentic AI engineer', 'agent engineer intern'] },
  { test: /architect|solution|forward.?deployed|deploy|customer/i, queries: ['AI solutions engineer', 'forward deployed engineer', 'solutions engineer AI'] },
  { test: /applied|real.?world|real problem|ship|product/i, queries: ['applied AI engineer', 'applied scientist intern', 'AI product engineer'] },
  { test: /claude|anthropic|openai|gpt|llm|language model|generative|gen.?ai/i, queries: ['LLM engineer', 'generative AI engineer', 'GenAI engineer intern'] },
  { test: /rag|retrieval|search|knowledge|vector|embedding/i, queries: ['RAG engineer', 'AI search engineer', 'retrieval engineer'] },
  { test: /eval|guardrail|safety|alignment|trust|reliab/i, queries: ['AI evaluation engineer', 'LLM evals engineer', 'trustworthy AI intern'] },
  { test: /research|paper|novel|model|foundation|pretrain|fine.?tun/i, queries: ['AI research intern', 'ML research engineer', 'research scientist intern'] },
  { test: /voice|speech|asr|audio/i, queries: ['voice AI engineer', 'speech ML engineer'] },
  { test: /multimodal|vision|image|video|cv|perception/i, queries: ['multimodal AI engineer', 'computer vision engineer intern'] },
  { test: /nlp|text|conversational|chatbot|dialog/i, queries: ['NLP engineer', 'conversational AI engineer'] },
  { test: /infra|platform|serving|deployment|mlops|inference|scale/i, queries: ['ML platform engineer', 'ML infrastructure engineer', 'MLOps engineer intern'] },
  { test: /data|pipeline|feature|analytics/i, queries: ['machine learning engineer', 'ML data engineer'] },
  { test: /recommend|ranking|personaliz|ads/i, queries: ['ML engineer recommendations', 'ranking ML engineer'] },
  { test: /ml|machine learning|deep learning|neural/i, queries: ['machine learning engineer', 'ML engineer intern', 'deep learning engineer'] },
  { test: /ai engineer|ai intern|artificial intelligence/i, queries: ['AI engineer', 'AI engineer intern', 'artificial intelligence engineer'] },
]

/** Location/remote variants — how a board actually segments the same role. */
function withLocationVariants(query: string, vision: VisionProfile): string[] {
  const out = [query]
  if (vision.remoteInternational) out.push(`${query} remote`)
  out.push(`${query} India`)
  return out
}

export function deriveHunts(vision: VisionProfile): DerivedHunt[] {
  const haystack = `${vision.dream} ${vision.targetRoles.join(' ')}`.toLowerCase()
  const seen = new Set<string>()
  const hunts: DerivedHunt[] = []
  const add = (query: string, why: string) => {
    const q = query.trim()
    if (!q || seen.has(q.toLowerCase())) return
    seen.add(q.toLowerCase())
    hunts.push({ query: q, why, remoteOnly: vision.remoteInternational })
  }

  // The explicit target roles he named come first, each with a remote/India variant.
  for (const r of vision.targetRoles) {
    for (const v of withLocationVariants(r, vision)) {
      add(v, `You named "${r}" as a target role — this is the query a job board indexes on.`)
    }
  }

  // Theme-derived queries: every AI-role corner his vision implies.
  for (const rule of PHRASE_RULES) {
    if (!rule.test.test(haystack)) continue
    const theme = (haystack.match(rule.test) ?? [''])[0]
    for (const q of rule.queries) {
      add(q, `Your vision mentions "${theme}" — this role type is a market name for that work.`)
    }
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
