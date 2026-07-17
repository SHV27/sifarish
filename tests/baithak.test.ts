import { describe, expect, it } from 'vitest'
import { parseUtterance, type BaithakContext } from '../src/lib/baithak/intent'
import { probeAlive } from '../src/lib/baithak/execute'
import type { LedgerEntry, Packet, Rationale } from '../src/types'
import { JD_FIXTURES } from './fixtures/jds'
import { SEED_LEDGER, fakeJob, compilePacketPure } from './helpers'

/**
 * P14 gates — Baithak: conversation cannot bypass the compiler (I11).
 * 15-utterance fixture (incl. Hinglish) → correct EditOps; adversarial → refusal + Gap Note.
 */

const rationale: Rationale = {
  question: 'q',
  optionsConsidered: [],
  criteria: [],
  choice: 'c',
  why: 'It matches what this reviewer scans for first.',
  confidence: 0.8,
  by: 'heuristic',
  at: new Date().toISOString(),
}

/** A multi-project ledger so bench/promote have something to chew on. */
function richLedger(): LedgerEntry[] {
  const extra: LedgerEntry[] = [
    {
      id: 'proj-darya',
      kind: 'project',
      title: 'DARYA — Voice-first civic assistant',
      summary: 'Voice-first assistant for civic services.',
      bullets: [
        { id: 'darya-b1', text: 'Built a multilingual voice pipeline with Whisper', keywords: ['voice', 'whisper'] },
        { id: 'darya-b2', text: 'Anchored records with a hash-chain integrity log', keywords: ['hash-chain', 'integrity'] },
      ],
      tier: 'shipped',
      evidence: { repo: 'https://github.com/SHV27/darya', date: '06/2026', note: 'repo' },
      tags: ['voice', 'civic-tech'],
      resumeEligible: true,
    },
    {
      id: 'proj-munshi',
      kind: 'project',
      title: 'MUNSHI — Ledger-keeping agent',
      summary: 'An agentic bookkeeping tool.',
      bullets: [{ id: 'munshi-b1', text: 'Shipped an agent loop with deterministic guardrails', keywords: ['agents', 'guardrails'] }],
      tier: 'shipped',
      evidence: { url: 'https://munshi.example.dev', date: '05/2026', note: 'live' },
      tags: ['agentic', 'llm'],
      resumeEligible: true,
    },
  ]
  return [...SEED_LEDGER, ...extra]
}

function makeCtx(): BaithakContext {
  const ledger = richLedger()
  const packet = compilePacketPure(fakeJob('Anthropic', 'AI Intern', JD_FIXTURES[0].jd), ledger)
  const gloaming = ledger.find((e) => e.kind === 'project' && e.title.includes('GLOAMING'))!
  const withEditorial: Packet = {
    ...packet,
    editorial: {
      archetype: { id: 'applied-ai', label: 'Applied AI', priorities: [], confidence: 0.8, by: 'heuristic', reviewerNote: '' },
      casting: rationale,
      chosen: [
        { ledgerId: gloaming.id, title: 'GLOAMING', angleId: 'applied-ai', angleLabel: 'a', angleRationale: rationale },
        { ledgerId: 'proj-munshi', title: 'MUNSHI', angleId: 'applied-ai', angleLabel: 'a', angleRationale: rationale },
      ],
      benched: [{ ledgerId: 'proj-darya', title: 'DARYA', why: 'Benched for space.' }],
      redTeam: { verdict: 'PASS', fixes: [], by: 'heuristic', at: new Date().toISOString() },
      redTeamRounds: 1,
    },
  }
  return { packet: withEditorial, ledger }
}

