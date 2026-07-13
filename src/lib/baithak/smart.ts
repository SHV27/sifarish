import type { BaithakParse, EditOp, LedgerEntry, Packet, ProposedEdit } from '../../types'
import { meteredCallsAllowed, meteredHeaders } from '../apiGuard'
import { allowedThisRun, recordSpend } from '../budget'

/**
 * SMART BAITHAK (Session 5.2, D53) — the intelligence layer. When the deterministic parser
 * doesn't match a specific intent (handled=false), THIS takes over: an LLM with FULL CONTEXT
 * (the ledger, the current casting, the vision) maps a freeform request to PROPOSED EditOps.
 *
 * I11 is preserved by construction: the LLM may only emit ops that SELECT/ORDER/LINK existing
 * ledger evidence (it returns ledger IDs, never free text), and every op is re-validated against
 * the real ledger here before it can become a diff card. Anything unevidenced → a refusal.
 * Owner-only + budgeted; keyless/over-budget → an honest keyless reply (never a crash).
 */

interface LlmOp {
  kind: string
  ledgerId?: string
  bulletId?: string
  on?: boolean
  url?: string
  sectionOrder?: string[]
}
interface LlmResult {
  reply?: string
  ops?: LlmOp[]
  refuse?: { term?: string; reason?: string }
}

let seq = 0
function proposal(op: EditOp, before: string, after: string, invariants: string[]): ProposedEdit {
  return { id: `smart-${Date.now()}-${seq++}`, op, before, after, invariants }
}

const SECTIONS = new Set(['education', 'skills', 'projects', 'forge', 'achievements', 'certs'])
const nameOf = (e: LedgerEntry) => e.title.split('—')[0].trim()

function ledgerDigest(ledger: LedgerEntry[]): string {
  const eligible = ledger.filter((e) => e.resumeEligible)
  const line = (e: LedgerEntry) =>
    `  ${e.id} [${e.tier}/${e.kind}] "${nameOf(e)}"` +
    (e.kind === 'project' ? ` bullets: ${e.bullets.map((b) => `${b.id}="${b.text.slice(0, 50)}"`).join(' | ')}` : '')
  return eligible.map(line).join('\n')
}

function systemPrompt(packet: Packet, ledger: LedgerEntry[]): string {
  const chosen = packet.editorial?.chosen.map((c) => c.ledgerId) ?? []
  return [
    'You are the Darzi Baithak — a resume tailor that turns a request into STRUCTURED EDIT OPS.',
    'HARD RULE (never break): you may only SELECT, ORDER, or LINK evidence that already exists in the',
    'LEDGER below. You can NEVER invent a skill, project, number, or bullet. If the request needs a',
    'claim not in the ledger, do NOT emit an op — instead set "refuse" with the term and an honest reason.',
    '',
    'Available ops (emit only these; use exact ledger IDs from the LEDGER):',
    '- {"kind":"set-summary","on":true|false}  — add/remove a professional summary (compiled from evidence).',
    '- {"kind":"promote-project","ledgerId":"proj-..."}  — make a shipped project lead the resume.',
    '- {"kind":"bench-project","ledgerId":"proj-..."}  — remove a project from the lead lineup.',
    '- {"kind":"lead-bullet","ledgerId":"proj-...","bulletId":"..."}  — lead a project with one of ITS bullets.',
    '- {"kind":"attach-link","ledgerId":"proj-...","url":"https://..."}  — attach a live link (probe-gated).',
    '- {"kind":"set-section-order","sectionOrder":["skills","projects","forge","education","achievements","certs"]}',
    '- {"kind":"polish-tone"}  — a guarded phrasing pass (facts frozen).',
    '',
    `Currently leading (chosen) project IDs: ${chosen.join(', ') || '(none yet)'}.`,
    '',
    'Return ONLY compact JSON: {"reply": string, "ops": Op[], "refuse"?: {"term": string, "reason": string}}.',
    'The reply is warm, brief, Hinglish-friendly, and explains what you propose. Prefer 1-3 ops.',
    '',
    'LEDGER (the ONLY source of truth — every op must reference these exact IDs):',
    ledgerDigest(ledger),
  ].join('\n')
}

