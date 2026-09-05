import type { GamePlan, Job, LedgerEntry, Packet, EditorialPlan, Reading } from '../types'
import { db } from '../db/db'
import { judgePage, strategize, strategizeFast } from './strategist'
import { makePlan } from './strategist/plan'
import { archetypeById } from './darzi/archetypes'
import { decodeJD } from './jd/decode'
import { matchEvidence } from './match/evidence'
import { compileResume, type CompileInput } from './compile/compiler'
import { compileOutreach, buildGapNote } from './compile/letters'
import { getIntel } from './intel/client'
import { redTeamPass } from './darzi/editor'
import { nazarPass, nazarHeuristic, bulletIdsForIssues } from './darzi/nazar'
import { composeLetter } from './atelier/letter'
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
/**
 * v2 — the Editor's Desk objects (EditorialPlan) survive as a COMPATIBILITY VIEW derived from the
 * game plan, so the letter composer, cockpit and ops keep reading one shape. The plan is the
 * authority; this view is recomputed from it, never edited on its own.
 */
export function editorialFromPlan(plan: GamePlan, reading: Reading, ledger: LedgerEntry[]): EditorialPlan {
  const at = plan.at
  const arch = archetypeById(reading.archetype)
  const title = (id: string) => ledger.find((e) => e.id === id)?.title.split('—')[0].trim() ?? id
  const projects = plan.played.filter((p) => p.section === 'projects')
  return {
    archetype: { id: arch.id, label: arch.label, priorities: arch.priorities, confidence: reading.by === 'heuristic' ? 0.6 : 0.85, by: reading.by === 'heuristic' ? 'heuristic' : 'dimaag', reviewerNote: arch.reviewerNote },
    casting: {
      question: `Which facts play for ${reading.company || 'this company'}?`,
      optionsConsidered: plan.played.map((p) => title(p.factId)),
      criteria: reading.cares.slice(0, 4).map((q) => q.phrase),
      choice: projects.map((p) => title(p.factId)).join(', '),
      why: plan.rationale,
      confidence: plan.by === 'heuristic' ? 0.6 : 0.85,
      evidenceRefs: plan.threeLines.factIds,
      by: plan.by === 'heuristic' ? 'heuristic' : 'dimaag',
      at,
    },
    chosen: projects.map((p) => ({
      ledgerId: p.factId,
      title: title(p.factId),
      angleId: p.framing ? 'framed' : 'plan',
      angleLabel: p.framing ?? p.reason,
      angleRationale: { question: `Angle for ${title(p.factId)}`, optionsConsidered: [], criteria: [], choice: p.framing ?? 'as planned', why: p.reason, confidence: 0.8, by: plan.by === 'heuristic' ? 'heuristic' : 'dimaag', at },
    })),
    benched: plan.benched
      .filter((b) => ledger.find((e) => e.id === b.factId)?.kind === 'project')
      .map((b) => ({ ledgerId: b.factId, title: title(b.factId), why: b.reason })),
    redTeam: { verdict: 'PASS', fixes: [], by: 'heuristic', at },
    redTeamRounds: 0,
  }
}

export const pageTextOf = (resume: Packet['resume']) => resume.lines.map((l) => `${l.text}${l.right ? ` ${l.right}` : ''}`).join('\n')

