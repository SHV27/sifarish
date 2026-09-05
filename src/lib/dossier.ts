import type { Job, LedgerEntry, JDDecode, Packet } from '../types'
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
  /** v2 R3 — what THEY said they care about (the packet's Reading) → the played fact that proves it. */
  cares: { care: string; quote: string; proof: string; ledgerId?: string }[]
  /** What they said they do NOT care about — do not lead with these in the room. */
  doNotLead: string[]
}

/** Compile an interview brief from the job's own data + ledger, mapped to the JD (vision §P5). */
export function buildDossier(job: Job, ledger: LedgerEntry[], packet?: Packet): InterviewDossier {
  const decode: JDDecode = decodeJD(job.jd || job.title)
  const coverage = matchEvidence(decode, ledger)
  const byId = new Map(ledger.map((e) => [e.id, e]))
  const played = packet?.plan?.played ?? []
  const cares = (packet?.reading?.cares ?? []).slice(0, 8).map((c) => {
    const phrase = c.phrase.toLowerCase()
    const hit =
      played.find((p) => p.reason.toLowerCase().includes(phrase)) ??
      played.find((p) => { const e = byId.get(p.factId); return !!e && (e.kind === 'achievement' || e.kind === 'project') })
    const e = hit ? byId.get(hit.factId) : undefined
    const num = e?.bullets.map((b) => b.text).find((t) => /\d/.test(t))
    return {
      care: c.phrase,
      quote: c.quote,
      proof: e ? `${e.title.split('—')[0].trim()} — ${num ?? e.bullets[0]?.text ?? e.summary}` : 'no played fact names this — answer it from a real story, not a claim',
      ledgerId: e?.id,
    }
  })
  const doNotLead = (packet?.reading?.doesNotCare ?? []).slice(0, 6).map((d) => d.phrase)

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
    cares,
    doNotLead,
    probe: coverage.missing
      .filter((m) => m.mustHave)
      .slice(0, 4)
      .map((m) => `"${m.keyword.replace(/-/g, ' ')}" — no shipped evidence. Have the honest "here's what I'm building toward it" answer ready.`),
  }
}
