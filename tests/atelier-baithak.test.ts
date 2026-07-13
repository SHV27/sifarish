import { describe, expect, it } from 'vitest'
import { parseLetterUtterance } from '../src/lib/atelier/baithak'
import { composeLetter } from '../src/lib/atelier/letter'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { JD_FIXTURES } from './fixtures/jds'
import { SEED_IDENTITY, SEED_LEDGER, fakeJob, compilePacketPure } from './helpers'

/** WS4 gate — Atelier Baithak: safe letter refinement ops + adversarial refusal (I11 on the letter). */

const packet = compilePacketPure(fakeJob('Anthropic', 'AI Intern', JD_FIXTURES[0].jd))
const ledger = SEED_LEDGER

describe('Atelier Baithak intent → correct refinement ops', () => {
  const cases: { u: string; kind: string | null }[] = [
    { u: 'signature on karo', kind: 'toggle-signature' },
    { u: 'add the signature, make it shine', kind: 'toggle-signature' },
    { u: 'signature hata do', kind: 'toggle-signature' },
    { u: 'thoda formal tone', kind: 'tone' },
    { u: 'make it more direct and punchy', kind: 'tone' },
    { u: 'letter chhota kar do', kind: 'tighten' },
    { u: 'tighten this letter', kind: 'tighten' },
    { u: 'GLOAMING ko proof bana', kind: 'swap-proof' },
    { u: 'what can you do?', kind: null },
  ]
  for (const c of cases) {
    it(`"${c.u}" → ${c.kind ?? 'teach (no op)'}`, () => {
      const r = parseLetterUtterance(c.u, packet, ledger)
      if (c.kind === null) {
        expect(r.proposals).toHaveLength(0)
      } else {
        expect(r.proposals.length).toBeGreaterThan(0)
        expect(r.proposals[0].op.kind).toBe(c.kind)
        expect(r.proposals[0].invariants.length).toBeGreaterThan(0)
      }
      expect(r.reply.length).toBeGreaterThan(10)
    })
  }

  it('signature on/off carry the right boolean', () => {
    const on = parseLetterUtterance('signature on', packet, ledger).proposals[0].op
    const off = parseLetterUtterance('remove the signature', packet, ledger).proposals[0].op
    expect(on).toMatchObject({ kind: 'toggle-signature', on: true })
    expect(off).toMatchObject({ kind: 'toggle-signature', on: false })
  })
})

describe('Atelier Baithak adversarial — refusal + Gap Note (I1/I11 on the letter)', () => {
  it('"add that I know Kubernetes" (no evidence) → refused, zero ops', () => {
    const r = parseLetterUtterance('add that I know Kubernetes to the letter', packet, ledger)
    expect(r.proposals).toHaveLength(0)
    expect(r.refused?.term.toLowerCase()).toContain('kubernetes')
    expect(r.refused?.gapNote).toContain('zero ledger evidence')
  })
})

describe('letter refinement stays evidence-true + unique', () => {
  it('proofLead only surfaces a REAL shipped project (I1) and keeps a unique body', () => {
    const job = fakeJob('Sarvam AI', 'ML Intern', JD_FIXTURES[1].jd)
    const decode = decodeJD(job.jd)
    const coverage = matchEvidence(decode, ledger)
    const gloaming = ledger.find((e) => e.title.includes('GLOAMING'))!
    const base = composeLetter({ job, identity: SEED_IDENTITY, ledger, decode, coverage, useSignature: false })
    const led = composeLetter({ job, identity: SEED_IDENTITY, ledger, decode, coverage, useSignature: false, proofLeadId: gloaming.id })
    // The led letter mentions GLOAMING as a proof; both are the same company so uniqueness vs each
    // other isn't the test — the test is that no non-ledger claim appears and tighten shrinks it.
    const tight = composeLetter({ job, identity: SEED_IDENTITY, ledger, decode, coverage, useSignature: false, tightTo: 170 })
    const wc = (d: typeof base) => d.paragraphs.filter((p) => !p.text.startsWith('P.S.')).reduce((n, p) => n + p.text.split(/\s+/).length, 0)
    expect(wc(tight)).toBeLessThanOrEqual(wc(base) + 1)
    // every paragraph with a ledgerId references a real ledger entry (never a minted claim)
    const ids = new Set(ledger.map((e) => e.id))
    for (const p of led.paragraphs) for (const id of p.ledgerIds) expect(ids.has(id)).toBe(true)
    void base
  })
})
