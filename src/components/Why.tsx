import { useState } from 'react'
import type { Rationale } from '../types'

/**
 * The "Why?" expander — the visible face of I10. Every consequential decision renders one.
 * The app never says "trust me"; it shows the options it weighed, the criteria, its choice,
 * its confidence, and whether a reasoning model or the deterministic heuristic decided it.
 */
export function Why({ rationale, label = 'Why?' }: { rationale: Rationale; label?: string }) {
  const [open, setOpen] = useState(false)
  const pct = Math.round(rationale.confidence * 100)
  return (
    <div className="mt-1.5">
      <button
        className="text-[11px] font-mono text-ink-soft hover:text-ink inline-flex items-center gap-1"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{open ? '▾' : '▸'}</span>
        {label}
        <span className={`ml-1 ${rationale.by === 'dimaag' ? 'text-shipped' : 'text-forge'}`}>
          {rationale.by === 'dimaag' ? '🧠 reasoned' : '⚙ heuristic'}
        </span>
        <span className="text-ink-faint">· {pct}% conf</span>
      </button>
      {open && (
        <div className="mt-1.5 ledger-rule pt-2 text-xs text-ink-soft space-y-1.5">
          <p className="text-ink leading-relaxed">{rationale.why}</p>
          {rationale.ranking && rationale.ranking.length > 1 && (
            <p>
              <span className="font-medium text-ink">Weighed:</span>{' '}
              {rationale.ranking.map((r, i) => (
                <span key={i}>
                  {i > 0 && ' › '}
                  <span className={i === 0 ? 'text-shipped font-medium' : ''}>{r}</span>
                </span>
              ))}
            </p>
          )}
          {rationale.criteria.length > 0 && (
            <p>
              <span className="font-medium text-ink">Criteria:</span> {rationale.criteria.join(' · ')}
            </p>
          )}
          {rationale.citations && rationale.citations.length > 0 && (
            <div className="flex flex-wrap gap-x-3">
              {rationale.citations.map((c, i) => (
                <a key={i} href={c.url} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-ink underline decoration-dotted">
                  {c.title} ↗
                </a>
              ))}
            </div>
          )}
          <p className="text-[10px] text-ink-faint">
            {rationale.by === 'dimaag'
              ? 'Reasoned by the Dimaag core (gpt-oss-120b), stored and inspectable.'
              : 'Deterministic heuristic (keyless or budget-capped) — honest, just less eloquent.'}
          </p>
        </div>
      )}
    </div>
  )
}
