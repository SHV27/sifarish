import type { LedgerEntry, Packet } from '../../types'
import { hasEvidence } from '../baithak/intent'

/**
 * ATELIER BAITHAK (Session 5) — talk to the cover letter. Extends I11 to the letter: an utterance
 * becomes a PROPOSED structured refinement op that recomposes the letter deterministically and
 * re-runs the fact-drift guard + uniqueness gate. Natural language never mints an unevidenced
 * claim — "add that I know Kubernetes" (no ledger evidence) is a refusal + Gap Note, by design.
 */

export type LetterOp =
  | { kind: 'swap-proof'; toLedgerId: string }
  | { kind: 'toggle-signature'; on: boolean }
  | { kind: 'tighten' }
  | { kind: 'tone'; tone: 'formal' | 'direct' }

export interface LetterProposal {
  id: string
  op: LetterOp
  before: string
  after: string
  invariants: string[]
}

export interface LetterParse {
  reply: string
  proposals: LetterProposal[]
  refused?: { term: string; gapNote: string }
}

let seq = 0
function prop(op: LetterOp, before: string, after: string, invariants: string[]): LetterProposal {
  return { id: `letter-${Date.now()}-${seq++}`, op, before, after, invariants }
}

const CUE = {
  signatureOn: /\b(signature|p\.?s\.?|meta.?hook)\b.*\b(on|add|daal|lagao|include|shine|dikhao)\b|\b(add|daal|include)\b.*\bsignature\b/i,
  signatureOff: /\b(signature|p\.?s\.?)\b.*\b(off|hata|remove|nikaal|drop)\b|\b(remove|hata)\b.*\bsignature\b/i,
  tighten: /\b(short|shorter|tight|tighten|concise|chhota|kam kar|trim|crisp)\b/i,
  formal: /\b(formal|professional|polished|serious)\b/i,
  direct: /\b(direct|casual|punchy|conversational|simple|plain)\b/i,
  swap: /\b(swap|replace|use|lead with|proof|badal|instead|feature)\b/i,
  claimAdd: /\b(add that i know|likh de|likh do|mention kar|write that i)\b|\b(jaanta|jaanti|aata|aati)\s+(hai|hoon|hu)\b/i,
}

const FAB_SKILLS = /\b(kubernetes|k8s|rust|golang|scala|terraform|hadoop|spark|tensorflow|c\+\+|\.net|php|salesforce)\b/i

// Session 7.2 (C4): the letter Baithak SHARES the résumé Baithak's evidence rule. Its private
// copy never got D136's widening (summary + deep-read README context), so a fact he wrote in his
// own README could still be refused as a fabrication HERE after being fixed THERE — the third
// copy of the same disease. One rule now (imported above); a fix reaches every surface.

const projName = (e: LedgerEntry) => e.title.split('—')[0].trim()

export function parseLetterUtterance(utterance: string, packet: Packet, ledger: LedgerEntry[]): LetterParse {
  const u = utterance.trim()
  const proofs = ledger.filter((e) => e.kind === 'project' && e.tier === 'shipped' && e.resumeEligible)
  const inLetter = new Set(packet.coverLetter.paragraphs.flatMap((p) => p.ledgerIds))

  // Adversarial claim → refusal (I1/I11)
  const fab = FAB_SKILLS.exec(u)
  if (CUE.claimAdd.test(u) && fab && !hasEvidence(fab[0], ledger)) {
    return {
      reply: `Nahi — "${fab[0]}" ka evidence tumhare ledger mein nahi hai, aur main letter mein bina saboot ek shabd nahi likhta (I1). Pehle usse ship karo; Nabz promote kar dega, phir woh sach ban ke letter mein aayega.`,
      proposals: [],
      refused: { term: fab[0], gapNote: `"${fab[0]}" requested in the letter but has zero ledger evidence — build it first.` },
    }
  }

  // Signature (his favourite)
  if (CUE.signatureOn.test(u)) {
    return { reply: 'Signature on kar deta hoon — woh P.S. jo batata hai ye letter tumne banaye agent se compile hua. AI-first teams ke liye ye initiative dikhata hai.', proposals: [prop({ kind: 'toggle-signature', on: true }, 'Letter without the Sifarish Signature', 'The Sifarish Signature P.S. added', ['I1 (fixed evidence-linked line)'])] }
  }
  if (CUE.signatureOff.test(u)) {
    return { reply: 'Signature hata deta hoon — evidence khud bolega.', proposals: [prop({ kind: 'toggle-signature', on: false }, 'Letter with the Signature', 'Signature removed', ['no claim touched'])] }
  }

  // Tone
  if (CUE.formal.test(u) || CUE.direct.test(u)) {
    const tone = CUE.formal.test(u) ? 'formal' : 'direct'
    return { reply: `Tone ${tone} kar deta hoon — phrasing only, har line fact-drift guard se dobara guzregi (koi naya fact nahi).`, proposals: [prop({ kind: 'tone', tone }, 'Current phrasing', `A guarded ${tone} rephrase (facts frozen)`, ['I1 fact-drift guard', 'slop-scan', 'uniqueness gate'])] }
  }

  // Tighten
  if (CUE.tighten.test(u)) {
    return { reply: 'Letter ko aur crisp kar deta hoon — sabse strong proof rakhta hoon, doosra hata deta hoon.', proposals: [prop({ kind: 'tighten' }, 'Two proof points', 'One strongest proof point (tighter letter)', ['I1', 'one honest ask'])] }
  }

  // Lead a named ledger project as the letter's proof point
  if (CUE.swap.test(u)) {
    const named = proofs.find((p) => u.toLowerCase().includes(projName(p).toLowerCase()))
    if (named) {
      const already = inLetter.has(named.id)
      return {
        reply: `${projName(named)} ko sabse pehle proof point bana deta hoon — ye ledger mein hai, isliye legal hai (I1).${already ? ' (Abhi bhi letter mein hai; sabse aage le aaunga.)' : ''}`,
        proposals: [prop({ kind: 'swap-proof', toLedgerId: named.id }, 'Current proof lineup', `${projName(named)} leads as the proof point`, ['I1 (existing ledger project)', 'uniqueness gate re-runs'])],
      }
    }
    return { reply: `Kaunsa project proof banau? Naam le lo (e.g. "GLOAMING ko proof bana"). Main sirf ledger ke shipped projects use kar sakta hoon.`, proposals: [] }
  }

  return {
    reply: 'Letter pe main ye kar sakta hoon: "signature on/off" · "thoda formal/direct tone" · "letter chhota kar" · "GLOAMING ko proof bana". Jo ledger mein nahi, woh main letter mein nahi likhta.',
    proposals: [],
  }
}