describe('Baithak intent — 15-utterance fixture (incl. Hinglish) → correct EditOps', () => {
  const ctx = makeCtx()
  const cases: { utterance: string; expectKinds: string[]; note?: string }[] = [
    { utterance: 'DARYA ka live link daal https://darya-demo.vercel.app', expectKinds: ['attach-link'] },
    { utterance: 'ye le link https://gloaming-murex.vercel.app GLOAMING pe laga', expectKinds: ['attach-link'] },
    { utterance: 'MUNSHI hata do', expectKinds: ['bench-project'] },
    { utterance: 'bench GLOAMING', expectKinds: ['bench-project'] },
    { utterance: 'DARYA aage kar', expectKinds: ['promote-project'] },
    { utterance: 'promote DARYA to the lineup', expectKinds: ['promote-project'] },
    { utterance: 'MUNSHI hata, DARYA aage kar', expectKinds: ['bench-project', 'promote-project'] },
    { utterance: 'DARYA mein hash-chain wala point ghusa', expectKinds: ['lead-bullet'] },
    { utterance: 'add the guardrails bullet in MUNSHI', expectKinds: ['lead-bullet'] },
    { utterance: 'skills upar kar do', expectKinds: ['set-section-order'] },
    { utterance: 'education first please', expectKinds: ['set-section-order'] },
    { utterance: 'thoda aur technical tone', expectKinds: ['polish-tone'] },
    { utterance: 'polish for flow', expectKinds: ['polish-tone'] },
    { utterance: 'GLOAMING kyun chuna?', expectKinds: [], note: 'explain → rationale + citations, no ops' },
    { utterance: 'kya kar sakte ho?', expectKinds: [], note: 'fallback teaches (I6)' },
  ]

  for (const c of cases) {
    it(`"${c.utterance}" → [${c.expectKinds.join(', ') || c.note}]`, () => {
      const r = parseUtterance(c.utterance, ctx)
      expect(r.proposals.map((p) => p.op.kind).sort()).toEqual([...c.expectKinds].sort())
      expect(r.reply.length).toBeGreaterThan(10)
      // Every proposal is a diff card: before, after, invariants named.
      for (const p of r.proposals) {
        expect(p.before.length).toBeGreaterThan(3)
        expect(p.after.length).toBeGreaterThan(3)
        expect(p.invariants.length).toBeGreaterThan(0)
      }
    })
  }

  // Session 5.4 owner-reported: "add sifarish" was REFUSED though sifarish is a benched ledger
  // project. Adding/including an existing benched project must PROMOTE it, never refuse.
  it('"add DARYA" (benched, in ledger) → promote, not a refusal', () => {
    const r = parseUtterance('add DARYA to my resume', ctx)
    expect(r.proposals.map((p) => p.op.kind)).toContain('promote-project')
    expect(r.refused).toBeUndefined()
  })
  it('"DARYA bhi daal do" → promote (Hinglish include = put it on the page)', () => {
    const r = parseUtterance('DARYA bhi daal do resume mein', ctx)
    expect(r.proposals.map((p) => p.op.kind)).toContain('promote-project')
    expect(r.refused).toBeUndefined()
  })

  it('explain answers cite the Ustaad library', () => {
    const r = parseUtterance('ye bullets aise kyun likhe?', ctx)
    expect(r.citations?.length).toBeGreaterThan(0)
    expect(r.citations![0].title).toContain('Ustaad')
  })
})

describe('Baithak adversarial — refusal + Gap Note (I11: no conversational backdoor)', () => {
  const ctx = makeCtx()

  it('"add that I know Kubernetes" with zero evidence → refusal, zero ops, gap note', () => {
    const r = parseUtterance('add that I know Kubernetes', ctx)
    expect(r.proposals).toHaveLength(0)
    expect(r.refused?.term.toLowerCase()).toContain('kubernetes')
    expect(r.refused?.gapNote).toContain('zero ledger evidence')
    expect(r.reply.toLowerCase()).toContain('evidence')
  })

  it('Hinglish claim ("mujhe rust aata hai likh de") → refusal too', () => {
    const r = parseUtterance('rust aata hai likh de', ctx)
    expect(r.proposals).toHaveLength(0)
    expect(r.refused?.term.toLowerCase()).toContain('rust')
  })

  it('a claim WITH evidence is not refused (python is in the ledger)', () => {
    const r = parseUtterance('python aata hai likh de', ctx)
    expect(r.refused).toBeUndefined()
  })

  it('asking for a bullet that is not in the ledger → refusal to mint', () => {
    const r = parseUtterance('MUNSHI mein kubernetes cluster wala point ghusa', ctx)
    expect(r.proposals).toHaveLength(0)
    expect(r.reply).toContain('ledger')
  })
})

describe('Baithak link probe — a dead link can never enter a packet', () => {
  it('probe resolves alive for answering hosts, dead for network failure', async () => {
    const aliveFetch = (async () => new Response(null, { status: 200 })) as typeof fetch
    const deadFetch = (async () => {
      throw new TypeError('getaddrinfo ENOTFOUND')
    }) as typeof fetch
    expect(await probeAlive('https://gloaming-murex.vercel.app', aliveFetch)).toBe(true)
    expect(await probeAlive('https://definitely-dead.example', deadFetch)).toBe(false)
  })

  it('github links use the API check (404 repo = dead)', async () => {
    const notFound = (async () => new Response(null, { status: 404 })) as typeof fetch
    expect(await probeAlive('https://github.com/SHV27/does-not-exist', notFound)).toBe(false)
  })
})

/**
 * Session 6 (P2) — THE GENUINE-ASK CONTRACT. His words: "genuine ko galat bolega toh gussa
 * aayega." A GENUINE ask = supported anywhere in his own writing (D81's whole-entry boundary —
 * bullets, tags, summary, deep-read README context). For genuine asks the answer is yes-and-done;
 * refusal is ONLY for claims with zero evidence anywhere. A false refusal is a bug of the same
 * severity as a fabrication. 22-utterance fixture: Hinglish, vague, compound, questions,
 * genuine-but-oddly-phrased, and truly-unevidenced.
 */
