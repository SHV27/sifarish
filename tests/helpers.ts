import seed from '../seed/ledger.seed.json'
import type { Identity, Job, LedgerEntry, VoiceBank } from '../src/types'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { compileResume } from '../src/lib/compile/compiler'
import { compileCoverLetter, compileOutreach, buildGapNote } from '../src/lib/compile/letters'
import type { Packet } from '../src/types'

export const SEED_LEDGER = seed.entries as unknown as LedgerEntry[]
export const SEED_IDENTITY = seed.identity as Identity
export const SEED_VOICE = seed.voiceBank as VoiceBank

export function fakeJob(company: string, title: string, jd: string): Job {
  return {
    id: `test-${company}`,
    source: 'paste',
    company,
    title,
    location: '',
    url: `https://example.com/${company}`,
    jd,
    fetchedAt: new Date().toISOString(),
    status: 'found',
  }
}

/** Compile a full packet from a JD without touching Dexie — the pure pipeline. */
export function compilePacketPure(job: Job, ledger = SEED_LEDGER, identity = SEED_IDENTITY): Packet {
  const decode = decodeJD(job.jd)
  const coverage = matchEvidence(decode, ledger)
  const resume = compileResume({ identity, ledger, decode, coverage, jobId: job.id })
  return {
    id: `packet-${job.id}`,
    jobId: job.id,
    createdAt: new Date().toISOString(),
    resume,
    coverLetter: compileCoverLetter(job, identity, ledger, decode, coverage),
    outreach: compileOutreach(job, identity, ledger, decode),
    coverage,
    gapNote: buildGapNote(coverage),
    decode,
    polished: false,
  }
}

export function allText(packet: Packet): string {
  return [
    ...packet.resume.lines.map((l) => l.text),
    ...packet.coverLetter.paragraphs.map((p) => p.text),
    ...packet.outreach.paragraphs.map((p) => p.text),
  ].join('\n')
}
