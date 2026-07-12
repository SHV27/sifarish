import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { rankGaps, draftForgeEntry, type TaleemGap } from '../lib/taleem'
import { useDarbaan } from './DarbaanControl'

/**
 * TALEEM RADAR (U5) — the "never let a gap open between my skills and the market" panel.
 * Demand comes from real JDs (cited); suggestions only — one tap tracks a gap as an honest
 * in-forge entry with an ETA (I2). Owner decides everything.
 */
export default function TaleemPanel() {
  const jobs = useLiveQuery(() => db.jobs.toArray()) ?? []
  const ledger = useLiveQuery(() => db.ledger.toArray()) ?? []
  const settings = useLiveQuery(() => db.settings.get('app'))
  const owner = useDarbaan()
  const [note, setNote] = useState('')
  const [expanded, setExpanded] = useState(false)

  const gaps = rankGaps(jobs, ledger, settings?.visionProfile)
  const shown = expanded ? gaps.slice(0, 12) : gaps.slice(0, 5)

  const track = async (gap: TaleemGap) => {
    const eta = new Date(Date.now() + 45 * 86400000).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    try {
      await db.ledger.put(draftForgeEntry(gap, eta))
      setNote(`"${gap.keyword}" is now in your forge (ETA ${eta}) — it renders only in the dated Currently Building line until it ships (I2).`)
    } catch {
      setNote('Owner Mode required to edit the ledger.')
    }
  }

  return (
    <section className="dossier p-4 mb-4" aria-label="Taleem — skill-gap radar">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display font-semibold text-ink text-sm">
          Taleem Radar <span className="font-devanagari text-xs text-ink-soft">तालीम</span>
          <span className="text-ink-soft font-normal"> — what the market wants that your ledger can't prove yet</span>
        </h2>
        {gaps.length > 5 && (
          <button className="text-[11px] text-ink-soft hover:underline" onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'top 5' : `all ${Math.min(12, gaps.length)}`}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-2 text-xs text-ink-soft leading-relaxed">
          No gaps detected yet — sweep some roles first. Every JD the Radar sees feeds this panel: demand ×
          vision-fit, each with the jobs that asked for it.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {shown.map((g) => (
            <li key={g.keyword} className="border-l-2 border-l-forge pl-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-semibold text-ink font-mono">{g.keyword}</span>
                <span className="font-mono text-[10px] text-ink-soft">
                  demand {g.demand} · fit {(g.visionFit * 10).toFixed(0)}/10
                </span>
                {g.inForge ? (
                  <span className="stamp stamp-forge !text-[9px] !rotate-0">already in forge</span>
                ) : (
                  owner && (
                    <button className="text-[10px] font-semibold text-ink underline decoration-dotted" onClick={() => void track(g)}>
                      + track in forge
                    </button>
                  )
                )}
              </div>
              <p className="text-[11px] text-ink-soft leading-relaxed mt-0.5">{g.rationale}</p>
              <p className="font-mono text-[10px] text-ink-soft mt-0.5">
                asked by:{' '}
                {g.citations.map((c, i) => (
                  <a key={i} className="underline decoration-dotted mr-2" href={c.url} target="_blank" rel="noreferrer">
                    {c.title}
                  </a>
                ))}
                {g.firstResource && (
                  <>
                    · start:{' '}
                    <a className="underline decoration-dotted" href={g.firstResource.url} target="_blank" rel="noreferrer">
                      {g.firstResource.title}
                    </a>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="mt-2 text-[11px] font-mono text-shipped">{note}</p>}
    </section>
  )
}