export async function buildPacketFast(job: Job): Promise<Packet> {
  const identity = await db.identity.get('me')
  const ledger = await db.ledger.toArray()
  if (!identity) throw new Error('Identity missing — reseed the app.')

  const cachedIntel = await db.intel.get(job.company.trim().toLowerCase())
  const intel = cachedIntel && !cachedIntel.keyless && cachedIntel.bullets.length > 0 ? cachedIntel : undefined

  const decode = decodeJD(job.jd)
  const coverage = matchEvidence(decode, ledger)
  const settings = await db.settings.get('app')
  // v2 THE STRATEGIST (keyless floor, instant): the deterministic reading + plan — the page on
  // screen in ~300 ms, already executing a plan; the reasoned pass replaces it in the background.
  const strategy = strategizeFast({ job, ledger, identity, vision: settings?.visionProfile, sections: settings?.sections })
  const resume = compileResume({
    identity,
    ledger,
    decode,
    coverage,
    jobId: job.id,
    plan: strategy.plan,
    pagePolicy: settings?.pagePolicy ?? 'two-ok',
    sections: settings?.sections,
    summaryOn: true,
  })
  const editorial = editorialFromPlan(strategy.plan, strategy.reading, ledger)
  // R3: the reading drives the letter on EVERY path (the demo and the keyless floor included) —
  // the old compileCoverLetter opened on the skill list, which is what the owner read as generic.
  const coverLetter = composeLetter({ job, identity, ledger, decode, coverage, intel, vision: settings?.visionProfile, editorial, useSignature: false, reading: strategy.reading })
  const outreach = compileOutreach(job, identity, ledger, decode, settings?.visionProfile)
  const gapNote = buildGapNote(coverage)
  gapNote.push(...strategy.plan.notes)

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
    editorial,
    reading: strategy.reading,
    plan: strategy.plan,
    strategistMode: 'heuristic',
    compilePlan: { order: strategy.plan.projectOrder, bullets: {}, sectionOrder: undefined },
    enhancing: true, // the reasoned strategist is still working in the background
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

  const decode = decodeJD(job.jd)
  const coverage = matchEvidence(decode, ledger)

  // -- v2 THE STRATEGIST: reading → game plan (Gemini deep pass; deterministic floor) --
  onProgress?.('Reading the whole posting…')
  const settings = await db.settings.get('app')
  const vision = settings?.visionProfile
  let strategy = await strategize({ job, ledger, identity, vision, sections: settings?.sections })
  // THE CHALAKI (owner: "total framing different jaani thi"): the plan's angle per project becomes
  // re-aimed WORDING — the same facts, aimed at THIS reader — through the drift-guarded reframer
  // (a new number/tech/noun kills the rephrasing; the compiled truth stands). Packet-scoped.
  onProgress?.('Re-aiming the wording for this reader…')
  const bulletOverrides: Record<string, string> = {}
  const reframeFor = async (plan: GamePlan) => {
    if (strategy.mode === 'heuristic') return
    for (const k of Object.keys(bulletOverrides)) delete bulletOverrides[k]
    const { reframeProject } = await import('./polish/reframe')
    const framed = plan.played.filter((p) => p.section === 'projects' && p.framing)
    for (const p of framed.slice(0, 4)) {
      const entry = ledger.find((e) => e.id === p.factId)
      if (!entry) continue
      const r = await reframeProject(entry, `${p.framing}. The reader: ${strategy.reading.readerPersona} at ${strategy.reading.company || 'the company'}; they say they care about ${strategy.reading.cares.slice(0, 4).map((q) => q.phrase).join(', ') || 'shipped work'}.`).catch(() => null)
      if (r) Object.assign(bulletOverrides, r.overrides)
    }
  }
  await reframeFor(strategy.plan)
  onProgress?.('Executing the game plan on the page…')
  const compileWithOverrides = (plan: GamePlan, excludedBulletIds?: string[]) =>
    compileResume({
      identity,
      ledger,
      decode,
      coverage,
      jobId: job.id,
      plan,
      pagePolicy: settings?.pagePolicy ?? 'two-ok',
      sections: settings?.sections,
      summaryOn: true,
      excludedBulletIds,
      bulletOverrides: Object.keys(bulletOverrides).length ? bulletOverrides : undefined,
    })
  let resume = compileWithOverrides(strategy.plan)

  // -- THE CRITIC on the executed page; ONE bounded revise when a brain found real defects --
  onProgress?.('The critic reads it as the company would…')
  let critic = await judgePage(pageTextOf(resume), strategy.reading, strategy.plan, strategy.mode !== 'heuristic')
  if (critic.verdict === 'REVISE' && strategy.mode !== 'heuristic' && critic.issues.length > 0) {
    onProgress?.('Revising the plan once on the critic’s notes…')
    const revisedReading: Reading = {
      ...strategy.reading,
      summary: `${strategy.reading.summary}\nCRITIC ISSUES TO FIX IN THIS PLAN: ${critic.issues.slice(0, 5).join(' | ')}`,
    }
    const revisedPlan = await makePlan({ reading: revisedReading, ledger, identity, vision, sections: settings?.sections }).catch(() => null)
    if (revisedPlan && revisedPlan.by !== 'heuristic') {
      strategy = { ...strategy, plan: revisedPlan }
      await reframeFor(revisedPlan) // R3: the revised plan's framing becomes wording too (was decorative)
      resume = compileWithOverrides(revisedPlan)
      const again = await judgePage(pageTextOf(resume), strategy.reading, revisedPlan, true)
      critic = { ...again, revised: true }
    }
  }
  const editorial: EditorialPlan | undefined = editorialFromPlan(strategy.plan, strategy.reading, ledger)
  const compileEditorial: CompileInput['editorial'] = { order: strategy.plan.projectOrder, bullets: strategy.plan.bulletPlan ?? {}, sectionOrder: undefined }
  const nazarNotes: string[] = []
  let nazarDropIds: string[] | undefined

  // -- Pass 4 (red-team) ∥ signature decision — independent judgments, run concurrently (S6,
  // Defect 5): the red-team reads the compiled résumé, the signature call reads company+archetype;
  // neither needs the other, so awaiting them serially only added wall-time.
  let ready = true
  let signature: Packet['signature']
  let coverLetter
  if (editorial) {
    onProgress?.('Red-teaming the draft & weighing the signature…')
    const arch = editorial.archetype
    // Session 7 (defect R6): ground the red-team in what the ledger ACTUALLY holds unused —
    // digit-bearing bullets that didn't make the page + benched shipped projects. Its fixes
    // must cite this inventory or the page itself; career-coach boilerplate dies here.
    const pageText = resume.lines.map((l) => `${l.text}${l.right ? ` ${l.right}` : ''}`).join('\n')
    const inventory = redTeamInventory(ledger, resume)
    const [rt, nazar] = await Promise.all([
      redTeamPass(pageText, decode, arch, inventory).catch(() => null),
      // Session 7.1 — THE NAZAR: the page-level judge that catches defect CLASSES nobody
      // hand-coded yet (semantic twins, broken lines). Its verdicts act only through the
      // compiler's exclusion gate; every removal is visible in the gap note (L4).
      nazarPass(resume).catch(() => null),
    ])
    // v2 — the letter's signature IS the plan's reveal decision (one call, one reason).
    const sig = { use: strategy.plan.reveal.on, rationale: { question: 'Reveal that Sifarish compiled this?', optionsConsidered: ['on', 'off'], criteria: ['reader affinity'], choice: strategy.plan.reveal.on ? 'on' : 'off', why: strategy.plan.reveal.reason, confidence: 0.8, by: (strategy.plan.by === 'heuristic' ? 'heuristic' : 'dimaag') as 'heuristic' | 'dimaag', at: new Date().toISOString() } }
    if (nazar && nazar.issues.length > 0) {
      const dropIds = bulletIdsForIssues(nazar.issues, ledger, bulletOverrides)
      if (dropIds.length > 0) {
        nazarDropIds = dropIds
        resume = compileWithOverrides(strategy.plan, dropIds)
        nazarNotes.push(
          ...nazar.issues
            .filter((i) => i.type === 'duplicate')
            .map((i) => `Nazar: removed a twin claim — "${i.drop.slice(0, 70)}…" said what a stronger line already says (${i.why.slice(0, 90)})`),
        )
      }
      nazarNotes.push(
        ...nazar.issues
          .filter((i) => i.type === 'broken')
          .map((i) => `Nazar: a line reads broken/placeholder — "${i.drop.slice(0, 60)}" (${i.why.slice(0, 90)}). Re-forge the entry to heal its source.`),
      )
    }
    if (rt) {
      editorial.redTeam = rt
      editorial.redTeamRounds = 1
    }
    // v2 — "ready" is the CRITIC's verdict (skipped counts as ready-with-a-note, never silent).
    ready = critic.verdict !== 'REVISE'
    onProgress?.('Composing your cover letter…')
    const useSignature = sig?.use ?? false
    if (sig) signature = { on: useSignature, rationale: sig.rationale }
    coverLetter = composeLetter({ job, identity, ledger, decode, coverage, intel, vision, editorial, useSignature, reading: strategy.reading })
  } else {
    // Keyless path: the same composer, driven by the heuristic reading (R3 — one letter door).
    coverLetter = composeLetter({ job, identity, ledger, decode, coverage, intel, vision, editorial, useSignature: false, reading: strategy.reading })
  }
  const outreach = compileOutreach(job, identity, ledger, decode, vision)
  const gapNote = buildGapNote(coverage)
  gapNote.push(...nazarNotes) // the judge's removals are visible, never silent (L4)
  gapNote.push(...strategy.plan.notes) // the validator's discards (I1 at the plan)
  if (critic.verdict !== 'PASS') gapNote.push(...critic.issues.map((i) => `Critic: ${i}`))
  // Closure F3 — THE LAST JUDGE: the compiled page is checked against the casting sheet.
  // Everything cast appears, or the bench is DECLARED (the GLOAMING class can never be silent).
  for (const name of resume.benchedByPage ?? []) {
    gapNote.push(`Benched by page pressure: ${name} was cast but could not fit even at the tightest layout — drop a bullet elsewhere or bench a project deliberately.`)
  }

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
    enhancing: false, // the strategist has finished — this is the fully-reasoned packet
    quality: estimateQuality(resume, coverage, ledger),
    summaryOn: true,
    bulletOverrides, // Session 5.9: framing rewrites survive later Baithak recompiles
    // Session 7.2 (A1): the compile plan AS EXECUTED + the Nazar's exclusions persist on the
    // packet, so no later recompile forgets what the first one knew.
    compilePlan: compileEditorial,
    excludedBulletIds: nazarDropIds,
    // v2 — the strategist's artifacts: inspectable, executed, judged.
    reading: strategy.reading,
    plan: strategy.plan,
    strategistMode: strategy.mode,
    critic,
  }
}

