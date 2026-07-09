import type { Job, Packet, EditorialPlan } from '../types'
import { db } from '../db/db'
import { decodeJD } from './jd/decode'
import { matchEvidence } from './match/evidence'
import { compileResume, type CompileInput } from './compile/compiler'
import { compileCoverLetter, compileOutreach, buildGapNote } from './compile/letters'
import { getIntel, hookFromIntel } from './intel/client'
import { runEditor, redTeamPass } from './darzi/editor'
import { composeLetter, decideSignature } from './atelier/letter'

/**
 * The Darzi orchestrator: JD decode → evidence match → deterministic compile.
 * Pure pipeline over the Sach Ledger; the optional polish amplifier is applied
 * separately (and diff-guarded) so the compiled truth is always the baseline.
 */
/**
 * INSTANT packet (v3 smoothness, D33) — a fully usable, evidence-true dossier with ZERO LLM
 * calls, rendered the moment you click Tailor (v2 speed). It uses cached intel only (no fetch)
 * and the deterministic v2 relevance compile. The Editor's Desk reasoning then refines it in
 * the background (buildPacket) and updates the view. You never wait on a blank screen again.
 */
export async function buildPacketFast(job: Job): Promise<Packet> {
  const identity = await db.identity.get('me')
  const ledger = await db.ledger.toArray()
  if (!identity) throw new Error('Identity missing — reseed the app.')

  const cachedIntel = await db.intel.get(job.company.trim().toLowerCase())
  const intel = cachedIntel && !cachedIntel.keyless && cachedIntel.bullets.length > 0 ? cachedIntel : undefined
  const intelHook = hookFromIntel(intel)

  const decode = decodeJD(job.jd)
  const coverage = matchEvidence(decode, ledger)
  const resume = compileResume({ identity, ledger, decode, coverage, jobId: job.id }) // deterministic, no editorial
  const coverLetter = compileCoverLetter(job, identity, ledger, decode, coverage, intelHook)
  const outreach = compileOutreach(job, identity, ledger, decode)
  const gapNote = buildGapNote(coverage)

  return {
    id: `packet-${job.id}-fast`,
    jobId: job.id,
    createdAt: new Date().toISOString(),
    resume,
    coverLetter,
    outreach,
    coverage,
    gapNote,
    decode,
    polished: false,
    intel,
    enhancing: true, // the Dimaag layer is still refining casting + letter in the background
  }
}

export async function buildPacket(job: Job, onProgress?: (step: string) => void): Promise<Packet> {
  const identity = await db.identity.get('me')
  const ledger = await db.ledger.toArray()
  if (!identity) throw new Error('Identity missing — reseed the app.')

  // Darzi v2: an Intel Pass runs before the compile. Cited (I7); keyless-safe (falls back to
  // v1 output). Intel shapes the cover-letter hook and the dossier panel — never a claim (I1).
  onProgress?.('Researching the company…')
  const intel = await getIntel(job.company).catch(() => undefined)
  const intelHook = hookFromIntel(intel)

  const decode = decodeJD(job.jd)
  const coverage = matchEvidence(decode, ledger)

  // -- Darzi v3 Editor's Desk: archetype → casting → surgery (passes 1-3) --
  const shippedProjects = ledger.filter((e) => e.resumeEligible && e.tier === 'shipped' && e.kind === 'project')
  let editorial: EditorialPlan | undefined
  let compileEditorial: CompileInput['editorial']
  if (shippedProjects.length > 0) {
    onProgress?.('Reading the role & casting your projects…')
    const ed = await runEditor({ projects: shippedProjects, decode, jd: job.jd, intel }).catch(() => null)
    if (ed) {
      compileEditorial = { order: ed.order, bullets: ed.bullets }
      editorial = { ...ed.plan, redTeam: { verdict: 'PASS', fixes: [], by: 'heuristic', at: new Date().toISOString() }, redTeamRounds: 0 }
    }
  }

  // -- Compile (v1 compiler is final authority for I1/I2/one-page) --
  onProgress?.('Compiling the one-page résumé…')
  const resume = compileResume({ identity, ledger, decode, coverage, jobId: job.id, editorial: compileEditorial })

  // -- Pass 4: Red-Team loop (≤3 rounds). PASS required for "ready". --
  let ready = true
  if (editorial) {
    onProgress?.('Red-teaming the draft…')
    const rt = await redTeamPass(resume.lines.map((l) => l.text).join('\n')).catch(() => null)
    if (rt) {
      editorial.redTeam = rt
      editorial.redTeamRounds = 1
      ready = rt.verdict === 'PASS'
    }
  }

  // -- Atelier (v3): composed letter with per-company Sifarish Signature decision --
  onProgress?.('Composing your cover letter…')
  const settings = await db.settings.get('app')
  const vision = settings?.visionProfile
  let signature: Packet['signature']
  let coverLetter
  if (editorial) {
    const sig = await decideSignature(job, editorial.archetype.id, intel).catch(() => null)
    const useSignature = sig?.use ?? false
    if (sig) signature = { on: useSignature, rationale: sig.rationale }
    coverLetter = composeLetter({ job, identity, ledger, decode, coverage, intel, vision, editorial, useSignature })
  } else {
    // Keyless / no-editorial path keeps the proven v2 letter (regression-safe).
    coverLetter = compileCoverLetter(job, identity, ledger, decode, coverage, intelHook)
  }
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
    editorial,
    ready,
    signature,
    enhancing: false, // the Dimaag layer has finished — this is the fully-reasoned packet
  }
}

