import type { LedgerEntry } from '../types'

/**
 * Resume strength — moves ONLY when truth moves (a promotion or a new shipped entry).
 * Weighted share of resume-eligible ledger weight that is shipped.
 */
// v2: kinds are open (custom sections) — unknown kinds weigh like an achievement.
const KIND_WEIGHT: Record<string, number> = {
  project: 3,
  skill: 2,
  experience: 3,
  certification: 1,
  achievement: 1,
  position: 1,
  education: 1,
}
const weightOf = (e: LedgerEntry) => KIND_WEIGHT[e.kind] ?? 1

export function resumeStrength(entries: LedgerEntry[]): { pct: number; shipped: number; total: number } {
  const eligible = entries.filter((e) => e.resumeEligible)
  let got = 0
  let max = 0
  for (const e of eligible) {
    const w = weightOf(e)
    max += w
    if (e.tier === 'shipped') got += w
  }
  return {
    pct: max === 0 ? 0 : Math.round((got / max) * 100),
    shipped: eligible.filter((e) => e.tier === 'shipped').length,
    total: eligible.length,
  }
}