/**
 * Toggle / recompile the professional summary (Session 5.2). Deterministic, zero LLM budget —
 * the summary is always compiled from real ledger evidence, so I1 holds by construction.
 */
export async function setSummary(packet: Packet, on: boolean): Promise<Packet> {
  // Session 7.2 (A1): one recompile authority — toggling the summary no longer discards the
  // Nazar's exclusions, the framing rewrites, or the Editor's reasoned bullet plan.
  const updated = await recompilePacket(packet, { summaryOn: on })
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
    reading: packet.reading,
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
    reading: packet.reading,
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
      ]
    }
  }

  const order = chosen.map((c) => c.ledgerId)
  const prevPlan = planFromPacket(packet, ledger)
  const bullets: Record<string, string[]> = {}
  for (const c of chosen) {
    // Session 7.2 (A1): an overrule changes WHO plays, not how their bullets were reasoned —
    // keep the Editor's per-project bullet plan for projects that stay in the lineup.
    const planned = prevPlan?.bullets[c.ledgerId]
    if (planned && planned.length > 0) {
      bullets[c.ledgerId] = planned
    } else {
      const p = ledger.find((e) => e.id === c.ledgerId)
      if (p) bullets[c.ledgerId] = p.bullets.slice(0, 3).map((b) => b.id)
    }
  }

  // One recompile authority (A1): the overrule used to drop the professional summary, the
  // Baithak suppressions, the framing rewrites AND the Nazar exclusions. Now it changes only
  // the lineup; everything else survives, and the red-team re-runs with full context (A5).
  const overruledPacket: Packet = { ...packet, editorial: { ...ed, chosen, benched, overruled: true } }
  const recompiled = await recompilePacket(overruledPacket, {
    plan: { order, bullets, sectionOrder: ed.sectionOrder },
  })
  const updated: Packet = {
    ...recompiled,
    editorial: recompiled.editorial ? { ...recompiled.editorial, chosen, benched, overruled: true } : recompiled.editorial,
  }
  await db.packets.put(updated)
  return updated
}

