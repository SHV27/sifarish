import { db } from '../../db/db'
import type { PulseBrief } from '../../types'
import { recordSpend } from '../budget'
import { LEXICON } from '../jd/lexicon'

/**
 * Pulse Loop — keeps the rubric present-tense. A weekly news sweep produces cited briefs;
 * each brief that mentions a keyword NOT yet in the lexicon becomes a human-confirmed
 * suggestion ("'MCP' is trending — add to AI-relevance keywords?"). The user confirms every
 * change (Nabz pattern); the rubric config keeps an append-only changelog.
 */

export const PULSE_TOPICS = [
  'agentic AI hiring trends 2026',
  'AI intern skills in demand',
  'Claude Code adoption enterprises',
]

/** Emerging terms worth watching in JDs — if a brief mentions one absent from the lexicon, suggest it. */
const WATCH_TERMS = ['mcp', 'agentic', 'rag', 'evals', 'fine-tuning', 'multi-agent', 'vector', 'guardrails', 'ollama', 'langgraph', 'inference', 'context window']

function knownInLexicon(term: string): boolean {
  const t = term.toLowerCase()
  return LEXICON.some((l) => l.canonical.includes(t) || l.patterns.some((p) => p.includes(t)))
}

export async function runPulse(): Promise<{ keyless: boolean; count: number }> {
  let keyless = true
  let count = 0
  try {
    const res = await fetch('/api/pulse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topics: PULSE_TOPICS }),
    })
    if (res.ok) {
      const data = (await res.json()) as {
        keyless: boolean
        briefs: { topic: string; headline: string; url: string; insight: string; publishedAt?: string }[]
        creditsSpent?: number
      }
      keyless = data.keyless
      if (!data.keyless) {
        if (data.creditsSpent) await recordSpend('tavily', data.creditsSpent)
        for (const b of data.briefs) {
          const text = `${b.headline} ${b.insight}`.toLowerCase()
          const emerging = WATCH_TERMS.find((t) => text.includes(t) && !knownInLexicon(t))
          const brief: PulseBrief = {
            id: `pulse-${b.url.slice(-24)}`,
            at: new Date().toISOString(),
            topic: b.topic,
            headline: b.headline,
            url: b.url,
            insight: b.insight,
            suggestion: emerging
              ? `"${emerging.toUpperCase()}" is showing up in the market and isn't in your keyword lexicon yet — worth tracking in AI-relevance scoring?`
              : undefined,
            status: 'pending',
          }
          const prior = await db.pulse.get(brief.id)
          if (!prior) {
            await db.pulse.put(brief)
            count += 1
          }
        }
      }
    }
  } catch {
    keyless = true
  }
  await db.settings.update('app', { lastPulseAt: new Date().toISOString() })
  return { keyless, count }
}

export async function acceptPulse(brief: PulseBrief): Promise<void> {
  const s = await db.settings.get('app')
  const changelog = s?.rubricChangelog ?? []
  changelog.push({
    at: new Date().toISOString(),
    summary: brief.suggestion ? `Noted from pulse: ${brief.suggestion}` : `Reviewed: ${brief.headline}`,
    source: brief.url,
  })
  await db.settings.update('app', { rubricChangelog: changelog })
  await db.pulse.update(brief.id, { status: 'accepted' })
}

export async function dismissPulse(id: string): Promise<void> {
  await db.pulse.update(id, { status: 'dismissed' })
}

/** Due when never run, or >7 days since the last pulse. */
export function pulseDue(lastPulseAt?: string): boolean {
  if (!lastPulseAt) return true
  return Date.now() - new Date(lastPulseAt).getTime() > 7 * 86400000
}
