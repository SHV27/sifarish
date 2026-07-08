import { db } from '../../db/db'
import type { GuruMessage } from '../../types'
import { buildSystemPrompt } from './context'
import { route, honestyGate, type RoutedReply } from './router'
import { runSweep } from '../khabri/client'

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
  const routed = route(userText, ledger, jobs)
  // Honesty-critical intents are answered by the router verbatim — never handed to the LLM.
  const deterministicIntents = new Set(['refuse_guarantee', 'refuse_fabrication'])
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
  const ledger = await db.ledger.toArray()
  const jobs = await db.jobs.toArray()
  const settings = await db.settings.get('app')
  if (!settings) return null
  const system = buildSystemPrompt(ledger, settings, jobs)
  const messages = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  let res: Response
  try {
    res = await fetch('/api/guru', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
            // I9 tripwire: if guarantee language appears mid-stream, abort and discard.
            if (!honestyGate(full).ok) {
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
    return full.length > 0 && honestyGate(full).ok ? full : null
  }
  return honestyGate(full).ok ? full : null
}
