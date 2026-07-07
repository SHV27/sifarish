import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { resumeStrength } from '../lib/strength'

/**
 * The 60-second promise (L7): confirm the seeded ledger → pick the hunt → the app is armed.
 * The first packet flows from Radar's top card immediately after.
 */
export function Onboarding({ onDone }: { onDone: (jobId: string) => void }) {
  void onDone
  const [step, setStep] = useState<0 | 1>(0)
  const entries = useLiveQuery(() => db.ledger.toArray()) ?? []
  const watchlist = useLiveQuery(() => db.watchlist.toArray()) ?? []
  const identity = useLiveQuery(() => db.identity.get('me'))
  const strength = resumeStrength(entries)

  const finish = async () => {
    await db.settings.update('app', { onboarded: true })
  }

  if (!identity) return null

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="dossier max-w-2xl w-full p-6 sm:p-10 animate-dossier-in">
        {step === 0 ? (
          <>
            <p className="font-devanagari text-stamp text-sm">सिफ़ारिश</p>
            <h1 className="font-display font-black text-3xl sm:text-4xl text-ink mt-1">
              Namaste, {identity.name.split(' ')[0]}.
            </h1>
            <p className="text-ink-soft mt-2 text-sm leading-relaxed">
              Your ledger is ready — {strength.shipped} provable entries on the shelf,{' '}
              {strength.total - strength.shipped} honestly in the forge. Every resume this app ever produces
              is compiled from these entries and nothing else. <strong className="text-ink">Compile truth.
              Draft everything. Send nothing.</strong>
            </p>
            <div className="mt-5 max-h-64 overflow-y-auto ledger-rule pt-3 space-y-1.5">
              {entries
                .filter((e) => e.kind === 'project')
                .map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink truncate">{e.title.split('—')[0].trim()}</span>
                    {e.tier === 'shipped' ? (
                      <span className="stamp stamp-shipped">Shipped</span>
                    ) : (
                      <span className="stamp stamp-forge">In forge · {e.forgeEta}</span>
                    )}
                  </div>
                ))}
            </div>
            <button
              className="mt-6 w-full sm:w-auto bg-ink text-paper font-semibold px-6 py-3 rounded hover:opacity-90"
              onClick={() => setStep(1)}
            >
              That's my truth — continue →
            </button>
          </>
        ) : (
          <>
            <h1 className="font-display font-bold text-2xl text-ink">Pick your hunt</h1>
            <p className="text-ink-soft mt-1 text-sm">
              {watchlist.length} AI-first boards, every one probed live and returning real jobs today.
              ★ marks conviction picks. Edit anytime in Settings.
            </p>
            <div className="mt-4 max-h-72 overflow-y-auto grid sm:grid-cols-2 gap-1.5">
              {watchlist.map((w) => (
                <label key={w.id} className="flex items-center gap-2 text-sm text-ink bg-paper-sunken/60 rounded px-3 py-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={w.enabled}
                    onChange={(e) => db.watchlist.update(w.id, { enabled: e.target.checked })}
                  />
                  <span className="truncate">{w.company}</span>
                  {w.starred && <span className="text-forge ml-auto">★</span>}
                </label>
              ))}
            </div>
            <button
              className="mt-6 w-full sm:w-auto bg-stamp text-paper font-semibold px-6 py-3 rounded hover:opacity-90"
              onClick={finish}
            >
              Arm the Radar →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
