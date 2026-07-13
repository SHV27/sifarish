import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Packet } from '../types'
import { buildAlignmentMap } from '../lib/alignment'

/**
 * ALIGNMENT MAP (Session 5, WS5) — every JD requirement matched to the specific ledger evidence
 * that meets it, or marked an honest gap. Maximum honest scoring, reasoning visible. Never invents
 * coverage (I1); gaps feed Taleem.
 */
export default function AlignmentMap({ packet }: { packet: Packet }) {
  const ledger = useLiveQuery(() => db.ledger.toArray()) ?? []
  if (ledger.length === 0) return null
  const map = buildAlignmentMap(packet.decode, packet.coverage, ledger, packet.intel)
  if (map.rows.length === 0) return null

  return (
    <section className="dossier p-4" aria-label="Alignment map">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display font-semibold text-ink text-sm">Alignment Map</h2>
        <span className="font-mono text-xs text-ink-soft">
          {map.metCount}/{map.mustTotal} must-haves proven
        </span>
      </div>
      <p className="mt-1 text-[11px] text-ink-soft leading-relaxed">
        Every requirement → the exact evidence that meets it, or an honest gap. No invented coverage.
      </p>
      <ul className="mt-2 space-y-1.5">
        {map.rows.map((r) => (
          <li key={`${r.tier}-${r.requirement}`} className="text-[11px] leading-relaxed">
            <span
              className={`stamp !text-[9px] !rotate-0 mr-1 ${
                r.status === 'met' ? 'stamp-shipped' : r.status === 'building' ? 'stamp-forge' : 'stamp-red'
              }`}
            >
              {r.status === 'met' ? 'proven' : r.status === 'building' ? 'building' : 'gap'}
            </span>
            <span className="font-mono text-ink">{r.requirement}</span>
            {r.tier === 'must' && <span className="text-ink-faint"> ·must</span>}
            {r.metBy.length > 0 && (
              <span className="text-ink-soft"> — {r.metBy.map((m) => m.title).join(', ')}</span>
            )}
            {r.status === 'building' && <span className="text-ink-soft"> — currently building ({r.building.map((m) => m.title).join(', ')})</span>}
            {r.status === 'gap' && <span className="text-ink-soft"> — no evidence yet → Taleem</span>}
          </li>
        ))}
      </ul>
      {map.gaps.length > 0 && (
        <p className="mt-2 text-[10px] text-ink-faint leading-relaxed">
          Honest gaps ({map.gaps.length}) never enter the resume — they become learning targets in the Taleem Radar.
        </p>
      )}
    </section>
  )
}