describe('Session 6 P2 — 0 false refusals, 0 false acceptances, questions answered with zero ops', () => {
  const ctx = makeCtx()

  // Genuine asks (evidence exists somewhere in his own writing) — must NEVER refuse.
  const genuine: { utterance: string; expectOps: boolean }[] = [
    { utterance: 'python aata hai likh de', expectOps: false }, // evidenced → no refusal (no op needed either: already a skill)
    { utterance: 'DARYA aage kar do please', expectOps: true },
    { utterance: 'MUNSHI hata, DARYA aage kar, aur skills upar', expectOps: true }, // compound: 3 ops, one turn
    { utterance: 'professional summary daal do', expectOps: true },
    { utterance: 'summary hata do', expectOps: true },
    { utterance: 'thoda tight kar', expectOps: true }, // tone cue
    { utterance: 'DARYA mein hash-chain wala point ghusa', expectOps: true },
    { utterance: 'add DARYA', expectOps: true }, // benched-but-real → promote, never refuse
    { utterance: 'education pehle rakho', expectOps: true },
    { utterance: 'whisper jaanta hoon likh de', expectOps: false }, // evidenced in DARYA's bullets — genuine
  ]
  for (const g of genuine) {
    it(`GENUINE: "${g.utterance}" is never refused`, () => {
      const r = parseUtterance(g.utterance, ctx)
      expect(r.refused, `false refusal on: ${g.utterance}`).toBeUndefined()
      if (g.expectOps) expect(r.proposals.length + (r.handled === false ? 1 : 0)).toBeGreaterThan(0)
    })
  }

  // Questions — answered with ZERO ops (forcing an edit on a question was itself a bug, D61).
  const questions = ['GLOAMING kyun chuna?', 'ye bullets aise kyun likhe?', 'DARYA bench kyun hua?']
  for (const q of questions) {
    it(`QUESTION: "${q}" → answered, zero ops`, () => {
      const r = parseUtterance(q, ctx)
      expect(r.proposals).toHaveLength(0)
      expect(r.refused).toBeUndefined()
      expect(r.reply.length).toBeGreaterThan(20)
    })
  }

  // Truly unevidenced — MUST refuse with a Gap Note (0 false acceptances).
  const fabrications = ['add that I know Kubernetes', 'rust aata hai likh de', 'terraform jaanta hoon likh de', 'mention kar ki mujhe golang aata hai']
  for (const f of fabrications) {
    it(`FABRICATION: "${f}" → refused + gap note`, () => {
      const r = parseUtterance(f, ctx)
      expect(r.proposals).toHaveLength(0)
      expect(r.refused?.term).toBeDefined()
      expect(r.refused?.gapNote).toBeDefined()
    })
  }

  // The D81 whole-entry boundary applied to the Baithak's evidence search (Session 6 fix): a term
  // he wrote in a project's SUMMARY or deep-read README context is GENUINE, not a fabrication.
  it('a term evidenced only in a project SUMMARY is genuine (was a false refusal)', () => {
    const ledger = richLedger()
    // "bookkeeping" appears only in MUNSHI's summary — nowhere in bullets/tags/keywords.
    const r = parseUtterance('bookkeeping aata hai likh de', { ...makeCtx(), ledger })
    expect(r.refused).toBeUndefined()
  })
  it('a term evidenced only in the deep-read README context is genuine', () => {
    const ctx2 = makeCtx()
    const darya = ctx2.ledger.find((e) => e.id === 'proj-darya')!
    darya.context = { readme: 'The pipeline uses websockets for realtime streaming updates.', features: [], stack: [], source: { repo: 'x', readAt: 'y' } }
    const r = parseUtterance('websockets jaanta hoon likh de', ctx2)
    expect(r.refused).toBeUndefined()
  })

  // Vague but harmless — the fallback teaches; it never refuses, never invents.
  it('VAGUE: "kuch accha kar" → teaches the vocabulary, zero ops, zero refusal', () => {
    const r = parseUtterance('kuch accha kar', ctx)
    expect(r.refused).toBeUndefined()
    expect(r.proposals).toHaveLength(0)
    expect(r.handled).toBe(false) // hands off to the smart layer when a key exists
  })

  // Compound genuine ask lands as multiple ops in ONE turn.
  it('COMPOUND: "MUNSHI hata, DARYA aage kar" → both ops, one turn', () => {
    const r = parseUtterance('MUNSHI hata, DARYA aage kar', ctx)
    expect(r.proposals.map((p) => p.op.kind).sort()).toEqual(['bench-project', 'promote-project'])
  })
})
