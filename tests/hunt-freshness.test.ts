import { describe, expect, it } from 'vitest'
import { SEED_HUNTS } from '../src/lib/khabri/client'

/**
 * HUNT FRESHNESS (Session 5.4, D66) — "roz naye roles chahiye, LinkedIn jaise."
 *
 * Every seeded hunt asked the aggregator for `datePosted: 'month'`, so each sweep re-requested a
 * MONTH of postings — the same month-old listings returning day after day — while LinkedIn showed
 * him "1 hour ago". The market moved daily; the app asked monthly. That single word is why the
 * radar felt stale next to LinkedIn.
 */
describe('seeded hunts ask for a fresh window', () => {
  it('no seeded hunt requests a month-wide window any more', () => {
    const monthly = SEED_HUNTS.filter((h) => h.datePosted === 'month')
    expect(monthly, `these still ask for a month: ${monthly.map((h) => h.query).join(', ')}`).toHaveLength(0)
  })

  it('every seeded hunt asks for a week or tighter', () => {
    const fresh = new Set(['today', '3days', 'week'])
    for (const h of SEED_HUNTS) {
      expect(fresh.has(h.datePosted ?? ''), `"${h.query}" has window ${h.datePosted}`).toBe(true)
    }
  })

  it('the seed still carries real hunts (the fix must not have emptied them)', () => {
    expect(SEED_HUNTS.length).toBeGreaterThan(5)
    expect(SEED_HUNTS.some((h) => h.enabled)).toBe(true)
  })
})
