import type { CriticVerdict, GamePlan, Reading } from '../../types'
import { generateWithMeta } from '../dimaag/core'
import { scanHonesty } from '../slop/scan'

/**
 * v2 THE STRATEGIST · pass 3 — THE CRITIC (the hostile recruiter).
 *
 * A separate critic with its OWN rubric beats self-critique (shared blind spots — RESEARCH v2
 * verdict 8). It reads the executed page as the person the Reading says will read it, in six
 * seconds, and names concrete defects it can point at. It does not write; it only returns issues.
 * The strategist may revise the plan ONCE on those issues (bounded), then the page ships with the
 * verdict printed. Keyless / over-budget → verdict SKIPPED, declared — never a silent PASS.
 *
 * Groq-sized: the page text + the reading's summary fit well under Groq's 8K TPM, so this pass
 * can ride the second brain when Gemini is busy.
 */

export const CRITIC_VERSION = 1

export const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'REVISE'] },
    issues: {
      type: 'array',
      items: { type: 'string' },
      description: 'Concrete defects you can point at on the page (≤ 5, most damaging first, ≤ 30 words each). Empty when PASS.',
    },
    sixSecondRead: { type: 'string', description: 'What you took away in six seconds, in one sentence.' },
  },
  required: ['verdict', 'issues', 'sixSecondRead'],
  additionalProperties: false,
} as const

export function criticSystem(): string {
  return [
    'You are THE CRITIC: a hostile, experienced reader of résumés at the company described. You have 100 résumés and six seconds each.',
    'You are handed the reading of the posting (what the company cares about / does not) and the text of one résumé page.',
    'Judge ONLY what is on the page against what THIS company said it wants. Name concrete defects you can point at:',
    'the first three lines do not carry the proof this company asked for; a valued quality is buried; something they said they do not care about takes prime space;',
    'a line reads as generic or AI-written; a number or link is missing where one would decide it; the section order fights the reader.',
    'Do not ask for facts that are not on the page — you cannot know them. Do not praise. PASS only if you would call this person.',
    'Return JSON matching the schema exactly.',
  ].join(' ')
}

interface CriticLLM {
  verdict: 'PASS' | 'REVISE'
  issues: string[]
  sixSecondRead: string
}

function readingBrief(r: Reading): string {
  return [
    `COMPANY: ${r.company} (${r.domain || 'domain not stated'}) · ROLE: ${r.roleTitle} (${r.roleWindow}) · READER: ${r.readerPersona}`,
    `THEY CARE ABOUT: ${r.cares.slice(0, 10).map((q) => q.phrase).join(' · ') || '—'}`,
    `THEY DO NOT CARE ABOUT: ${r.doesNotCare.slice(0, 8).map((q) => q.phrase).join(' · ') || '—'}`,
    `ASKED-FOR SKILLS: ${r.skills.must.slice(0, 10).join(', ') || '—'}`,
  ].join('\n')
}

export async function criticPass(pageText: string, reading: Reading, plan: GamePlan): Promise<CriticVerdict> {
  const user = `THE READING\n${readingBrief(reading)}\n\nTHE PLAN'S OWN CLAIM: ${plan.rationale.slice(0, 500)}\n\nTHE PAGE\n${pageText.slice(0, 9000)}`
  const meta = await generateWithMeta<CriticLLM>({
    feature: 'strategist.critic',
    system: criticSystem(),
    user,
    maxTokens: 700,
    schema: CRITIC_SCHEMA as unknown as Record<string, unknown>,
  }).catch(() => null)
  const at = new Date().toISOString()
  if (!meta || !meta.result) return { verdict: 'SKIPPED', issues: ['no brain was free for the critic — the page shipped unjudged; reopen to retry'], revised: false, by: 'heuristic', at }
  const r = meta.result
  const issues = (Array.isArray(r.issues) ? r.issues : [])
    .map((i) => String(i).replace(/\s+/g, ' ').trim())
    .filter((i) => i.length >= 8 && scanHonesty(i).guarantee.length === 0)
    .slice(0, 5)
  const read = String(r.sixSecondRead ?? '').trim()
  return {
    verdict: r.verdict === 'PASS' && issues.length === 0 ? 'PASS' : 'REVISE',
    issues: read ? [`six-second read: ${read}`, ...issues] : issues,
    revised: false,
    by: meta.mode,
    at,
  }
}

/**
 * Deterministic critic floor — the checks a hostile reader always makes, keyless. Runs on every
 * page (it costs nothing) and feeds the same issues list; the LLM critic adds judgement on top.
 */
export function criticHeuristic(pageText: string, reading: Reading, plan: GamePlan): string[] {
  const issues: string[] = []
  const head = pageText.split('\n').slice(0, 5).join(' ').toLowerCase()
  const care = reading.cares.slice(0, 3)
  const strongest = plan.threeLines.factIds.length
  if (strongest === 0) issues.push('the three lines cite no fact — the opening carries no proof')
  if (care.length && !/\d/.test(head)) issues.push('no number in the first three lines; a reader anchors on a number')
  for (const q of reading.doesNotCare) {
    const p = q.phrase.toLowerCase()
    if (/certificat/.test(p) && /\bcertifications?\b/.test(pageText.slice(0, 1200).toLowerCase())) issues.push(`certifications sit in prime space although they say: "${q.quote}"`)
  }
  const hon = scanHonesty(pageText)
  if (!hon.clean) issues.push(`slop/guarantee phrases on the page: ${[...hon.slop, ...hon.guarantee].join(', ')}`)
  return issues
}
