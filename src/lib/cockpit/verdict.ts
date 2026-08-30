import type { CoverageReport, ScoreBreakdown } from '../../types'
import type { PreflightCheck } from './dossier'

/**
 * WORTH APPLYING? (final-bar pass — "my time is the scarce thing"). One composed judgement per
 * opportunity, from signals the app already computes: the rubric score, the VISION fit (is this
 * his kind of role, not just keyword-matched), JD coverage (can the ledger actually answer it),
 * and the pre-flight (work-auth / pay / freshness / link). Deterministic, inspectable (L4),
 * never a guarantee (I9) — it maximizes where his hours go, it does not promise outcomes.
 */

export interface ApplyVerdict {
  call: 'apply' | 'apply-with-eyes-open' | 'skip'
  headline: string
  reasons: string[]
}

export function applyVerdict(args: {
  score?: ScoreBreakdown
  coverage: CoverageReport
  preflight: PreflightCheck[]
}): ApplyVerdict {
  const { score, coverage, preflight } = args
  const reasons: string[] = []
  let plus = 0
  let minus = 0

  const reds = preflight.filter((c) => c.status === 'red')
  const ambers = preflight.filter((c) => c.status === 'amber')

  // Hard blockers first — a red pre-flight is the scarce-time killer.
  for (const r of reds) {
    minus += 2
    reasons.push(`✕ ${r.label}: ${r.why}`)
  }

  // Vision: his kind of role, or a keyword coincidence?
  const vision = score?.parts.find((p) => p.key === 'visionFit')
  if (vision) {
    if (vision.points >= 12) {
      plus += 2
      reasons.push(`✓ This is YOUR kind of role — ${vision.why}`)
    } else if (vision.points <= -8) {
      minus += 2
      reasons.push(`✕ Off-vision: ${vision.why}`)
    }
  }
  const family = score?.parts.find((p) => p.key === 'roleFamily')
  if (family) {
    minus += 1
    reasons.push(`✕ ${family.why}`)
  }

  // Coverage: can the ledger actually answer this JD?
  const musts = coverage.matched.filter((m) => m.mustHave).length + coverage.missing.filter((m) => m.mustHave).length
  const proven = coverage.matched.filter((m) => m.mustHave).length
  if (musts > 0) {
    const frac = proven / musts
    if (frac >= 0.7) {
      plus += 2
      reasons.push(`✓ Your ledger proves ${proven} of ${musts} must-haves — you can walk this interview.`)
    } else if (frac >= 0.4) {
      plus += 1
      reasons.push(`△ ${proven} of ${musts} must-haves proven — apply, and expect questions on the gaps (see the Gap Note).`)
    } else {
      minus += 1
      reasons.push(`✕ Only ${proven} of ${musts} must-haves have ledger evidence — the interview would lean on claims you can't back yet.`)
    }
  }

  // Overall rubric strength.
  if (score) {
    if (score.total >= 70) {
      plus += 1
      reasons.push(`✓ Rubric ${score.total}/100 — top-band match.`)
    } else if (score.total < 40) {
      minus += 1
      reasons.push(`✕ Rubric ${score.total}/100 — weak overall match; your hour beats this role's odds elsewhere.`)
    }
  }

  for (const a of ambers) reasons.push(`△ ${a.label}: ${a.why}`)

  const call: ApplyVerdict['call'] = reds.length > 0 || minus >= plus + 2 ? 'skip' : minus > 0 || ambers.length > 0 ? 'apply-with-eyes-open' : 'apply'
  const headline =
    call === 'apply'
      ? 'Worth your hour — apply.'
      : call === 'apply-with-eyes-open'
        ? 'Worth it, eyes open — read the flags first.'
        : 'Skip — your hour is worth more elsewhere.'
  return { call, headline, reasons: reasons.slice(0, 6) }
}
