import type { Job, LedgerEntry, ScoreBreakdown, Settings } from '../types'
import { scoreJobCached } from './radar/score'
import { nudgeState } from './morcha'

/**
 * THE CHIEF-OF-STAFF BRIEFING (Session 5.6) — what a real assistant hands you the moment you sit
 * down: the roles worth your time (ranked by YOUR vision, with the reason), the follow-ups that are
 * due, the interviews to prep, and the ONE thing to do next. Pure + deterministic so it is testable
 * and needs no keys — it only READS and AGGREGATES what other parts already compute (scoreJobCached,
 * nudgeState). It never sweeps, never spends, never mutates. The display is a thin wrapper (Briefing.tsx).
 */

export interface BriefingMatch {
  job: Job
  score: ScoreBreakdown
  visionWhy: string
}

export type BriefingTarget = 'radar' | 'morcha' | 'khabri' | 'packet'

export interface BriefingData {
  newCount: number
  topMatches: BriefingMatch[]
  dueFollowups: Job[]
  interviews: Job[]
  tailoredCount: number
  /** The single most valuable next move, priority-ordered — an assistant gives ONE, not a list. */
  next: { text: string; cta: string; target: BriefingTarget; jobId?: string }
}

const visionPoints = (s: ScoreBreakdown) => s.parts.find((p) => p.key === 'visionFit')?.points ?? 0

export function buildBriefing(jobs: Job[], ledger: LedgerEntry[], settings: Settings, starred: Set<string> = new Set()): BriefingData {
  const ranked = jobs
    .filter((j) => j.status === 'found' && !j.closed) // closed postings never brief him (S5.10)
    .map((j) => ({ job: j, score: scoreJobCached(j, ledger, settings.rubric, starred.has(j.company), settings.visionProfile) }))
    // Vision breaks ties at the score ceiling — his target-role matches surface above generic AI.
    .sort((a, b) => b.score.total - a.score.total || visionPoints(b.score) - visionPoints(a.score))

  const topMatches: BriefingMatch[] = ranked.slice(0, 3).map(({ job, score }) => ({
    job,
    score,
    visionWhy: score.parts.find((p) => p.key === 'visionFit')?.why ?? '',
  }))
  const newCount = jobs.filter((j) => j.isNew === true).length
  const dueFollowups = jobs.filter((j) => nudgeState(j).due)
  const interviews = jobs.filter((j) => j.status === 'interview')
  const tailoredCount = jobs.filter((j) => j.status === 'tailored').length

  // ONE next action, priority-ordered: prep an interview > answer a due follow-up > apply a ready
  // packet > tailor your #1 match > fill the funnel. A chief of staff tells you the single next move.
  let next: BriefingData['next']
  if (interviews.length > 0) {
    next = { text: `Prep for your interview${interviews.length > 1 ? `s (${interviews.length})` : ''}${interviews[0] ? ` — ${interviews[0].company}` : ''}`, cta: 'Interview dossier →', target: 'morcha' }
  } else if (dueFollowups.length > 0) {
    next = { text: `Follow up with ${dueFollowups[0].company}${dueFollowups.length > 1 ? ` +${dueFollowups.length - 1} more` : ''} — it's been a week`, cta: 'Open follow-ups →', target: 'morcha' }
  } else if (tailoredCount > 0) {
    next = { text: `${tailoredCount} packet${tailoredCount > 1 ? 's' : ''} compiled and ready — apply now (fastest wins)`, cta: 'Open the board →', target: 'morcha' }
  } else if (topMatches.length > 0) {
    next = { text: `Tailor "${topMatches[0].job.title}" at ${topMatches[0].job.company} — your #1 match right now`, cta: 'Tailor it →', target: 'packet', jobId: topMatches[0].job.id }
  } else {
    next = { text: 'Run a Khabri sweep to pull in roles matched to your vision', cta: 'Open Khabri →', target: 'khabri' }
  }

  return { newCount, topMatches, dueFollowups, interviews, tailoredCount, next }
}
