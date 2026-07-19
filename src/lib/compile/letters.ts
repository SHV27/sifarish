import type { CompiledDoc, CoverageReport, Identity, IntelBullet, JDDecode, Job, LedgerEntry, VisionProfile } from '../../types'
import { entryRelevance } from '../match/evidence'
import { cleanUrlForDisplay, stripMarkdownResidue } from './typeset'
import { cleanSummaryForDisplay } from './compiler'

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
  intelHook?: IntelBullet | null,
  vision?: VisionProfile,
): CompiledDoc {
  const proofs = topProjects(ledger, decode, 2)
  const forgeIds = new Set(coverage.building.flatMap((h) => h.ledgerIds))
  const forge = ledger.filter((e) => e.tier === 'in_forge' && e.resumeEligible && forgeIds.has(e.id))

  const paragraphs: CompiledDoc['paragraphs'] = []

  if (intelHook) {
    // Darzi v2: a specific, CITED company fact opens the letter — never a generic "I admire your mission".
    const fact = intelHook.text.replace(/\s+$/, '').replace(/[.;]?$/, '')
    paragraphs.push({
      text: `Dear ${job.company} team — I'm applying for ${job.title}. I noticed ${fact}. That's the kind of work I do, and the role's ask for ${keywordPhrase(decode)} maps directly onto what I've shipped — every claim below links to something you can open and check.`,
      ledgerIds: [],
      citationUrl: intelHook.url,
    })
  } else {
    paragraphs.push({
      text: `Dear ${job.company} team — I'm applying for ${job.title}. The role asks for ${keywordPhrase(decode)}; that is exactly the work I do, and every claim below links to something you can open and check.`,
      ledgerIds: [],
    })
  }

  // Session 7.2 (A2): letter text passes the same hygiene gates as the résumé — markdown
  // residue and raw-URL scraps from the vault die here too, not only at the compiler's push().
  for (const p of proofs) {
    const url = p.evidence?.url ?? p.evidence?.repo ?? ''
    const firstBullet = stripMarkdownResidue(cleanSummaryForDisplay(p.bullets[0]?.text ?? p.summary)).replace(/[.]\s*$/, '')
    paragraphs.push({
      text: `${p.title.split('—')[0].trim()}: ${firstBullet}.${url ? ` See it at ${cleanUrlForDisplay(url)}.` : ''}`,
      ledgerIds: [p.id],
    })
  }

  if (forge.length > 0) {
    const names = forge.map((e) => e.title.split('—')[0].trim()).join(', ')
    // Session 7.2 (C7): the window reads from his live vision, never a hardcoded year.
    const window = vision?.windowStart && vision?.windowEnd ? `${vision.windowStart}–${vision.windowEnd}` : 'January–May 2027'
    paragraphs.push({
      text: `Honest note on momentum: I'm currently building ${names} (target ${forge[0].forgeEta ?? 'July 2026'}). My internship window is ${window}, so what's in the forge today will be shipped and demo-able well before day one.`,
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
  vision?: VisionProfile,
): CompiledDoc {
  const proof = topProjects(ledger, decode, 1)[0]
  const url = proof?.evidence?.url ?? proof?.evidence?.repo ?? `https://${identity.github}`
  const window = vision?.windowStart && vision?.windowEnd ? `${vision.windowStart}–${vision.windowEnd}` : 'Jan–May 2027'

  const paragraphs: CompiledDoc['paragraphs'] = [
    {
      // W2 matrix-found: `?? 'AI'` never fired — an EMPTY keywords array joins to '' (not
      // nullish), leaving a double space on the letter. `||` is the honest operator here.
      text: `Hi — I just applied for ${job.title} at ${job.company}. One reason to open my application instead of the pile: I ship. ${proof ? `${proof.title.split('—')[0].trim()} is live at ${cleanUrlForDisplay(url)} — built end to end, ${proof.bullets[0]?.keywords.slice(0, 3).join('/') || 'AI'} included.` : `My work is public at ${identity.github}.`} My window is ${window} and I'm applying to very few places, deliberately. If the timing fits, I'd love a look. — ${identity.name.split(' ')[0]}`,
      ledgerIds: proof ? [proof.id] : [],
    },
  ]
  return { paragraphs }
}

/** The Gap Note: honest ambition, surfaced usefully. Missing evidence never enters the resume. */
export function buildGapNote(coverage: CoverageReport): string[] {
  // Session 6 (P3): one sentence-shape repeated per keyword read as template output. The gaps now
  // aggregate — must-haves in one honest line, nice-to-haves in another — same information, a
  // human's cadence.
  const notes: string[] = []
  const must = coverage.missing.filter((m) => m.mustHave).map((m) => m.keyword.replace(/-/g, ' '))
  const nice = coverage.missing.filter((m) => !m.mustHave).map((m) => m.keyword.replace(/-/g, ' '))
  if (must.length === 1) {
    notes.push(`This JD calls "${must[0]}" a must-have and the ledger holds no evidence for it — so it stays off the page (I1). Build or learn it, ship the proof, and Nabz promotes it.`)
  } else if (must.length > 1) {
    notes.push(`${must.length} of this JD's must-haves have no ledger evidence: ${must.map((k) => `"${k}"`).join(', ')}. They stay off the page (I1) — real proof for even one of them changes the compile.`)
  }
  if (nice.length > 0) {
    notes.push(`Nice-to-haves without evidence yet: ${nice.map((k) => `"${k}"`).join(', ')}. A small public artifact would cover any of them.`)
  }
  return notes
}
