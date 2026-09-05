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

  // --- v2 THE DOSSIER: a fact of ANY kind, said out loud ---
  // "add fact: district-level badminton player, 2019" · "note: …" · "remember: …" · "mere paas X hai"
  // · "I am a district-level badminton player" · "add experience: AI intern at Jio, Jun–Jul 2026"
  m =
    /^(?:add|new|nayi|naya|note|remember|yaad rakh(?:o|na)?)\s*(?:fact|baat|cheez|info)?\s*[:\-–—]\s*(.{6,})$/i.exec(t) ??
    /^(?:add|new|nayi|naya)\s+(experience|position|publication|sports?|language|award|volunteering|responsibility|internship|paper)\s*[:\-–—]?\s+(.{4,})$/i.exec(t) ??
    /^(?:mere paas|maine|i have|i am|i'm|i was|main)\s+(.{8,})$/i.exec(t)
  if (m && !/\b(why|how|what|kya|kaise|kaun|resume|résumé|cv)\b/i.test(lower)) {
    const named = m.length > 2 ? m[1].toLowerCase().replace(/s$/, '').replace('internship', 'experience').replace('paper', 'publication').replace('responsibility', 'position').replace('award', 'achievement') : undefined
    const text = clean(m.length > 2 ? m[2] : m[1])
    const r = propose({ kind: 'add-fact', factKind: named, text }, 'Confirm and it joins your dossier — the strategist decides per posting whether it plays, and says why.')
    if (r) return r
  }
  // "create section Volunteering" · "naya section banao: Sports"
  m = /^(?:create|make|add|naya|nayi)\s+(?:a\s+)?section\s*(?:banao|bana do|for)?\s*[:\-–—]?\s*(.{3,40})$/i.exec(t) ?? /^section\s+(.{3,40})\s+(?:banao|bana do|add karo)$/i.exec(t)
  if (m) {
    const label = clean(m[1])
    const r = propose({ kind: 'create-section', sectionKind: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label }, 'Confirm and the section exists — add facts to it any time.')
    if (r) return r
  }
  // "promote LoRA" · "I know LangGraph now" · "lora shipped hai ab" · "mark lora as shipped"
  m = /^(?:promote|ship)\s+(.{2,60})$/i.exec(t) ?? /^(?:i know|i've learned|i have learned|maine seekh liya|ab aata hai)\s+(.{2,60}?)\s*(?:now|ab)?$/i.exec(t) ?? /^(.{2,60}?)\s+(?:shipped|ho gaya|aa gaya|seekh liya)\s*(?:hai|ab|now)?(?:\s+ab)?$/i.exec(t) ?? /^mark\s+(.{2,60}?)\s+(?:as\s+)?shipped$/i.exec(t)
  if (m) {
    const r = propose({ kind: 'promote-entry', entryId: clean(m[1]) }, 'Confirm and it leaves the Currently Building line — only if you can defend it in an interview.')
    if (r) return r
  }
  // "allow React on my résumé" · "react ko resume pe aane do" · "keep firebase off the page"
  m = /^(?:allow|enable|show)\s+(.{2,40}?)\s+(?:on|in)\s+(?:my\s+)?(?:resume|résumé|cv|page)$/i.exec(t) ?? /^(.{2,40}?)\s+ko\s+(?:resume|résumé|cv|page)\s+(?:pe|par)\s+(?:aane do|dikhao|rehne do)$/i.exec(t)
  if (m) {
    const r = propose({ kind: 'set-skill-eligible', entryId: clean(m[1]), eligible: true }, 'Confirm and the skill may render again — it was marked not-interview-safe by you earlier.')
    if (r) return r
  }
  m = /^(?:keep|hide|remove)\s+(.{2,40}?)\s+(?:off|from)\s+(?:my\s+)?(?:resume|résumé|cv|page)$/i.exec(t)
  if (m) {
    const r = propose({ kind: 'set-skill-eligible', entryId: clean(m[1]), eligible: false }, 'Confirm and it stays evidence only — never rendered.')
    if (r) return r
  }
  // "re-read my readmes" · "readme refresh karo" · "absorb my github"
  if (/^(?:re-?read|refresh|absorb|update)\s+(?:my\s+)?(?:github\s+)?readmes?(?:\s+(?:karo|again))?$/i.test(t) || /^readmes?\s+(?:refresh|re-?read)\s*(?:karo)?$/i.test(t)) {
    const r = propose({ kind: 'refresh-readmes' }, 'Confirm and every repo-linked project gets its README context refreshed (bullets untouched).')
    if (r) return r
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