/**
 * v2 THE DOSSIER — play or bench ANY fact on THIS packet's plan (achievement, position, publication,
 * a custom kind…), not only projects. His word is final; the reason is recorded as his; the page
 * recompiles through the one door. Packet-scoped: other packets and the ledger are untouched.
 */
export async function overrulePlan(packet: Packet, opts: { playId?: string; benchId?: string }): Promise<Packet> {
  if (!packet.plan) return packet
  const ledger = await db.ledger.toArray()
  const plan = packet.plan
  let played = plan.played.slice()
  let benched = plan.benched.slice()
  if (opts.benchId) {
    played = played.filter((p) => p.factId !== opts.benchId)
    if (!benched.some((b) => b.factId === opts.benchId)) benched = [{ factId: opts.benchId, reason: 'Benched by the owner (studio head overrule).' }, ...benched]
  }
  if (opts.playId) {
    const e = ledger.find((x) => x.id === opts.playId)
    if (e) {
      benched = benched.filter((b) => b.factId !== opts.playId)
      if (!played.some((p) => p.factId === opts.playId)) {
        const { sectionKeyFor } = await import('./strategist/plan')
        played = [...played, { factId: e.id, section: sectionKeyFor(e.kind), reason: 'Played by the owner (studio head overrule).' }]
      }
    }
  }
  const projectOrder = played.filter((p) => p.section === 'projects').map((p) => p.factId)
  const sectionOrder = plan.sectionOrder.slice()
  for (const p of played) if (!sectionOrder.includes(p.section)) sectionOrder.push(p.section)
  const next: Packet = { ...packet, plan: { ...plan, played, benched, projectOrder, sectionOrder } }
  const recompiled = await recompilePacket(next, {})
  await db.packets.put(recompiled)
  return recompiled
}

