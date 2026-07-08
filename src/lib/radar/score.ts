import type { Job, LedgerEntry, RubricWeights, ScoreBreakdown, ScorePart } from '../../types'
import { decodeJD } from '../jd/decode'
import { matchEvidence } from '../match/evidence'
import { LEXICON } from '../jd/lexicon'

/**
 * The Shikaar rubric — every score expands to its arithmetic (Law 4). Weights come
 * from Settings; the WHY strings are written for a human reading the breakdown.
 */

/**
 * Score cache (v3 optimization): scoreJob is pure over (job JD, rubric, starred). Discovery adds
 * ~100 jobs/sweep and the Radar re-renders often (e.g. tailoring flips a flag); without a cache
 * every render re-decodes every JD. Keyed on job id + freshness + rubric signature + starred, so
 * only genuinely-changed jobs recompute. Bounded to avoid unbounded growth.
 */
const scoreCache = new Map<string, ScoreBreakdown>()

function rubricSig(r: RubricWeights): string {
  return `${r.aiRelevance},${r.roleFit},${r.remoteIndia},${r.windowFit},${r.compSignal},${r.conviction}`
}

export function scoreJobCached(job: Job, ledger: LedgerEntry[], rubric: RubricWeights, starred: boolean): ScoreBreakdown {
  const key = `${job.id}|${job.fetchedAt}|${job.jd.length}|${rubricSig(rubric)}|${starred ? 1 : 0}`
  const hit = scoreCache.get(key)
  if (hit) return hit
  const result = scoreJob(job, ledger, rubric, starred)
  if (scoreCache.size > 800) scoreCache.clear() // simple bound; recompute is cheap after
  scoreCache.set(key, result)
  return result
}

export function scoreJob(job: Job, ledger: LedgerEntry[], rubric: RubricWeights, starred: boolean): ScoreBreakdown {
  const decode = decodeJD(job.jd || job.title)
  const coverage = matchEvidence(decode, ledger)
  const parts: ScorePart[] = []

  // 1 · AI-first / agentic relevance
  const aiKeywords = [...decode.mustHave, ...decode.niceToHave].filter((kw) =>
    LEXICON.some((l) => l.canonical === kw && l.aiClass),
  )
  const aiFrac = Math.min(aiKeywords.length, 6) / 6
  parts.push({
    key: 'aiRelevance',
    label: 'AI-first / agentic relevance',
    points: Math.round(aiFrac * rubric.aiRelevance),
    max: rubric.aiRelevance,
    why:
      aiKeywords.length > 0
        ? `JD mentions ${aiKeywords.slice(0, 6).join(', ')} (${aiKeywords.length} AI-class signals, 6 = full marks).`
        : 'No agents/LLM/RAG/fine-tuning signals in this JD.',
  })

  // 2 · Role fit vs ledger coverage
  const totalKw = decode.mustHave.length + decode.niceToHave.length
  const fitFrac = totalKw === 0 ? 0.3 : coverage.matched.length / totalKw
  parts.push({
    key: 'roleFit',
    label: 'Role fit vs ledger',
    points: Math.round(fitFrac * rubric.roleFit),
    max: rubric.roleFit,
    why:
      totalKw === 0
        ? 'JD too thin to decode keywords — neutral score.'
        : `${coverage.matched.length} of ${totalKw} JD keywords have shipped evidence in the ledger (${coverage.building.length} more in the forge).`,
  })

  // 3 · Remote / India-eligible
  const loc = decode.locationHints
  let locFrac = 0.45
  let locWhy = 'Location not stated — assumed uncertain.'
  if (loc.includes('authorization-constrained')) {
    locFrac = 0.15
    locWhy = 'JD mentions work-authorization constraints — risky for a remote-international candidate.'
  } else if (loc.includes('india')) {
    locFrac = 1
    locWhy = 'India location named in the JD.'
  } else if (loc.includes('remote')) {
    locFrac = 0.9
    locWhy = 'Remote role — India-eligible unless stated otherwise.'
  }
  parts.push({
    key: 'remoteIndia',
    label: 'Remote / India-eligible',
    points: Math.round(locFrac * rubric.remoteIndia),
    max: rubric.remoteIndia,
    why: locWhy,
  })

  // 4 · Internship-window fit (Jan–May 2027)
  let winFrac = 0.35
  let winWhy = 'Seniority unclear — window fit uncertain.'
  if (decode.seniority === 'intern') {
    winFrac = 1
    winWhy = 'Internship role — matches the compulsory Jan–May 2027 window.'
  } else if (decode.seniority === 'early-career') {
    winFrac = 0.75
    winWhy = 'Early-career role — plausible for the 2027 window or post-graduation.'
  } else if (decode.seniority === 'senior') {
    winFrac = 0
    winWhy = 'Senior role — out of window.'
  } else if (decode.seniority === 'mid') {
    winFrac = 0.3
    winWhy = 'Mid-level engineer role — a stretch for an intern window.'
  }
  if (/jan(uary)?[\s–-]+(to\s+)?may|spring 2027|winter 2027|2027/i.test(job.jd)) {
    winFrac = Math.max(winFrac, 0.9)
    winWhy += ' JD explicitly mentions a 2027-adjacent window.'
  }
  parts.push({
    key: 'windowFit',
    label: 'Jan–May 2027 window fit',
    points: Math.round(winFrac * rubric.windowFit),
    max: rubric.windowFit,
    why: winWhy,
  })

  // 5 · Compensation signal (currency-aware)
  let compFrac = 0.3
  let compWhy = 'No compensation signal in the JD.'
  if (decode.compHints.includes('conversion-language')) {
    compFrac = 1
    compWhy = 'PPO / full-time-conversion language present — the strongest signal for the ≥16 LPA target.'
  } else if (decode.compHints.some((h) => /[$€£]/.test(h))) {
    compFrac = 0.9
    compWhy = `Foreign-currency compensation stated (${decode.compHints.find((h) => /[$€£]/.test(h))}) — comfortably clears the ₹30–40k floor.`
  } else if (decode.compHints.some((h) => /₹|inr|rs/.test(h))) {
    compFrac = 0.7
    compWhy = `Rupee compensation stated (${decode.compHints.find((h) => /₹|inr|rs/.test(h))}) — check against the ₹30–40k/month floor.`
  } else if (decode.compHints.includes('paid-signal')) {
    compFrac = 0.6
    compWhy = 'Mentions stipend/pay without numbers.'
  }
  parts.push({
    key: 'compSignal',
    label: 'Compensation signal',
    points: Math.round(compFrac * rubric.compSignal),
    max: rubric.compSignal,
    why: compWhy,
  })

  // 6 · Company conviction
  parts.push({
    key: 'conviction',
    label: 'Company conviction',
    points: starred ? rubric.conviction : 0,
    max: rubric.conviction,
    why: starred ? 'Starred on your watchlist.' : 'Not a starred company.',
  })

  return { total: parts.reduce((n, p) => n + p.points, 0), parts }
}
