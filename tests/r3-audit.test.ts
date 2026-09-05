import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { compileResume, pageTwoWeight } from '../src/lib/compile/compiler'
import { buildDigest } from '../src/lib/strategist/digest'
import { criticHeuristic } from '../src/lib/strategist/critic'
import { readPostingHeuristic } from '../src/lib/strategist/reading'
import { planHeuristic } from '../src/lib/strategist/plan'
import { etaClause, composeLetter } from '../src/lib/atelier/letter'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { SEED_LEDGER, SEED_IDENTITY, fakeJob } from './helpers'
import type { LedgerEntry } from '../src/types'

/**
 * v2 R3 — the fresh-context hunter's findings, each with its gate (studio-verify: findings are
 * never optional). Two-sided wherever a guard exists.
 */
const JD = 'We do not care about: LeetCode · certificates · corporate vocabulary. We care enormously about: logical reasoning · personal agency. Python, React, FastAPI.'

// Five genuinely different bullets — near-duplicates are (rightly) deduped by the compiler.
const DISTINCT = [
  'Designed the ingestion pipeline that turns raw uploads into typed records, validated against 1,200 real files with a 38% drop in manual corrections',
  'Wrote the evaluation harness comparing three retrieval strategies on 400 held-out questions, and kept the one that answered 91% correctly',
  'Cut cold-start latency from 6.2 s to 900 ms by moving model loading behind a warm cache and measuring every release on real devices',
  'Documented the failure modes found in production — 14 of them, each with the input that triggers it — so the next engineer inherits a map, not a mess',
  'Ran the rollout to 300 daily users over nine weeks with zero data loss, owning the outage plan, the backups and the apology template that was never sent',
]

function richLedger(): LedgerEntry[] {
  // Every project carries 5 long bullets and ten more achievements play, so one page cannot hold
  // the richest variant even at the tightest spacing.
  const extra: LedgerEntry[] = Array.from({ length: 10 }, (_, i) => ({
    ...(SEED_LEDGER.find((e) => e.kind === 'achievement') as LedgerEntry),
    id: `ach-extra-${i}`,
    title: `Winner ${i + 1} — a national-level build competition judged on shipped systems and measured outcomes`,
    summary: `Won against ${40 + i} teams with a working system demonstrated live to a panel of engineers and founders`,
    bullets: [],
  }))
  return [...extra, ...SEED_LEDGER].map((e) =>
    e.kind === 'project'
      ? {
          ...e,
          bullets: DISTINCT.map((text, i) => ({ id: `${e.id}-b${i}`, text: `${text} (${e.id.slice(-4)})`, keywords: ['python'], ledgerIds: [e.id] })),
        }
      : e,
  ) as LedgerEntry[]
}

describe('the page-solver under two-ok (hunter #1)', () => {
  it('a full two-pager beats a starved one-pager; page 2 carries real weight', () => {
    const ledger = richLedger()
    const reading = readPostingHeuristic(JD, 'Acme', 'AI Engineer Intern')
    const plan = planHeuristic(reading, ledger, SEED_IDENTITY)
    const decode = decodeJD(JD)
    const coverage = matchEvidence(decode, ledger)
    const two = compileResume({ identity: SEED_IDENTITY, ledger, decode, coverage, jobId: 'j', plan, pagePolicy: 'two-ok', summaryOn: true })
    const one = compileResume({ identity: SEED_IDENTITY, ledger, decode, coverage, jobId: 'j', plan, pagePolicy: 'one', summaryOn: true })
    const bulletsOf = (r: typeof two) => r.lines.filter((l) => l.kind === 'bullet').length
    expect(one.pages).toBe(1)
    expect(two.pages).toBe(2)
    expect(bulletsOf(two)).toBeGreaterThan(bulletsOf(one)) // no kanjoosi
    expect(pageTwoWeight(two)).toBeGreaterThanOrEqual(0.25) // never an orphan second page
  })
})

describe('the smart lane can say every dossier op it advertises (hunter #2)', () => {
  it('the json_schema names text / factKind / sectionKind / entryId / field / value / hide / policy', () => {
    const src = readFileSync('src/lib/agent/smart.ts', 'utf8')
    const required = /required: \[([^\]]+)\]/.exec(src.slice(src.indexOf('ops: {')))?.[1] ?? ''
    for (const f of ['text', 'factKind', 'sectionKind', 'label', 'entryId', 'field', 'value', 'hide', 'policy', 'eligible']) expect(required, f).toContain(`'${f}'`)
  })
})

describe('the digest carries the README depth (hunter #3)', () => {
  it('problem + notable + prose reach the brain for a project with 5 bullets (not only thin ones)', () => {
    const ledger = richLedger().map((e) =>
      e.id === 'proj-gloaming' ? { ...e, context: { problem: 'Board games die when one player is the referee.', features: ['the board is the antagonist'], stack: ['Vite'], readme: 'GLOAMING is a co-op game where the board itself hunts the players.', source: { repo: 'x', readAt: 'now' } } } : e,
    )
    const d = buildDigest(ledger, SEED_IDENTITY)
    expect(d.text).toMatch(/problem \(his README\): Board games die/)
    expect(d.text).toMatch(/notable \(his README\): the board is the antagonist/)
    expect(d.text).toMatch(/readme prose: GLOAMING is a co-op game/)
  })
})

describe('the letter invents nothing (hunter #5, #6)', () => {
  it('etaClause: a future target is stated, a past one is dropped, garbage is passed through', () => {
    const now = new Date(2026, 8, 5)
    expect(etaClause('July 2026', now)).toBe('')
    expect(etaClause('November 2026', now)).toBe(' (target November 2026)')
    expect(etaClause('September 2026', now)).toBe(' (target September 2026)')
    expect(etaClause(undefined, now)).toBe('')
  })
  it('the signature never claims a GitHub ordinal', () => {
    const job = fakeJob('Acme', 'AI Engineer', JD)
    const decode = decodeJD(JD)
    const coverage = matchEvidence(decode, SEED_LEDGER)
    const letter = composeLetter({ job, identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, useSignature: true })
    expect(letter.paragraphs.map((p) => p.text).join(' ')).not.toMatch(/project #\d/)
  })
})

describe('the deterministic critic reads every "we do not care" (hunter #14)', () => {
  const reading = readPostingHeuristic(JD, 'Acme', 'Intern')
  const plan = planHeuristic(reading, SEED_LEDGER, SEED_IDENTITY)
  it('flags LeetCode-style lines in prime space when they dismissed LeetCode', () => {
    const page = 'Name\nline\nACHIEVEMENTS\n- Solved 400+ problems solved on LeetCode\n' + 'x'.repeat(100)
    expect(criticHeuristic(page, reading, plan).join(' ')).toMatch(/LeetCode-style lines sit in prime space/)
  })
  it('stays quiet when the page does not lead with what they dismissed', () => {
    const page = 'Name\nline\nACHIEVEMENTS\n- National NTSE Scholar (2021)\n' + 'x'.repeat(100)
    expect(criticHeuristic(page, reading, plan).join(' ')).not.toMatch(/prime space/)
  })
})
