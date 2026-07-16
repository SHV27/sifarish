import { db } from '../../db/db'
import type { BaithakLogEntry, EditOp, Packet } from '../../types'
import { compileResume } from '../compile/compiler'
import { matchEvidence } from '../match/evidence'
import { redTeamPass } from '../darzi/editor'
import { overrulePacket, setSummary } from '../darzi'
import { estimateQuality } from '../ustaad/quality'

/**
 * BAITHAK EXECUTOR (P14, I11) — applies an owner-approved EditOp through the SAME
 * deterministic pipeline as any other input: the v1 compiler stays the final authority
 * (I1/I2/one-page/parse-back), the red-team re-runs on content changes, quality re-estimates,
 * and every applied op logs to the packet's decisions trail. No conversational backdoor exists:
 * this module can only select, order, link, and re-polish — never write a claim.
 */

export type ProbeFn = (url: string) => Promise<boolean>

/**
 * Liveness probe. `no-cors` HEAD resolves for any reachable host (opaque response) and
 * rejects on DNS/network failure — an honest "does this host exist and answer" check from
 * the browser. GitHub links get a stronger API check (CORS-open).
 */
export async function probeAlive(url: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const gh = /^(www\.)?github\.com$/i.exec(u.hostname)
    if (gh) {
      const [, owner, repo] = u.pathname.split('/')
      if (owner && repo) {
        const res = await fetchFn(`https://api.github.com/repos/${owner}/${repo}`, { signal: AbortSignal.timeout(6000) })
        return res.ok
      }
    }
    await fetchFn(u.toString(), { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(6000) })
    return true
  } catch {
    return false
  }
}

export interface ApplyResult {
  ok: boolean
  note: string
  packet?: Packet
}

async function persist(packet: Packet, utterance: string, summary: string): Promise<Packet> {
  const entry: BaithakLogEntry = { at: new Date().toISOString(), utterance, summary }
  const updated: Packet = { ...packet, baithakLog: [...(packet.baithakLog ?? []), entry] }
  await db.packets.put(updated)
  return updated
}

/** Recompile the packet's resume with overrides; red-team + quality re-run. */
async function recompile(
  packet: Packet,
  overrides: {
    bullets?: Record<string, string[]>
    sectionOrder?: NonNullable<Packet['editorial']>['sectionOrder']
    excludedIds?: string[]
    bulletOverrides?: Record<string, string>
  },
): Promise<Packet> {
  const identity = await db.identity.get('me')
  const ledger = await db.ledger.toArray()
  if (!identity) throw new Error('Identity missing — reseed the app.')
  const coverage = matchEvidence(packet.decode, ledger)
  const editorial = {
    order: packet.editorial?.chosen.map((c) => c.ledgerId) ?? [],
    bullets: overrides.bullets ?? {},
    sectionOrder: overrides.sectionOrder ?? packet.editorial?.sectionOrder,
  }
  const resume = compileResume({
    identity,
    ledger,
    decode: packet.decode,
    coverage,
    jobId: packet.jobId,
    editorial,
    // Baithak state travels with the packet, so every later recompile keeps his decisions.
    excludedIds: overrides.excludedIds ?? packet.excludedIds,
    bulletOverrides: overrides.bulletOverrides ?? packet.bulletOverrides,
  })
  const rt = await redTeamPass(resume.lines.map((l) => l.text).join('\n')).catch(() => null)
  return {
    ...packet,
    resume,
    coverage,
    excludedIds: overrides.excludedIds ?? packet.excludedIds,
    bulletOverrides: overrides.bulletOverrides ?? packet.bulletOverrides,
    quality: estimateQuality(resume, coverage, ledger),
    editorial: packet.editorial
      ? { ...packet.editorial, sectionOrder: editorial.sectionOrder, redTeam: rt ?? packet.editorial.redTeam, redTeamRounds: packet.editorial.redTeamRounds + (rt ? 1 : 0) }
      : packet.editorial,
    ready: rt ? rt.verdict === 'PASS' : packet.ready,
  }
}

