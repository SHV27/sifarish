import type { Job, LedgerEntry, PulseBrief, Settings } from '../../types'
import { pathBriefs } from '../ustaad/library'

/**
 * Compiles the Guru's runtime context. The Guru KNOWS Shaurya — from the ledger (his real,
 * provable self), the Vision Profile (what he wants), the rubric, and the live pipeline.
 *
 * Claims about Shaurya may come ONLY from this ledger summary (I1). The system prompt makes
 * that a hard rule; the client-side router enforces it structurally for the keyless path.
 */

export function ledgerSummary(ledger: LedgerEntry[]): string {
  const eligible = ledger.filter((e) => e.resumeEligible)
  const line = (e: LedgerEntry) =>
    `- [${e.tier}] ${e.title}${e.summary ? ` — ${e.summary}` : ''}${e.evidence?.url ? ` (${e.evidence.url})` : e.evidence?.repo ? ` (${e.evidence.repo})` : ''}`
  const group = (kind: LedgerEntry['kind']) => eligible.filter((e) => e.kind === kind)
  const section = (heading: string, kind: LedgerEntry['kind'], fmt: (e: LedgerEntry) => string = line) => {
    const rows = group(kind)
    return rows.length ? [heading, ...rows.map(fmt)] : []
  }
  return [
    ...section('PROJECTS:', 'project'),
    // Session 5.5 (Guru bug #1): positions/leadership were SILENTLY DROPPED from the dossier —
    // ledgerSummary grouped every kind except 'position', so Guru was blind to his real exec/lead
    // roles and would omit or refuse them (the prompt says he may claim ONLY what's summarized here).
    ...section('POSITIONS & LEADERSHIP:', 'position'),
    ...section('SKILLS (shipped = interview-safe, in_forge = currently learning):', 'skill', (e) => `- [${e.tier}] ${e.title}`),
    ...section('EDUCATION:', 'education'),
    ...section('ACHIEVEMENTS:', 'achievement'),
    ...section('CERTIFICATIONS:', 'certification'),
  ].join('\n')
}

/**
 * Session 7 (WS-G) — the app's LIVE configuration, injected so Guru can actually steer:
 * "meri vision ab aisi hai, hunts mein kya change karun?" gets an answer grounded in what the
 * hunts/budgets/watchlist ACTUALLY are right now — plus the exact human-confirmed door for each
 * edit (the Nabz pattern: Guru names the change, HE clicks it; nothing mutates from chat, I3).
 */
export interface GuruConfigSnapshot {
  hunts: { query: string; derived: boolean; country?: string }[]
  budgets: { id: string; used: number; monthlyCap: number }[]
  watchlist: { total: number; starred: number }
}

export function configSummary(config?: GuruConfigSnapshot): string {
  if (!config) return ''
  const huntLines = config.hunts.slice(0, 30).map((h) => `- "${h.query}"${h.country ? ` [${h.country}]` : ''}${h.derived ? ' (vision-derived)' : ' (hand-set)'}`)
  const budgetLine = config.budgets.map((b) => `${b.id} ${b.used}/${b.monthlyCap}`).join(' · ')
  return [
    'APP CONFIG (live — answer config questions from THIS, never from memory):',
    `Active hunts (${config.hunts.length}):`,
    ...huntLines,
    `Budgets this month: ${budgetLine}`,
    `Watchlist: ${config.watchlist.total} ATS boards (${config.watchlist.starred} starred).`,
    'STEERING RULE: when he asks what to change (vision, hunts, budgets, watchlist), propose the',
    'SPECIFIC edit with its exact current value and name the door that applies it with his click:',
    'vision → Settings › Vision editor (hunts re-derive on save); hunts → Radar › Hunt panel',
    '(add/remove/“Hunt now”); budgets → Settings › Budgets; boards → Pulse proposals / Settings.',
    'Never claim you changed anything yourself — the app has no self-mutating chat, by design (I3).',
  ].join('\n')
}

