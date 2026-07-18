import type { CompiledDoc, Packet } from '../../types'
import { db } from '../../db/db'
import { safePolish } from './factGuard'
import { scanSlop } from '../slop/scan'
import { scanGuarantee } from '../slop/scan'
import { meteredCallsAllowed, meteredHeaders } from '../apiGuard'
import { allowedThisRun, recordSpend } from '../budget'
import { stripMarkdownResidue } from '../compile/typeset'
import { bulletOverlap, HARD_DUPLICATE } from '../compile/overlap'

/**
 * Client-side polish orchestration. Sends compiled bullet lines to /api/polish, then
 * enforces the fact-drift guard AND slop scan on every returned line before accepting it.
 * The compiled truth is always the fallback — polish is a pure amplifier (I4).
 */
export interface PolishOutcome {
  packet: Packet
  applied: number
  rejected: number
  keyless: boolean
}

export async function polishPacket(packet: Packet): Promise<PolishOutcome> {
  // Darshak/demo mode: compiled text stands, zero spend (D44).
  if (!meteredCallsAllowed()) return { packet, applied: 0, rejected: 0, keyless: true }
  // Session 7.2 (C1): polish spends the 'groq' budget it always claimed to (I8).
  if ((await allowedThisRun('groq')) <= 0) return { packet, applied: 0, rejected: 0, keyless: true }
  const voice = (await db.voicebank.get('voice'))?.samples ?? []

  // Only bullet/forge lines are eligible; headings/contact/skills stay verbatim.
  const eligibleIdx = packet.resume.lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.kind === 'bullet' || l.kind === 'forge')
  const lines = eligibleIdx.map(({ l }) => l.text)

  let polished: string[] | null = null
  let keyless = false
  try {
    const res = await fetch('/api/polish', {
      method: 'POST',
      headers: meteredHeaders(),
      body: JSON.stringify({ lines, voiceSamples: voice }),
    })
    const data = await res.json()
    polished = data.polished
    keyless = data.reason === 'keyless' || polished === null
  } catch {
    keyless = true
  }

  if (!polished) return { packet, applied: 0, rejected: 0, keyless: true }
  await recordSpend('groq', 1) // C1: a real polish call moves the meter

  let applied = 0
  let rejected = 0
  const newLines = packet.resume.lines.slice()
  eligibleIdx.forEach(({ i }, k) => {
    const candidate = polished![k]
    if (!candidate) return
    // Session 7.2 (A3): polish mutates lines AFTER the compiler's push() gate, so it must
    // re-enter the same gates itself — markdown residue dies here, and a rewording that
    // collapses two distinct bullets into twins is rejected (the page-wide MMR already ran;
    // nothing may undo it post-hoc).
    const cleaned = stripMarkdownResidue(candidate)
    const guard = safePolish(newLines[i].text, cleaned)
    const slop = scanSlop(cleaned)
    const makesTwin =
      guard.accepted &&
      newLines.some((other, j) => j !== i && (other.kind === 'bullet' || other.kind === 'forge') && bulletOverlap(guard.text, other.text) >= HARD_DUPLICATE)
    if (guard.accepted && slop.length === 0 && !makesTwin) {
      newLines[i] = { ...newLines[i], text: guard.text }
      applied += 1
    } else {
      rejected += 1
    }
  })

  const updated: Packet = {
    ...packet,
    resume: { ...packet.resume, lines: newLines },
    polished: applied > 0,
  }
  await db.packets.put(updated)
  return { packet: updated, applied, rejected, keyless }
}

/**
 * Guarded phrasing pass for a CompiledDoc (the cover letter) — Atelier Baithak "tone" op. Same
 * fact-drift guard + slop + I9 guarantee scan; the greeting and P.S. stay verbatim. Keyless-safe.
 */
export async function polishDoc(doc: CompiledDoc): Promise<{ doc: CompiledDoc; applied: number; rejected: number; keyless: boolean }> {
  if (!meteredCallsAllowed()) return { doc, applied: 0, rejected: 0, keyless: true }
  if ((await allowedThisRun('groq')) <= 0) return { doc, applied: 0, rejected: 0, keyless: true } // C1
  const voice = (await db.voicebank.get('voice'))?.samples ?? []
  // Only substantive body paragraphs are eligible; greeting and the P.S. signature stay exact.
  const eligible = doc.paragraphs
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.text.startsWith('P.S.') && !/^dear /i.test(p.text))
  const lines = eligible.map(({ p }) => p.text)
  if (lines.length === 0) return { doc, applied: 0, rejected: 0, keyless: false }

  let polished: string[] | null = null
  let keyless = false
  try {
    const res = await fetch('/api/polish', { method: 'POST', headers: meteredHeaders(), body: JSON.stringify({ lines, voiceSamples: voice }) })
    const data = await res.json()
    polished = data.polished
    keyless = data.reason === 'keyless' || polished === null
  } catch {
    keyless = true
  }
  if (!polished) return { doc, applied: 0, rejected: 0, keyless: true }
  await recordSpend('groq', 1) // C1

  let applied = 0
  let rejected = 0
  const paragraphs = doc.paragraphs.slice()
  eligible.forEach(({ i }, k) => {
    const raw = polished![k]
    if (!raw) return
    const candidate = stripMarkdownResidue(raw) // A3: the letter re-enters the hygiene gate too
    const guard = safePolish(paragraphs[i].text, candidate)
    if (guard.accepted && scanSlop(candidate).length === 0 && scanGuarantee(candidate).length === 0) {
      paragraphs[i] = { ...paragraphs[i], text: guard.text }
      applied += 1
    } else {
      rejected += 1
    }
  })
  return { doc: { ...doc, paragraphs }, applied, rejected, keyless }
}
