import type { LedgerEntry } from '../types'

/**
 * Resume strength — moves ONLY when truth moves (a promotion or a new shipped entry).
 * Weighted share of resume-eligible ledger weight that is shipped.
 */
const KIND_WEIGHT: Record<LedgerEntry['kind'], number> = {
  project: 3,
  skill: 2,
  certification: 1,
  achievement: 1,
  position: 1,
  education: 1,
}

export function resumeStrength(entries: LedgerEntry[]): { pct: number; shipped: number; total: number } {
  const eligible = entries.filter((e) => e.resumeEligible)
  let got = 0
  let max = 0
  for (const e of eligible) {
    const w = KIND_WEIGHT[e.kind]
    max += w
    if (e.tier === 'shipped') got += w
  }
  return {
    pct: max === 0 ? 0 : Math.round((got / max) * 100),
    shipped: eligible.filter((e) => e.tier === 'shipped').length,
    total: eligible.length,
  }
}
