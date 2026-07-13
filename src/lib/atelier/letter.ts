import type {
  CompiledDoc,
  CompanyIntel,
  CoverageReport,
  EditorialPlan,
  Identity,
  JDDecode,
  Job,
  LedgerEntry,
  Rationale,
  VisionProfile,
} from '../../types'
import { entryRelevance } from '../match/evidence'
import { hookFromIntel } from '../intel/client'
import { decide } from '../dimaag/core'

/**
 * THE ATELIER (P11) — cover letters composed, not filled. Each letter could only be his, for
 * only this company. Structure: cited company hook → vision bridge → two cast proof points →
 * dated momentum → the ask. Optional Sifarish Signature (per-company Dimaag decision). Composed
 * from real parts, so it is I1-safe and unique by construction; the uniqueness gate enforces it.
 */

function words(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}

function keywordPhrase(decode: JDDecode): string {
  const top = decode.mustHave.slice(0, 3)
  return top.length > 0 ? top.join(', ').replace(/-/g, ' ') : 'applied AI'
}

/** Decide whether the meta "compiled-by-SIFARISH" P.S. helps for this company (per-company). */
export async function decideSignature(
  job: Job,
  archetypeId: string,
  intel?: CompanyIntel,
): Promise<{ use: boolean; rationale: Rationale }> {
  const aiFirst = ['applied-ai', 'agent-eng', 'research-intern', 'platform-infra'].includes(archetypeId)
  const rationale = await decide({
    feature: 'atelier.signature',
    question: `Should the cover letter to ${job.company} include the Sifarish Signature — a P.S. revealing that SIFARISH (his self-built, evidence-linked hiring agent) compiled the letter?`,
    options: [
      { id: 'yes', label: 'Include the Signature', detail: 'The meta-hook shows initiative + shipping ability; AI-first teams usually reward it.' },
      { id: 'no', label: 'Omit the Signature', detail: 'A conservative or non-technical reviewer may find it gimmicky.' },
    ],
    criteria: ['is this an AI-first / engineering-led team?', 'does showing a self-built agent strengthen the candidate?', 'reviewer conservatism'],
    context: `Role archetype: ${archetypeId}. ${intel?.bullets?.[0]?.text ?? ''}`.slice(0, 500),
    citations: intel?.bullets.slice(0, 1).map((b) => ({ title: 'company intel', url: b.url })),
    heuristic: () => ({
      choice: aiFirst ? 'yes' : 'no',
      ranking: aiFirst ? ['yes', 'no'] : ['no', 'yes'],
      why: aiFirst
        ? `${job.company} reads as an AI-first/engineering team (archetype ${archetypeId}); a self-built agent that refuses to lie is exactly the initiative signal they reward.`
        : `${job.company} may not be engineering-led; the meta-hook risks reading as gimmicky. Safer to omit and let the evidence speak.`,
      confidence: 0.6,
    }),
  })
  return { use: rationale.choice.toLowerCase().includes('include'), rationale }
}

export interface AtelierInput {
  job: Job
  identity: Identity
  ledger: LedgerEntry[]
  decode: JDDecode
  coverage: CoverageReport
  intel?: CompanyIntel
  vision?: VisionProfile
  editorial?: EditorialPlan
  useSignature: boolean
  /** Atelier Baithak: force a specific shipped project to LEAD the proof points (evidence-true). */
  proofLeadId?: string
  /** Atelier Baithak: cap the core word count harder than the default 250 (tighter letter). */
  tightTo?: number
}

