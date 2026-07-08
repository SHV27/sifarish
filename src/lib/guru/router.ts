import type { GuruMessage, Job, LedgerEntry } from '../../types'
import { scanGuarantee } from '../slop/scan'

/**
 * Deterministic intent router — the Guru's testable core AND its keyless mode (I4).
 *
 * Every reply routed here is honest by construction:
 * - self-claims only from the ledger (I1),
 * - guarantee-bait triggers an I9 refusal,
 * - "claim a skill I don't have" triggers a ledger-grounded refusal.
 *
 * When a Groq key is present, the LLM Guru handles free-form phrasing; this router still
 * runs first to catch the honesty-critical intents so a hallucinating model can't override them.
 */

export type Intent =
  | 'find_jobs'
  | 'explain_score'
  | 'apply_plan'
  | 'what_to_learn'
  | 'refuse_guarantee'
  | 'refuse_fabrication'
  | 'status'
  | 'derive_hunts'
  | 'explain_angle'
  | 'signature_advice'
  | 'resource_budget'
  | 'freeform'

export interface RoutedReply {
  intent: Intent
  text: string
  action?: 'sweep' | 'open_apply_plan' | 'open_radar' | 'derive_hunts'
  citationsRequired: boolean
}

const FABRICATION_SKILLS = /\b(kubernetes|k8s|rust|golang|scala|terraform|hadoop|spark|tensorflow|c\+\+|\.net|php|salesforce)\b/i

export function detectIntent(text: string, ledger: LedgerEntry[]): Intent {
  const t = text.toLowerCase()

  // I9 — guarantee-bait. Highest priority: never let it through.
  if (/\b(guarantee|assured|100%|promise me|sure.?shot|definitely get|will i definitely)\b/.test(t) &&
      /\b(job|offer|intern|selec|placement|hire|get in|admit|placed)/.test(t)) {
    return 'refuse_guarantee'
  }

  // I1 — fabrication-bait: "put X on my resume / say I know X" where X isn't in the ledger.
  if (/\b(add|put|say i know|claim|pretend|write that i|tell them i know|include)\b/.test(t)) {
    const skillMatch = t.match(FABRICATION_SKILLS)
    if (skillMatch) {
      const has = ledger.some(
        (e) => e.resumeEligible && (e.title.toLowerCase().includes(skillMatch[0]) || e.bullets.some((b) => b.keywords.some((k) => k.includes(skillMatch[0])))),
      )
      if (!has) return 'refuse_fabrication'
    }
  }

  // Vision-derived hunts (proposeHunts).
  if (/\b(vision|dream|derive|hunt for|what.*hunt|roles?.*(match|fit).*vision|based on my (vision|dream|goals))\b/.test(t)) return 'derive_hunts'
  // Angle / casting explanation.
  if (/\b(angle|framed?|casting|why.*(lead|chose|picked|benched)|editor)/.test(t)) return 'explain_angle'
  // Sifarish Signature advice.
  if (/\b(signature|p\.?s\.?|meta.?hook|mention.*(built|sifarish))\b/.test(t)) return 'signature_advice'
  // Resource / budget questions.
  if (/\b(budget|spend|spent|credits?|tokens?|cost|how much.*(use|using|call)|cache)\b/.test(t)) return 'resource_budget'

  if (/\b(find|search|look for|show me|any|new)\b.*\b(job|role|intern|opening|position)/.test(t) || /\bsweep\b/.test(t)) return 'find_jobs'
  if (/\b(why|explain|how).*(score|rank|rated|point)/.test(t) || /score.*mean/.test(t)) return 'explain_score'
  if (/\b(apply|application|how do i apply|plan|walk me|steps)\b/.test(t)) return 'apply_plan'
  if (/\b(what|which).*(learn|study|build|improve|missing|gap|skill)/.test(t) || /should i learn/.test(t)) return 'what_to_learn'
  if (/\b(status|pipeline|where am i|how many|progress)\b/.test(t)) return 'status'
  return 'freeform'
}

export function refuseGuarantee(): RoutedReply {
  return {
    intent: 'refuse_guarantee',
    text:
      "I won't promise that — and you should distrust any tool that does. No one can guarantee selection; " +
      'interviews decide. What I can do is make your application the strongest, truest version of itself so ' +
      'your probability is as high as it honestly gets. That is the whole design of this app: maximize your ' +
      'odds, never fake the outcome. Want me to build an apply plan for a specific role?',
    citationsRequired: false,
  }
}

export function refuseFabrication(skill: string): RoutedReply {
  return {
    intent: 'refuse_fabrication',
    text:
      `I can't put "${skill}" on your resume — it isn't in your ledger, and this app compiles only what you ` +
      `can prove. Claiming it would be exactly the fabrication recruiters now hunt for. The honest move: build ` +
      `something small and public with ${skill}, and the moment its repo goes live, Nabz will offer to promote ` +
      `it — then it's true, and it ships. Want me to suggest a tiny ${skill} project you could ship this week?`,
    citationsRequired: false,
  }
}

