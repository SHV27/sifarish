import type { Packet } from '../../types'
import { db } from '../../db/db'
import { safePolish } from './factGuard'
import { scanSlop } from '../slop/scan'

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines, voiceSamples: voice }),
    })
    const data = await res.json()
    polished = data.polished
    keyless = data.reason === 'keyless' || polished === null
  } catch {
    keyless = true
  }

  if (!polished) return { packet, applied: 0, rejected: 0, keyless: true }

  let applied = 0
  let rejected = 0
  const newLines = packet.resume.lines.slice()
  eligibleIdx.forEach(({ i }, k) => {
    const candidate = polished![k]
    if (!candidate) return
    const guard = safePolish(newLines[i].text, candidate)
    const slop = scanSlop(candidate)
    if (guard.accepted && slop.length === 0) {
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
