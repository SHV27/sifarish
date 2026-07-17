import type { Job, LedgerEntry, RubricWeights, ScoreBreakdown, ScorePart, VisionProfile } from '../../types'
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

/** A short signature of the vision fields that move a score, for the cache key. */
function visionSig(v?: VisionProfile): string {
  if (!v) return '-'
  return `${v.targetRoles.join(',')}|${v.notInterested.join(',')}|${v.dream.length}`
}

export function scoreJobCached(job: Job, ledger: LedgerEntry[], rubric: RubricWeights, starred: boolean, vision?: VisionProfile): ScoreBreakdown {
  // updatedAt joins the key: the staleness deduction (D65) is a function of the posting date,
  // so a re-synced job whose date moved must re-score rather than serve a stale breakdown.
  // visionSig joins it too (D85): the same job re-ranks when his vision changes.
  // lastSeenOpenAt joins the key (Session 6): a board scan that re-verifies a posting open must
  // re-score it — a softened staleness deduction served from a stale cache would be invisible.
  const key = `${job.id}|${job.fetchedAt}|${job.updatedAt ?? ''}|${job.lastSeenOpenAt ?? ''}|${job.jd.length}|${rubricSig(rubric)}|${starred ? 1 : 0}|${visionSig(vision)}`
  const hit = scoreCache.get(key)
  if (hit) return hit
  const result = scoreJob(job, ledger, rubric, starred, vision)
  if (scoreCache.size > 1200) scoreCache.clear() // simple bound; recompute is cheap after
  scoreCache.set(key, result)
  return result
}

export function scoreJob(job: Job, ledger: LedgerEntry[], rubric: RubricWeights, starred: boolean, vision?: VisionProfile): ScoreBreakdown {
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
  } else if (job.salary) {
    // Session 5.8 — the structured salary the provider itself published (Adzuna/JSearch/Remotive/
    // RemoteOK set Job.salary) was captured but never scored: a posting with a clean salary field
    // and no comp language in the JD body sat at "No compensation signal". A stated salary from
    // the board is at least as strong a signal as comp language buried in JD prose.
    compFrac = /[$€£]/.test(job.salary) ? 0.9 : /₹|inr|lpa|lakh/i.test(job.salary) ? 0.7 : 0.6
    compWhy = `Posting states salary: ${job.salary.slice(0, 60)}.`
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

  // 7 · Staleness (D65) — a deduction, not a rubric dimension.
  //
  // The rubric scored WHAT a role is and never WHEN it was posted, so a LangChain posting last
  // touched 511 days ago sat at 85 and ate a slot in the top 15. A 17-month-old listing is
  // almost certainly filled or dead: it is not a sniper target, whatever its keywords say.
  // Implemented as a deduction so his saved rubric weights keep their meaning (no migration,
  // no silent reweighting of the dimensions he tuned), and it renders in "why this score"
  // like every other part — the penalty is never hidden math (L4).
  parts.push(stalenessPart(job))

  // Session 6.1 (owner-caught: "you even suggested me an unpaid intern"): an explicitly unpaid
  // posting sits below his stated stipend floor by definition — a hard, visible deduction, so it
  // can never hold a queue slot on keyword strength alone. Deterministic; renders in "why" (L4).
  if (/\bunpaid\b|\bno stipend\b|\bwithout (a )?stipend\b|\bnon-?paid\b/i.test(`${job.title} ${job.jd}`)) {
    parts.push({ key: 'unpaid', label: 'Unpaid', points: -20, max: 0, why: 'The posting says UNPAID — below your stated stipend floor; it costs 20 points so it never outranks paid work.' })
  }

  // 8 · Vision fit (D85) — the piece that makes the top 15 HIS, not a generic AI list.
  //
  // The rubric above scores what a role IS (AI-ness, ledger fit, remote, window) but never whether
  // it is the role HE actually wants. LinkedIn ranks on his stated preferences; SIFARISH did not,
  // so generic AI roles bubbled up and his top 15 read as "someone else's list" (D68). This scores
  // a role against his Vision Profile: his named target role in the TITLE is the strongest signal
  // (that is exactly what a job board ranks on), his dream themes are secondary, and a hit on his
  // not-interested list is a real penalty. Rendered like every other part (L4). A boost + the
  // staleness deduction together give the queue real spread toward fresh, on-vision roles.
  parts.push(visionPart(job, vision))

  // Vision can push a strong match past the rubric's 100 — cap it; a deduction can't go below 0.
  const total = Math.max(0, Math.min(100, parts.reduce((n, p) => n + p.points, 0)))
  return { total, parts }
}

/** Salient theme words a vision dream implies (AI-role vocabulary), for secondary matching. */
const VISION_THEMES = [
  'agent', 'agentic', 'llm', 'rag', 'retrieval', 'multimodal', 'vision', 'voice', 'speech',
  'fine-tun', 'fine tun', 'eval', 'guardrail', 'orchestrat', 'inference', 'serving', 'mlops',
  'platform', 'research', 'applied', 'nlp', 'transformer', 'diffusion', 'reinforcement', 'ranking',
  'recommendation', 'generative', 'foundation model', 'prompt', 'automation', 'tool use',
]

/**
 * Vision fit — deterministic, inspectable, bounded. Boost for on-vision roles, penalty for
 * off-vision ones. Absent vision → neutral (0), so nothing breaks before onboarding is done.
 */
