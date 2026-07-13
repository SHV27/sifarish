import type { CompiledLine, CoverageReport, EditorialPlan, Identity, JDDecode, LedgerEntry, VisionProfile } from '../../types'
import { entryRelevance, bulletRelevance } from '../match/evidence'
import { LEXICON } from '../jd/lexicon'

/** True if a skill's tags map to an AI/ML/agentic lexicon class — these lead the capability list. */
function isAiSkill(s: LedgerEntry): boolean {
  return s.tags.some((t) => LEXICON.some((l) => l.canonical === t && !!l.aiClass))
}

/** What this role "ships", derived from the vision role (keeps the head clause honest + on-target). */
function shipsPhrase(role: string): string {
  if (/agentic/i.test(role)) return 'production LLM and agent systems end to end'
  if (/LLM/i.test(role)) return 'production LLM applications end to end'
  if (/research/i.test(role)) return 'rigorous ML systems and experiments'
  return 'production ML and LLM systems end to end'
}

/**
 * PROFESSIONAL SUMMARY (Session 5.2) — a strong, GLOBALLY-framed AI-engineer positioning line for the
 * top third of the resume (the 6-second skim's first fixation; Ustaad ¶headline-mirrors-role). By design:
 *   • Framed by his VISION (the role he's aiming at), not his geography or a project.
 *   • NO project names (the projects speak for themselves lower down; the summary is positioning).
 *   • NO geography (he targets remote/international too — the framing must travel).
 *   • TIMELESS — no "currently building X" (that decays as he ships; the app is ever-evolving, so the
 *     summary states only what stays true). The shipped-project COUNT is recompiled each tailor, so it's
 *     always current without ever being a forward-dated claim.
 * It is NOT a fluffy objective — every capability word is a REAL ledger skill and the count is a real
 * count, so it mints nothing (I1). It carries the ledgerIds it leaned on.
 */

/** A strong, geography-free role phrase from the vision's target roles (or a solid default). */
function rolePhrase(vision?: VisionProfile): string {
  const roles = (vision?.targetRoles ?? []).join(' ').toLowerCase()
  if (/agentic|agent/.test(roles)) return 'Agentic-AI engineer'
  if (/llm/.test(roles)) return 'LLM engineer'
  if (/research|residency/.test(roles)) return 'AI research engineer'
  if (/ml|machine learning/.test(roles)) return 'Machine-learning engineer'
  return 'Applied-AI engineer'
}

export function buildSummaryLine(args: {
  identity: Identity
  vision?: VisionProfile
  ledger: LedgerEntry[]
  decode: JDDecode
  coverage: CoverageReport
  editorial?: EditorialPlan
}): CompiledLine | null {
  const { vision, ledger, decode } = args
  const eligible = ledger.filter((e) => e.resumeEligible)
  const shippedProjects = eligible.filter((e) => e.tier === 'shipped' && e.kind === 'project')
  const shippedSkills = eligible.filter((e) => e.tier === 'shipped' && e.kind === 'skill')
  if (shippedSkills.length === 0 && shippedProjects.length === 0) return null

  const ledgerIds: string[] = []
  const skillName = (s: LedgerEntry) => s.title.split('—')[0].split('(')[0].trim()

  // Capability list: AI/ML skills LEAD (architect image), then any remaining JD-matched skills.
  // Generic tooling (git etc.) only appears if there aren't enough AI skills to stand on.
  const rankedSkills = shippedSkills
    .map((s) => ({ s, r: bulletRelevance(s.tags, decode) + entryRelevance(s, decode) + (isAiSkill(s) ? 100 : 0) }))
    .sort((a, b) => b.r - a.r)
  const aiCount = shippedSkills.filter(isAiSkill).length
  const capSkills = rankedSkills.slice(0, Math.min(4, Math.max(3, aiCount))).map((x) => x.s)
  for (const s of capSkills) ledgerIds.push(s.id)
  const capability = capSkills.length > 0 ? capSkills.map(skillName).join(', ') : 'modern LLM tooling'

  // Proof by NUMBER, not name (Ustaad ¶quantify). Clean phrasing — no redundant "1 … 1".
  for (const p of shippedProjects) ledgerIds.push(p.id)
  const n = shippedProjects.length
  const live = shippedProjects.filter((p) => p.evidence?.url).length
  let proof = ''
  if (n > 0) {
    proof =
      live === n
        ? `${n} production project${n === 1 ? '' : 's'} shipped and live`
        : live > 0
          ? `${n} shipped project${n === 1 ? '' : 's'}, ${live} live`
          : `${n} shipped project${n === 1 ? '' : 's'}`
  }

  // Compose — TIMELESS, vision-framed, name-free, geography-free.
  const role = rolePhrase(vision)
  const head = `${role} who ships ${shipsPhrase(role)} — ${capability}`
  const text = proof ? `${head}. ${proof}.` : `${head}.`

  return { kind: 'summary', text, ledgerIds: [...new Set(ledgerIds)] }
}
