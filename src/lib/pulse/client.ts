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
  'AI engineer skills in demand',
  'new AI engineering roles emerging',
  // v4: the Ustaad library stays evergreen — craft trends become proposed library diffs (I13).
  'resume ATS parsing best practices 2026',
]

/**
 * Vision-tracked topics (Session 5.6): the sweep also watches HIS market — the roles he actually
 * wants — so a shift in demand for his target roles surfaces here, not a generic AI feed. Capped so
 * the Tavily spend stays bounded (I8). This is how the pulse tracks his lane, not the whole field.
 */
export function pulseTopicsFor(targetRoles: string[] = []): string[] {
  const visionTopics = [...new Set(targetRoles.map((r) => r.replace(/\bintern\b/gi, '').trim()).filter((r) => r.length > 2))]
    .slice(0, 2)
    .map((r) => `${r} hiring demand 2026`)
  return [...PULSE_TOPICS, ...visionTopics].slice(0, 6)
}

/** Emerging terms worth watching in JDs — the HIGH-CONFIDENCE seed; the dynamic detector adds more. */
const WATCH_TERMS = ['mcp', 'agentic', 'rag', 'evals', 'fine-tuning', 'multi-agent', 'vector', 'guardrails', 'ollama', 'langgraph', 'inference', 'context window', 'computer use', 'reasoning model', 'tool use', 'a2a']

function knownInLexicon(term: string): boolean {
  const t = term.toLowerCase()
  return LEXICON.some((l) => l.canonical.includes(t) || l.patterns.some((p) => p.includes(t)))
}

// Never propose these as "emerging" — common words + noise that would clutter the radar.
const EMERGING_STOP = new Set(['ai', 'ml', 'the', 'and', 'for', 'llm', 'api', 'aws', 'gcp', 'sql', 'ceo', 'cto', 'usa', 'inc', 'ltd', 'new', 'top', 'job', 'jobs', 'now', 'get'])

/**
 * DYNAMIC EMERGING-TERM DETECTION (Session 5.6, "the app must evolve with the market"). A hardcoded
 * WATCH_TERMS list ages the moment the field moves. So ALSO mine the live market brief for terms that
 * look like a new AI role or technology and aren't in the lexicon yet — capitalized acronyms and
 * "<adjective> AI"/"<X> Engineer" role phrases. The owner still confirms every proposal (Nabz pattern),
 * so noise is filtered by a human and never auto-applied. This is what keeps discovery current without
 * a code change: the market names a new thing → the pulse surfaces it → he adds the hunt.
 */
export function emergingFromBrief(text: string): string | undefined {
  const t = text.toLowerCase()
  // New AI-role phrases the market coins ("agentic ai", "generative ai engineer", "physical ai"…).
  const phrase = t.match(/\b(agentic|generative|multimodal|autonomous|reasoning|retrieval|physical|embodied|voice|world[- ]model)[- ]?(ai|ml)\b/g)?.[0]
  if (phrase && !knownInLexicon(phrase.replace(/[- ]/g, ''))) return phrase
  // Capitalized acronyms (MCP, A2A, RLHF…) in an AI-context brief that the lexicon doesn't know yet.
  for (const m of text.match(/\b[A-Z][A-Z0-9]{1,5}\b/g) ?? []) {
    const term = m.toLowerCase()
    if (!EMERGING_STOP.has(term) && !/^\d/.test(term) && !knownInLexicon(term)) return term
  }
  return undefined
}

export async function runPulse(): Promise<{ keyless: boolean; count: number }> {
  // Darshak/demo: a pulse sweep spends Tavily credits and writes briefs — Owner Mode only (D44).
  if (!meteredCallsAllowed()) return { keyless: true, count: 0 }
  let keyless = true
  let count = 0
  const settings = await db.settings.get('app').catch(() => undefined)
  const topics = pulseTopicsFor(settings?.visionProfile?.targetRoles ?? [])
  try {
    const res = await fetch('/api/pulse', {
      method: 'POST',
      headers: meteredHeaders(),
      body: JSON.stringify({ topics }),
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
          const raw = `${b.headline} ${b.insight}`
          const text = raw.toLowerCase()
          // High-confidence seed first, then the dynamic detector for terms the market just coined.
          const emerging = WATCH_TERMS.find((t) => text.includes(t) && !knownInLexicon(t)) ?? emergingFromBrief(raw)
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

  // Session 5.10: accepting a retirement DISABLES the derived hunt (reversible — never deleted;
  // marked ownerSetDate so no future sync/derive path flips it back without him).
  if (brief.proposedHuntRemoval?.huntId) {
    const h = await db.savedHunts.get(brief.proposedHuntRemoval.huntId)
    if (h) await db.savedHunts.update(h.id, { enabled: false, ownerSetDate: true })
  }

  // Session 6: accepting a board proposal adds the company's public ATS feed to the watchlist —
  // the watchlist grows itself from tokens the aggregator sweeps already surfaced (lawful, keyless,
  // human-confirmed). Deduped by source+token; enabled immediately so the next scan covers it.
  if (brief.proposedBoard?.token) {
    const b = brief.proposedBoard
    const watch = await db.watchlist.toArray()
    const exists = watch.some((w) => w.source === b.source && w.token.toLowerCase() === b.token.toLowerCase())
    if (!exists) {
      await db.watchlist.put({
        id: `w-pulse-${b.source}-${b.token.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        company: b.company,
        source: b.source,
        token: b.token,
        enabled: true,
        starred: false,
      })
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