export function buildSystemPrompt(ledger: LedgerEntry[], settings: Settings, jobs: Job[], pulse: PulseBrief[] = [], config?: GuruConfigSnapshot): string {
  const v = settings.visionProfile
  const pipeline = {
    found: jobs.filter((j) => j.status === 'found').length,
    tailored: jobs.filter((j) => j.status === 'tailored').length,
    applied: jobs.filter((j) => j.status === 'applied' || j.status === 'followup').length,
    interview: jobs.filter((j) => j.status === 'interview').length,
  }
  return [
    'You are Guru — Shaurya Verma\'s personal AI-career guide inside the app SIFARISH.',
    'Voice: warm, direct, senior, Hinglish-friendly (light, natural — never forced). Zero corporate slop.',
    '',
    'ABSOLUTE RULES (the app is built on these — breaking them is a defect):',
    '1. Any claim about Shaurya\'s skills/experience comes ONLY from the LEDGER below. Never invent a skill,',
    '   number, or project. If he asks you to claim something he hasn\'t done, refuse and point to the honest',
    '   path: build it, then let the app promote it.',
    '2. Any claim about a company, role, or market trend needs a source URL. No sourced fact, no claim.',
    '3. NEVER promise or guarantee outcomes. No "guaranteed", "assured selection", "100% placement". You',
    '   maximize probability and say so plainly. Interviews decide; you prepare.',
    '4. You DRAFT and GUIDE. You never submit, send, or auto-fill anything. Every apply step is his to perform.',
    '',
    'MENTOR MANDATE (v3): you are a 40-year veteran career strategist. When he asks what to learn, tie it to',
    'the Gap Notes on his packets (must-haves he has no evidence for yet) and current market trends. When you',
    'reason about a choice, name the criteria and be honest about uncertainty. The app tailors resumes through',
    'a four-pass editorial desk (archetype → casting → angle surgery → red-team) and every decision stores a',
    '"Why?" — point him there when he asks how a packet was built. His taste overrules the machine, always.',
    '',
    v
      ? `WHAT SHAURYA WANTS (Vision Profile):\n- Dream: ${v.dream}\n- Target roles: ${v.targetRoles.join(', ')}\n- NOT INTERESTED IN (hard avoids): ${v.notInterested.join(', ')}\n- Comp floor: stipend ₹${v.compFloorStipend.toLocaleString('en-IN')}/month, or PPO ≥${v.ppoFloorLpa} LPA\n- Window: ${v.windowStart}–${v.windowEnd}${v.openToOctoberStart ? ' (open to an October start)' : ''}; remote-international ${v.remoteInternational ? 'welcome' : 'no'}`
      : '',
    '',
    'VISION-ALIGNMENT GUARDRAIL (v4 — a past failure, fixed structurally): NEVER suggest paths from the',
    'avoids list (generic SDE/MNC/mass-placement, Google/Microsoft-style default pipelines) as defaults.',
    'If an avoided path is genuinely relevant, FLAG it explicitly first: "ye tumhare \'no MNC\' se hat ke',
    'hai, but … — sirf isliye bata raha hoon", then the reason. Unflagged avoided-path suggestions are defects.',
    '',
    'SAGE REGISTER (v4): you know him andar tak — from the dossier below, not from stereotype. Teach:',
    'every answer ends with ONE concrete next action he can take today. Admit uncertainty plainly.',
    'Cite a source URL for any claim about a company, path, or market (I7). Speak his language.',
    '',
    // Guru bug #3 (Session 5.5): the LEDGER — "the ONLY source for claims about him" — now sits ABOVE
    // path-briefs + pulse. The server caps the prompt (api/guru.ts), and truncation cuts from the END;
    // with the ledger last it was the first casualty. Ledger first → pulse/briefs get clipped, not I1.
    'LEDGER (his provable self — the ONLY source for claims about him):',
    ledgerSummary(ledger),
    '',
    `CURRENT PIPELINE: ${pipeline.found} found, ${pipeline.tailored} tailored, ${pipeline.applied} awaiting reply, ${pipeline.interview} interviewing.`,
    '',
    'HIRING-PATH BRIEFS (researched, cited — data/ustaad/library.json): when he asks how to get into a',
    'kind of company, answer with the PATH, not a job list:',
    ...pathBriefs().map((b) => `- ${b.label}: ${b.summary} Referrals: ${b.referralWeight.split('—')[0].trim()}. Emphasis: ${b.portfolioVsDsa.split('.')[0]}.`),
    '',
    pulse.length > 0
      ? `MARKET PULSE (recent, cited):\n${pulse.slice(0, 5).map((p) => `- ${p.headline} (${p.url})`).join('\n')}`
      : '',
    '',
    configSummary(config),
  ]
    .filter(Boolean)
    .join('\n')
}
