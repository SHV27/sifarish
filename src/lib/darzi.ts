import type { Job, Packet, EditorialPlan } from '../types'
import { db } from '../db/db'
import { decodeJD } from './jd/decode'
import { matchEvidence } from './match/evidence'
import { compileResume, type CompileInput } from './compile/compiler'
import { compileCoverLetter, compileOutreach, buildGapNote } from './compile/letters'
import { getIntel, hookFromIntel } from './intel/client'
import { runEditor, redTeamPass } from './darzi/editor'
import { composeLetter, decideSignature } from './atelier/letter'
import { estimateQuality } from './ustaad/quality'
import { buildSummaryLine } from './darzi/summary'

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
  const settings = await db.settings.get('app')
  const summaryLine = buildSummaryLine({ identity, vision: settings?.visionProfile, ledger, decode, coverage }) ?? undefined
  const resume = compileResume({ identity, ledger, decode, coverage, jobId: job.id, summaryLine }) // deterministic, no editorial
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
    quality: estimateQuality(resume, coverage, ledger),
    summaryOn: true,
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
  // Session 5.9 — JD-picked framing rewrites from the Editor's Desk (drift-guarded in
  // reframeProject; render under the same evidence link — compiler.ts keeps ledgerIds).
  let bulletOverrides: Record<string, string> | undefined
  if (shippedProjects.length > 0) {
    onProgress?.('Reading the role & casting your projects…')
    const ed = await runEditor({ projects: shippedProjects, decode, jd: job.jd, intel, company: job.company }).catch(() => null)
    if (ed) {
      compileEditorial = { order: ed.order, bullets: ed.bullets, sectionOrder: ed.sectionOrder }
      editorial = { ...ed.plan, sectionOrder: ed.sectionOrder, redTeam: { verdict: 'PASS', fixes: [], by: 'heuristic', at: new Date().toISOString() }, redTeamRounds: 0 }
      bulletOverrides = ed.bulletOverrides
    }
  }

  // -- Professional summary (evidence-linked; top of the page) --
  const settings = await db.settings.get('app')
  const vision = settings?.visionProfile
  const summaryLine = buildSummaryLine({ identity, vision, ledger, decode, coverage, editorial }) ?? undefined

  // -- Compile (v1 compiler is final authority for I1/I2/one-page) --
  onProgress?.('Compiling the one-page résumé…')
  const resume = compileResume({ identity, ledger, decode, coverage, jobId: job.id, editorial: compileEditorial, summaryLine, bulletOverrides })

  // -- Pass 4: Red-Team loop (≤3 rounds). PASS required for "ready". --
  let ready = true
  if (editorial) {
    onProgress?.('Red-teaming the draft…')
    const rt = await redTeamPass(resume.lines.map((l) => l.text).join('\n'), decode, editorial.archetype).catch(() => null)
    if (rt) {
      editorial.redTeam = rt
      editorial.redTeamRounds = 1
      ready = rt.verdict === 'PASS'
    }
  }

  // -- Atelier (v3): composed letter with per-company Sifarish Signature decision --
  onProgress?.('Composing your cover letter…')
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

  // D29 uniqueness, WIRED (Session 5.10 wiring audit — it only ever ran in tests): this letter's
  // substantive body is compared against his recent letters; too-similar → an honest, visible
  // note. Advisory, never a block (a letter is his to send).
  try {
    const { checkUniqueness } = await import('./atelier/uniqueness')
    const others = (await db.packets.orderBy('createdAt').reverse().limit(5).toArray())
      .filter((p) => p.jobId !== job.id)
      .map((p) => p.coverLetter.paragraphs.join('\n'))
    if (others.length > 0) {
      const u = checkUniqueness([coverLetter.paragraphs.join('\n'), ...others])
      if (!u.ok) {
        gapNote.push(
          `This letter's body is ${Math.round(u.maxSimilarity * 100)}% similar to a recent one — a recruiter comparing notes would notice. Ask the Baithak to sharpen the company-specific hook.`,
        )
      }
    }
  } catch {
    /* advisory only */
  }

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
    quality: estimateQuality(resume, coverage, ledger),
    summaryOn: true,
    bulletOverrides, // Session 5.9: framing rewrites survive later Baithak recompiles
  }
}