export function whatToLearn(ledger: LedgerEntry[]): RoutedReply {
  const forge = ledger.filter((e) => e.resumeEligible && e.tier === 'in_forge' && e.kind === 'skill')
  const forgeList = forge.map((e) => e.title).join(', ')
  return {
    intent: 'what_to_learn',
    text:
      forge.length > 0
        ? `You've already named the right targets — they're in your forge: ${forgeList}. These aren't claims yet, ` +
          `and that's correct. Finish and ship one, and it moves to "shipped" on your resume automatically. If I had ` +
          `to pick the highest-leverage next one for the roles you're chasing: whatever appears most in the JDs you're ` +
          `tailoring against — check the Gap Notes on your packets, they tell you exactly which must-haves you're missing evidence for.`
        : `Your shipped skills already cover the core. The sharpest signal for what to learn next is your packets' ` +
          `Gap Notes — every tailored role lists the must-haves you have no evidence for yet. Build toward those, in public.`,
    citationsRequired: false,
  }
}

export function statusReply(jobs: Job[]): RoutedReply {
  const c = (s: string) => jobs.filter((j) => j.status === s).length
  return {
    intent: 'status',
    text:
      `Here's your hunt right now: ${c('found')} found, ${c('tailored')} tailored and ready, ` +
      `${c('applied') + c('followup')} awaiting reply, ${c('interview')} interviewing. ` +
      (c('tailored') > 0
        ? `You have ${c('tailored')} packet(s) compiled but not yet applied — those are your fastest wins.`
        : c('found') > 0
          ? `Tailor a few of the found roles to move them forward.`
          : `Run a Khabri sweep to fill the top of the funnel.`),
    citationsRequired: false,
  }
}

/** The router's honesty gate — run on ANY Guru output (LLM or template) before display. */
export function honestyGate(text: string): { ok: boolean; violations: string[] } {
  const g = scanGuarantee(text)
  return { ok: g.length === 0, violations: g }
}

/** Route a user turn to a deterministic reply for the honesty-critical + keyless paths. */
export function route(userText: string, ledger: LedgerEntry[], jobs: Job[]): RoutedReply {
  const intent = detectIntent(userText, ledger)
  switch (intent) {
    case 'refuse_guarantee':
      return refuseGuarantee()
    case 'refuse_fabrication': {
      const skill = (userText.toLowerCase().match(FABRICATION_SKILLS) ?? ['that skill'])[0]
      return refuseFabrication(skill)
    }
    case 'what_to_learn':
      return whatToLearn(ledger)
    case 'status':
      return statusReply(jobs)
    case 'find_jobs':
      return {
        intent,
        text: 'On it — running a Khabri sweep across every enabled source (LinkedIn/Indeed via the aggregator, plus the keyless lanes). New finds land in the Radar with a NEW stamp.',
        action: 'sweep',
        citationsRequired: false,
      }
    case 'explain_score':
      return {
        intent,
        text: 'Open any role in the Radar and hit "why this score" — every rubric line shows its points and the exact reason. Nothing is hidden math. Want me to walk through a specific one?',
        action: 'open_radar',
        citationsRequired: false,
      }
    case 'apply_plan':
      return {
        intent,
        text: "I'll build a step-by-step apply plan — open the role's packet and I'll lay out exactly what to attach, paste, and send (you send it; I never do).",
        action: 'open_apply_plan',
        citationsRequired: false,
      }
    case 'derive_hunts':
      return {
        intent,
        text: "Let me derive hunts straight from your vision — the role names the market uses for the work you actually want. I'll list them; you confirm each (nothing added silently). You can also do this in Settings → Vision Profile → Derive hunts.",
        action: 'derive_hunts',
        citationsRequired: false,
      }
    case 'explain_angle':
      return {
        intent,
        text: "Open any tailored packet and look at the Casting Sheet — it shows all four editorial passes: which archetype I cast the role as, which projects I put forward and which I benched (with reasons), the angle chosen per project, and the red-team verdict. Every call has a 'Why?' you can expand — and you can overrule any of them; your taste is final.",
        citationsRequired: false,
      }
    case 'signature_advice':
      return {
        intent,
        text: "The Sifarish Signature is that P.S. revealing this letter was compiled by the agent you built. My rule of thumb: include it for AI-first, engineering-led teams (it reads as initiative and proof you ship) and omit it for conservative or non-technical reviewers (it can read as gimmicky). Each packet shows my per-company recommendation with a 'Why?' — and a toggle, so the final call is yours.",
        citationsRequired: false,
      }
    case 'resource_budget':
      return {
        intent,
        text: "Everything metered is in Settings → API budgets and the Dimaag Ledger: LLM calls, cache hits (reused reasoning that cost nothing), heuristic fallbacks, and tokens — per feature, this month. Identical inputs never re-call the model, and if a budget runs low I quietly switch to the deterministic path. Zero silent burn.",
        citationsRequired: false,
      }
    default:
      return {
        intent: 'freeform',
        text:
          "I can find you roles, explain any score, build a step-by-step apply plan, or tell you honestly what to " +
          "learn next. What's on your mind? (I only ever claim what's in your ledger, and I never promise outcomes.)",
        citationsRequired: false,
      }
  }
}

export type { GuruMessage }
