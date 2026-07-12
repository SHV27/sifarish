import { useEffect, useState } from 'react'
import { authenticate, gateMode, hasPasscode, type GateMode } from '../lib/darbaan/lock'

/**
 * THE GATE (D46) — the first thing any browser sees: Owner Mode or Demo. Ownership is
 * verified by the SERVER (/api/darbaan vs SIFARISH_OWNER_PASSCODE); a visitor cannot
 * "set a new lock" because the lock does not live in their browser. Only a self-hosted
 * deployment without the server secret falls back to a local first-run passcode
 * (their deployment, their keys — the README explains).
 */
export default function GateScreen({ onDemo }: { onDemo: () => void }) {
  const [mode, setMode] = useState<GateMode | 'checking'>('checking')
  const [showAuth, setShowAuth] = useState(false)
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    void gateMode().then((m) => {
      if (alive) setMode(m)
    })
    return () => {
      alive = false
    }
  }, [])

  const localFirstRun = mode === 'local' && !hasPasscode()

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      const r = await authenticate(pass, needsConfirm || localFirstRun ? confirm : undefined)
      if (r.ok) return // owner state flips; App unmounts the gate
      if (r.reason === 'local-setup') {
        setNeedsConfirm(true)
        setErr('First run on this deployment — set a passcode (and keep it safe).')
      } else {
        setErr(r.reason ?? 'Could not unlock.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" role="dialog" aria-label="SIFARISH gate">
      <h1 className="font-display font-black text-4xl sm:text-5xl text-ink text-center">
        SIFARISH <span className="font-devanagari text-stamp">· सिफ़ारिश</span>
      </h1>
      <p className="font-mono text-xs text-ink-soft mt-2 text-center">Compile truth. Draft everything. Send nothing.</p>

      <div className="mt-10 grid sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {/* Owner door */}
        <section className="dossier p-6 flex flex-col" aria-label="Owner Mode">
          <h2 className="font-display font-bold text-lg text-ink">🔑 Owner Mode</h2>
          <p className="text-xs text-ink-soft mt-1 leading-relaxed flex-1">
            {mode === 'remote'
              ? 'The owner code is verified by the server — it is not stored in any browser.'
              : mode === 'local'
                ? localFirstRun
                  ? 'Self-hosted deployment: first unlock sets this device’s passcode.'
                  : 'Enter this deployment’s passcode.'
                : 'Checking this deployment…'}
          </p>
          {!showAuth ? (
            <button
              className="mt-4 text-sm font-semibold bg-ink text-paper px-4 py-2.5 rounded disabled:opacity-50"
              disabled={mode === 'checking'}
              onClick={() => setShowAuth(true)}
            >
              I am the owner →
            </button>
          ) : (
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              <input
                type="password"
                autoFocus
                className="w-full text-sm border border-ink-wash rounded px-3 py-2 bg-white text-ink"
                placeholder={mode === 'remote' ? 'owner code' : 'passcode'}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                aria-label="Passcode"
              />
              {(needsConfirm || localFirstRun) && mode === 'local' && (
                <input
                  type="password"
                  className="mt-2 w-full text-sm border border-ink-wash rounded px-3 py-2 bg-white text-ink"
                  placeholder="confirm passcode"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  aria-label="Confirm passcode"
                />
              )}
              {err && (
                <p className="mt-2 text-xs text-stamp font-semibold" role="alert">
                  {err}
                </p>
              )}
              <button type="submit" className="mt-3 w-full text-sm font-semibold bg-ink text-paper px-4 py-2.5 rounded disabled:opacity-50" disabled={busy}>
                {busy ? 'Checking…' : mode === 'local' && (needsConfirm || localFirstRun) ? 'Set & unlock' : 'Unlock'}
              </button>
            </form>
          )}
        </section>

        {/* Demo door */}
        <section className="dossier p-6 flex flex-col" aria-label="Demo mode">
          <h2 className="font-display font-bold text-lg text-ink">🎭 Demo Mode</h2>
          <p className="text-xs text-ink-soft mt-1 leading-relaxed flex-1">
            Watch the whole machine work on a fictional persona — read-only, and it can never spend the
            owner's API budget (locked mode is structurally keyless). Built by Shaurya Verma
            (github.com/SHV27).
          </p>
          <button className="mt-4 text-sm font-semibold border-2 border-ink text-ink px-4 py-2.5 rounded hover:bg-ink hover:text-paper" onClick={onDemo}>
            Show me the demo →
          </button>
        </section>
      </div>

      <p className="mt-8 font-mono text-[10px] text-ink-faint text-center max-w-md leading-relaxed">
        Data is local-first: this browser holds only what it creates. To run SIFARISH as your own,
        deploy your own copy — the README shows how.
      </p>
    </div>
  )
}