export function composeLetter(input: AtelierInput): CompiledDoc {
  const { job, identity, ledger, decode, coverage, intel, vision, editorial, useSignature } = input
  const paragraphs: CompiledDoc['paragraphs'] = []

  // Proof projects: prefer the Editor's cast lineup (already reasoned); else JD relevance.
  const castIds = editorial?.chosen.map((c) => c.ledgerId) ?? []
  const proofPool = ledger.filter((e) => e.resumeEligible && e.tier === 'shipped' && e.kind === 'project')
  let ordered =
    castIds.length > 0
      ? (castIds.map((id) => proofPool.find((p) => p.id === id)).filter(Boolean) as LedgerEntry[])
      : proofPool.slice().sort((a, b) => entryRelevance(b, decode) - entryRelevance(a, decode))
  // Atelier Baithak: an owner-chosen proof project leads (still a real ledger project — I1 holds).
  if (input.proofLeadId) {
    const lead = proofPool.find((p) => p.id === input.proofLeadId)
    if (lead) ordered = [lead, ...ordered.filter((p) => p.id !== lead.id)]
  }
  const proofs = ordered.slice(0, 2)

  // 1 — Cited company hook (real fact) or an honest fallback opener.
  const hook = hookFromIntel(intel)
  if (hook) {
    const fact = hook.text.replace(/\s+$/, '').replace(/[.;]$/, '')
    paragraphs.push({
      text: `Dear ${job.company} team — I'm applying for ${job.title}. I noticed ${fact}.`,
      ledgerIds: [],
      citationUrl: hook.url,
    })
  } else {
    paragraphs.push({
      text: `Dear ${job.company} team — I'm applying for ${job.title}, because the work — ${keywordPhrase(decode)} — is exactly what I build.`,
      ledgerIds: [],
    })
  }

  // 2 — Vision bridge: his dream ↔ this role, one honest sentence.
  if (vision?.dream) {
    const dreamShort = vision.dream.replace(/\.$/, '').split('—')[0].trim()
    paragraphs.push({
      text: `That matters to me because ${dreamShort.charAt(0).toLowerCase()}${dreamShort.slice(1)} — and ${job.company}'s ${keywordPhrase(decode)} work is squarely on that path, not a detour from it.`,
      ledgerIds: [],
    })
  }

  // 3 — Two cast proof points (project + why-this-company).
  for (const p of proofs) {
    const url = p.evidence?.url ?? p.evidence?.repo ?? ''
    const first = p.bullets[0]?.text ?? p.summary
    paragraphs.push({
      text: `${p.title.split('—')[0].trim()}: ${first}.${url ? ` It's live at ${url.replace(/^https?:\/\//, '')}.` : ''}`,
      ledgerIds: [p.id],
    })
  }

  // 4 — Dated momentum (in_forge), honest.
  const forgeIds = new Set(coverage.building.flatMap((h) => h.ledgerIds))
  const forge = ledger.filter((e) => e.tier === 'in_forge' && e.resumeEligible && forgeIds.has(e.id))
  if (forge.length > 0) {
    const names = forge.map((e) => e.title.split('—')[0].trim()).join(' and ')
    paragraphs.push({
      text: `I'm honest about what's still in progress: I'm building ${names} right now (${forge[0].forgeEta ?? 'July 2026'}). My internship window is January–May 2027, so it will be shipped well before day one.`,
      ledgerIds: forge.map((e) => e.id),
    })
  }

  // 5 — The ask.
  paragraphs.push({
    text: `I'd value fifteen minutes to walk you through the work — all of it is public at ${identity.github}. — ${identity.name}, ${identity.email}`,
    ledgerIds: [],
  })

  // 6 — Sifarish Signature (optional, per-company decision).
  if (useSignature) {
    paragraphs.push({
      text: `P.S. — This letter was compiled by SIFARISH, the evidence-linked hiring agent I built: every claim above links to proof, because I designed it so it cannot lie. It's project #6 on my GitHub.`,
      ledgerIds: [],
    })
  }

  // Trim to the word cap (excluding the P.S.) by dropping the 2nd proof if needed.
  const cap = input.tightTo ?? 250
  const core = () => paragraphs.filter((p) => !p.text.startsWith('P.S.')).reduce((n, p) => n + words(p.text), 0)
  while (core() > cap && proofs.length > 1) {
    // remove the last proof paragraph (index of 2nd proof)
    const idx = paragraphs.findIndex((p) => p.ledgerIds[0] === proofs[proofs.length - 1].id)
    if (idx === -1) break
    paragraphs.splice(idx, 1)
    proofs.pop()
  }

  return { paragraphs }
}
