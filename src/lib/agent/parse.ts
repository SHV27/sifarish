import type { AgentContext, GlobalProposal } from './ops'
import { validateGlobalOp } from './ops'

/**
 * EK BAAT — deterministic utterance → global-op proposals (the keyless core, D23/D37 pattern
 * applied app-wide). Hinglish + English cue grammar; anything it can't parse cleanly falls
 * through (the Guru streams prose, or the LLM op lane proposes — both re-validated by the
 * registry). The honesty ROUTER always runs before this: refusals are decided upstream.
 */

export interface GlobalParse {
  proposals: GlobalProposal[]
  reply: string
}

const clean = (s: string) =>
  s
    .trim()
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.?!]+$/, '')
    .trim()

export function parseGlobal(utterance: string, ctx: AgentContext): GlobalParse | null {
  const t = utterance.trim()
  const lower = t.toLowerCase()
  const propose = (raw: Record<string, unknown>, reply: string): GlobalParse | null => {
    const p = validateGlobalOp(raw, ctx)
    return p ? { proposals: [p], reply } : null
  }

  // --- Ledger adds: "add achievement: won X" · "achievement jodo …" · "add skill Python" ---
  let m =
    /^(?:add|new|nayi|naya)\s+(achievement|certification|cert|skill)\s*[:\-–—]?\s+(.+)$/i.exec(t) ??
    /^(achievement|certification|cert|skill)\s+(?:jodo|daal(?:o)?|add karo?|likho?)\s*[:\-–—]?\s*(.+)$/i.exec(t)
  if (m) {
    const entryKind = m[1].toLowerCase() === 'cert' ? 'certification' : (m[1].toLowerCase() as 'achievement' | 'certification' | 'skill')
    return propose(
      { kind: 'add-entry', entryKind, title: clean(m[2]) },
      `Ledger entry proposed — confirm and it lands exactly like Shelf's Quick-add. (The ledger is your sworn truth: only add what you can defend in an interview.)`,
    )
  }

  // --- Mark applied: "mark netomi as applied" · "netomi pe apply kar diya" ---
  m =
    /^mark(?:ed)?\s+(.+?)\s+(?:as\s+)?applied$/i.exec(t) ??
    /^(.+?)\s+(?:pe|par|ko|mein)\s+apply\s+(?:kar diya|ho gaya|done|kiya)$/i.exec(t) ??
    /^applied\s+(?:to|at)\s+(.+)$/i.exec(t)
  if (m) {
    const found = propose(
      { kind: 'mark-applied', jobId: clean(m[1]) },
      'Confirm and I stamp it applied — nudges arm on day 7/14.',
    )
    if (found) return found
    return {
      proposals: [],
      reply: `I couldn't find "${clean(m[1])}" in your pipeline. Open the Morcha and check the card's name, or tell me the exact company.`,
    }
  }

  // --- Hunts: "hunt for RAG engineer" · "RAG engineer hunt karo" · "pause hunt X" ---
  m = /^(?:hunt(?:\s+for)?|search\s+(?:for\s+)?jobs?\s+(?:for|like)?)\s+(.+)$/i.exec(t) ?? /^(.+?)\s+(?:hunt|dhundho|khojo)\s*(?:karo|start karo)?$/i.exec(t)
  if (m && !/\bwhy|how|what|kya|kaise|kaun\b/i.test(lower)) {
    const q = clean(m[1])
    if (q.length >= 4) {
      const r = propose({ kind: 'add-hunt', query: q }, 'Confirm and this joins your saved hunts (budget-rationed).')
      if (r) return r
    }
  }
  m = /^(pause|stop|disable|enable|resume)\s+(?:the\s+)?hunt\s+(.+)$/i.exec(t)
  if (m) {
    const enabled = /enable|resume/i.test(m[1])
    return propose({ kind: 'toggle-hunt', huntId: clean(m[2]), enabled }, enabled ? 'Confirm to fund it again next sweep.' : 'Confirm to pause it (kept, not deleted).')
  }

  // --- Vision edits ---
  // "My vision is …" / "mera vision …" — the whole point of Ek Baat (final-bar pass).
  m = /^(?:my vision(?:\s+now)? is|mera vision(?:\s+(?:hai|ye hai|ab ye hai))?[:,]?|vision\s*[:\-–—])\s+(.{20,})$/i.exec(t)
  if (m) return propose({ kind: 'vision-set-dream', dream: clean(m[1]) }, 'Confirm and everything re-derives around it — ranking, hunts, the headline\'s voice, the letters.')
  // "add X to the radar" — his own phrasing for a new hunt.
  m = /^(?:add|daal(?:o)?)\s+["']?(.+?)["']?\s+(?:to|on|pe)\s+(?:the\s+)?radar$/i.exec(t)
  if (m) return propose({ kind: 'add-hunt', query: clean(m[1]) }, 'Confirm and the Radar starts hunting it (budget-rationed).')
  m = /^(?:add\s+)?["']?(.+?)["']?\s+(?:to|in)\s+(?:my\s+)?(?:target\s+roles?|vision)$/i.exec(t) ?? /^target\s+role\s+(?:add|jodo)\s*[:\-]?\s*(.+)$/i.exec(t)
  if (m) return propose({ kind: 'vision-add-role', role: clean(m[1]) }, 'Confirm and the Radar starts ranking this title at the top of the score.')
  m = /^(?:i(?:'| a)?m\s+)?not\s+interested\s+in\s+(.+)$/i.exec(t) ?? /^(.+?)\s+(?:mein|me)\s+interest\s+nahi(?:\s+hai)?$/i.exec(t)
  if (m) return propose({ kind: 'vision-add-avoid', term: clean(m[1]) }, 'Confirm and matching roles demote (never hidden) with the reason shown.')
  m = /^(?:add\s+)?dream\s+compan(?:y|ies)\s*[:\-]?\s*(.+)$/i.exec(t)
  if (m) return propose({ kind: 'vision-add-company', company: clean(m[1]) }, 'Confirm and it gets hunted by name every sweep.')

  // --- Navigate: "open radar" · "morcha kholo" ---
  m = /^(?:open|show|go to|kholo?)\s+(?:the\s+)?(shelf|khabri|radar|packet|guru|morcha|settings)$/i.exec(t) ?? /^(shelf|khabri|radar|packet|morcha|settings)\s+kholo?$/i.exec(t)
  if (m) return propose({ kind: 'navigate', screen: m[1].toLowerCase() }, '')

  return null
}
