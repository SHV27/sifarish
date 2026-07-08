import type { Job, Packet } from '../types'
import { db } from '../db/db'
import { decodeJD } from './jd/decode'
import { matchEvidence } from './match/evidence'
import { compileResume } from './compile/compiler'
import { compileCoverLetter, compileOutreach, buildGapNote } from './compile/letters'
import { getIntel, hookFromIntel } from './intel/client'

/**
 * The Darzi orchestrator: JD decode → evidence match → deterministic compile.
 * Pure pipeline over the Sach Ledger; the optional polish amplifier is applied
 * separately (and diff-guarded) so the compiled truth is always the baseline.
 */
export async function buildPacket(job: Job): Promise<Packet> {
  const identity = await db.identity.get('me')
  const ledger = await db.ledger.toArray()
  if (!identity) throw new Error('Identity missing — reseed the app.')

  // Darzi v2: an Intel Pass runs before the compile. Cited (I7); keyless-safe (falls back to
  // v1 output). Intel shapes the cover-letter hook and the dossier panel — never a claim (I1).
  const intel = await getIntel(job.company).catch(() => undefined)
  const intelHook = hookFromIntel(intel)

  const decode = decodeJD(job.jd)
  const coverage = matchEvidence(decode, ledger)
  const resume = compileResume({ identity, ledger, decode, coverage, jobId: job.id })
  const coverLetter = compileCoverLetter(job, identity, ledger, decode, coverage, intelHook)
  const outreach = compileOutreach(job, identity, ledger, decode)
  const gapNote = buildGapNote(coverage)

  return {
    id: `packet-${job.id}-${Date.now()}`,
    jobId: job.id,
    createdAt: new Date().toISOString(),
    resume,
    coverLetter,
    outreach,
    coverage,
    gapNote,
    decode,
    polished: false,
    intel: intel && !intel.keyless && intel.bullets.length > 0 ? intel : undefined,
  }
}

/** Persist the packet and move the job forward — tracking as a side effect, never a chore. */
export async function savePacket(packet: Packet): Promise<void> {
  await db.transaction('rw', [db.packets, db.jobs], async () => {
    // One packet per job: replace any previous tailoring.
    await db.packets.where('jobId').equals(packet.jobId).delete()
    await db.packets.put(packet)
    const job = await db.jobs.get(packet.jobId)
    if (job && job.status === 'found') {
      await db.jobs.update(packet.jobId, { status: 'tailored', packetId: packet.id })
    } else {
      await db.jobs.update(packet.jobId, { packetId: packet.id })
    }
  })
}
