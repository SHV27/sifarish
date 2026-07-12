import { describe, expect, it } from 'vitest'
import {
  getLibrary,
  isValidLibrary,
  patternsFor,
  citePatterns,
  guideFor,
  pathBriefs,
  sectionOrderFor,
  staleSources,
  startsStrong,
  startsWeak,
} from '../src/lib/ustaad/library'
import { estimateQuality } from '../src/lib/ustaad/quality'
import { compileResume } from '../src/lib/compile/compiler'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { JD_FIXTURES } from './fixtures/jds'
import { SEED_IDENTITY, SEED_LEDGER, fakeJob, compilePacketPure } from './helpers'

/** P13 gates — the Ustaad library and the Compile Quality estimator. */

describe('Ustaad library integrity (I13 — the library is data, cited and dated)', () => {
  const lib = getLibrary()

  it('carries ≥25 cited sources, all with URL + access date', () => {
    expect(lib.sources.length).toBeGreaterThanOrEqual(25)
    for (const s of lib.sources) {
      expect(s.url).toMatch(/^https?:\/\//)
      expect(s.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(s.title.length).toBeGreaterThan(5)
    }
  })

  it('every pattern is evidenced: rule + why + exemplar + resolvable sourceIds', () => {
    const ids = new Set(lib.sources.map((s) => s.id))
    expect(lib.patterns.length).toBeGreaterThanOrEqual(15)
    for (const p of lib.patterns) {
      expect(p.rule.length).toBeGreaterThan(20)
      expect(p.why.length).toBeGreaterThan(20)
      expect(p.exemplar.length).toBeGreaterThan(10)
      expect(p.sourceIds.length).toBeGreaterThan(0)
      for (const sid of p.sourceIds) expect(ids.has(sid)).toBe(true)
      expect(p.passes.length).toBeGreaterThan(0)
    }
  })

  it('archetype guides + path briefs are all cited too', () => {
    const ids = new Set(lib.sources.map((s) => s.id))
    expect(lib.archetypeGuides.length).toBeGreaterThanOrEqual(6)
    expect(lib.pathBriefs.length).toBeGreaterThanOrEqual(3)
    for (const g of [...lib.archetypeGuides, ...lib.pathBriefs]) {
      expect(g.sourceIds.length).toBeGreaterThan(0)
      for (const sid of g.sourceIds) expect(ids.has(sid)).toBe(true)
    }
  })

  it('honesty note disclaims any "selected-at-company-X" database', () => {
    expect(lib.honestyNote.toLowerCase()).toContain('no public database')
  })

  it('validates itself through the same gate Pulse updates must pass', () => {
    expect(isValidLibrary(lib)).toBe(true)
    expect(isValidLibrary({ ...lib, sources: lib.sources.slice(0, 5) })).toBe(false)
  })

  it('no source is stale today (fresh library) and staleness flags 13-month-old entries', () => {
    expect(staleSources(new Date(lib.updatedAt))).toHaveLength(0)
    const future = new Date(new Date(lib.updatedAt).getTime() + 400 * 86400000)
    expect(staleSources(future).length).toBe(lib.sources.length)
  })
})

describe('Ustaad consultation (patterns reach the passes)', () => {
  it('each Darzi pass has patterns to consult', () => {
    for (const pass of ['casting', 'surgery', 'redteam', 'estimator'] as const) {
      expect(patternsFor(pass).length).toBeGreaterThan(2)
    }
  })

  it('citePatterns returns Rationale-shaped receipts', () => {
    const cites = citePatterns(['xyz-formula', 'six-second-skim'], 3)
    expect(cites.length).toBeGreaterThan(0)
    for (const c of cites) {
      expect(c.title).toContain('Ustaad ¶')
      expect(c.url).toMatch(/^https?:\/\//)
    }
  })

  it('sectionOrderFor maps guides to compiler tokens, always complete', () => {
    for (const arch of ['applied-ai', 'agent-eng', 'research-intern', 'forward-deployed', 'ml-generalist', 'platform-infra']) {
      expect(guideFor(arch)).toBeDefined()
      const order = sectionOrderFor(arch)
      expect([...order].sort()).toEqual(['achievements', 'certs', 'education', 'forge', 'projects', 'skills'])
    }
    // research-intern leads with education; applied-ai leads with skills
    expect(sectionOrderFor('research-intern')[0]).toBe('education')
    expect(sectionOrderFor('applied-ai')[0]).toBe('skills')
    // unknown archetype → default order, never a crash
    expect(sectionOrderFor('nonsense')[0]).toBe('education')
  })

  it('path briefs cover the three hiring paths with concrete norms', () => {
    const briefs = pathBriefs()
    const ids = briefs.map((b) => b.id)
    expect(ids).toContain('ai-first-startup')
    expect(ids).toContain('research-lab')
    expect(ids).toContain('big-tech-internship')
    for (const b of briefs) {
      expect(b.referralWeight.length).toBeGreaterThan(20)
      expect(b.portfolioVsDsa.length).toBeGreaterThan(20)
      expect(b.conversionNorms.length).toBeGreaterThan(20)
    }
  })

  it('verb craft helpers agree with the library ladder', () => {
    expect(startsStrong('- Built a resume compiler with 100% parse-back fidelity')).toBe(true)
    expect(startsWeak('- Worked on a resume tool')).toBe('worked on')
    expect(startsWeak('- Shipped the thing')).toBeNull()
  })
})

describe('Compile Quality estimator (honest rubric, itemized remainders — never a guarantee)', () => {
  it('section order override is respected by the compiler', () => {
    const job = fakeJob('Anthropic', 'AI Engineering Intern', JD_FIXTURES[0].jd)
    const decode = decodeJD(job.jd)
    const coverage = matchEvidence(decode, SEED_LEDGER)
    const projects = SEED_LEDGER.filter((e) => e.resumeEligible && e.tier === 'shipped' && e.kind === 'project')
    const resume = compileResume({
      identity: SEED_IDENTITY,
      ledger: SEED_LEDGER,
      decode,
      coverage,
      jobId: job.id,
      editorial: {
        order: projects.map((p) => p.id),
        bullets: {},
        sectionOrder: ['skills', 'projects', 'forge', 'education', 'achievements', 'certs'],
      },
    })
    const headings = resume.lines.filter((l) => l.kind === 'heading').map((l) => l.text)
    expect(headings.indexOf('SKILLS')).toBeLessThan(headings.indexOf('EDUCATION'))
    expect(headings.indexOf('PROJECTS')).toBeLessThan(headings.indexOf('EDUCATION'))
  })

  it('golden packets score ≥90 with every missing point itemized as gap or choice', () => {
    for (const fx of JD_FIXTURES.filter((f) => f.strongFit)) {
      const packet = compilePacketPure(fakeJob(fx.company, fx.title, fx.jd))
      const q = estimateQuality(packet.resume, packet.coverage, SEED_LEDGER)
      expect(q.score).toBeGreaterThanOrEqual(90)
      expect(q.score).toBeLessThanOrEqual(100)
      // Every scoring item that lost points explains itself and is typed gap|choice.
      const missing = 100 - q.score
      const lostItems = q.items.filter((i) => i.points < i.max)
      if (missing > 0) {
        expect(lostItems.length).toBeGreaterThan(0)
        for (const i of lostItems) {
          expect(['gap', 'choice']).toContain(i.kind)
          expect(i.why.length).toBeGreaterThan(20)
        }
      }
      // Itemized points add up exactly — no hidden math (LAW: evidence is the interface).
      expect(q.items.reduce((n, i) => n + i.points, 0)).toBe(q.score)
    }
  })

  it('estimator carries pattern receipts (patternId on every scoring item)', () => {
    const packet = compilePacketPure(fakeJob('Anthropic', 'AI Intern', JD_FIXTURES[0].jd))
    const q = estimateQuality(packet.resume, packet.coverage, SEED_LEDGER)
    for (const i of q.items) expect(i.patternId).toBeTruthy()
  })

  it('punishes weak verbs and unquantified bullets (rubric is real, not flattery)', () => {
    const weakLedger = SEED_LEDGER.map((e) =>
      e.kind === 'project'
        ? {
            ...e,
            bullets: e.bullets.map((b) => ({ ...b, text: 'Worked on various things with no particular outcome', metrics: undefined })),
          }
        : e,
    )
    const job = fakeJob('Anthropic', 'AI Intern', JD_FIXTURES[0].jd)
    const decode = decodeJD(job.jd)
    const coverage = matchEvidence(decode, weakLedger)
    const resume = compileResume({ identity: SEED_IDENTITY, ledger: weakLedger, decode, coverage, jobId: job.id })
    const q = estimateQuality(resume, coverage, weakLedger)
    const golden = estimateQuality(compilePacketPure(job).resume, compilePacketPure(job).coverage, SEED_LEDGER)
    expect(q.score).toBeLessThan(golden.score)
    const verbItem = q.items.find((i) => i.patternId === 'verb-strength-ladder')
    expect(verbItem && verbItem.points).toBeLessThan(20)
  })
})
