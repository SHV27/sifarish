import type { BaithakParse, EditOp, LedgerEntry, Packet, ProposedEdit } from '../../types'
import { db } from '../../db/db'
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
  direction?: string
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

/**
 * THE LEDGER DIGEST — what the Baithak can actually reach for.
 *
 * It used to slice every bullet to 50 characters, so the tailor was reasoning about evidence it
 * could not read ("Built a browser co-op board game where the board it…"). Bullets are now given
 * whole, and each project carries the deep-read context (D58) — the problem it attacks and its
 * stack — so "make this more agentic" can find the actual agentic work instead of guessing.
 */
function ledgerDigest(ledger: LedgerEntry[]): string {
  const eligible = ledger.filter((e) => e.resumeEligible)
  const line = (e: LedgerEntry) => {
    const head = `  ${e.id} [${e.tier}/${e.kind}] "${nameOf(e)}"${e.summary ? ` — ${e.summary.slice(0, 160)}` : ''}`
    if (e.kind !== 'project') return head
    const ctx = e.context
    const extra = [
      ctx?.problem ? `\n     problem: ${ctx.problem.slice(0, 180)}` : '',
      ctx?.stack?.length ? `\n     stack: ${ctx.stack.join(', ')}` : '',
      e.tags.length ? `\n     tags: ${e.tags.join(', ')}` : '',
    ].join('')
    const bullets = e.bullets.map((b) => `\n     - ${b.id}: "${b.text}"`).join('')
    return head + extra + bullets
  }
  return eligible.map(line).join('\n')
}

/**
 * THE ROLE BRIEF — the context the Baithak was missing entirely.
 *
 * The old prompt knew the ledger and nothing else: not the company, not the JD, not the archetype,
 * not why the Editor's Desk cast what it cast. Asked to "make this fit the role better" it had no
 * role to fit. That is why it felt dumb — it was blind, not stupid.
 */
