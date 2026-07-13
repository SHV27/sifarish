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
  overrides: { bullets?: Record<string, string[]>; sectionOrder?: NonNullable<Packet['editorial']>['sectionOrder'] },
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
  const resume = compileResume({ identity, ledger, decode: packet.decode, coverage, jobId: packet.jobId, editorial })
  const rt = await redTeamPass(resume.lines.map((l) => l.text).join('\n')).catch(() => null)
  return {
    ...packet,
    resume,
    coverage,
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