/** Toggle the Sifarish Signature on a packet and recompose the letter (zero LLM budget). */
export async function toggleSignature(packet: Packet, on: boolean): Promise<Packet> {
  const job = await db.jobs.get(packet.jobId)
  const identity = await db.identity.get('me')
  const ledger = await db.ledger.toArray()
  const settings = await db.settings.get('app')
  if (!job || !identity) return packet
  const coverLetter = composeLetter({
    job,
    identity,
    ledger,
    decode: packet.decode,
    coverage: packet.coverage,
    intel: packet.intel,
    vision: settings?.visionProfile,
    editorial: packet.editorial,
    useSignature: on,
  })
  const updated: Packet = {
    ...packet,
    coverLetter,
    signature: packet.signature ? { ...packet.signature, on } : undefined,
  }
  await db.packets.put(updated)
  return updated
}

/**
 * Overrule a casting call (Darzi v3). Shaurya is the studio head — his taste is final. Promoting
 * a benched project or benching a chosen one recompiles deterministically (zero LLM budget: the
 * human choice IS the decision), re-runs the red-team, and stamps the plan `overruled`.
 */
export async function overrulePacket(packet: Packet, opts: { promoteId?: string; benchId?: string }): Promise<Packet> {
  if (!packet.editorial) return packet
  const job = await db.jobs.get(packet.jobId)
  const identity = await db.identity.get('me')
  const ledger = await db.ledger.toArray()
  if (!job || !identity) return packet

  const ed = packet.editorial
  let chosen = ed.chosen.slice()
  let benched = ed.benched.slice()

  if (opts.benchId) {
    const c = chosen.find((x) => x.ledgerId === opts.benchId)
    if (c) {
      chosen = chosen.filter((x) => x.ledgerId !== opts.benchId)
      benched = [{ ledgerId: c.ledgerId, title: c.title, why: 'Benched by Shaurya (studio head overrule).' }, ...benched]
    }
  }
  if (opts.promoteId) {
    const b = benched.find((x) => x.ledgerId === opts.promoteId)
    const project = ledger.find((e) => e.id === opts.promoteId)
    if (b && project) {
      benched = benched.filter((x) => x.ledgerId !== opts.promoteId)
      chosen = [
        ...chosen,
        {
          ledgerId: b.ledgerId,
          title: b.title,
          angleId: 'manual',
          angleLabel: 'Shaurya’s pick',
          angleRationale: {
            question: `Angle for ${b.title}`,
            optionsConsidered: [b.title],
            criteria: ['studio head’s call'],
            choice: 'Shaurya’s pick',
            why: 'Promoted by Shaurya — his taste overrides the machine (I10: the reason is "the studio head chose it").',
            confidence: 1,
            by: 'heuristic' as const,
            at: new Date().toISOString(),
          },
        },
      ].slice(0, 3)
    }
  }

  const order = chosen.map((c) => c.ledgerId)
  const bullets: Record<string, string[]> = {}
  for (const c of chosen) {
    const p = ledger.find((e) => e.id === c.ledgerId)
    if (p) bullets[c.ledgerId] = p.bullets.slice(0, 3).map((b) => b.id)
  }

  const decode = packet.decode
  const coverage = packet.coverage
  const resume = compileResume({ identity, ledger, decode, coverage, jobId: job.id, editorial: { order, bullets } })
  const rt = await redTeamPass(resume.lines.map((l) => l.text).join('\n')).catch(() => null)

  const updated: Packet = {
    ...packet,
    resume,
    editorial: {
      ...ed,
      chosen,
      benched,
      overruled: true,
      redTeam: rt ?? ed.redTeam,
      redTeamRounds: ed.redTeamRounds + 1,
    },
    ready: rt ? rt.verdict === 'PASS' : packet.ready,
  }
  await db.packets.put(updated)
  return updated
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
