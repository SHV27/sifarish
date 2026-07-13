import { useEffect, useState } from 'react'
import { DarbaanLockedError } from '../db/db'
import { usePehchaan, lockToGate } from '../lib/pehchaan'

/** Backward-compatible hook name — the single source is PEHCHAAN. */
export function useDarbaan(): boolean {
  return usePehchaan().mode === 'owner'
}

/**
 * DARBAAN header control (Session 5). Authentication happens ONLY at the Gate (server-verified);
 * this control just locks (→ gate) and surfaces any demo-mode write-block as a calm toast.
 */
export default function DarbaanControl() {
  const owner = useDarbaan()
  const [toast, setToast] = useState('')

  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (e.reason instanceof DarbaanLockedError || e.reason?.name === 'DarbaanLockedError') {
        e.preventDefault()
        setToast('Demo mode is read-only — this is the public showcase store.')
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
          onClick={lockToGate}
          title="Lock and return to the gate"
        >
          🔓 owner · lock
        </button>
      ) : (
        <button className="font-mono text-[11px] font-semibold text-ink border border-ink px-2 py-1 rounded hover:bg-ink hover:text-paper" onClick={lockToGate}>
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

/** The demo banner (only in demo mode) — honest about what a visitor is seeing. */
export function DarshakBanner() {
  const owner = useDarbaan()
  if (owner) return null
  return (
    <div className="bg-ink text-paper text-center text-[11px] px-3 py-1.5" role="note">
      <strong>Demo Mode</strong> — SIFARISH on a fictional persona, read-only, spending nothing. Built by
      Shaurya Verma (
      <a className="underline decoration-dotted" href="https://github.com/SHV27" target="_blank" rel="noreferrer">
        github.com/SHV27
      </a>
      ). Your real data lives in a separate owner vault, never here.
    </div>
  )
}
