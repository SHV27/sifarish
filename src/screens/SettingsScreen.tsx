import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { RUBRIC_LABELS } from '../lib/radar/rubric'
import type { RubricWeights, VisionProfile } from '../types'
import { ensureBudgets } from '../lib/budget'

const KEY_INFO = [
  { name: 'GROQ_API_KEY', enables: 'Guru chat + resume polish', without: 'Guru uses its deterministic router; resume stays as compiled' },
  { name: 'TAVILY_API_KEY', enables: 'Hiring signals, company intel, market pulse', without: 'Discovery runs on the free lanes; no signal/intel/pulse' },
  { name: 'JSEARCH_API_KEY', enables: 'LinkedIn/Indeed/Glassdoor job aggregation', without: 'Discovery via Hacker News + Remotive + RemoteOK' },
  { name: 'GITHUB_PAT', enables: 'Nabz at 5,000 req/hr', without: 'Nabz at 60 req/hr (still works)' },
]

export function SettingsScreen() {
  const settings = useLiveQuery(() => db.settings.get('app'))
  const watchlist = useLiveQuery(() => db.watchlist.orderBy('id').toArray()) ?? []
  const budgets = useLiveQuery(async () => {
    await ensureBudgets()
    return db.budgets.toArray()
  }) ?? []
  if (!settings) return null

  return (
    <div className="max-w-3xl">
      <h1 className="font-display font-bold text-3xl text-ink mb-6">Settings</h1>

      {settings.visionProfile && <VisionEditor vision={settings.visionProfile} />}

      <section className="dossier p-4 mb-5" aria-label="Keys status">
        <h2 className="font-display font-semibold text-lg text-ink">Keys</h2>
        <p className="text-sm text-ink mt-2 mb-3">
          <span className="stamp stamp-shipped mr-2">Keyless mode works</span>
          Every pillar runs with zero keys. Keys are amplifiers, set server-side on Vercel (never in the
          browser bundle). This panel shows what each unlocks — it never shows a key value.
        </p>
        <div className="space-y-1.5">
          {KEY_INFO.map((k) => (
            <div key={k.name} className="text-xs grid sm:grid-cols-[160px_1fr] gap-x-3 gap-y-0.5 py-1.5 ledger-rule">
              <code className="font-mono text-ink">{k.name}</code>
              <div>
                <p className="text-ink">
                  <span className="text-shipped font-medium">unlocks:</span> {k.enables}
                </p>
                <p className="text-ink-soft">
                  <span className="font-medium">without:</span> {k.without}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="dossier p-4 mb-5" aria-label="API budgets">
        <h2 className="font-display font-semibold text-lg text-ink">API budgets (I8 — no silent burn)</h2>
        <p className="text-xs text-ink-soft mt-1 mb-3">Metered usage this month. Sweeps refuse to exceed the monthly cap and degrade to keyless lanes.</p>
        <div className="space-y-3">
          {budgets.map((b) => {
            const pct = Math.min(100, Math.round((b.used / b.monthlyCap) * 100))
            return (
              <div key={b.id}>
                <div className="flex justify-between text-xs text-ink mb-1">
                  <span>{b.label}</span>
                  <span className="font-mono text-ink-soft">
                    {b.used}/{b.monthlyCap} {b.unit}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-paper-sunken border border-paper-edge overflow-hidden">
                  <div className={`h-full ${pct > 85 ? 'bg-stamp' : 'bg-shipped'} transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {settings.rubricChangelog && settings.rubricChangelog.length > 0 && (
        <section className="dossier p-4 mb-5" aria-label="Rubric changelog">
          <h2 className="font-display font-semibold text-lg text-ink">Rubric changelog</h2>
          <p className="text-xs text-ink-soft mt-1 mb-2">Append-only. The Pulse Loop proposes changes; you confirm each.</p>
          <ul className="space-y-1">
            {settings.rubricChangelog.slice().reverse().slice(0, 8).map((c, i) => (
              <li key={i} className="text-xs text-ink-soft flex gap-2">
                <span className="font-mono text-[10px] text-ink-faint shrink-0">{c.at.slice(0, 10)}</span>
                <span>{c.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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

function VisionEditor({ vision }: { vision: VisionProfile }) {
  const save = (patch: Partial<VisionProfile>) => db.settings.update('app', { visionProfile: { ...vision, ...patch } })
  return (
    <section className="dossier p-4 mb-5" aria-label="Vision profile">
      <h2 className="font-display font-semibold text-lg text-ink">Vision Profile</h2>
      <p className="text-xs text-ink-soft mt-1 mb-3">
        What you actually want. Guru reads this to guide you — the more honest it is, the sharper the guidance.
      </p>
      <label className="block text-xs font-medium text-ink mb-1">Your dream, in a sentence</label>
      <textarea
        className="w-full bg-paper-sunken px-3 py-2 rounded text-xs mb-3"
        rows={2}
        value={vision.dream}
        onChange={(e) => save({ dream: e.target.value })}
        aria-label="Dream statement"
      />
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-ink">
          Stipend floor (₹/month)
          <input
            type="number"
            className="mt-1 w-full bg-paper-sunken px-2 py-1 rounded font-mono text-xs"
            value={vision.compFloorStipend}
            onChange={(e) => save({ compFloorStipend: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="text-xs text-ink">
          PPO floor (LPA)
          <input
            type="number"
            className="mt-1 w-full bg-paper-sunken px-2 py-1 rounded font-mono text-xs"
            value={vision.ppoFloorLpa}
            onChange={(e) => save({ ppoFloorLpa: Number(e.target.value) || 0 })}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink mt-3">
        <input type="checkbox" checked={vision.remoteInternational} onChange={(e) => save({ remoteInternational: e.target.checked })} />
        Open to remote-international
      </label>
      <label className="flex items-center gap-2 text-xs text-ink mt-1.5">
        <input type="checkbox" checked={vision.openToOctoberStart} onChange={(e) => save({ openToOctoberStart: e.target.checked })} />
        Open to an October start
      </label>
    </section>
  )
}
