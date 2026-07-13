import type { CompiledLine, CoverageReport, EditorialPlan, Identity, JDDecode, LedgerEntry, VisionProfile } from '../../types'
import { entryRelevance, bulletRelevance } from '../match/evidence'

/**
 * PROFESSIONAL SUMMARY (Session 5.2) — a targeted, evidence-DENSE opening line for the top third
 * of the resume (the 6-second skim's first fixation; Ustaad ¶headline-mirrors-role). It is NOT a
 * fluffy objective (¶cut-the-obvious bans those) — every clause traces to REAL ledger evidence:
 * his own headline, the strongest cast project, the top JD-matched skills, and honest momentum.
 * Compiled deterministically → mints no claim (I1); carries the ledgerIds it leaned on.
 */
export function buildSummaryLine(args: {
  identity: Identity
  vision?: VisionProfile
  ledger: LedgerEntry[]
  decode: JDDecode
  coverage: CoverageReport
  editorial?: EditorialPlan
}): CompiledLine | null {
  const { identity, ledger, decode, coverage, editorial } = args
  const eligible = ledger.filter((e) => e.resumeEligible)
  const shippedProjects = eligible.filter((e) => e.tier === 'shipped' && e.kind === 'project')
  if (shippedProjects.length === 0 && !identity.headline) return null

  const ledgerIds: string[] = []

  // Spine: his real, human-written headline (his voice), lightly trimmed.
  const spine = (identity.headline || 'AI engineering intern candidate').replace(/[.。]$/, '').trim()

  // Strongest proof: the #1 cast project, else the most JD-relevant shipped project.
  const castTop = editorial?.chosen[0]?.ledgerId
  const topProject =
    (castTop && shippedProjects.find((p) => p.id === castTop)) ||
    shippedProjects.slice().sort((a, b) => entryRelevance(b, decode) - entryRelevance(a, decode))[0]
  let proofClause = ''
  if (topProject) {
    ledgerIds.push(topProject.id)
    const name = topProject.title.split('—')[0].trim()
    const live = topProject.evidence?.url ? ' (live)' : ''
    proofClause = `shipped ${name}${live}`
  }

  // Top JD-matched shipped skills (max 3), spelled as the ledger spells them.
  const topSkills = eligible
    .filter((e) => e.tier === 'shipped' && e.kind === 'skill')
    .map((s) => ({ s, r: bulletRelevance(s.tags, decode) + entryRelevance(s, decode) }))
    .sort((a, b) => b.r - a.r)
    .slice(0, 3)
    .map((x) => x.s)
  let skillClause = ''
  if (topSkills.length > 0) {
    for (const s of topSkills) ledgerIds.push(s.id)
    skillClause = `strongest in ${topSkills.map((s) => s.title.split('—')[0].split('(')[0].trim()).join(', ')}`
  }

  // Honest momentum: in-forge items the JD actually asks for (max 2).
  const forgeIds = new Set(coverage.building.flatMap((h) => h.ledgerIds))
  const building = eligible.filter((e) => e.tier === 'in_forge' && forgeIds.has(e.id)).slice(0, 2)
  let buildingClause = ''
  if (building.length > 0) {
    for (const b of building) ledgerIds.push(b.id)
    buildingClause = `currently building ${building.map((b) => b.title.split('—')[0].trim()).join(' and ')}`
  }

  const tail = [proofClause, skillClause].filter(Boolean).join('; ')
  let text = tail ? `${spine} — ${tail}.` : `${spine}.`
  if (buildingClause) text = text.replace(/\.$/, `; ${buildingClause}.`)

  return { kind: 'summary', text, ledgerIds: [...new Set(ledgerIds)] }
}
