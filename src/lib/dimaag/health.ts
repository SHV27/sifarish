import type { DimaagUsageRow } from '../../types'

/**
 * REASONING-TIER HEALTH (Session 5.8) — closes D74's blind spot for good.
 *
 * D74's lesson: a dead LLM tier is indistinguishable from a healthy keyless app, because every
 * caller silently degrades to the deterministic heuristic (I4's virtue is also its blindness).
 * The usage ledger already distinguishes call / hit / fallback per feature per month — but it was
 * only visible if the owner opened Settings and read the numbers. This derives ONE word from those
 * rows so the app can wear its state on its sleeve:
 *
 *   'live'     — real LLM calls are landing (any successful call this month, and fallbacks are
 *                not drowning them out)
 *   'degraded' — the tier is being ATTEMPTED but mostly failing (fallbacks outnumber calls 3:1
 *                with real volume) → the exact D73/D74 silent-death signature
 *   'keyless'  — no LLM call has succeeded at all this month; only heuristics ran
 *   'quiet'    — nothing recorded yet (fresh month / fresh vault) — no verdict either way
 *
 * Pure over rows → unit-tested without a browser or a key.
 */
export type DimaagHealth = 'live' | 'degraded' | 'keyless' | 'quiet'

export function dimaagHealth(rows: DimaagUsageRow[], monthKey?: string): DimaagHealth {
  const scoped = monthKey ? rows.filter((r) => r.monthKey === monthKey) : rows
  const calls = scoped.reduce((n, r) => n + r.calls, 0)
  const fallbacks = scoped.reduce((n, r) => n + r.fallbacks, 0)
  const hits = scoped.reduce((n, r) => n + r.cacheHits, 0)
  if (calls === 0 && fallbacks === 0 && hits === 0) return 'quiet'
  if (calls === 0 && fallbacks > 0) return 'keyless'
  if (fallbacks >= 4 && fallbacks >= calls * 3) return 'degraded'
  return 'live'
}

export const HEALTH_COPY: Record<DimaagHealth, { label: string; hint: string }> = {
  live: { label: '🧠 reasoning: live', hint: 'The LLM tier is answering — decisions carry real reasoning.' },
  degraded: {
    label: '🧠 reasoning: DEGRADED',
    hint: 'LLM calls are mostly failing and falling back to heuristics — check the Groq key, budgets, or rate limits (Settings → Dimaag Ledger).',
  },
  keyless: {
    label: '⚙ reasoning: keyless',
    hint: 'No LLM call has succeeded this month — every decision used the deterministic heuristic. Fine by design; add a key for real reasoning.',
  },
  quiet: { label: '', hint: '' },
}
