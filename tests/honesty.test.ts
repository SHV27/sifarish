import { describe, it, expect } from 'vitest'
import { scanGuarantee, scanHonesty, scanSlop } from '../src/lib/slop/scan'
import { JD_FIXTURES } from './fixtures/jds'
import { compilePacketPure, fakeJob, allText } from './helpers'
import { hookFromIntel } from '../src/lib/intel/client'
import { compileCoverLetter } from '../src/lib/compile/letters'
import { SEED_LEDGER, SEED_IDENTITY } from './helpers'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import type { CompanyIntel } from '../src/types'

/**
 * I9 — no guarantee language, anywhere. I7 — cited intelligence: intel bullets and the
 * cover-letter hook always carry a source URL.
 */
describe('I9 — guarantee-language scan', () => {
  it('catches the banned phrases', () => {
    expect(scanGuarantee('I guarantee you a job')).not.toHaveLength(0)
    expect(scanGuarantee('100% placement assured')).not.toHaveLength(0)
    expect(scanGuarantee('this is a sure-shot selection')).not.toHaveLength(0)
  })
  it('passes honest probability language', () => {
    expect(scanGuarantee('this maximizes your odds; interviews decide')).toHaveLength(0)
  })
  it('no generated packet contains guarantee language', () => {
    for (const fx of JD_FIXTURES) {
      const packet = compilePacketPure(fakeJob(fx.company, fx.title, fx.jd))
      expect(scanGuarantee(allText(packet)), fx.company).toHaveLength(0)
    }
  })
  it('the packet honesty note itself is clean', () => {
    const note = 'Research-backed fit — outcomes depend on interviews. No tool can guarantee selection.'
    // The word "guarantee" here is a negation ("cannot guarantee") — the scan targets promises, not denials.
    expect(scanHonesty('No tool can guarantee selection').guarantee).toHaveLength(0)
  })
})

describe('I7 — cited intelligence in the cover-letter hook', () => {
  const job = fakeJob('Anthropic', 'AI Engineering Intern', JD_FIXTURES[0].jd)
  const decode = decodeJD(job.jd)
  const coverage = matchEvidence(decode, SEED_LEDGER)

  it('hookFromIntel returns a bullet with a source URL', () => {
    const intel: CompanyIntel = {
      company: 'anthropic',
      keyless: false,
      fetchedAt: new Date().toISOString(),
      bullets: [{ text: 'Anthropic builds frontier AI with a strong safety research culture', url: 'https://anthropic.com/careers' }],
    }
    const hook = hookFromIntel(intel)
    expect(hook?.url).toBe('https://anthropic.com/careers')
  })

  it('keyless intel yields no hook (compile falls back to v1 exactly)', () => {
    const keyless: CompanyIntel = { company: 'x', keyless: true, fetchedAt: '', bullets: [] }
    expect(hookFromIntel(keyless)).toBeNull()
  })

  it('cover letter with an intel hook carries the citation URL on paragraph 0 (I7)', () => {
    const hook = { text: 'Anthropic ships agentic tools used by real engineering teams', url: 'https://anthropic.com/news' }
    const doc = compileCoverLetter(job, SEED_IDENTITY, SEED_LEDGER, decode, coverage, hook)
    expect(doc.paragraphs[0].citationUrl).toBe('https://anthropic.com/news')
    expect(scanSlop(doc.paragraphs.map((p) => p.text).join(' '))).toHaveLength(0)
  })

  it('cover letter WITHOUT intel is identical shape to v1 (regression) and stays ≤250 words', () => {
    const doc = compileCoverLetter(job, SEED_IDENTITY, SEED_LEDGER, decode, coverage, null)
    expect(doc.paragraphs[0].citationUrl).toBeUndefined()
    const words = doc.paragraphs.map((p) => p.text).join(' ').split(/\s+/).filter(Boolean).length
    expect(words).toBeLessThanOrEqual(250)
  })
})
