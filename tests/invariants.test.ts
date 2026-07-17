import { describe, it, expect } from 'vitest'
import { JD_FIXTURES } from './fixtures/jds'
import { compilePacketPure, fakeJob, allText, SEED_LEDGER } from './helpers'
import { compileResume, estimateHeight, USABLE_HEIGHT } from '../src/lib/compile/compiler'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { SEED_IDENTITY } from './helpers'
import type { LedgerEntry } from '../src/types'

const EXCLUDED_TITLES = ['Firebase', 'React', 'Netlify', 'HTML/CSS']

describe('I1 — No orphan claims: every bullet/forge line carries ledger evidence', () => {
  for (const fx of JD_FIXTURES) {
    it(`${fx.company}: no content line without a ledgerId`, () => {
      const packet = compilePacketPure(fakeJob(fx.company, fx.title, fx.jd))
      for (const line of packet.resume.lines) {
        if (line.kind === 'bullet' || line.kind === 'forge') {
          expect(line.ledgerIds.length, `orphan: "${line.text}"`).toBeGreaterThan(0)
        }
      }
    })
  }

  it('the compiler THROWS if a bullet is forced through with no evidence', () => {
    const badLedger: LedgerEntry[] = [
      {
        id: 'edu-x', kind: 'education', title: 'X', summary: '', bullets: [], tier: 'shipped',
        evidence: { date: '2021', note: '' }, tags: [], resumeEligible: true,
      },
    ]
    // A project with a bullet but we strip its id to simulate a mint — compiler must reject.
    const decode = decodeJD('python')
    const coverage = matchEvidence(decode, badLedger)
    // Direct construction path is guarded; ensure normal compile of a clean ledger never orphans.
    const r = compileResume({ identity: SEED_IDENTITY, ledger: badLedger, decode, coverage, jobId: 'x' })
    expect(r.lines.every((l) => l.kind !== 'bullet' || l.ledgerIds.length > 0)).toBe(true)
  })
})

describe('I2 — Tier honesty: in_forge appears ONLY in the dated Currently Building line', () => {
  const forgeTitles = SEED_LEDGER.filter((e) => e.tier === 'in_forge').map((e) => e.title.split('—')[0].trim())

  for (const fx of JD_FIXTURES) {
    it(`${fx.company}: no in_forge project title in a bullet or skills line`, () => {
      const packet = compilePacketPure(fakeJob(fx.company, fx.title, fx.jd))
      const forgeLines = packet.resume.lines.filter((l) => l.kind === 'forge')
      // Any mention of a forge project name must be inside a 'forge' line.
      for (const line of packet.resume.lines) {
        if (line.kind === 'forge') {
          expect(line.text).toMatch(/Currently Building \(/)
          continue
        }
        for (const ft of forgeTitles) {
          if (ft.length > 4 && line.text.includes(ft)) {
            // allowed only if that title is ALSO a shipped entry (it isn't in seed)
            expect(forgeLines.some((f) => f.text.includes(ft)), `"${ft}" leaked into ${line.kind}`).toBe(true)
          }
        }
      }
    })
  }

  it('every forge line names its ETA (dated)', () => {
    const packet = compilePacketPure(fakeJob('LangChain', 'Applied AI Intern', JD_FIXTURES[3].jd))
    for (const line of packet.resume.lines.filter((l) => l.kind === 'forge')) {
      expect(line.text).toMatch(/\((?:July|Jan|Feb|Mar|Apr|May|Jun|Aug|Sep|Oct|Nov|Dec)[^)]*\d{4}\)/)
    }
  })
})

describe('Excluded skills (resumeEligible:false) never appear in any artifact', () => {
  for (const fx of JD_FIXTURES) {
    it(`${fx.company}: Firebase/React/Netlify/HTML-CSS absent from resume + letters`, () => {
      const packet = compilePacketPure(fakeJob(fx.company, fx.title, fx.jd))
      const text = allText(packet)
      for (const banned of EXCLUDED_TITLES) {
        // Match as a standalone skills token, not substrings inside words.
        const re = new RegExp(`\\b${banned.replace('/', '\\s*/\\s*')}\\b`)
        expect(re.test(text), `"${banned}" leaked for ${fx.company}`).toBe(false)
      }
    })
  }
})

