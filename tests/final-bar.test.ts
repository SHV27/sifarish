import { describe, expect, it } from 'vitest'
import { deriveHunts } from '../src/lib/vision/derive'
import { voiceClause, buildSummaryLine } from '../src/lib/darzi/summary'
import { roleFamilyPart } from '../src/lib/radar/score'
import { applyVerdict } from '../src/lib/cockpit/verdict'
import { validateGlobalOp, type AgentContext } from '../src/lib/agent/ops'
import { parseGlobal } from '../src/lib/agent/parse'
import { DEFAULT_VISION } from '../src/db/seed'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { SEED_IDENTITY, SEED_LEDGER } from './helpers'
import type { Job } from '../src/types'

/**
 * FINAL-BAR gates (30-Aug-2026) — the owner's acceptance message, pinned as tests:
 * heart-vision drives hunts/ranking/headline; the worth-it verdict judges; the chat sets vision.
 */

const job = (over: Partial<Job>): Job => ({
  id: 'j', source: 'jsearch', company: 'X', title: 'AI Engineer', location: 'Remote', url: 'https://x',
  jd: '', fetchedAt: new Date().toISOString(), status: 'found', ...over,
})

describe('search parity with his LinkedIn stream', () => {
  const hunts = deriveHunts(DEFAULT_VISION)
  const queries = hunts.map((h) => h.query.toLowerCase())
  it('every role family he named is hunted by its market name', () => {
    for (const q of ['agentic ai engineer', 'ai agent engineer', 'applied ai engineer', 'llm systems engineer', 'generative ai engineer', 'forward deployed engineer', 'ai solutions engineer']) {
      expect(queries.some((x) => x.includes(q)), q).toBe(true)
    }
  })
  it('city-scoped India hub hunts exist (Bengaluru + Delhi NCR), plus India and remote variants', () => {
    expect(queries.some((x) => x.includes('bengaluru'))).toBe(true)
    expect(queries.some((x) => x.includes('delhi ncr'))).toBe(true)
    expect(queries.some((x) => x.includes('india'))).toBe(true)
    expect(queries.some((x) => x.includes('remote'))).toBe(true)
  })
})

describe('the headline carries HIS voice', () => {
  it('voiceClause mines his own self-definition from the dream', () => {
    expect(voiceClause(DEFAULT_VISION.dream)).toBe('finds the real problem and ships the thing that solves it')
    expect(voiceClause('Break into AI by building real tools that solve public problems — ship fast.')).toBe('builds real tools that solve public problems')
    expect(voiceClause('Some vision without a mineable clause?')).toBeNull()
    expect(voiceClause(undefined)).toBeNull()
  })
  it('the compiled summary line uses the voice + shipped-count proof and keeps I1 links', () => {
    const decode = decodeJD('agents rag evals python')
    const coverage = matchEvidence(decode, SEED_LEDGER)
    const line = buildSummaryLine({ identity: SEED_IDENTITY, vision: DEFAULT_VISION, ledger: SEED_LEDGER, decode, coverage })!
    expect(line.text).toContain('finds the real problem and ships the thing that solves it')
    expect(line.ledgerIds.length).toBeGreaterThan(0)
    expect(line.text.length).toBeLessThan(260)
  })
})

describe('his not-my-heart families rank down, with the reason said plainly', () => {
  it('data engineering + pure SDE titles demote; his named roles never do', () => {
    expect(roleFamilyPart(job({ title: 'Data Engineer' }), DEFAULT_VISION)?.points).toBeLessThan(0)
    expect(roleFamilyPart(job({ title: 'SDE II' }), DEFAULT_VISION)?.points).toBeLessThan(0)
    expect(roleFamilyPart(job({ title: 'Research Scientist' }), DEFAULT_VISION)?.points).toBeLessThan(0)
    expect(roleFamilyPart(job({ title: 'Agentic AI Engineer' }), DEFAULT_VISION)).toBeNull()
    expect(roleFamilyPart(job({ title: 'Forward Deployed Engineer' }), DEFAULT_VISION)).toBeNull()
    const why = roleFamilyPart(job({ title: 'Data Engineer' }), DEFAULT_VISION)!.why
    expect(why).toContain('your vision')
  })
})

describe('the worth-it verdict (two-sided)', () => {
  const greenPre = [{ id: 'work-auth', label: 'Work authorization', status: 'green', why: 'x' }] as never
  it('strong vision + coverage + clean pre-flight → apply', () => {
    const v = applyVerdict({
      score: { total: 82, parts: [{ key: 'visionFit', label: 'Vision fit', points: 20, max: 24, why: 'title matches your target role' }] },
      coverage: { matched: [{ keyword: 'rag', mustHave: true, ledgerIds: ['a'] }], missing: [], building: [] } as never,
      preflight: greenPre,
    })
    expect(v.call).toBe('apply')
    expect(v.reasons.join(' ')).toContain('YOUR kind of role')
  })
  it('red pre-flight or off-vision + thin coverage → skip, with plain reasons', () => {
    const v = applyVerdict({
      score: { total: 35, parts: [{ key: 'visionFit', label: 'Vision fit', points: -18, max: 24, why: 'hits "sql" from your not-interested list' }] },
      coverage: { matched: [], missing: [{ keyword: 'kubernetes', mustHave: true }], building: [] } as never,
      preflight: [{ id: 'work-auth', label: 'Work authorization', status: 'red', why: 'US citizens only' }] as never,
    })
    expect(v.call).toBe('skip')
    expect(v.reasons.join(' ')).toContain('US citizens only')
  })
  it('never uses guarantee language (I9)', () => {
    const v = applyVerdict({ score: { total: 90, parts: [] }, coverage: { matched: [], missing: [], building: [] } as never, preflight: greenPre })
    expect(/guarantee|assured|100%/i.test(v.headline + v.reasons.join(' '))).toBe(false)
  })
})

describe('"my vision is …" through the chat', () => {
  const ctx: AgentContext = { hunts: [], jobs: [], vision: DEFAULT_VISION }
  it('parses, proposes, and validates', () => {
    const p = parseGlobal('My vision is to sit close to real problems and direct AI to build the things that solve them, shipping production agent systems.', ctx)!
    expect(p.proposals[0].op.kind).toBe('vision-set-dream')
    expect(parseGlobal('add LLM systems engineer Europe to the radar', ctx)?.proposals[0].op).toMatchObject({ kind: 'add-hunt' })
  })
  it('registry rejects a trivial dream', () => {
    expect(validateGlobalOp({ kind: 'vision-set-dream', dream: 'be great' }, ctx)).toBeNull()
  })
})
