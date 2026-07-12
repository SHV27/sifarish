import { useEffect, useState, useSyncExternalStore } from 'react'
import { DarbaanLockedError, isOwner, lock, onDarbaanChange } from '../lib/darbaan/lock'

/** Subscribe React to the Darbaan lock state. */
export function useDarbaan(): boolean {
  return useSyncExternalStore(onDarbaanChange, isOwner, () => false)
}

/**
 * DARBAAN header control (P16, I12/D46). Authentication happens ONLY at the Gate
 * (server-verified owner code) — this control just locks, or routes back to the Gate.
 * A stranger has nothing to "set" here; the lock does not live in their browser.
 */
export default function DarbaanControl({ onGate }: { onGate: () => void }) {
  const owner = useDarbaan()
  const [toast, setToast] = useState('')

  // Any blocked mutation anywhere in the app surfaces here as a calm toast, not a console error.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (e.reason instanceof DarbaanLockedError || e.reason?.name === 'DarbaanLockedError') {
        e.preventDefault()
        setToast('Demo mode is read-only — Owner Mode (verified) unlocks editing.')
        setTimeout(() => setToast(''), 4000)
      }
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [])

  return (
    <>
      {owner ? (
        <button
          className="font-mono text-[11px] text-ink-soft hover:text-ink hover:underline"
          onClick={() => {
            lock()
            onGate()
          }}
          title="Lock the app and return to the gate"
        >
          🔓 owner · lock
        </button>
      ) : (
        <button
          className="font-mono text-[11px] font-semibold text-ink border border-ink px-2 py-1 rounded hover:bg-ink hover:text-paper"
          onClick={onGate}
        >
          🔑 Owner Mode
        </button>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-ink text-paper text-xs px-4 py-2 rounded shadow-lg animate-dossier-in" role="status">
          {toast}
        </div>
      )}
    </>
  )
}

/** The demo banner (Darshak Mode) — honest about what a visitor is seeing. */
export function DarshakBanner() {
  const owner = useDarbaan()
  if (owner) return null
  return (
    <div className="bg-ink text-paper text-center text-[11px] px-3 py-1.5" role="note">
      <strong>Demo Mode</strong> — SIFARISH on fictional data, read-only, spending nothing. Built by
      Shaurya Verma (
      <a className="underline decoration-dotted" href="https://github.com/SHV27" target="_blank" rel="noreferrer">
        github.com/SHV27
      </a>
      ). Data is local-first: this browser holds only the demo seed.
    </div>
  )
}
