import type { GuruMessage, Job, LedgerEntry, VisionProfile } from '../../types'
import { scanGuarantee } from '../slop/scan'
import { pathBriefs, sourcesOf, citePatterns } from '../ustaad/library'

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
  | 'path_brief'
  | 'sharpen_vision'
  | 'vision_check'
  | 'freeform'

export interface RoutedReply {
  intent: Intent
  text: string
  action?: 'sweep' | 'open_apply_plan' | 'open_radar' | 'derive_hunts'
  citationsRequired: boolean
  /** I7 — external claims carry their sources. */
  citations?: { title: string; url: string }[]
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

  // Sharpen the vision/about (Guru v3 — the reported-failure fix: proposed edits, grounded + cited).
  if (/\b(sharpen|improve|polish|rewrite|strengthen|better|raise)\b.*\b(about|vision|profile|headline|chances|odds)\b/.test(t) ||
      /\b(about|vision)\b.*\b(sharpen|improve|kaise (behtar|sharp))\b/.test(t)) {
    return 'sharpen_vision'
  }
  // Hiring-path briefs (Guru v3): "how do I get into an AI startup / research lab / big tech?"
  if (/\b(how (do|can|should) i|kaise|what('s| is) the (path|way)|path (to|into)|break into|get into|get hired (at|by))\b/.test(t) &&
      /\b(startup|research lab|lab|residency|big tech|faang|company|companies|openai|deepmind|anthropic)\b/.test(t)) {
    return 'path_brief'
  }
  if (/\b(difference|compare|vs|versus)\b.*\b(startup|big tech|lab|residency)\b/.test(t)) return 'path_brief'
  // Vision-derived hunts (proposeHunts).
  if (/\b(vision|dream|derive|hunt for|what.*hunt|roles?.*(match|fit).*vision|based on my (vision|dream|goals))\b/.test(t)) return 'derive_hunts'
  // Vision-alignment check: "should I apply/go for" an avoided lane → flagged answer, never a default.
  if (/\b(should i|worth|kya main)\b.*\b(apply|join|go|try|target)\b/.test(t) &&
      /\b(google|microsoft|amazon|meta|apple|tcs|infosys|wipro|accenture|cognizant|capgemini|mass (placement|recruit)|mnc|service compan|big.?tech)/.test(t)) {
    // Session 5.6 (Guru #6): the deterministic flag now covers big-tech names too — "should I apply to
    // Google?" gets the honest vision-aligned answer up front, not a default yes that leans on the scan.
    return 'vision_check'
  }
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

/** Pick the hiring-path brief(s) the question is about; default = compare all three. */
export function pathBriefReply(text: string): RoutedReply {
  const t = text.toLowerCase()
  const briefs = pathBriefs()
  const pick =
    /\b(startup)\b/.test(t) && !/big tech|lab/.test(t)
      ? briefs.filter((b) => b.id === 'ai-first-startup')
      : /\b(lab|research|residency)\b/.test(t) && !/startup|big tech/.test(t)
        ? briefs.filter((b) => b.id === 'research-lab')
        : /\b(big tech|faang)\b/.test(t) && !/startup|lab/.test(t)
          ? briefs.filter((b) => b.id === 'big-tech-internship')
          : briefs
  const body = pick
    .map(
      (b) =>
        `${b.label.toUpperCase()}: ${b.summary} Timeline: ${b.timeline} Referrals: ${b.referralWeight} ` +
        `Interview emphasis: ${b.portfolioVsDsa} Conversion: ${b.conversionNorms}`,
    )
    .join('\n\n')
  const next =
    pick.length === 1 && pick[0].id === 'ai-first-startup'
      ? 'Next action: pick one company from your Radar queue and draft the hiring-manager outreach today — in this lane, the warm intro IS the pipeline.'
      : pick.length === 1 && pick[0].id === 'research-lab'
        ? 'Next action: make one project reproducible end-to-end (repo + honest eval writeup) — that artifact is the application.'
        : pick.length === 1
          ? 'Next action: check the application window now — big-tech intern pipelines open ~8–12 months ahead, and a missed window costs a season.'
          : 'Next action: your lane is AI-first startups (your vision says so) — treat the other two as options you deliberately declined, not defaults you missed.'
  const citations = pick.flatMap((b) => sourcesOf(b).slice(0, 2).map((s) => ({ title: s.title, url: s.url })))
  return { intent: 'path_brief', text: `${body}\n\n${next}`, citationsRequired: true, citations }
}

/** Sharpen the About/Vision — ledger-grounded, library-cited, proposed (never silently applied). */
export function sharpenVision(ledger: LedgerEntry[], vision?: VisionProfile): RoutedReply {
  const shipped = ledger.filter((e) => e.resumeEligible && e.tier === 'shipped' && e.kind === 'project')
  const withUrl = shipped.filter((p) => p.evidence?.url)
  const strongest = withUrl[0] ?? shipped[0]
  const suggestions = [
    strongest
      ? `Lead your About with the strongest shipped proof, not adjectives: "${strongest.title.split('—')[0].trim()}" with its live link — a recruiter's first skim fixates on the top lines (Ustaad ¶six-second-skim).`
      : 'Ship one public project first — an About without a live artifact is adjectives.',
    vision?.dream
      ? `Your dream line ("${vision.dream.slice(0, 80)}…") is direction; sharpen it into an outcome sentence shaped like the XYZ formula — what you build, for whom, with what measured proof (¶xyz-formula).`
      : 'Write the dream as one concrete sentence: what you build, for whom, with what proof.',
    `Name the numbers your ledger already holds (projects shipped, boards probed, parse-back fidelity) — quantified lines are the top shortlisting signal recruiters report (¶quantify-everything-honest).`,
    vision?.notInterested?.length
      ? `Keep the "not interested" list (${vision.notInterested.slice(0, 2).join(', ')}) explicit in Settings — it is my guardrail: I will never pitch those lanes as defaults.`
      : 'Fill the "not interested" list in Settings → Vision Profile — it becomes my guardrail.',
  ]
  return {
    intent: 'sharpen_vision',
    text:
      `Proposed sharpenings (edit Settings → Vision Profile yourself — I propose, never apply):\n` +
      suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n') +
      `\n\nNext action: rewrite the dream line as one XYZ-shaped sentence and paste it into the Vision Profile now.`,
    citationsRequired: true,
    citations: citePatterns(['six-second-skim', 'xyz-formula', 'quantify-everything-honest'], 3),
  }
}

/** Vision-alignment guardrail: an avoided lane is answered with an explicit flag, never as a default. */
export function visionCheck(vision?: VisionProfile): RoutedReply {
  const avoids = vision?.notInterested?.join(', ') || 'generic mass-placement lanes'
  return {
    intent: 'vision_check',
    text:
      `Ye tumhare stated avoids se hat ke hai (${avoids}) — isliye main ise kabhi default suggest nahi karta. ` +
      `Sirf isliye bata raha hoon kyunki tumne poocha: mass-placement lanes optimize for volume, not for the ` +
      `AI-first work in your ledger; your portfolio's edge disappears in that pipeline. If you still want a ` +
      `safety lane, do it deliberately and time-boxed — but your Radar queue is built for the lane you chose. ` +
      `Next action: open the Radar and tailor the top-ranked role instead.`,
    citationsRequired: false,
  }
}

/**
 * The vision-alignment output scan (the reported-failure fix, structural). If a reply PITCHES an
 * avoided lane without an explicit flag, the reply is discarded and the router's grounded text
 * stands (client.ts). Used on LLM output.
 *
 * Session 5.5 fixes two holes the audit found:
 *  - Bug #2: the flag no longer counts if it merely appears SOMEWHERE — "you should deliberately
 *    target Google" used to pass because 'deliberately' existed. The scan is now SENTENCE-AWARE: a
 *    lane pitch is excused only when a real flag sits in the SAME sentence (or the one before it),
 *    and the too-loose 'deliberately' is no longer a flag word.
 *  - Bug #4: it now derives lanes from HIS ACTUAL notInterested list (pure frontend, non-AI QA/…),
 *    not only a hardcoded big-tech regex — so the guard reflects his stated avoids, not a fixed set.
 */
const MISALIGNED_LANES_ALT =
  'google|microsoft|amazon|meta|apple|tcs|infosys|wipro|accenture|cognizant|capgemini|mass placement|service compan\\w*|generic sde|big.?tech pipeline'
const SUGGESTION_VERBS = /\b(apply|target|aim (for|at)|try|consider|focus on|recommend|suggest|you should|go for|pursue|prioritize|opt for|lean into)\b/i
const FLAG_PHRASES = /hat ke hai|off your stated|against your (vision|avoids|stated)|you said no to|outside your lane|not your lane|sirf isliye bata|know you avoid|despite your/i
// Generic/dangerous tokens that must never become an avoided-lane marker — 'ai' especially (his whole
// vision IS AI; treating it as an avoid would flag every on-vision suggestion).
const LANE_STOP = new Set(['ai', 'non', 'pure', 'generic', 'mass', 'role', 'roles', 'work', 'the', 'and', 'for', 'with', 'into', 'your', 'you', 'job', 'jobs'])

function laneRegex(vision?: VisionProfile): RegExp {
  const userTerms = (vision?.notInterested ?? [])
    .flatMap((t) => t.toLowerCase().match(/[a-z][a-z+.#-]{2,}/g) ?? [])
    .filter((w) => w.length >= 3 && !LANE_STOP.has(w))
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`\\b(${[MISALIGNED_LANES_ALT, ...new Set(userTerms)].join('|')})\\b`, 'gi')
}

export function visionAlignmentScan(text: string, vision?: VisionProfile): { aligned: boolean; hits: string[] } {
  if (!vision?.notInterested?.length) return { aligned: true, hits: [] }
  const re = laneRegex(vision)
  // Sentence-aware: naming a company as a fact/comparison is fine; PITCHING an avoided lane as his
  // path is not — and only a flag in the same sentence (or the one before) excuses it.
  const sentences = text.split(/(?<=[.!?])\s+|\n+/)
  const hits: string[] = []
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i]
    const laneMatches = s.match(re)
    if (!laneMatches) continue
    if (!SUGGESTION_VERBS.test(s)) continue // a factual mention, not a pitch
    const window = `${sentences[i - 1] ?? ''} ${s}`
    if (FLAG_PHRASES.test(window)) continue // properly flagged as a deliberate, off-vision aside
    hits.push(...laneMatches.map((h) => h.toLowerCase()))
  }
  return { aligned: hits.length === 0, hits: [...new Set(hits)] }
}

/** The router's honesty gate — run on ANY Guru output (LLM or template) before display. */
export function honestyGate(text: string): { ok: boolean; violations: string[] } {
  const g = scanGuarantee(text)
  return { ok: g.length === 0, violations: g }
}

/** Route a user turn to a deterministic reply for the honesty-critical + keyless paths. */
export function route(userText: string, ledger: LedgerEntry[], jobs: Job[], vision?: VisionProfile): RoutedReply {
  const intent = detectIntent(userText, ledger)
  switch (intent) {
    case 'path_brief':
      return pathBriefReply(userText)
    case 'sharpen_vision':
      return sharpenVision(ledger, vision)
    case 'vision_check':
      return visionCheck(vision)
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