export function visionPart(job: Job, vision?: VisionProfile): ScorePart {
  if (!vision) return { key: 'visionFit', label: 'Vision fit', points: 0, max: 24, why: 'No Vision Profile yet — set one in Settings to rank roles by what YOU want.' }

  const title = job.title.toLowerCase()
  const hay = `${job.title} ${job.jd}`.toLowerCase()
  const wordHit = (h: string, needle: string) => new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(h)

  const rolePhrases = vision.targetRoles.map((r) => r.toLowerCase().trim()).filter((r) => r.length >= 3)
  const dreamHay = `${vision.dream} ${vision.targetRoles.join(' ')}`.toLowerCase()
  const activeThemes = VISION_THEMES.filter((t) => dreamHay.includes(t))

  let pts = 0
  const why: string[] = []

  // Session 5.6 (D85 fix): match on the role's CORE words, dropping the ubiquitous seniority tokens
  // a real title almost never carries. "AI Engineer Intern" used to require the literal word "Intern"
  // in the title, so the actual posting "AI Engineer" scored ZERO on the strongest lever — the exact
  // reason his named roles didn't top the queue. Now the core ("ai", "engineer") is what must match.
  const GENERIC_TITLE_WORDS = new Set(['intern', 'interns', 'internship', 'internships', 'co-op', 'coop', 'trainee', 'fellow', 'fellowship'])
  const coreOf = (r: string) => r.split(/\s+/).filter((w) => !GENERIC_TITLE_WORDS.has(w))
  const titleRole = rolePhrases.find((r) => {
    const core = coreOf(r)
    return core.length > 0 && wordHit(title, core[0]) && core.every((w) => title.includes(w))
  })
  if (titleRole) {
    pts += 16
    why.push(`its title matches your target role "${titleRole}"`)
  } else if (rolePhrases.some((r) => hay.includes(r))) {
    pts += 8
    why.push('a target role you named appears in the description')
  }

  const themeHits = activeThemes.filter((t) => hay.includes(t))
  if (themeHits.length > 0) {
    pts += Math.min(themeHits.length * 2, 8)
    why.push(`vision themes present: ${[...new Set(themeHits.map((t) => t.replace(/-?tun$/, '-tuning')))].slice(0, 4).join(', ')}`)
  }

  const noHit = vision.notInterested.map((n) => n.toLowerCase().trim()).find((n) => n.length >= 3 && wordHit(hay, n))
  if (noHit) {
    pts -= 18
    why.push(`but it hits "${noHit}" from your not-interested list`)
  }

  pts = Math.max(-20, Math.min(24, pts))
  return {
    key: 'visionFit',
    label: 'Vision fit',
    points: pts,
    max: 24,
    why: why.length > 0 ? why.join('; ') + '.' : 'No overlap with your stated target roles or vision themes.',
  }
}

/** A board scan confirmed this posting open within the last N days → it is verifiably hiring. */
const VERIFIED_OPEN_WINDOW_DAYS = 10

/** Age bands. Unknown date → no penalty: we punish evidence of staleness, never absence of it. */
export function stalenessPart(job: Job, now = Date.now()): ScorePart {
  const stamp = job.updatedAt
  if (!stamp) {
    return { key: 'freshness', label: 'Freshness', points: 0, max: 0, why: 'No posting date published by this board — not penalised on a guess.' }
  }
  // Session 5.5 (bug B1): a PRESENT-but-unparseable date used to yield NaN, and every `NaN <= n` is
  // false, so a malformed stamp fell through to the max −30 penalty + "Last touched NaNd ago". An
  // unrecognised date is now treated like a missing one — we penalise evidence of staleness, never a
  // parsing failure.
  const t = new Date(stamp).getTime()
  if (!Number.isFinite(t)) {
    return { key: 'freshness', label: 'Freshness', points: 0, max: 0, why: 'Posting date unrecognised — not penalised on a guess.' }
  }
  const days = Math.max(0, Math.floor((now - t) / 86400000))
  const band = days <= 30 ? 0 : days <= 60 ? -5 : days <= 120 ? -12 : days <= 240 ? -20 : -30

  // Session 6 (owner: "hiring chal rahi ho, that's what matters — age ≠ death"). When the last
  // board scan SAW this posting still listed (D122's openIds, stamped as lastSeenOpenAt), the
  // company is verifiably still hiring whatever the posted date says. Evidence of life caps the
  // deduction at −8: an old-but-verified-open role stays in the running, while an equally old
  // aggregator ghost (no board to verify against) keeps the full penalty. We soften on proof of
  // life, never on hope.
  const seenOpen = job.lastSeenOpenAt ? new Date(job.lastSeenOpenAt).getTime() : NaN
  const verifiedOpen = Number.isFinite(seenOpen) && now - seenOpen <= VERIFIED_OPEN_WINDOW_DAYS * 86400000
  if (verifiedOpen && band < -8) {
    const seenDays = Math.max(0, Math.floor((now - seenOpen) / 86400000))
    return {
      key: 'freshness',
      label: 'Freshness',
      points: -8,
      max: 0,
      why: `Posted ${days}d ago, but its own board still listed it ${seenDays === 0 ? 'today' : `${seenDays}d ago`} — verified open, so age costs it far less than a ghost.`,
    }
  }

  const why =
    band === 0
      ? `Posted ${days}d ago — live.`
      : days > 240
        ? `Last touched ${days}d ago. A posting this old is usually filled or abandoned; it should not hold a slot in your top 15.`
        : `Last touched ${days}d ago — going cold, apply-through rate drops with age.`
  return { key: 'freshness', label: 'Freshness', points: band, max: 0, why }
}