/**
 * Session 7.2 (A1) — THE ONE RECOMPILE AUTHORITY. Every post-build recompile (Baithak op,
 * summary toggle, overrule) used to re-assemble compile options ad-hoc, each forgetting a
 * different field: Baithak ops dropped the professional summary, setSummary dropped Nazar's
 * exclusions and the framing rewrites, overrule dropped all three. Root cause: five call
 * sites, five partial memories. Now the packet's persisted state IS the compile input, and a
 * recompile may only CHANGE the field its op targets — everything else survives by construction.
 */
export interface RecompileChanges {
  summaryOn?: boolean
  excludedIds?: string[]
  excludedBulletIds?: string[]
  bulletOverrides?: Record<string, string>
  /** Replace the whole plan (overrule) … */
  plan?: NonNullable<Packet['compilePlan']>
  /** …or merge per-project bullet orders into the existing plan (lead-bullet). */
  planBullets?: Record<string, string[]>
  sectionOrder?: NonNullable<Packet['compilePlan']>['sectionOrder']
}

/** The compile plan as the packet remembers it; falls back for pre-7.2 packets. */
export function planFromPacket(packet: Packet, ledger: LedgerEntry[]): Packet['compilePlan'] {
  if (packet.compilePlan) return packet.compilePlan
  if (!packet.editorial) return undefined
  const order = packet.editorial.chosen.map((c) => c.ledgerId)
  const bullets: Record<string, string[]> = {}
  for (const id of order) {
    const p = ledger.find((e) => e.id === id)
    if (p) bullets[id] = p.bullets.slice(0, 3).map((b) => b.id)
  }
  return { order, bullets, sectionOrder: packet.editorial.sectionOrder }
}

/**
 * Red-team context for RE-runs (A5). The first compile grounds the red-team in the JD decode,
 * the archetype, and the ledger's unused inventory; re-runs used to call it bare — a weaker
 * judge on every later edit. One builder, used by both.
 */