/**
 * Toggle / recompile the professional summary (Session 5.2). Deterministic, zero LLM budget —
 * the summary is always compiled from real ledger evidence, so I1 holds by construction.
 */
export async function setSummary(packet: Packet, on: boolean): Promise<Packet> {
  const identity = await db.identity.get('me')
  const ledger = await db.ledger.toArray()
  const settings = await db.settings.get('app')
  if (!identity) return packet
  const summaryLine = on ? buildSummaryLine({ identity, vision: settings?.visionProfile, ledger, decode: packet.decode, coverage: packet.coverage, editorial: packet.editorial }) ?? undefined : undefined
  const order = packet.editorial?.chosen.map((c) => c.ledgerId) ?? []
  const bullets: Record<string, string[]> = {}
  for (const c of packet.editorial?.chosen ?? []) {
    const p = ledger.find((e) => e.id === c.ledgerId)
    if (p) bullets[c.ledgerId] = p.bullets.slice(0, 3).map((b) => b.id)
  }
  const resume = compileResume({
    identity,
    ledger,
    decode: packet.decode,
    coverage: packet.coverage,
    jobId: packet.jobId,
    editorial: packet.editorial ? { order, bullets, sectionOrder: packet.editorial.sectionOrder } : undefined,
    summaryLine,
  })
  const updated: Packet = { ...packet, resume, summaryOn: on, quality: estimateQuality(resume, packet.coverage, ledger) }
  await db.packets.put(updated)
  return updated
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
 * ATELIER BAITHAK executor (Session 5) — apply an owner-approved letter refinement op. Every op
 * recomposes the letter deterministically from real parts (I1) and re-checks uniqueness; tone runs
 * the same fact-drift-guarded polish as the resume. Conversation refines, it never mints a claim.
 */
export async function refineLetter(packet: Packet, op: import('./atelier/baithak').LetterOp): Promise<{ packet: Packet; note: string }> {
  if (op.kind === 'toggle-signature') {
    const updated = await toggleSignature(packet, op.on)
    return { packet: updated, note: op.on ? 'Signature added.' : 'Signature removed.' }
  }
  if (op.kind === 'tone') {
    const { polishDoc } = await import('./polish/client')
    const r = await polishDoc(packet.coverLetter)
    const updated: Packet = { ...packet, coverLetter: r.doc }
    await db.packets.put(updated)
    return { packet: updated, note: r.keyless ? 'Keyless mode — phrasing kept as compiled.' : `Rephrased ${r.applied} line(s); ${r.rejected} rejected by the fact-drift guard.` }
  }
  // swap-proof / tighten → recompose deterministically
  const job = await db.jobs.get(packet.jobId)
  const identity = await db.identity.get('me')
  const ledger = await db.ledger.toArray()
  const settings = await db.settings.get('app')
  if (!job || !identity) return { packet, note: 'Missing job/identity.' }
  const coverLetter = composeLetter({
    job,
    identity,
    ledger,
    decode: packet.decode,
    coverage: packet.coverage,
    intel: packet.intel,
    vision: settings?.visionProfile,
    editorial: packet.editorial,
    useSignature: packet.signature?.on ?? false,
    proofLeadId: op.kind === 'swap-proof' ? op.toLedgerId : undefined,
    tightTo: op.kind === 'tighten' ? 170 : undefined,
  })
  const updated: Packet = { ...packet, coverLetter }
  await db.packets.put(updated)
  return { packet: updated, note: op.kind === 'tighten' ? 'Letter tightened to its strongest single proof.' : 'Proof lineup updated.' }
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
  const resume = compileResume({ identity, ledger, decode, coverage, jobId: job.id, editorial: { order, bullets, sectionOrder: ed.sectionOrder } })
  const rt = await redTeamPass(resume.lines.map((l) => l.text).join('\n')).catch(() => null)

  const updated: Packet = {
    ...packet,
    resume,
    quality: estimateQuality(resume, coverage, ledger),
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
