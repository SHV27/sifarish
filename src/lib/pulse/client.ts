import { db } from '../../db/db'
import type { PulseBrief } from '../../types'
import { recordSpend } from '../budget'
import { LEXICON } from '../jd/lexicon'
import { getLibrary, libraryRefreshDue, staleSources } from '../ustaad/library'
import { meteredCallsAllowed, meteredHeaders } from '../apiGuard'

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
  // v4: the Ustaad library stays evergreen — craft trends become proposed library diffs (I13).
  'resume ATS parsing best practices 2026',
]

/** Emerging terms worth watching in JDs — if a brief mentions one absent from the lexicon, suggest it. */
const WATCH_TERMS = ['mcp', 'agentic', 'rag', 'evals', 'fine-tuning', 'multi-agent', 'vector', 'guardrails', 'ollama', 'langgraph', 'inference', 'context window']

function knownInLexicon(term: string): boolean {
  const t = term.toLowerCase()
  return LEXICON.some((l) => l.canonical.includes(t) || l.patterns.some((p) => p.includes(t)))
}

export async function runPulse(): Promise<{ keyless: boolean; count: number }> {
  // Darshak/demo: a pulse sweep spends Tavily credits and writes briefs — Owner Mode only (D44).
  if (!meteredCallsAllowed()) return { keyless: true, count: 0 }
  let keyless = true
  let count = 0
  try {
    const res = await fetch('/api/pulse', {
      method: 'POST',
      headers: meteredHeaders(),
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
            // D89: an emerging skill/role becomes a proposed radar hunt — accept it and the Radar
            // starts finding those roles. The self-evolving loop (Khabri trend → Radar hunt).
            proposedHunt: emerging ? { query: `${emerging} engineer`, why: `"${emerging}" is trending in the market (${b.topic}) — hunt roles for it before the crowd does.` } : undefined,
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

  // Ustaad staleness watch (keyless-safe, I13): when the craft library is due a review,
  // Pulse PROPOSES it — the owner confirms; entries are never silently trusted past their date.
  if (libraryRefreshDue()) {
    const lib = getLibrary()
    const stale = staleSources()
    const id = `pulse-ustaad-${lib.version}`
    const prior = await db.pulse.get(id)
    if (!prior) {
      await db.pulse.put({
        id,
        at: new Date().toISOString(),
        topic: 'Ustaad library freshness',
        headline: `Craft library v${lib.version} is due a review (last updated ${lib.updatedAt})`,
        url: 'https://www.theladders.com/static/images/basicSite/pdfs/TheLadders-EyeTracking-StudyC2.pdf',
        insight:
          stale.length > 0
            ? `${stale.length} cited source(s) are >12 months old. Stale craft guidance is flagged, never silently trusted — re-verify and bump the library version.`
            : 'Monthly review window reached. Re-verify the cited sources and bump the library version if anything moved.',
        suggestion: 'Review data/ustaad/library.json sources and accept an updated library in Settings (owner confirms — Nabz pattern).',
        status: 'pending',
      })
      count += 1
    }
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

  // D89: accepting a brief that carries a proposed hunt adds it to the live radar hunts — the
  // Pulse now evolves discovery, not just the changelog. Human-confirmed (this accept IS the
  // confirmation), deduped by query, marked ownerSetDate so the freshness migration leaves it be.
  if (brief.proposedHunt?.query) {
    const q = brief.proposedHunt.query.trim()
    const existing = await db.savedHunts.toArray()
    if (q && !existing.some((h) => h.query.toLowerCase() === q.toLowerCase())) {
      await db.savedHunts.put({ id: `h-pulse-${q.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, query: q, remoteOnly: false, datePosted: 'week', ownerSetDate: true, enabled: true })
    }
  }
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
