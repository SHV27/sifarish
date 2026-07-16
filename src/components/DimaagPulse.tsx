import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { dimaagHealth, HEALTH_COPY } from '../lib/dimaag/health'
import { useDarbaan } from './DarbaanControl'
import { monthKey } from '../lib/budget'

/**
 * The reasoning tier wears its state in the header (Session 5.8, D74's lesson made structural).
 * A dead LLM tier used to be indistinguishable from a healthy keyless app — the owner diagnosed
 * it from feel ("dimaag hi nahi hai"). Now: live / DEGRADED / keyless, one glance, owner-only.
 */
export default function DimaagPulse() {
  const owner = useDarbaan()
  const rows = useLiveQuery(() => db.dimaagUsage.toArray()) ?? []
  if (!owner) return null
  const health = dimaagHealth(rows, monthKey())
  if (health === 'quiet') return null
  const { label, hint } = HEALTH_COPY[health]
  const cls =
    health === 'live'
      ? 'text-shipped border-shipped/40'
      : health === 'degraded'
        ? 'text-stamp border-stamp animate-nudge'
        : 'text-ink-soft border-paper-edge'
  return (
    <span
      className={`hidden md:inline-block shrink-0 font-mono text-[10px] px-2 py-1 rounded border ${cls}`}
      title={hint}
      aria-label={hint}
    >
      {label}
    </span>
  )
}
