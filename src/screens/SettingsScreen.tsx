import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { RUBRIC_LABELS } from '../lib/radar/rubric'
import type { RubricWeights } from '../types'

export function SettingsScreen() {
  const settings = useLiveQuery(() => db.settings.get('app'))
  const watchlist = useLiveQuery(() => db.watchlist.orderBy('id').toArray()) ?? []
  if (!settings) return null

  return (
    <div className="max-w-3xl">
      <h1 className="font-display font-bold text-3xl text-ink mb-6">Settings</h1>

      <section className="dossier p-4 mb-5" aria-label="Keys status">
        <h2 className="font-display font-semibold text-lg text-ink">Keys</h2>
        <p className="text-sm text-ink mt-2">
          <span className="stamp stamp-shipped mr-2">Keyless mode</span>
          Fully functional. Every pillar works with zero API keys. A server-side <code className="font-mono text-xs">GROQ_API_KEY</code>{' '}
          (Vercel env) unlocks optional phrasing polish; it is an amplifier, never a dependency.
        </p>
      </section>

      <section className="dossier p-4 mb-5" aria-label="Scoring rubric">
        <h2 className="font-display font-semibold text-lg text-ink">Scoring rubric</h2>
        <p className="text-xs text-ink-soft mt-1">Weights are points out of 100. Every score in the Radar expands to show its arithmetic.</p>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          {(Object.keys(RUBRIC_LABELS) as (keyof RubricWeights)[]).map((k) => (
            <label key={k} className="flex items-center justify-between gap-3 text-sm text-ink">
              {RUBRIC_LABELS[k]}
              <input
                type="number"
                min={0}
                max={50}
                className="w-16 bg-paper-sunken px-2 py-1 rounded font-mono text-xs text-right"
                value={settings.rubric[k]}
                onChange={(e) =>
                  db.settings.update('app', { rubric: { ...settings.rubric, [k]: Number(e.target.value) || 0 } })
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="dossier p-4 mb-5" aria-label="Weekly quota">
        <h2 className="font-display font-semibold text-lg text-ink">Sniper quota</h2>
        <label className="flex items-center justify-between gap-3 text-sm text-ink mt-2 max-w-xs">
          Applications per week
          <input
            type="number"
            min={1}
            max={30}
            className="w-16 bg-paper-sunken px-2 py-1 rounded font-mono text-xs text-right"
            value={settings.weeklyQuota}
            onChange={(e) => db.settings.update('app', { weeklyQuota: Number(e.target.value) || 10 })}
          />
        </label>
        <p className="text-xs text-ink-soft mt-2">The cap is a feature: few, deep, truthful applications beat spray.</p>
      </section>

      <section className="dossier p-4" aria-label="Watchlist">
        <h2 className="font-display font-semibold text-lg text-ink">Watchlist</h2>
        <p className="text-xs text-ink-soft mt-1">Every token probed live at build; ★ = conviction (worth +{settings.rubric.conviction} points).</p>
        <div className="mt-3 grid sm:grid-cols-2 gap-1.5">
          {watchlist.map((w) => (
            <div key={w.id} className="flex items-center gap-2 text-sm text-ink bg-paper-sunken/60 rounded px-3 py-1.5">
              <input
                type="checkbox"
                checked={w.enabled}
                onChange={(e) => db.watchlist.update(w.id, { enabled: e.target.checked })}
                aria-label={`Enable ${w.company}`}
              />
              <span className="truncate">{w.company}</span>
              <span className="font-mono text-[10px] text-ink-soft">{w.source}</span>
              <button
                className={`ml-auto ${w.starred ? 'text-forge' : 'text-ink-faint'}`}
                onClick={() => db.watchlist.update(w.id, { starred: !w.starred })}
                aria-label={`${w.starred ? 'Unstar' : 'Star'} ${w.company}`}
              >
                ★
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
