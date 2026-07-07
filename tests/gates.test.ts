import { describe, it, expect } from 'vitest'
import { JD_FIXTURES } from './fixtures/jds'
import { compilePacketPure, fakeJob, allText, SEED_LEDGER, SEED_VOICE } from './helpers'
import { scanSlop } from '../src/lib/slop/scan'
import { decodeJD } from '../src/lib/jd/decode'
import { detectDrift, safePolish } from '../src/lib/polish/factGuard'

describe('Gate — JD coverage: must-haves with evidence appear; without evidence never do', () => {
  for (const fx of JD_FIXTURES) {
    it(`${fx.company}: expected must-haves are decoded`, () => {
      const decode = decodeJD(fx.jd)
      for (const kw of fx.expectMustHave) {
        expect(decode.mustHave, `${kw} not decoded as must-have`).toContain(kw)
      }
    })

    it(`${fx.company}: >=80% of evidence-backed must-haves land on the resume; zero unbacked keywords`, () => {
      const packet = compilePacketPure(fakeJob(fx.company, fx.title, fx.jd))
      const text = allText(packet).toLowerCase()

      const backed = packet.coverage.matched.filter((m) => m.mustHave)
      if (backed.length > 0) {
        const present = backed.filter((m) => text.includes(m.keyword.replace(/-/g, ' ')) || text.includes(m.keyword))
        expect(present.length / backed.length).toBeGreaterThanOrEqual(0.8)
      }

      // No keyword WITHOUT evidence may appear as a claimed skill line.
      const skillsLine = packet.resume.lines.find((l) => l.kind === 'skills')?.text.toLowerCase() ?? ''
      for (const miss of packet.coverage.missing) {
        expect(skillsLine.includes(miss.keyword), `unbacked "${miss.keyword}" in skills`).toBe(false)
      }
    })
  }
})

describe('Gate — Slop scan: zero banned phrases in any generated artifact', () => {
  for (const fx of JD_FIXTURES) {
    it(`${fx.company}: resume + cover + outreach are slop-free`, () => {
      const packet = compilePacketPure(fakeJob(fx.company, fx.title, fx.jd))
      const hits = scanSlop(allText(packet))
      expect(hits, `slop: ${hits.join(', ')}`).toHaveLength(0)
    })
  }
})

describe('Gate — Cover letter <=250 words, outreach <=120 words', () => {
  const count = (s: string) => s.split(/\s+/).filter(Boolean).length
  for (const fx of JD_FIXTURES) {
    it(`${fx.company}: length ceilings hold`, () => {
      const packet = compilePacketPure(fakeJob(fx.company, fx.title, fx.jd))
      const cover = packet.coverLetter.paragraphs.map((p) => p.text).join(' ')
      const outreach = packet.outreach.paragraphs.map((p) => p.text).join(' ')
      expect(count(cover), 'cover letter too long').toBeLessThanOrEqual(250)
      expect(count(outreach), 'outreach too long').toBeLessThanOrEqual(120)
    })
  }
})

describe('Gate — Fact-drift guard rejects invented facts/numbers', () => {
  it('passes an honest rephrase', () => {
    const orig = 'Built a browser co-op board game with an AI narrator and a hand-authored fallback'
    const nice = 'Built a browser-based cooperative board game featuring an AI narrator with a hand-authored fallback'
    expect(safePolish(orig, nice).accepted).toBe(true)
  })

  it('rejects an invented number', () => {
    const orig = 'Built a voice agent for welfare eligibility'
    const lie = 'Built a voice agent for welfare eligibility serving 10,000 users'
    const d = detectDrift(orig, lie)
    expect(d.ok).toBe(false)
    expect(d.addedNumbers).toContain('10,000')
  })

  it('rejects an invented skill/tool', () => {
    const orig = 'Built a flood intelligence pipeline in Python'
    const lie = 'Built a flood intelligence pipeline in Python and Kubernetes'
    expect(detectDrift(orig, lie).ok).toBe(false)
  })

  it('safePolish keeps compiled text when drift detected', () => {
    const orig = 'Shipped a game to Vercel'
    const lie = 'Shipped a game to Vercel with 99.9% uptime'
    expect(safePolish(orig, lie).text).toBe(orig)
  })
})

describe('Voice Bank is real and non-slop', () => {
  it('samples exist and are themselves slop-free', () => {
    expect(SEED_VOICE.samples.length).toBeGreaterThanOrEqual(4)
    expect(scanSlop(SEED_VOICE.samples.join('\n'))).toHaveLength(0)
  })
})

describe('Ledger integrity of the seed', () => {
  it('shipped entries have evidence; in_forge entries have an ETA', () => {
    for (const e of SEED_LEDGER) {
      if (e.tier === 'shipped') expect(e.evidence, `${e.id} shipped without evidence`).toBeTruthy()
      if (e.tier === 'in_forge') expect(e.forgeEta, `${e.id} in_forge without ETA`).toBeTruthy()
    }
  })

  it('core fields are non-null', () => {
    for (const e of SEED_LEDGER) {
      expect(e.id).toBeTruthy()
      expect(e.title).toBeTruthy()
      expect(e.kind).toBeTruthy()
      expect(Array.isArray(e.tags)).toBe(true)
    }
  })
})
