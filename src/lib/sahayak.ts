import type { Identity, Job, LedgerEntry, Packet } from '../types'

/**
 * SAHAYAK (Session 6, P1) — the artifacts a paid human career agent hands a candidate, compiled
 * lawfully: drafted, cited, HUMAN-SENT. Benchmarked against reverse-recruiter / placement-team
 * practice (capability matrix in the S6 report):
 *   · a follow-up raises response rates ~65% (Robert Half / Backlinko-class data) — so the day-7/14
 *     nudge now hands him the MESSAGE, not just the reminder;
 *   · referred candidates take ~72% of interviews from ~7% of applicants (Zippia) — so every packet
 *     can draft the referral ask;
 *   · post-rejection retros are the compounding loop no software product does — so verdicts feed a
 *     deterministic "what your rejections share" aggregation.
 * All deterministic, all evidence-grounded (I1 style — proofs come from the ledger), zero LLM,
 * zero sends (I3: he copies, he sends). No guarantee language anywhere (I9).
 */

function topProof(ledger: LedgerEntry[]): LedgerEntry | undefined {
  return ledger.filter((e) => e.resumeEligible && e.tier === 'shipped' && e.kind === 'project' && (e.evidence?.url || e.evidence?.repo))[0]
}

const cleanUrl = (u?: string) => (u ?? '').replace(/^https?:\/\//, '')

/**
 * The follow-up DRAFT at the moment the nudge fires. Day 7: short, warm, adds one new proof point
 * (the mechanics that measurably work: brief, references the exact role + date, gives a reason to
 * look again, asks nothing burdensome). Day 14: the graceful last touch.
 */
export function draftFollowUp(job: Job, day: 7 | 14, identity: Identity, ledger: LedgerEntry[]): string {
  const first = identity.name.split(' ')[0]
  const applied = job.appliedAt ? new Date(job.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'recently'
  const proof = topProof(ledger)
  if (day === 7) {
    return (
      `Subject: Following up — ${job.title} application (${applied})\n\n` +
      `Hi — I applied for ${job.title} at ${job.company} on ${applied} and wanted to check in, since I know strong applications can sit in a busy queue.\n\n` +
      `Since applying I've kept shipping${proof ? ` — ${proof.title.split('—')[0].trim()} is live at ${cleanUrl(proof.evidence?.url ?? proof.evidence?.repo)}` : ''}. ` +
      `If it's useful, I'm happy to share anything else that helps you evaluate the fit.\n\n` +
      `Thanks for your time — ${first}`
    )
  }
  return (
    `Subject: Last note — ${job.title} at ${job.company}\n\n` +
    `Hi — following up once more on my ${job.title} application from ${applied}. I understand priorities shift; if this role has moved on, no reply needed and thank you for the consideration.\n\n` +
    `If it's still open, I remain genuinely interested — ${job.company} is one of a small, deliberate list I'm pursuing. Either way, I'd welcome staying on your radar for future AI roles.\n\n` +
    `— ${first}`
  )
}

/**
 * The referral ask — drafted for HIM to send to someone he actually knows (or finds via public
 * sources: the company's site, GitHub, conference talks). Never sent by the app, never scraped
 * from anywhere (I3). Short, specific, easy to forward — the shape referrers actually act on.
 */
export function draftReferralAsk(job: Job, identity: Identity, ledger: LedgerEntry[]): string {
  const first = identity.name.split(' ')[0]
  const proof = topProof(ledger)
  return (
    `Subject: Quick ask — referral for ${job.title} at ${job.company}\n\n` +
    `Hi — hope you're doing well! ${job.company} has an open ${job.title} role (${cleanUrl(job.url)}) and it's a close match for what I build: ` +
    `${proof ? `my latest shipped project is ${proof.title.split('—')[0].trim()} (${cleanUrl(proof.evidence?.url ?? proof.evidence?.repo)})` : `my work is public at ${identity.github}`}.\n\n` +
    `Would you be comfortable referring me, or pointing me to the right person there? I've attached my résumé so it's zero extra work — and if a referral isn't possible, absolutely no pressure.\n\n` +
    `Thanks either way — ${first}`
  )
}

export interface RetroFinding {
  keyword: string
  count: number
}
export interface RejectionRetro {
  sampleSize: number
  shared: RetroFinding[]
  note: string
}

/**
 * POST-REJECTION RETRO — the compounding loop. Aggregates the must-have keywords that were
 * EVIDENCE GAPS across his rejected/ghosted applications; a keyword missing in 2+ lost
 * applications is a pattern, not noise, and building it is the highest-yield next move (Taleem's
 * job). Deterministic aggregation over data the packets already hold — never a guess about WHY a
 * company said no (only they know), just what the lost JDs demonstrably shared.
 */
export function rejectionRetro(jobs: Job[], packets: Packet[]): RejectionRetro {
  const lost = jobs.filter((j) => j.status === 'rejected' || j.status === 'ghosted')
  const byJob = new Map(packets.map((p) => [p.jobId, p]))
  const counts = new Map<string, number>()
  let sampleSize = 0
  for (const j of lost) {
    const p = byJob.get(j.id)
    if (!p) continue
    sampleSize++
    const gaps = new Set(p.coverage.missing.filter((k) => k.mustHave).map((k) => k.keyword))
    for (const k of gaps) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const shared = [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([keyword, count]) => ({ keyword, count }))
  const note =
    sampleSize < 2
      ? 'Too few closed applications to see a pattern yet.'
      : shared.length === 0
        ? `Across ${sampleSize} closed applications, no must-have gap repeats — the evidence held; the loss reasons lived on their side.`
        : `Across ${sampleSize} closed applications, ${shared.map((s) => `"${s.keyword.replace(/-/g, ' ')}" was an evidence gap in ${s.count}`).join('; ')}. Shipping proof of the top one raises every future application at once.`
  return { sampleSize, shared, note }
}