/** Validate an LLM op against the real ledger → ProposedEdit, or null if it would mint/mismatch. */
function validate(op: LlmOp, packet: Packet, ledger: LedgerEntry[]): ProposedEdit | null {
  const byId = new Map(ledger.map((e) => [e.id, e]))
  const chosen = new Set(packet.editorial?.chosen.map((c) => c.ledgerId) ?? [])
  switch (op.kind) {
    case 'set-summary':
      return proposal({ kind: 'set-summary', on: op.on !== false }, op.on === false ? 'Resume has a summary' : 'No professional summary', op.on === false ? 'Summary removed' : 'Evidence-dense professional summary at the top', ['I1 (compiled from real evidence)'])
    case 'polish-tone':
      return proposal({ kind: 'polish-tone' }, 'Compiled phrasing', 'A guarded phrasing pass (facts frozen)', ['I1 fact-drift guard'])
    case 'promote-project': {
      const e = op.ledgerId ? byId.get(op.ledgerId) : undefined
      if (!e || e.kind !== 'project' || e.tier !== 'shipped') return null
      return proposal({ kind: 'promote-project', ledgerId: e.id }, `${nameOf(e)} not leading`, `${nameOf(e)} leads the resume`, ['casting override', 'red-team re-runs'])
    }
    case 'bench-project': {
      const e = op.ledgerId ? byId.get(op.ledgerId) : undefined
      if (!e || !chosen.has(e.id)) return null
      return proposal({ kind: 'bench-project', ledgerId: e.id }, `${nameOf(e)} is leading`, `${nameOf(e)} benched`, ['casting override', 'red-team re-runs'])
    }
    case 'lead-bullet': {
      const e = op.ledgerId ? byId.get(op.ledgerId) : undefined
      const b = e?.bullets.find((x) => x.id === op.bulletId)
      if (!e || !b) return null
      return proposal({ kind: 'lead-bullet', ledgerId: e.id, bulletId: b.id }, `${nameOf(e)} bullet order`, `"${b.text.slice(0, 60)}…" leads ${nameOf(e)}`, ['I1 (existing ledger bullet)'])
    }
    case 'attach-link': {
      const e = op.ledgerId ? byId.get(op.ledgerId) : undefined
      if (!e || !op.url || !/^https?:\/\//.test(op.url)) return null
      return proposal({ kind: 'attach-link', ledgerId: e.id, url: op.url }, `${nameOf(e)} link`, `Attach ${op.url} to ${nameOf(e)} (probe-gated)`, ['dead-link probe', 'I1'])
    }
    case 'set-section-order': {
      const requested = (op.sectionOrder ?? []).filter((s) => SECTIONS.has(s))
      if (requested.length < 2) return null
      const sectionOrder = [...new Set([...requested, 'education', 'skills', 'projects', 'forge', 'achievements', 'certs'])] as ('education' | 'skills' | 'projects' | 'forge' | 'achievements' | 'certs')[]
      return proposal({ kind: 'set-section-order', sectionOrder }, 'Current section order', `${sectionOrder[0]} leads`, ['structure only'])
    }
    default:
      return null
  }
}

export async function smartBaithak(utterance: string, packet: Packet, ledger: LedgerEntry[]): Promise<BaithakParse> {
  const keyless: BaithakParse = {
    reply:
      'Iske liye mujhe thoda aur samajhna hoga. Try: "professional summary daal" · "GLOAMING ko lead karao" · ' +
      '"skills upar" · "thoda technical tone". (Freeform smart mode ke liye owner GROQ key chahiye.)',
    proposals: [],
    by: 'deterministic',
    handled: true,
  }
  if (!meteredCallsAllowed()) return keyless
  if ((await allowedThisRun('dimaag')) <= 0) return keyless

  let data: { keyless?: boolean; result?: LlmResult; tokens?: number } | null = null
  try {
    const res = await fetch('/api/dimaag', {
      method: 'POST',
      headers: meteredHeaders(),
      body: JSON.stringify({ tier: 'reasoning', system: systemPrompt(packet, ledger), user: utterance.slice(0, 500), maxTokens: 700 }),
    })
    if (!res.ok) return keyless
    data = await res.json()
  } catch {
    return keyless
  }
  if (!data || data.keyless || !data.result) return keyless
  await recordSpend('dimaag', 1)

  const r = data.result
  if (r.refuse?.term) {
    return {
      reply: `Nahi — "${r.refuse.term}" ka evidence tumhare ledger mein nahi hai, aur main bina saboot kuch nahi likhta (I1). ${r.refuse.reason ?? 'Pehle usse ship karo; Nabz promote kar dega.'}`,
      proposals: [],
      refused: { term: r.refuse.term, gapNote: `"${r.refuse.term}" requested via Baithak but has no ledger evidence.` },
      by: 'dimaag',
      handled: true,
    }
  }
  const proposals = (r.ops ?? []).map((op) => validate(op, packet, ledger)).filter((p): p is ProposedEdit => p !== null).slice(0, 4)
  return {
    reply: (r.reply || 'Ye propose kar raha hoon — diff cards dekho, ✓ karo toh compiler se guzrenge.').slice(0, 600),
    proposals,
    by: 'dimaag',
    handled: true,
  }
}
