import type { LedgerEntry } from '../../types'
import { generate } from '../dimaag/core'
import { detectDrift } from './factGuard'

/**
 * THE REFRAMER (Session 5.4, D61) — "GLOAMING ko aise explain kar."
 *
 * Baithak could previously only SELECT and ORDER. So when he said "explain this project this way",
 * the honest answer the app gave was effectively "I can't" — which reads as stupidity, not safety.
 * But re-expressing a true bullet in a stated direction is exactly what a human tailor does, and
 * it mints no claim: the FACTS are the constraint, the WORDING is not.
 *
 * So the reframer rephrases toward his direction and then freezes the facts: every rephrased
 * bullet must survive `detectDrift` against ITS OWN original — a new number, technology, or proper
 * noun and the rephrasing is DISCARDED and the compiled truth stands. He gets the framing he asked
 * for, and a bullet that says something new is structurally impossible (I1/I11).
 *
 * Packet-scoped by design: the ledger (his truth) is never rewritten by conversation.
 */

export interface ReframeResult {
  /** bulletId → rephrased text that passed the guard. */
  overrides: Record<string, string>
  applied: number
  /** Rephrasings the guard threw out, with the fact that killed them (inspectable, never silent). */
  rejected: { original: string; attempt: string; addedFacts: string[] }[]
  keyless: boolean
}

const SYSTEM = `You re-express resume bullets for a specific framing the engineer asked for.

ABSOLUTE RULE: you may change WORDING ONLY. Every fact must already be in the original bullet.
- Do NOT add numbers, metrics, percentages, durations, or scale claims.
- Do NOT add technologies, libraries, companies, or product names not in the original.
- Do NOT add outcomes ("used by X", "improved Y") that the original does not state.
- Do NOT remove a fact that carries the bullet's weight — re-aim it, don't hollow it.
Keep each bullet one sentence, 110-190 characters, strong past-tense verb first.
Banned register: "results-driven", "passionate about leveraging", "proven track record", "spearheaded", "utilized", "synergies".

Return JSON: {"bullets": [{"id": string, "text": string}]} — reuse the EXACT ids given.`

/**
 * Rephrase a project's bullets toward `direction`. Every failure path (keyless, over budget,
 * malformed JSON, guard rejection) yields fewer or zero overrides — never invented text.
 */
export async function reframeProject(entry: LedgerEntry, direction: string): Promise<ReframeResult> {
  const empty: ReframeResult = { overrides: {}, applied: 0, rejected: [], keyless: false }
  if (entry.bullets.length === 0) return empty

  const user = [
    `Project: ${entry.title}`,
    entry.context?.stack?.length ? `Stack (context only — do not add these to bullets unless already present): ${entry.context.stack.join(', ')}` : '',
    '',
    `HOW HE WANTS IT FRAMED: ${direction}`,
    '',
    'Bullets to re-express (keep the ids):',
    ...entry.bullets.map((b) => `- ${b.id}: ${b.text}`),
  ]
    .filter(Boolean)
    .join('\n')

  const out = await generate<{ bullets?: { id?: string; text?: string }[] }>({
    feature: 'baithak.reframe',
    system: SYSTEM,
    user,
    maxTokens: 900,
  })
  if (!out || !Array.isArray(out.bullets)) return { ...empty, keyless: true }

  const byId = new Map(entry.bullets.map((b) => [b.id, b]))
  const overrides: Record<string, string> = {}
  const rejected: ReframeResult['rejected'] = []

  for (const r of out.bullets) {
    const orig = r?.id ? byId.get(r.id) : undefined
    const text = String(r?.text ?? '').trim().replace(/^[-*•]\s*/, '').replace(/\s+/g, ' ')
    if (!orig || !text || text === orig.text) continue

    // THE FREEZE: the rephrasing may only say what the original already said.
    const drift = detectDrift(orig.text, text)
    if (!drift.ok) {
      rejected.push({ original: orig.text, attempt: text, addedFacts: [...drift.addedFacts, ...drift.addedNumbers] })
      continue
    }
    overrides[orig.id] = text
  }

  return { overrides, applied: Object.keys(overrides).length, rejected, keyless: false }
}
