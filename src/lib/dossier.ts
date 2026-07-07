import type { Job, LedgerEntry, JDDecode } from '../types'
import { decodeJD } from './jd/decode'
import { matchEvidence, entryRelevance } from './match/evidence'

export interface InterviewDossier {
  company: string
  title: string
  /** JD signals worth rehearsing against. */
  focus: string[]
  /** Ledger talking points mapped to the JD — each is a real, evidence-backed story. */
  talkingPoints: { title: string; hook: string; evidence?: string; ledgerId: string }[]
  /** Honest gaps the interviewer may probe — rehearse the "currently building" answer. */
  probe: string[]
}

/** Compile an interview brief from the job's own data + ledger, mapped to the JD (vision §P5). */
export function buildDossier(job: Job, ledger: LedgerEntry[]): InterviewDossier {
  const decode: JDDecode = decodeJD(job.jd || job.title)
  const coverage = matchEvidence(decode, ledger)

  const talkingPoints = ledger
    .filter((e) => e.resumeEligible && e.tier === 'shipped' && (e.kind === 'project' || e.kind === 'achievement'))
    .map((e) => ({ e, rel: entryRelevance(e, decode) }))
    .sort((a, b) => b.rel - a.rel)
    .slice(0, 4)
    .map(({ e }) => ({
      title: e.title.split('—')[0].trim(),
      hook: e.bullets[0]?.text ?? e.summary,
      evidence: e.evidence?.url ?? e.evidence?.repo,
      ledgerId: e.id,
    }))

  return {
    company: job.company,
    title: job.title,
    focus: decode.mustHave.slice(0, 8).map((k) => k.replace(/-/g, ' ')),
    talkingPoints,
    probe: coverage.missing
      .filter((m) => m.mustHave)
      .slice(0, 4)
      .map((m) => `"${m.keyword.replace(/-/g, ' ')}" — no shipped evidence. Have the honest "here's what I'm building toward it" answer ready.`),
  }
}