export function redTeamInventory(ledger: LedgerEntry[], resume: Packet['resume']): string {
  const pageText = resume.lines.map((l) => `${l.text}${l.right ? ` ${l.right}` : ''}`).join('\n')
  const onPage = pageText.toLowerCase()
  const unusedNumbered = ledger
    .filter((e) => e.resumeEligible && e.tier === 'shipped')
    .flatMap((e) => e.bullets)
    .filter((b) => /\d/.test(b.text) && !onPage.includes(b.text.slice(0, 40).toLowerCase()))
    .slice(0, 4)
    .map((b) => `"${b.text.slice(0, 90)}"`)
  const benched = ledger
    .filter((e) => e.resumeEligible && e.tier === 'shipped' && e.kind === 'project')
    .filter((p) => !resume.lines.some((l) => l.ledgerIds.includes(p.id)))
    .slice(0, 3)
    .map((p) => p.title.split('—')[0].trim())
  return (
    [
      unusedNumbered.length ? `unused numbered bullets: ${unusedNumbered.join('; ')}` : '',
      benched.length ? `benched shipped projects: ${benched.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' · ') || 'none — everything usable is already on the page'
  )
}

export async function recompilePacket(packet: Packet, changes: RecompileChanges): Promise<Packet> {
  const identity = await db.identity.get('me')
  const ledger = await db.ledger.toArray()
  const settings = await db.settings.get('app')
  if (!identity) throw new Error('Identity missing — reseed the app.')

  // Effective state = persisted packet state overlaid with ONLY the op's own changes.
  const summaryOn = changes.summaryOn ?? packet.summaryOn ?? true
  const excludedIds = changes.excludedIds ?? packet.excludedIds
  const excludedBulletIds = changes.excludedBulletIds ?? packet.excludedBulletIds
  const bulletOverrides = changes.bulletOverrides ?? packet.bulletOverrides
  const basePlan = changes.plan ?? planFromPacket(packet, ledger)
  const plan = basePlan
    ? {
        ...basePlan,
        bullets: { ...basePlan.bullets, ...(changes.planBullets ?? {}) },
        sectionOrder: changes.sectionOrder ?? basePlan.sectionOrder,
      }
    : undefined

  const coverage = matchEvidence(packet.decode, ledger)
  // The summary's evidence links must respect his suppressions too — a dropped entry may not
  // ride back onto the page as a summary citation (the single-gate law, applied here as well).
  const excludedSet = new Set(excludedIds ?? [])
  const summaryLedger = ledger.filter((e) => !excludedSet.has(e.id))
  const summaryLine = summaryOn
    ? buildSummaryLine({ identity, vision: settings?.visionProfile, ledger: summaryLedger, decode: packet.decode, coverage, editorial: packet.editorial }) ?? undefined
    : undefined
  // v2 — a packet that carries a GAME PLAN recompiles by executing the plan (the one authority);
  // a compile-plan change (overrule / lead-bullet / section order) is folded INTO the game plan.
  const gamePlan: GamePlan | undefined = packet.plan
    ? {
        ...packet.plan,
        projectOrder: changes.plan?.order ?? packet.plan.projectOrder,
        played: changes.plan
          ? [
              ...packet.plan.played.filter((p) => p.section !== 'projects' || changes.plan!.order.includes(p.factId)),
              ...changes.plan.order
                .filter((id) => !packet.plan!.played.some((p) => p.factId === id))
                .map((id) => ({ factId: id, section: 'projects', reason: 'Promoted by the owner (studio head overrule).' })),
            ]
          : packet.plan.played,
        benched: changes.plan
          ? [
              ...packet.plan.benched.filter((b) => !changes.plan!.order.includes(b.factId)),
              ...packet.plan.played
                .filter((p) => p.section === 'projects' && !changes.plan!.order.includes(p.factId))
                .map((p) => ({ factId: p.factId, reason: 'Benched by the owner (studio head overrule).' })),
            ]
          : packet.plan.benched,
        bulletPlan: { ...(packet.plan.bulletPlan ?? {}), ...(changes.planBullets ?? {}), ...(changes.plan?.bullets ?? {}) },
        sectionOrder: changes.sectionOrder ? mergeSectionOrder(packet.plan.sectionOrder, changes.sectionOrder) : packet.plan.sectionOrder,
      }
    : undefined
  const resume = compileResume({
    identity,
    ledger,
    decode: packet.decode,
    coverage,
    jobId: packet.jobId,
    editorial: plan,
    summaryLine,
    excludedIds,
    excludedBulletIds,
    bulletOverrides,
    plan: gamePlan,
    pagePolicy: settings?.pagePolicy ?? 'two-ok',
    sections: settings?.sections,
    summaryOn,
  })
  // Re-runs judge with the same context as the first compile (decode + archetype + inventory).
  const rt = await redTeamPass(
    resume.lines.map((l) => `${l.text}${l.right ? ` ${l.right}` : ''}`).join('\n'),
    packet.decode,
    packet.editorial?.archetype,
    redTeamInventory(ledger, resume),
  ).catch(() => null)

  // Closure F3 — the last judge runs on EVERY recompile path too.
  const benchNotes = (resume.benchedByPage ?? []).map(
    (name) => `Benched by page pressure: ${name} was cast but could not fit even at the tightest layout — drop a bullet elsewhere or bench a project deliberately.`,
  )
  const baseGap = packet.gapNote.filter((n) => !n.startsWith('Benched by page pressure:'))
  return {
    ...packet,
    resume,
    coverage,
    gapNote: [...baseGap, ...benchNotes],
    plan: gamePlan ?? packet.plan,
    summaryOn,
    excludedIds,
    excludedBulletIds,
    bulletOverrides,
    compilePlan: plan,
    quality: estimateQuality(resume, coverage, ledger),
    editorial: packet.editorial
      ? { ...packet.editorial, sectionOrder: plan?.sectionOrder ?? packet.editorial.sectionOrder, redTeam: rt ?? packet.editorial.redTeam, redTeamRounds: packet.editorial.redTeamRounds + (rt ? 1 : 0) }
      : packet.editorial,
    ready: rt ? rt.verdict === 'PASS' : packet.ready,
  }
}

/**
 * Session 7.2 (A4) — when phase-2 (the full Editor's Desk) THROWS, the instant packet used to
 * ship silently, never judged by any floor. Now the zero-spend deterministic floors run on it
 * (Nazar heuristic twins → the compiler's exclusion gate; red-team re-runs inside the recompile)
 * and the packet wears `enhanceFailed` so the UI can offer a visible retry. I4 with eyes open.
 */
export async function floorPassPacket(packet: Packet): Promise<Packet> {
  const ledger = await db.ledger.toArray()
  const heur = nazarHeuristic(packet.resume)
  const dropIds = heur.length > 0 ? bulletIdsForIssues(heur, ledger, packet.bulletOverrides) : []
  let updated = packet
  if (dropIds.length > 0) {
    const merged = [...new Set([...(packet.excludedBulletIds ?? []), ...dropIds])]
    updated = await recompilePacket(packet, { excludedBulletIds: merged })
    updated = {
      ...updated,
      gapNote: [
        ...updated.gapNote,
        ...heur
          .filter((i) => i.type === 'duplicate')
          .map((i) => `Nazar (floor): removed a twin claim — "${i.drop.slice(0, 70)}…" said what a stronger line already says.`),
      ],
    }
  }
  return { ...updated, enhancing: false, enhanceFailed: true }
}

/**
 * Re-brief Arc 2 — the typeset register's version. A stored packet compiled under an older
 * register re-tailors itself on open (the D140 repair law, applied to typography): bump this
 * when the page's LOOK changes even though no ledger content did.
 */
export const TYPESET_VERSION = 3 // 1 = Helvetica plain (S7 "Taaj") · 2 = Times canon register · 3 = v2 full-size page (36pt, links, plan-executed)

/** A Baithak section-order op names the classic keys; the plan may hold more (custom kinds) — keep them, after. */
function mergeSectionOrder(current: string[], requested: string[]): string[] {
  const out = requested.filter((k) => k !== 'forge')
  for (const k of current) if (!out.includes(k)) out.push(k)
  return out
}

/** Persist the packet and move the job forward — tracking as a side effect, never a chore. */
export async function savePacket(packet: Packet): Promise<void> {
  await db.transaction('rw', [db.packets, db.jobs], async () => {
    // One packet per job: replace any previous tailoring.
    await db.packets.where('jobId').equals(packet.jobId).delete()
    await db.packets.put({ ...packet, typesetVersion: TYPESET_VERSION })
    const job = await db.jobs.get(packet.jobId)
    if (job && job.status === 'found') {
      await db.jobs.update(packet.jobId, { status: 'tailored', packetId: packet.id })
    } else {
      await db.jobs.update(packet.jobId, { packetId: packet.id })
    }
  })
}
