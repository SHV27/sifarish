import type { CompiledLine, CoverageReport, EditorialPlan, Identity, JDDecode, LedgerEntry, VisionProfile } from '../../types'
import { LEXICON } from '../jd/lexicon'

/**
 * PROFESSIONAL SUMMARY (Session 5.2) — a TRULY TIMELESS, vision-framed positioning line for the top of
 * the resume (the 6-second skim's first fixation; Ustaad ¶headline-mirrors-role). It says who he IS and
 * how he WORKS — "I architect, I build" — never anything that decays:
 *   • NO tool/skill names (his stack changes month to month).
 *   • NO numbers (a count is a point-in-time fact).
 *   • NO project names, NO geography (he targets remote/international), NO "currently building X".
 * What remains is stable forever: a role from his vision + the director/builder identity + the domain.
 *
 * I1 is preserved: the line is only produced when the ledger actually backs the claim (he has shipped
 * AI/agent work OR the AI skills to do it), and it carries the ledgerIds of that backing evidence — it
 * simply doesn't *name* them. If there is no AI evidence at all, no summary is produced (returns null).
 */

/** True if a skill's tags map to an AI/ML/agentic lexicon class. */
function isAiSkill(s: LedgerEntry): boolean {
  return s.tags.some((t) => LEXICON.some((l) => l.canonical === t && !!l.aiClass))
}

/** A strong, geography-free role phrase from the vision's target roles (or a solid default). */
function rolePhrase(vision?: VisionProfile): string {
  const roles = (vision?.targetRoles ?? []).join(' ').toLowerCase()
  if (/agentic|agent/.test(roles)) return 'Agentic-AI engineer'
  if (/llm/.test(roles)) return 'LLM engineer'
  if (/research|residency/.test(roles)) return 'AI research engineer'
  if (/ml|machine learning/.test(roles)) return 'Machine-learning engineer'
  return 'AI engineer'
}

/** The stable DOMAIN the role builds in (no tools, no dates) — derived from the vision role. */
function domainPhrase(role: string): string {
  if (/agentic/i.test(role)) return 'production LLM and agent systems'
  if (/LLM/i.test(role)) return 'production LLM applications'
  if (/research/i.test(role)) return 'rigorous ML systems and experiments'
  if (/machine-learning/i.test(role)) return 'production machine-learning systems'
  return 'production AI systems'
}

export function buildSummaryLine(args: {
  identity: Identity
  vision?: VisionProfile
  ledger: LedgerEntry[]
  decode: JDDecode
  coverage: CoverageReport
  editorial?: EditorialPlan
}): CompiledLine | null {
  const { vision, ledger } = args
  const eligible = ledger.filter((e) => e.resumeEligible)
  const shippedAiProjects = eligible.filter((e) => e.tier === 'shipped' && e.kind === 'project')
  const aiSkills = eligible.filter((e) => e.kind === 'skill' && isAiSkill(e))

  // I1 guard: only claim the builder/architect identity if the ledger backs it. No AI evidence → no summary.
  if (shippedAiProjects.length === 0 && aiSkills.length === 0) return null

  // Backing evidence (linked for honesty, never named in the text).
  const ledgerIds = [...new Set([...shippedAiProjects.map((e) => e.id), ...aiSkills.map((e) => e.id)])]

  // TIMELESS: [Vision role] who architects and ships [domain] end to end — from first principles to live
  // deployment.  (Identity + how he works. No tools, no numbers, no geography, no dates → never decays.)
  const role = rolePhrase(vision)
  const text = `${role} who architects and ships ${domainPhrase(role)} end to end — from first principles to live deployment.`

  return { kind: 'summary', text, ledgerIds }
}
