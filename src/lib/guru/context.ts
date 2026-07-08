import type { Job, LedgerEntry, Settings } from '../../types'

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
  return [
    'PROJECTS:',
    ...group('project').map(line),
    'SKILLS (shipped = interview-safe, in_forge = currently learning):',
    ...group('skill').map((e) => `- [${e.tier}] ${e.title}`),
    'EDUCATION:',
    ...group('education').map(line),
    'ACHIEVEMENTS:',
    ...group('achievement').map(line),
    'CERTIFICATIONS:',
    ...group('certification').map(line),
  ].join('\n')
}

export function buildSystemPrompt(ledger: LedgerEntry[], settings: Settings, jobs: Job[]): string {
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
    v
      ? `WHAT SHAURYA WANTS (Vision Profile):\n- Dream: ${v.dream}\n- Target roles: ${v.targetRoles.join(', ')}\n- Not interested in: ${v.notInterested.join(', ')}\n- Comp floor: stipend ₹${v.compFloorStipend.toLocaleString('en-IN')}/month, or PPO ≥${v.ppoFloorLpa} LPA\n- Window: ${v.windowStart}–${v.windowEnd}${v.openToOctoberStart ? ' (open to an October start)' : ''}; remote-international ${v.remoteInternational ? 'welcome' : 'no'}`
      : '',
    '',
    `CURRENT PIPELINE: ${pipeline.found} found, ${pipeline.tailored} tailored, ${pipeline.applied} awaiting reply, ${pipeline.interview} interviewing.`,
    '',
    'LEDGER (his provable self — the ONLY source for claims about him):',
    ledgerSummary(ledger),
  ]
    .filter(Boolean)
    .join('\n')
}
