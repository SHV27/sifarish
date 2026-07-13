import { describe, expect, it } from 'vitest'
import { buildAlignmentMap } from '../src/lib/alignment'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { JD_FIXTURES } from './fixtures/jds'
import { SEED_LEDGER } from './helpers'

/** WS5 gate — Alignment Map: requirement→evidence, honest gaps, no invented coverage (I1/I7). */

function mapFor(jd: string) {
  const decode = decodeJD(jd)
  const coverage = matchEvidence(decode, SEED_LEDGER)
  return { decode, coverage, map: buildAlignmentMap(decode, coverage, SEED_LEDGER) }
}

describe('Alignment Map — honest requirement→evidence matching', () => {
  it('every must-have requirement appears as a row', () => {
    const { decode, map } = mapFor(JD_FIXTURES[0].jd)
    const mustRows = map.rows.filter((r) => r.tier === 'must').map((r) => r.requirement.replace(/ /g, '-'))
    for (const kw of decode.mustHave) expect(mustRows).toContain(kw)
  })

  it('a "met" row cites REAL ledger entries; a "gap" row cites none (no invented coverage)', () => {
    const { map } = mapFor(JD_FIXTURES[0].jd)
    const ids = new Set(SEED_LEDGER.map((e) => e.id))
    for (const r of map.rows) {
      if (r.status === 'met') {
        expect(r.metBy.length).toBeGreaterThan(0)
        for (const m of r.metBy) expect(ids.has(m.ledgerId)).toBe(true)
      }
      if (r.status === 'gap') {
        expect(r.metBy).toHaveLength(0)
        expect(r.building).toHaveLength(0)
      }
    }
  })

  it('the score is honest — exactly met-must / total-must, never inflated', () => {
    const { map } = mapFor(JD_FIXTURES[0].jd)
    const met = map.rows.filter((r) => r.tier === 'must' && r.status === 'met').length
    const total = map.rows.filter((r) => r.tier === 'must').length
    expect(map.metCount).toBe(met)
    expect(map.mustTotal).toBe(total)
    expect(map.score).toBeCloseTo(total === 0 ? 1 : met / total, 5)
  })

  it('gaps are collected and never contain a met requirement (they feed Taleem)', () => {
    const { map } = mapFor(JD_FIXTURES[0].jd)
    const metReqs = new Set(map.rows.filter((r) => r.status === 'met').map((r) => r.requirement))
    for (const g of map.gaps) expect(metReqs.has(g)).toBe(false)
  })

  it('a JD with no must-haves scores 1 without inventing anything', () => {
    const generic = mapFor('We want a great teammate who loves coffee and ping pong.')
    expect(generic.map.score).toBe(1)
    expect(generic.map.rows.every((r) => r.status !== 'met' || r.metBy.length > 0)).toBe(true)
  })
})
