import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  DarbaanLockedError,
  hasPasscode,
  isOwner,
  lock,
  onDarbaanChange,
  setPasscode,
  unlock,
} from '../lib/darbaan/lock'

/** Subscribe React to the Darbaan lock state. */
export function useDarbaan(): boolean {
  return useSyncExternalStore(onDarbaanChange, isOwner, () => false)
}

/**
 * DARBAAN header control (P16, I12) — the lock on the door. Locked = Darshak Mode (read-only
 * showcase on local demo data); unlocked = Owner Mode. First unlock sets the passcode.
 */
export default function DarbaanControl() {
  const owner = useDarbaan()
  const [open, setOpen] = useState(false)
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [toast, setToast] = useState('')
  const firstRun = !hasPasscode()

  // Any blocked mutation anywhere in the app surfaces here as a calm toast, not a console error.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (e.reason instanceof DarbaanLockedError || e.reason?.name === 'DarbaanLockedError') {
        e.preventDefault()
        setToast('Showcase mode is read-only — unlock Owner Mode to make changes.')
        setTimeout(() => setToast(''), 4000)
      }
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [])

  const submit = async () => {
    setErr('')
    if (firstRun) {
      if (pass !== confirm) {
        setErr('Passcodes do not match.')
        return
      }
      const r = await setPasscode(pass)
      if (!r.ok) {
        setErr(r.reason ?? 'Could not set passcode.')
        return
      }
      setOpen(false)
    } else {
      const ok = await unlock(pass)
      if (!ok) {
        setErr('Wrong passcode.')
        return
      }
      setOpen(false)
    }
    setPass('')
    setConfirm('')
  }

  return (
    <>
      {owner ? (
        <button
          className="font-mono text-[11px] text-ink-soft hover:text-ink hover:underline"
          onClick={() => lock()}
          title="Lock the app back into showcase mode"
        >
          🔓 owner · lock
        </button>
      ) : (
        <button
          className="font-mono text-[11px] font-semibold text-ink border border-ink px-2 py-1 rounded hover:bg-ink hover:text-paper"
          onClick={() => {
            setOpen(true)
            setErr('')
          }}
        >
          🔒 Owner Mode
        </button>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-ink text-paper text-xs px-4 py-2 rounded shadow-lg animate-dossier-in" role="status">
          {toast}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Owner Mode">
          <div className="dossier bg-paper p-6 max-w-sm w-full">
            <h2 className="font-display font-bold text-lg text-ink">{firstRun ? 'Set your Owner passcode' : 'Unlock Owner Mode'}</h2>
            <p className="text-xs text-ink-soft mt-1 leading-relaxed">
              {firstRun
                ? 'First run: choose a passcode. It never leaves this device (PBKDF2 hash, stored locally). It also encrypts your backups — do not lose it.'
                : 'Everything that changes your data sits behind this lock (I12).'}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              <input
                type="password"
                autoFocus
                className="mt-3 w-full text-sm border border-ink-wash rounded px-3 py-2 bg-white text-ink"
                placeholder="passcode"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                aria-label="Passcode"
              />
              {firstRun && (
                <input
                  type="password"
                  className="mt-2 w-full text-sm border border-ink-wash rounded px-3 py-2 bg-white text-ink"
                  placeholder="confirm passcode"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  aria-label="Confirm passcode"
                />
              )}
              {err && <p className="mt-2 text-xs text-stamp font-semibold">{err}</p>}
              <div className="mt-4 flex gap-2">
                <button type="submit" className="text-xs font-semibold bg-ink text-paper px-4 py-2 rounded">
                  {firstRun ? 'Set & unlock' : 'Unlock'}
                </button>
                <button type="button" className="text-xs text-ink-soft hover:underline" onClick={() => setOpen(false)}>
                  cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

/** The showcase banner (Darshak Mode) — honest about what a visitor is seeing. */
export function DarshakBanner() {
  const owner = useDarbaan()
  if (owner) return null
  return (
    <div className="bg-ink text-paper text-center text-[11px] px-3 py-1.5" role="note">
      You're watching <strong>SIFARISH</strong> in showcase mode on demo data — built by Shaurya Verma (
      <a className="underline decoration-dotted" href="https://github.com/SHV27" target="_blank" rel="noreferrer">
        github.com/SHV27
      </a>
      ). Data is local-first: this browser holds only the demo seed. 🔒 Owner Mode unlocks editing.
    </div>
  )
}
