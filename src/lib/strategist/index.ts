import type { CriticVerdict, GamePlan, Identity, Job, LedgerEntry, Reading, SectionDef, StrategistMode, VisionProfile } from '../../types'
import { criticHeuristic, criticPass } from './critic'
import { makePlan, planHeuristic } from './plan'
import { readPosting, readPostingHeuristic } from './reading'

/**
 * v2 THE STRATEGIST — the orchestrator. Reading → Plan → (page compiled by the caller) → Critic
 * → one bounded revise. `strategizeFast` is the instant, keyless floor (the packet on screen in
 * ~300 ms); `strategize` is the reasoned pass that replaces it in the background. Both return the
 * same typed artifacts, so the page never waits on a brain and never blanks (I4).
 */

export interface StrategyInputs {
  job: Job
  ledger: LedgerEntry[]
  identity: Identity
  vision?: VisionProfile
  sections?: SectionDef[]
}

export interface Strategy {
  reading: Reading
  plan: GamePlan
  mode: StrategistMode
}

/** The posting text the reader gets: the WHOLE page he pasted (jd holds it), plus the title/company header. */
export function postingText(job: Job): string {
  return `${job.title}\n${job.company}${job.location ? ` · ${job.location}` : ''}\n\n${job.jd}`
}

export function strategizeFast(inp: StrategyInputs): Strategy {
  const reading = readPostingHeuristic(postingText(inp.job), inp.job.company, inp.job.title)
  const plan = planHeuristic(reading, inp.ledger, inp.identity, inp.vision, inp.sections)
  return { reading, plan, mode: 'heuristic' }
}

export async function strategize(inp: StrategyInputs): Promise<Strategy> {
  const reading = await readPosting(postingText(inp.job), inp.job.company, inp.job.title)
  const plan = await makePlan({ reading, ledger: inp.ledger, identity: inp.identity, vision: inp.vision, sections: inp.sections })
  const mode: StrategistMode = plan.by !== 'heuristic' ? plan.by : reading.by !== 'heuristic' ? reading.by : 'heuristic'
  return { reading, plan, mode }
}

/**
 * The critic on the EXECUTED page. The deterministic floor always runs; the LLM critic adds
 * judgement when a brain is free. Returns the verdict; the caller decides whether to revise.
 */
export async function judgePage(pageText: string, reading: Reading, plan: GamePlan, withBrain: boolean): Promise<CriticVerdict> {
  const floor = criticHeuristic(pageText, reading, plan)
  if (!withBrain) {
    return { verdict: floor.length ? 'REVISE' : 'PASS', issues: floor, revised: false, by: 'heuristic', at: new Date().toISOString() }
  }
  const v = await criticPass(pageText, reading, plan)
  const merged = [...new Set([...v.issues, ...floor])]
  return { ...v, issues: merged, verdict: v.verdict === 'SKIPPED' ? (floor.length ? 'REVISE' : 'SKIPPED') : merged.length && v.verdict !== 'PASS' ? 'REVISE' : v.verdict }
}
