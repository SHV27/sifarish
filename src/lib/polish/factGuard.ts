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

export interface DriftResult {
  ok: boolean
  addedFacts: string[]
  addedNumbers: string[]
}

/**
 * An all-caps acronym is a legitimate re-expression (not an invention) when the source spells it
 * out — "RAG" for "retrieval-augmented generation", "MCP" for "model context protocol". So before
 * flagging an acronym as drift, check whether consecutive source words' initials spell it. This is
 * exact and safe: an acronym literally derivable from the author's own words is his fact, not a new
 * one. (Session 5.6 — the forge's good AI bullets were being nuked over acronyms the README itself
 * defined by expansion, forcing a fallback to raw feature-doc README lines.)
 */
function acronymDerivable(acr: string, sourceWords: string[]): boolean {
  const letters = acr.toLowerCase().split('')
  for (let i = 0; i + letters.length <= sourceWords.length; i++) {
    let match = true
    for (let j = 0; j < letters.length; j++) {
      if ((sourceWords[i + j]?.[0] ?? '') !== letters[j]) {
        match = false
        break
      }
    }
    if (match) return true
  }
  return false
}

export function detectDrift(original: string, polished: string): DriftResult {
  const origNums = new Set(extractNumbers(original))
  const addedNumbers = extractNumbers(polished).filter((n) => !origNums.has(n))

  const origWordList = original.toLowerCase().match(/[a-z0-9₹$€£]+/g) ?? []
  const origWords = new Set(origWordList)
  const addedFacts: string[] = []
  const words = polished.split(/\s+/)

  words.forEach((raw, i) => {
    const w = raw.replace(/^[^A-Za-z0-9₹$€£]+|[^A-Za-z0-9]+$/g, '')
    if (!w) return
    const lower = w.toLowerCase()
    const norm = normWord(w)
    if (origWords.has(lower) || origWords.has(norm)) return // already a fact in the original

    // An acronym the author spelled out by EXPANSION is his own fact, not an invention (RAG ⟵
    // retrieval-augmented generation, MCP ⟵ model context protocol). Accept it BEFORE the tech-term
    // check below — otherwise a lexicon acronym like RAG/MCP is flagged even when the README defines it.
    if (/^[A-Z]{2,6}$/.test(w) && acronymDerivable(w, origWordList)) return

    // (2) a known technology/skill term the original never claimed
    if (norm.length > 1 && TECH_VOCAB.has(norm)) {
      addedFacts.push(lower)
      return
    }
    // (3a) an all-caps acronym (RAG, LLM, API, ASR…) the source does NOT spell out → an added fact
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
