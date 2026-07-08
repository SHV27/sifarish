/**
 * Letter uniqueness gate (Atelier, WS3). A letter that could be sent to two companies is a
 * FAILED letter. We measure word-trigram Jaccard similarity between letters (excluding the
 * fixed contact/greeting scaffold) and enforce a strict ceiling.
 */

const SIMILARITY_CEILING = 0.5 // > this = too generic / too templated

function trigrams(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '') // urls are boilerplate-ish
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const grams = new Set<string>()
  for (let i = 0; i < words.length - 2; i++) grams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
  return grams
}

export function similarity(a: string, b: string): number {
  const ga = trigrams(a)
  const gb = trigrams(b)
  if (ga.size === 0 || gb.size === 0) return 0
  let inter = 0
  for (const g of ga) if (gb.has(g)) inter += 1
  return inter / (ga.size + gb.size - inter) // Jaccard
}

/**
 * Strip the parts that are legitimately shared across every letter and are NOT the
 * "could be sent to another company" risk: the greeting shell, the standard ask + the dated
 * momentum line (his consistent voice), and the signature block. What remains is the
 * company-specific substance — the hook, the vision bridge, and the cast proofs — which is
 * exactly what must differ. (Same rationale as excluding the contact block.)
 */
export function letterBody(text: string): string {
  return text
    .split('\n')
    .filter((p) => {
      const t = p.trim().toLowerCase()
      if (!t) return false
      if (t.startsWith('p.s.')) return false // meta signature
      if (/i'd value fifteen minutes|value fifteen minutes|public at github/.test(t)) return false // the ask
      if (/honest about what's still in progress|building .* right now|internship window is january/.test(t)) return false // momentum
      return true
    })
    .join('\n')
    .replace(/^dear\s+[^\n—-]+[—-]?/i, '')
    .trim()
}

export interface UniquenessResult {
  ok: boolean
  maxSimilarity: number
  worstPair?: [number, number]
}

/** Check a set of letters pairwise; fail if any pair is too similar. */
export function checkUniqueness(letters: string[]): UniquenessResult {
  const bodies = letters.map(letterBody)
  let max = 0
  let worst: [number, number] | undefined
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const s = similarity(bodies[i], bodies[j])
      if (s > max) {
        max = s
        worst = [i, j]
      }
    }
  }
  return { ok: max <= SIMILARITY_CEILING, maxSimilarity: max, worstPair: worst }
}

export { SIMILARITY_CEILING }