function roleBrief(packet: Packet, job: { title: string; company: string } | undefined, vision?: string): string {
  const d = packet.decode
  const ed = packet.editorial
  return [
    job ? `ROLE: ${job.title} at ${job.company}.` : 'ROLE: (job record unavailable)',
    d?.mustHave?.length ? `JD must-haves: ${d.mustHave.map((k) => k.replace(/-/g, ' ')).join(', ')}.` : '',
    d?.niceToHave?.length ? `JD nice-to-haves: ${d.niceToHave.slice(0, 8).map((k) => k.replace(/-/g, ' ')).join(', ')}.` : '',
    ed ? `Reviewer archetype: ${ed.archetype.label}.` : '',
    ed?.casting?.why ? `Why the current lineup was cast: ${ed.casting.why.slice(0, 400)}` : '',
    ed?.chosen?.length ? `LEADING now: ${ed.chosen.map((c) => `${c.ledgerId} (angle: ${c.angleLabel})`).join('; ')}.` : '',
    ed?.benched?.length ? `BENCHED now: ${ed.benched.map((b) => `${b.ledgerId} — ${b.why.slice(0, 90)}`).join('; ')}.` : '',
    packet.coverage?.missing?.length
      ? `JD requirements with NO ledger evidence (never claim these — refuse if asked): ${packet.coverage.missing.map((g) => g.keyword).join(', ')}.`
      : '',
    packet.coverage?.building?.length
      ? `Covered only by in_forge work (may appear ONLY in the dated "Currently Building" line, I2): ${packet.coverage.building.map((g) => g.keyword).join(', ')}.`
      : '',
    vision ? `His stated vision/target: ${vision.slice(0, 300)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** The resume as it currently stands — so "ye kyun hai?" and "chhota karo" have a referent. */
function currentResume(packet: Packet): string {
  return packet.resume.lines.map((l) => `  [${l.kind}] ${l.text}`).join('\n').slice(0, 2500)
}

function systemPrompt(packet: Packet, ledger: LedgerEntry[], job: { title: string; company: string } | undefined, vision: string | undefined): string {
  return [
    'You are the Darzi Baithak — Shaurya\'s resume tailor. He talks to you in Hinglish. You do two things:',
    '  (1) ANSWER questions about the resume, the casting, and the role — honestly and specifically.',
    '  (2) Turn requests for change into STRUCTURED EDIT OPS.',
    '',
    'If he is ASKING rather than instructing ("ye kyun chuna?", "is role ke liye theek hai?", "kya missing hai?"),',
    'just answer it well in "reply" with an EMPTY ops array. A good specific answer is a valid response —',
    'do NOT force an edit. Cite the actual reason (the casting rationale, the JD must-haves, the evidence).',
    '',
    'HARD RULE (never break): you may only SELECT, ORDER, or LINK evidence that already exists in the',
    'LEDGER below. You can NEVER invent a skill, project, number, or bullet. If the request needs a',
    'claim not in the ledger, do NOT emit an op — instead set "refuse" with the term and an honest reason.',
    'Rephrasing is allowed ONLY via polish-tone, which freezes facts.',
    '',
    'CRUCIAL: if he asks to ADD / include / put on the resume a project that IS in the LEDGER below',
    '(even if currently benched), that is a PROMOTE — emit promote-project, NEVER a refusal. Promoting',
    'a real project he built is not a fabrication. Ignore casual asides about how he built it (e.g.',
    '"with help of Claude"): promoting renders his real ledger bullets, none of which you invent.',
    'Only refuse a NEW factual claim (a skill/tech/number that appears nowhere in the LEDGER).',
    '',
    'Available ops (emit only these; use exact ledger IDs from the LEDGER):',
    '- {"kind":"set-summary","on":true|false}  — add/remove a professional summary (compiled from evidence).',
    '- {"kind":"promote-project","ledgerId":"proj-..."}  — make a shipped project lead the resume.',
    '- {"kind":"bench-project","ledgerId":"proj-..."}  — remove a project from the lead lineup.',
    '- {"kind":"lead-bullet","ledgerId":"proj-...","bulletId":"..."}  — lead a project with one of ITS bullets.',
    '- {"kind":"attach-link","ledgerId":"proj-...","url":"https://..."}  — attach a live link (probe-gated).',
    '- {"kind":"set-section-order","sectionOrder":["skills","projects","forge","education","achievements","certs"]}',
    '- {"kind":"polish-tone"}  — a guarded phrasing pass (facts frozen).',
    '- {"kind":"set-entry","ledgerId":"...","on":false}  — DROP any ledger entry (a skill, a project,',
    '    an achievement) from THIS resume; on:true restores it. Use this for "ye skill hata do",',
    '    "Python nikaal", "ye wali daal". It is packet-scoped and never edits his ledger.',
    '- {"kind":"reframe-project","ledgerId":"proj-...","direction":"<what he asked for, verbatim-ish>"}',
    '    — re-express THAT project\'s bullets toward a framing ("GLOAMING ko agentic angle se explain kar",',
    '    "isko zyada systems-heavy dikha"). Wording changes; a fact-drift guard freezes every number,',
    '    technology and proper noun, so it can never say something new. Use this whenever he asks for a',
    '    project to be EXPLAINED or FRAMED differently — do not refuse that, it is honest tailoring.',
    '- {"kind":"rewrite-angle","direction":"<the framing he asked for>"}  — reframe EVERY leading',
    '    project toward one direction ("poora resume agentic angle se frame kar", "sab kuch product',
    '    impact ki taraf le ja"). Same fact-drift guard, per project. Use this for whole-résumé asks;',
    '    reframe-project when he names one project.',
    '',
    'Reasoning guidance: when he asks to aim the resume at the role, work out WHICH ledger evidence best',
    'answers the JD must-haves, then promote/bench/reorder to put that evidence in the first third of the',
    'page (a recruiter skims ~6 seconds). Name the specific project and the specific reason in your reply.',
    '',
    // D74: the schema owns the structure. Spelling the shape out here fights it and reintroduces
    // Groq's 400 "Failed to generate JSON" — this prompt is why the smart Baithak was dead.
    'reply: warm, brief (max ~80 words), Hinglish-friendly, specific. ops: 0-3 of the ops above.',
    'refuse: set ONLY when he asks to claim something with no ledger evidence — give the term and an honest reason. Otherwise refuse is null.',
    // Strict structured output requires every field on every op; irrelevant ones are null.
    'On each op, set the fields that op uses and set every other field to null.',
    '',
    '--- THE ROLE HE IS TAILORING FOR ---',
    roleBrief(packet, job, vision),
    '',
    '--- THE RESUME AS IT STANDS RIGHT NOW ---',
    currentResume(packet),
    '',
    '--- LEDGER (the ONLY source of truth — every op must reference these exact IDs) ---',
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
    /** Drop/restore any real ledger entry for this packet. The id must exist — no minting. */
    case 'set-entry': {
      const e = op.ledgerId ? byId.get(op.ledgerId) : undefined
      if (!e) return null
      const on = op.on === true
      const excluded = new Set(packet.excludedIds ?? [])
      if (on === !excluded.has(e.id)) return null // already in that state — not a real change
      return proposal(
        { kind: 'set-entry', ledgerId: e.id, on },
        on ? `${nameOf(e)} is off this resume` : `${nameOf(e)} is on this resume`,
        on ? `${nameOf(e)} back on this resume` : `${nameOf(e)} dropped from this resume (your ledger keeps it)`,
        ['packet-scoped only', 'ledger untouched'],
      )
    }
    /** Re-express a real project's bullets. The guard freezes the facts at apply time. */
    case 'reframe-project': {
      const e = op.ledgerId ? byId.get(op.ledgerId) : undefined
      if (!e || e.kind !== 'project' || e.bullets.length === 0) return null
      const direction = (op.direction ?? '').trim()
      if (direction.length < 3) return null
      return proposal(
        { kind: 'reframe-project', ledgerId: e.id, direction },
        `${nameOf(e)} as compiled`,
        `${nameOf(e)} re-explained: "${direction.slice(0, 70)}" — same facts, new framing`,
        ['I1 fact-drift guard (facts frozen)', 'packet-scoped'],
      )
    }
    /** Whole-résumé reframe (Session 5.9): every leading project, one direction, guarded per project. */
    case 'rewrite-angle': {
      const direction = (op.direction ?? '').trim()
      if (direction.length < 3) return null
      const leading = ledger.filter((e) => chosen.has(e.id) && e.bullets.length > 0)
      if (leading.length === 0) return null
      return proposal(
        { kind: 'rewrite-angle', direction },
        'Résumé as compiled',
        `Every leading project re-explained: "${direction.slice(0, 70)}" — same facts, one framing`,
        ['I1 fact-drift guard (facts frozen, per project)', 'packet-scoped'],
      )
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

/** A turn of the conversation, so a follow-up ("haan wahi karo") has a referent. */
export interface BaithakTurn {
  role: 'owner' | 'darzi'
  text: string
}

export async function smartBaithak(utterance: string, packet: Packet, ledger: LedgerEntry[], history: BaithakTurn[] = []): Promise<BaithakParse> {
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

  // The context the Baithak was missing: which job this packet is for, and his stated vision.
  const job = await db.jobs.get(packet.jobId).catch(() => undefined)
  const settings = await db.settings.get('app').catch(() => undefined)
  const vision = settings?.visionProfile?.dream

  // Recent turns, so "wahi karo" / "aur?" resolve instead of starting cold every message.
  const convo = history
    .slice(-6)
    .map((t) => `${t.role === 'owner' ? 'SHAURYA' : 'YOU'}: ${t.text}`)
    .join('\n')
  const user = convo ? `Conversation so far:\n${convo}\n\nSHAURYA (now): ${utterance.slice(0, 500)}` : utterance.slice(0, 500)

  let data: { keyless?: boolean; result?: LlmResult; tokens?: number } | null = null
  try {
    const res = await fetch('/api/dimaag', {
      method: 'POST',
      headers: meteredHeaders(),
      body: JSON.stringify({
        tier: 'reasoning',
        system: systemPrompt(packet, ledger, job ? { title: job.title, company: job.company } : undefined, vision),
        user,
        maxTokens: 2000,
        /**
         * D74 — without this the call uses json_object, which openai/gpt-oss-120b fails on ~every
         * attempt (measured 0/3). The smart Baithak posts here directly rather than through the
         * dimaag core, so it needs its own schema; that omission is why "baithak is bullshit" was
         * a correct bug report. `ops` stays loosely typed because the op union is validated
         * against the real ledger by `validate()` below — the schema shapes it, the ledger
         * authorises it (I11 holds regardless of what the model returns).
         */
        schema: {
          type: 'object',
          properties: {
            reply: { type: 'string' },
            ops: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  kind: { type: 'string' },
                  ledgerId: { type: ['string', 'null'] },
                  bulletId: { type: ['string', 'null'] },
                  on: { type: ['boolean', 'null'] },
                  url: { type: ['string', 'null'] },
                  direction: { type: ['string', 'null'] },
                  sectionOrder: { type: ['array', 'null'], items: { type: 'string' } },
                },
                required: ['kind', 'ledgerId', 'bulletId', 'on', 'url', 'direction', 'sectionOrder'],
                additionalProperties: false,
              },
            },
            refuse: {
              type: ['object', 'null'],
              properties: { term: { type: 'string' }, reason: { type: 'string' } },
              required: ['term', 'reason'],
              additionalProperties: false,
            },
          },
          required: ['reply', 'ops', 'refuse'],
          additionalProperties: false,
        },
      }),
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
