import { LEXICON } from '../jd/lexicon'

/**
 * Fact-drift guard (I1 applied to the LLM). Polish may improve flow; it may NOT add
 * facts, numbers, or skills. The guard is deterministic and runs on BOTH sides (server
 * pre-instruction + client re-check), so a hallucinating model can never smuggle a claim
 * onto the resume.
 *
 * Precision matters: the invariant forbids new FACTS, NUMBERS, and SKILLS — not new
 * connective/descriptive words. A blunt token-diff would reject honest rephrasing
 * ("co-op" → "cooperative"). So we flag exactly three fact-bearing categories:
 *   1. new numbers / money / percentages (always drift),
 *   2. new known technology/skill terms (from the JD lexicon vocabulary),
 *   3. new proper nouns (capitalized mid-sentence) and acronyms (RAG, LLM, API…).
 */

/** Technology/skill vocabulary drawn from the JD lexicon — the "skills" a polish must not invent. */
const TECH_VOCAB: Set<string> = (() => {
  const set = new Set<string>()
  for (const e of LEXICON) {
    set.add(e.canonical.replace(/[^a-z0-9]/g, ''))
    for (const p of e.patterns) {
      const w = p.trim()
      if (w && !w.includes(' ')) set.add(w.replace(/[^a-z0-9]/g, ''))
    }
  }
  set.delete('')
  return set
})()

const normWord = (w: string) => w.toLowerCase().replace(/[^a-z0-9₹$€£]/g, '')

/** Numbers, %, ₹/$ figures — the facts most dangerous to invent. */
export function extractNumbers(text: string): string[] {
  return (text.match(/[₹$€£]?\d[\d,.%]*\s?(?:k|lpa|cr|crore|lakh|%|x)?/gi) ?? []).map((s) =>
    s.trim().toLowerCase().replace(/\s+/g, ''),
  )
}

/** Content tokens (lowercased, meaningful) — used to describe originals, not to gate. */
export function contentTokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9₹$€£]+/g) ?? []).filter((w) => w.length > 2))
}

export interface DriftResult {
  ok: boolean
  addedFacts: string[]
  addedNumbers: string[]
}

export function detectDrift(original: string, polished: string): DriftResult {
  const origNums = new Set(extractNumbers(original))
  const addedNumbers = extractNumbers(polished).filter((n) => !origNums.has(n))

  const origWords = new Set(original.toLowerCase().match(/[a-z0-9₹$€£]+/g) ?? [])
  const addedFacts: string[] = []
  const words = polished.split(/\s+/)

  words.forEach((raw, i) => {
    const w = raw.replace(/^[^A-Za-z0-9₹$€£]+|[^A-Za-z0-9]+$/g, '')
    if (!w) return
    const lower = w.toLowerCase()
    const norm = normWord(w)
    if (origWords.has(lower) || origWords.has(norm)) return // already a fact in the original

    // (2) a known technology/skill term the original never claimed
    if (norm.length > 1 && TECH_VOCAB.has(norm)) {
      addedFacts.push(lower)
      return
    }
    // (3a) an all-caps acronym (RAG, LLM, API, ASR…)
    if (/^[A-Z]{2,6}$/.test(w)) {
      addedFacts.push(w)
      return
    }
    // (3b) a proper noun: capitalized, mid-sentence (not after a full stop)
    const prev = (words[i - 1] ?? '').trim()
    const sentenceStart = i === 0 || /[.!?:]$/.test(prev)
    if (!sentenceStart && /^[A-Z][a-zA-Z][a-zA-Z]+$/.test(w)) {
      addedFacts.push(w)
    }
  })

  return { ok: addedNumbers.length === 0 && addedFacts.length === 0, addedFacts, addedNumbers }
}

/** Apply polish only if it survives the guard; otherwise keep the compiled truth. */
export function safePolish(original: string, polished: string): { text: string; accepted: boolean; drift: DriftResult } {
  const drift = detectDrift(original, polished)
  return { text: drift.ok ? polished : original, accepted: drift.ok, drift }
}
