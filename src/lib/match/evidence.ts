import type { CoverageReport, JDDecode, KeywordHit, LedgerEntry } from '../../types'

/**
 * Stage 2: map JD keywords to ledger evidence. Keywords without evidence NEVER enter
 * the resume (I1) — they feed the Gap Note. Keywords whose only evidence is in_forge
 * may appear ONLY in the Currently Building line (I2).
 */

function entriesForKeyword(keyword: string, entries: LedgerEntry[]): LedgerEntry[] {
  return entries.filter(
    (e) =>
      e.resumeEligible &&
      (e.tags.includes(keyword) || e.bullets.some((b) => b.keywords.includes(keyword))),
  )
}

export function matchEvidence(decode: JDDecode, ledger: LedgerEntry[]): CoverageReport {
  const matched: KeywordHit[] = []
  const building: KeywordHit[] = []
  const missing: KeywordHit[] = []

  const classify = (keyword: string, mustHave: boolean) => {
    const hits = entriesForKeyword(keyword, ledger)
    const shipped = hits.filter((e) => e.tier === 'shipped')
    const forge = hits.filter((e) => e.tier === 'in_forge')
    if (shipped.length > 0) matched.push({ keyword, mustHave, ledgerIds: shipped.map((e) => e.id) })
    else if (forge.length > 0) building.push({ keyword, mustHave, ledgerIds: forge.map((e) => e.id) })
    else missing.push({ keyword, mustHave, ledgerIds: [] })
  }

  for (const kw of decode.mustHave) classify(kw, true)
  for (const kw of decode.niceToHave) classify(kw, false)
  return { matched, building, missing }
}

/** A must-have's weight: its JD prominence (Session 5.5) when known, else the historic flat +2. */
function mustWeight(kw: string, decode: JDDecode): number {
  return decode.mustHaveWeights?.[kw] ?? 2
}

/** Per-entry JD relevance, used to rank projects and order skills. Must-haves weighted by prominence. */
export function entryRelevance(entry: LedgerEntry, decode: JDDecode): number {
  const kws = new Set([...entry.tags, ...entry.bullets.flatMap((b) => b.keywords)])
  let score = 0
  for (const kw of decode.mustHave) if (kws.has(kw)) score += mustWeight(kw, decode)
  for (const kw of decode.niceToHave) if (kws.has(kw)) score += 1
  return score
}

/** Relevance of a single bullet — for choosing which 2–3 bullets of a project make the cut. */
export function bulletRelevance(keywords: string[], decode: JDDecode): number {
  let score = 0
  for (const kw of decode.mustHave) if (keywords.includes(kw)) score += mustWeight(kw, decode)
  for (const kw of decode.niceToHave) if (keywords.includes(kw)) score += 1
  return score
}
