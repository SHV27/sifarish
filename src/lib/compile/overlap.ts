/**
 * Session 7 (WS-R2) — bullet-level redundancy detection (¶blt-no-duplicated-fact).
 *
 * The owner's real résumé rendered two bullets making the same claim in different words —
 * and the selection path had NO similarity primitive at all (the only Jaccard in the repo
 * was letter-scoped). This is the shared, deterministic overlap measure the compiler's
 * selector and the Editor's Desk both use: stemmed content-word Jaccard, so morphological
 * variants (compile/compiled/compiles) count as the same word.
 */

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'so', 'that', 'this', 'these', 'those', 'with', 'without',
  'for', 'from', 'into', 'onto', 'over', 'under', 'of', 'in', 'on', 'at', 'to', 'by', 'as', 'is',
  'are', 'was', 'were', 'be', 'been', 'its', 'it', 'their', 'his', 'her', 'my', 'our', 'your',
  'every', 'each', 'any', 'all', 'no', 'not', 'never', 'always', 'can', 'could', 'will', 'would',
  'has', 'have', 'had', 'using', 'used', 'use', 'via', 'per', 'both', 'than', 'then', 'when',
  'where', 'which', 'who', 'whose', 'what', 'how', 'end', 'ensuring', 'ensure', 'ensures',
])

/** Light stemmer: strips common suffixes, then a trailing 'e', so morphological variants
 *  collide on one stem: compiled/compiles/compile→compil, pipelines/pipeline→pipelin,
 *  guaranteed/guarantee→guarante, features/feature→featur. */
export function stem(w: string): string {
  let s = w
  for (const suf of ['ations', 'ation', 'ingly', 'ings', 'ing', 'edly', 'ed', 's', 'ly']) {
    if (s.length - suf.length >= 4 && s.endsWith(suf)) {
      s = s.slice(0, -suf.length)
      break
    }
  }
  if (s.length > 4 && s.endsWith('e')) s = s.slice(0, -1)
  return s
}

export function contentStems(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9+#&\s-]/g, ' ')
    .split(/[\s/-]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
  return new Set(words.map(stem))
}

/**
 * Overlap in [0,1]: Jaccard over stemmed content words, biased toward the SHORTER bullet
 * (containment): a short bullet fully restating part of a longer one is redundancy even
 * when the longer one has extra words.
 */
export function bulletOverlap(a: string, b: string): number {
  const sa = contentStems(a)
  const sb = contentStems(b)
  if (sa.size === 0 || sb.size === 0) return 0
  let inter = 0
  for (const w of sa) if (sb.has(w)) inter += 1
  const jaccard = inter / (sa.size + sb.size - inter)
  const containment = inter / Math.min(sa.size, sb.size)
  return Math.max(jaccard, containment * 0.85)
}

/** A pair above this is the same claim wearing different words — never both on one page. */
export const HARD_DUPLICATE = 0.6
/** MMR redundancy weight: how strongly overlap with already-chosen bullets repels a candidate. */
export const REDUNDANCY_WEIGHT = 6

/**
 * Session 7.1 (owner-caught on his REAL résumé): two bullets can make the same claim with
 * near-ZERO shared words — "Implemented guardrails… reject uncited prose… provably accurate"
 * vs "…compiles verified role data… human-in-the-loop policy" share 2 stems yet both say
 * TRUTH-ENFORCEMENT. Lexical overlap is blind to that. So bullets also carry a THEME from a
 * deterministic concept lexicon; within one project, two bullets whose PRIMARY theme matches
 * are the same claim (¶blt-no-duplicated-fact) — the stronger one keeps the seat.
 */
// Themes are FINE-GRAINED on purpose: an AI-engineer résumé legitimately carries several
// LLM-adjacent bullets (a RAG pipeline, an agent orchestrator, an eval harness are three
// DIFFERENT accomplishments) — one broad "llm" bucket would kill honest breadth. A theme is
// only "the same claim" when it names the same KIND of work.
const CONCEPT_GROUPS: { id: string; re: RegExp }[] = [
  { id: 'truth', re: /\b(guardrails?|uncited|cited|verif\w+|unverif\w+|provabl\w+|evidence|ledger|honest\w*|truth\w*|hallucinat\w+|fabricat\w+|human.in.the.loop|drift|integrity)\b/gi },
  { id: 'export', re: /\b(pdf|docx|parse[- ]?back|round[- ]?trip|fidelity|typeset\w*|text layer)\b/gi },
  { id: 'deploy', re: /\b(shipp?ed|deploy\w*|vercel|live|production|serverless)\b/gi },
  { id: 'resilience', re: /\b(keyless|fallbacks?|offline|degrad\w+|rate[- ]?limit\w*|retry|retries|outages?)\b/gi },
  { id: 'rag', re: /\b(rag|retrieval|embeddings?|vector\w*|semantic search|augmented generation)\b/gi },
  { id: 'agents', re: /\b(agents?|agentic|orchestrat\w+|multi[- ]?agent|tool[- ]?use|mcp|langgraph|prompts?)\b/gi },
  { id: 'evals', re: /\b(evals?|benchmarks?|evaluation harness\w*|red[- ]?team\w*)\b/gi },
  { id: 'models', re: /\b(fine[- ]?tun\w+|lora|model routing|two[- ]?tier|gpt|claude|gemini|groq)\b/gi },
  { id: 'security', re: /\b(hmac|auth\w*|cookies?|passwords?|encrypt\w+|aes|tokens?|sessions?|constant[- ]?time)\b/gi },
  { id: 'perf', re: /\b(latency|bundle|cach\w+|throughput|fps|milliseconds|p9\d)\b/gi },
]

/** The dominant theme of a bullet, or null when no group scores ≥2 hits (too weak to trust). */
export function primaryConcept(text: string): string | null {
  let best: string | null = null
  let bestHits = 0
  for (const g of CONCEPT_GROUPS) {
    const hits = (text.match(g.re) ?? []).length
    if (hits > bestHits) {
      bestHits = hits
      best = g.id
    }
  }
  return bestHits >= 2 ? best : null
}

/**
 * Within-project comparison: lexical overlap, floored at HARD_DUPLICATE when both bullets'
 * primary theme matches — the semantic-twin case lexical Jaccard cannot see. Cross-project
 * comparisons stay lexical (two projects may honestly both have, say, a security bullet).
 */
export function bulletOverlapSameProject(a: string, b: string): number {
  const lex = bulletOverlap(a, b)
  const ca = primaryConcept(a)
  if (ca !== null && ca === primaryConcept(b)) return Math.max(lex, HARD_DUPLICATE)
  return lex
}