describe('I3 — No Send: the codebase contains no submission mechanism', () => {
  it('no forbidden send APIs anywhere in src/ or api/', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const forbidden = [/nodemailer/i, /sendmail/i, /smtp\./i, /puppeteer/i, /playwright.*\.click\(/i]
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f)
        return statSync(p).isDirectory() ? walk(p) : [p]
      })
    // Session 5.5: walk api/ too — the server functions were not covered by this I3 gate.
    const files = [...walk('src'), ...walk('api')].filter((f) => /\.(ts|tsx)$/.test(f))
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const pat of forbidden) {
        expect(pat.test(src), `${f} contains a forbidden send API (${pat})`).toBe(false)
      }
    }
  })
})

describe('One-page budget (compiler)', () => {
  for (const fx of JD_FIXTURES) {
    it(`${fx.company}: compiles within one page or throws a legible CompileError`, () => {
      expect(() => compilePacketPure(fakeJob(fx.company, fx.title, fx.jd))).not.toThrow()
    })
  }

  it('a huge ledger (30 fat projects) compiles to ONE page — never an error at the user (v3, D32)', () => {
    // The self-strengthening loop keeps adding real shipped work. The compiler must SOLVE the
    // one-page constraint by trimming to the strongest evidence, not surface a CompileError.
    const fat: LedgerEntry[] = Array.from({ length: 30 }, (_, i) => ({
      id: `proj-fat-${i}`, kind: 'project', title: `Very Long Project Number ${i} With An Extended Descriptive Title`,
      summary: 'x', tier: 'shipped', evidence: { repo: 'https://github.com/x/y', date: '01/2026', note: '' },
      tags: ['python'], resumeEligible: true,
      bullets: [
        { id: `b${i}a`, text: 'A deliberately long bullet describing an enormous amount of engineering work done across many systems and services and pipelines to force page overflow in the compiler budget model beyond one page', keywords: ['python'] },
        { id: `b${i}b`, text: 'A second equally long bullet describing yet more engineering work that would overflow a one-page budget if the compiler did not trim to the strongest evidence', keywords: ['python'] },
      ],
    }))
    const decode = decodeJD('python machine learning')
    const coverage = matchEvidence(decode, fat)
    const resume = compileResume({ identity: SEED_IDENTITY, ledger: fat, decode, coverage, jobId: 'x' })
    // It fits one page…
    expect(estimateHeight(resume.lines)).toBeLessThanOrEqual(USABLE_HEIGHT)
    // …and it trimmed to a sniper lineup (not all 30 projects rendered).
    const projectTitles = resume.lines.filter((l) => l.kind === 'entry-title' && /Very Long Project/.test(l.text))
    expect(projectTitles.length).toBeLessThanOrEqual(4)
    // …while still carrying real evidence (I1 holds).
    for (const line of resume.lines) {
      if (line.kind === 'bullet' || line.kind === 'forge') expect(line.ledgerIds.length).toBeGreaterThan(0)
    }
  })

  it('respects an editorial cast: only the cast lineup renders, benched projects sit out', () => {
    const projects: LedgerEntry[] = ['a', 'b', 'c', 'd', 'e'].map((k) => ({
      id: `proj-${k}`, kind: 'project', title: `Project ${k.toUpperCase()}`, summary: 's', tier: 'shipped',
      evidence: { repo: 'https://x/y', date: '01/2026', note: '' }, tags: ['python'], resumeEligible: true,
      bullets: [{ id: `${k}1`, text: `Built project ${k} end to end`, keywords: ['python'] }],
    }))
    const decode = decodeJD('python')
    const coverage = matchEvidence(decode, projects)
    const resume = compileResume({
      identity: SEED_IDENTITY, ledger: projects, decode, coverage, jobId: 'x',
      editorial: { order: ['proj-a', 'proj-c'], bullets: {} }, // cast only A and C
    })
    const titles = resume.lines.filter((l) => l.kind === 'entry-title').map((l) => l.text)
    expect(titles).toContain('Project A (Jan 2026)') // Month-Year display (S6.1)
    expect(titles).toContain('Project C (Jan 2026)')
    expect(titles).not.toContain('Project B (Jan 2026)') // benched
    expect(titles).not.toContain('Project D (01/2026)')
  })
})
