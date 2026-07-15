import { db } from '../../db/db'
import type { GuruMessage } from '../../types'
import { buildSystemPrompt } from './context'
import { route, honestyGate, visionAlignmentScan, type RoutedReply } from './router'
import { runSweep } from '../khabri/client'
import { meteredCallsAllowed, meteredHeaders } from '../apiGuard'

/**
 * Guru orchestration. The deterministic router runs FIRST on every turn and owns the
 * honesty-critical intents (refusals, actions). For freeform conversation, if a Groq key is
 * present we stream an LLM reply grounded in the compiled system prompt; otherwise the
 * router's own text is the answer (keyless mode, fully functional).
 *
 * Every streamed token is checked against the I9 guarantee scan; a violation aborts the
 * stream and falls back to the router's safe reply.
 */

export interface GuruTurn {
  routed: RoutedReply
  /** Whether to stream an LLM enrichment after the routed text. */
  useLLM: boolean
}

export async function planTurn(userText: string): Promise<GuruTurn> {
  const ledger = await db.ledger.toArray()
  const jobs = await db.jobs.toArray()
  const settings = await db.settings.get('app')
  const routed = route(userText, ledger, jobs, settings?.visionProfile)
  // Honesty-critical + citation-carrying intents are answered by the router verbatim — never
  // handed to the LLM (refusals, the vision guardrail, and the cited path briefs stay exact).
  const deterministicIntents = new Set(['refuse_guarantee', 'refuse_fabrication', 'vision_check', 'path_brief', 'sharpen_vision'])
  return { routed, useLLM: !deterministicIntents.has(routed.intent) }
}

/** Execute a routed action (client-side only — no external form is ever touched; I3). */
export async function runAction(action: RoutedReply['action']): Promise<string | null> {
  if (action === 'sweep') {
    const y = await runSweep()
    return `Sweep done: ${y.found} found, ${y.new} new, ${y.duplicate} deduped${y.creditsSpent ? `, ${y.creditsSpent} credits` : ' (keyless lanes)'}. Check the Radar.`
  }
  return null
}

/**
 * Stream an LLM reply. onToken fires per chunk. Returns the full text (post-honesty-gate).
 * On any failure or keyless response, returns null so the caller uses the router text.
 */
export async function streamGuru(history: GuruMessage[], onToken: (t: string) => void): Promise<string | null> {
  // Darshak/demo browsers get the deterministic router only — zero token spend (D44).
  if (!meteredCallsAllowed()) return null
  const ledger = await db.ledger.toArray()
  const jobs = await db.jobs.toArray()
  const settings = await db.settings.get('app')
  if (!settings) return null
  // Guru v3: the compiled dossier on EVERY turn — vision + avoids + guardrail + path briefs +
  // pipeline + recent pulse + ledger. Retrieved, not hoped for.
  const pulse = await db.pulse.orderBy('at').reverse().limit(5).toArray().catch(() => [])
  const system = buildSystemPrompt(ledger, settings, jobs, pulse)
  const messages = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  let res: Response
  try {
    res = await fetch('/api/guru', {
      method: 'POST',
      headers: meteredHeaders(),
      body: JSON.stringify({ system, messages }),
    })
  } catch {
    return null
  }
  if (!res.ok) return null
  const ctype = res.headers.get('Content-Type') ?? ''
  if (!ctype.includes('text/event-stream')) {
    // keyless or error JSON
    return null
  }
  if (!res.body) return null

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta) {
            full += delta
            // Mid-stream tripwires (Session 5.5): abort + discard the moment the reply breaks I9
            // (guarantee language) OR pitches an avoided lane without a flag — was only checked at
            // [DONE], so a misaligned big-tech pitch streamed in full before being swapped out (bug
            // #5). The guardrail flags the lane FIRST, so a properly-flagged aside never trips.
            if (!honestyGate(full).ok || !visionAlignmentScan(full, settings.visionProfile).aligned) {
              await reader.cancel()
              return null
            }
            onToken(delta)
          }
        } catch {
          /* ignore partial json */
        }
      }
    }
  } catch {
    return full.length > 0 && replyClean(full, settings.visionProfile) ? full : null
  }
  return replyClean(full, settings.visionProfile) ? full : null
}

/** Final output gate: I9 guarantee scan + the vision-alignment scan (unflagged avoided-path
 *  suggestions are discarded — the router's grounded text stands instead). */
function replyClean(text: string, vision?: import('../../types').VisionProfile): boolean {
  return honestyGate(text).ok && visionAlignmentScan(text, vision).aligned
}