export async function applyEdit(packet: Packet, op: EditOp, utterance: string, probe: ProbeFn = probeAlive): Promise<ApplyResult> {
  switch (op.kind) {
    case 'bench-project': {
      const updated = await overrulePacket(packet, { benchId: op.ledgerId })
      const done = await persist(updated, utterance, `Benched ${op.ledgerId} (Baithak)`)
      return { ok: true, note: 'Benched — the lineup recompiled and the red-team re-ran.', packet: done }
    }
    case 'promote-project': {
      const updated = await overrulePacket(packet, { promoteId: op.ledgerId })
      const done = await persist(updated, utterance, `Promoted ${op.ledgerId} (Baithak)`)
      return { ok: true, note: 'Promoted — the lineup recompiled and the red-team re-ran.', packet: done }
    }
    case 'attach-link': {
      const alive = await probe(op.url)
      if (!alive) {
        return { ok: false, note: `Probe failed — ${op.url} is not answering. A dead link can never enter a packet; fix the deploy or give me the right URL.` }
      }
      const entry = await db.ledger.get(op.ledgerId)
      if (!entry) return { ok: false, note: 'Ledger entry not found.' }
      await db.ledger.update(op.ledgerId, {
        evidence: { ...(entry.evidence ?? { date: new Date().toISOString().slice(0, 7), note: '' }), url: op.url },
      })
      const updated = await recompile(packet, {})
      const done = await persist(updated, utterance, `Attached live link ${op.url} to ${op.ledgerId} (probe passed)`)
      return { ok: true, note: 'Probe passed — link attached to the ledger and the page recompiled.', packet: done }
    }
    case 'lead-bullet': {
      const entry = await db.ledger.get(op.ledgerId)
      if (!entry) return { ok: false, note: 'Ledger entry not found.' }
      const exists = entry.bullets.some((b) => b.id === op.bulletId)
      if (!exists) return { ok: false, note: 'That bullet is not in the ledger — Baithak cannot mint one (I11).' }
      const rest = entry.bullets.map((b) => b.id).filter((id) => id !== op.bulletId)
      const updated = await recompile(packet, { bullets: { [op.ledgerId]: [op.bulletId, ...rest] } })
      const done = await persist(updated, utterance, `Led ${op.ledgerId} with ledger bullet ${op.bulletId}`)
      return { ok: true, note: 'Bullet leads now — same evidence, sharper order.', packet: done }
    }
    case 'set-section-order': {
      const updated = await recompile(packet, { sectionOrder: op.sectionOrder })
      const done = await persist(updated, utterance, `Section order → ${op.sectionOrder.join(' · ')}`)
      return { ok: true, note: 'Sections reordered; the one-page constraint re-solved.', packet: done }
    }
    case 'polish-tone': {
      const { polishPacket } = await import('../polish/client')
      const r = await polishPacket(packet)
      const fresh = (await db.packets.get(packet.id)) ?? packet
      const done = await persist(fresh, utterance, `Polish pass: ${r.keyless ? 'keyless (no-op)' : `${r.applied} applied, ${r.rejected} rejected by the fact-drift guard`}`)
      return {
        ok: true,
        note: r.keyless
          ? 'Keyless mode — compiled text kept as-is (polish needs GROQ_API_KEY).'
          : `Polished: ${r.applied} line(s) improved, ${r.rejected} rejected by the fact-drift guard.`,
        packet: done,
      }
    }
    /** "ye skill hata" / "ye wali daal" — packet-scoped suppression. His ledger is never edited. */
    case 'set-entry': {
      const entry = await db.ledger.get(op.ledgerId)
      if (!entry) return { ok: false, note: 'Ledger entry not found.' }
      const current = new Set(packet.excludedIds ?? [])
      if (op.on) current.delete(op.ledgerId)
      else current.add(op.ledgerId)
      const excludedIds = [...current]

      const updated = await recompile(packet, { excludedIds })
      // A resume with nothing on it is not a tailoring outcome — refuse rather than ship a husk.
      if (updated.resume.lines.length < 4) {
        return { ok: false, note: 'That would empty the resume. Nothing changed.' }
      }
      const name = entry.title.split('—')[0].trim()
      const done = await persist(updated, utterance, `${op.on ? 'Restored' : 'Dropped'} ${op.ledgerId} for this role (Baithak)`)
      return {
        ok: true,
        note: op.on
          ? `${name} is back on this resume.`
          : `${name} dropped from this resume. Your ledger is untouched — it still runs for other roles.`,
        packet: done,
      }
    }

    /** "GLOAMING ko aise explain kar" — re-express its bullets; the fact-drift guard freezes facts. */
    case 'reframe-project': {
      const entry = await db.ledger.get(op.ledgerId)
      if (!entry) return { ok: false, note: 'Ledger entry not found.' }
      const { reframeProject } = await import('../polish/reframe')
      const r = await reframeProject(entry, op.direction)
      if (r.keyless) {
        return { ok: false, note: 'Keyless mode — reframing needs the owner GROQ key. The compiled bullets stand.' }
      }
      if (r.applied === 0) {
        const why = r.rejected.length
          ? `Every attempt tried to add something you haven't proved (${[...new Set(r.rejected.flatMap((x) => x.addedFacts))].slice(0, 4).join(', ')}), so I threw them out. Your bullets stand as compiled.`
          : 'Nothing came back better than what you already have — your bullets stand.'
        return { ok: false, note: why }
      }
      const bulletOverrides = { ...(packet.bulletOverrides ?? {}), ...r.overrides }
      const updated = await recompile(packet, { bulletOverrides })
      const done = await persist(updated, utterance, `Reframed ${op.ledgerId}: "${op.direction}" — ${r.applied} applied, ${r.rejected.length} rejected by the fact guard`)
      return {
        ok: true,
        note: `Reframed ${r.applied} bullet(s)${r.rejected.length ? ` · ${r.rejected.length} rejected by the fact guard (they tried to add facts you haven't proved)` : ''}. Same facts, your framing.`,
        packet: done,
      }
    }

    /** "poora resume is angle se frame kar" — every leading project, one direction (Session 5.9). */
    case 'rewrite-angle': {
      const chosen = packet.editorial?.chosen.map((c) => c.ledgerId) ?? []
      const entries = (await Promise.all(chosen.map((id) => db.ledger.get(id)))).filter(
        (e): e is NonNullable<typeof e> => !!e && e.bullets.length > 0,
      )
      if (entries.length === 0) return { ok: false, note: 'No leading projects to reframe.' }
      const { reframeProject } = await import('../polish/reframe')
      let applied = 0
      let rejectedCount = 0
      const addedFacts = new Set<string>()
      let overrides: Record<string, string> = { ...(packet.bulletOverrides ?? {}) }
      for (const entry of entries) {
        const r = await reframeProject(entry, op.direction)
        if (r.keyless) return { ok: false, note: 'Keyless mode — reframing needs the owner GROQ key. The compiled bullets stand.' }
        applied += r.applied
        rejectedCount += r.rejected.length
        for (const x of r.rejected) for (const f of x.addedFacts) addedFacts.add(f)
        overrides = { ...overrides, ...r.overrides }
      }
      if (applied === 0) {
        const why = rejectedCount
          ? `Every attempt tried to add something you haven't proved (${[...addedFacts].slice(0, 4).join(', ')}), so I threw them out. Your bullets stand as compiled.`
          : 'Nothing came back better than what you already have — your bullets stand.'
        return { ok: false, note: why }
      }
      const updated = await recompile(packet, { bulletOverrides: overrides })
      const done = await persist(updated, utterance, `Rewrote the résumé angle: "${op.direction}" — ${applied} bullet(s) across ${entries.length} project(s), ${rejectedCount} rejected by the fact guard`)
      return {
        ok: true,
        note: `Reframed ${applied} bullet(s) across ${entries.length} leading project(s)${rejectedCount ? ` · ${rejectedCount} rejected by the fact guard` : ''}. Same facts, one framing.`,
        packet: done,
      }
    }

    case 'set-summary': {
      const updated = await setSummary(packet, op.on)
      const done = await persist(updated, utterance, `Professional summary ${op.on ? 'added' : 'removed'}`)
      return {
        ok: true,
        note: op.on ? 'Professional summary added — evidence-dense, compiled from your ledger + vision.' : 'Professional summary removed.',
        packet: done,
      }
    }
  }
}
