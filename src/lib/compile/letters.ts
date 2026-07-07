import type { CompiledDoc, CoverageReport, Identity, JDDecode, Job, LedgerEntry } from '../../types'
import { entryRelevance } from '../match/evidence'

/**
 * Cover letter (≤250 words) and outreach draft (≤120 words), compiled — not free-written.
 * Every paragraph carries the ledgerIds backing its claims (I1). The register follows
 * Shaurya's Voice Bank: direct, concrete, zero corporate slop. Drafted, never sent (I3).
 */

function words(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}

function topProjects(ledger: LedgerEntry[], decode: JDDecode, n: number): LedgerEntry[] {
  return ledger
    .filter((e) => e.resumeEligible && e.tier === 'shipped' && e.kind === 'project')
    .sort((a, b) => entryRelevance(b, decode) - entryRelevance(a, decode))
    .slice(0, n)
}

function keywordPhrase(decode: JDDecode): string {
  const top = decode.mustHave.slice(0, 3)
  return top.length > 0 ? top.join(', ').replace(/-/g, ' ') : 'applied AI'
}

export function compileCoverLetter(
  job: Job,
  identity: Identity,
  ledger: LedgerEntry[],
  decode: JDDecode,
  coverage: CoverageReport,
): CompiledDoc {
  const proofs = topProjects(ledger, decode, 2)
  const forgeIds = new Set(coverage.building.flatMap((h) => h.ledgerIds))
  const forge = ledger.filter((e) => e.tier === 'in_forge' && e.resumeEligible && forgeIds.has(e.id))

  const paragraphs: CompiledDoc['paragraphs'] = []

  paragraphs.push({
    text: `Dear ${job.company} team — I'm applying for ${job.title}. The role asks for ${keywordPhrase(decode)}; that is exactly the work I do, and every claim below links to something you can open and check.`,
    ledgerIds: [],
  })

  for (const p of proofs) {
    const url = p.evidence?.url ?? p.evidence?.repo ?? ''
    const firstBullet = p.bullets[0]?.text ?? p.summary
    paragraphs.push({
      text: `${p.title.split('—')[0].trim()}: ${firstBullet}.${url ? ` See it at ${url.replace(/^https?:\/\//, '')}.` : ''}`,
      ledgerIds: [p.id],
    })
  }

  if (forge.length > 0) {
    const names = forge.map((e) => e.title.split('—')[0].trim()).join(', ')
    paragraphs.push({
      text: `Honest note on momentum: I'm currently building ${names} (target ${forge[0].forgeEta ?? 'July 2026'}). My internship window is January–May 2027, so what's in the forge today will be shipped and demo-able well before day one.`,
      ledgerIds: forge.map((e) => e.id),
    })
  }

  paragraphs.push({
    text: `I'd value fifteen minutes to walk you through the work. Everything is public at ${identity.github}. — ${identity.name}, ${identity.email}`,
    ledgerIds: [],
  })

  // Enforce the 250-word ceiling by trimming the least essential paragraph (2nd proof) if needed.
  while (paragraphs.reduce((n, p) => n + words(p.text), 0) > 250 && paragraphs.length > 3) {
    paragraphs.splice(2, 1)
  }

  return { paragraphs }
}

export function compileOutreach(
  job: Job,
  identity: Identity,
  ledger: LedgerEntry[],
  decode: JDDecode,
): CompiledDoc {
  const proof = topProjects(ledger, decode, 1)[0]
  const url = proof?.evidence?.url ?? proof?.evidence?.repo ?? `https://${identity.github}`

  const paragraphs: CompiledDoc['paragraphs'] = [
    {
      text: `Hi — I just applied for ${job.title} at ${job.company}. One reason to open my application instead of the pile: I ship. ${proof ? `${proof.title.split('—')[0].trim()} is live at ${url.replace(/^https?:\/\//, '')} — built end to end, ${proof.bullets[0]?.keywords.slice(0, 3).join('/') ?? 'AI'} included.` : `My work is public at ${identity.github}.`} My window is Jan–May 2027 and I'm applying to very few places, deliberately. If the timing fits, I'd love a look. — ${identity.name.split(' ')[0]}`,
      ledgerIds: proof ? [proof.id] : [],
    },
  ]
  return { paragraphs }
}

/** The Gap Note: honest ambition, surfaced usefully. Missing evidence never enters the resume. */
export function buildGapNote(coverage: CoverageReport): string[] {
  const notes: string[] = []
  for (const miss of coverage.missing) {
    const kw = miss.keyword.replace(/-/g, ' ')
    notes.push(
      miss.mustHave
        ? `"${kw}" is a must-have here and the ledger has no evidence for it. The honest move: build or learn it, then let Nabz promote it — never claim it first.`
        : `"${kw}" is nice-to-have; no ledger evidence yet. A small public artifact would cover it.`,
    )
  }
  return notes
}
