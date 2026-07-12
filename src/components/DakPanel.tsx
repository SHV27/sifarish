import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { connectGmail, disconnectGmail, isConnected } from '../lib/dak/gis'
import { sweepMail, confirmStage, dismissCard } from '../lib/dak/watch'

/**
 * DAK KHANA (P15) — the mailbox watchman on the Morcha board. Read-only by construction
 * (gmail.readonly is the only scope in the app — I3): reading and replying happen in Gmail
 * via the deep link. Stage moves are suggestions the owner confirms.
 */
export default function DakPanel() {
  const cards = useLiveQuery(() => db.dak.where('status').equals('pending').toArray()) ?? []
  const [connected, setConnected] = useState(isConnected())
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const connect = async () => {
    setBusy(true)
    setNote(null)
    const r = await connectGmail()
    if (r.ok) {
      setConnected(true)
      const sweep = await sweepMail()
      setNote(sweep.newCards > 0 ? `${sweep.newCards} reply card(s) found.` : 'Connected — no new replies matching your pipeline right now.')
    } else {
      setNote(`Connect failed: ${r.error}. (In Testing mode Google shows an "unverified app" warning — proceed through it.)`)
    }
    setBusy(false)
  }

  const check = async () => {
    setBusy(true)
    const sweep = await sweepMail()
    setNote(sweep.newCards > 0 ? `${sweep.newCards} new reply card(s).` : 'Nothing new — the watchman keeps watching.')
    setBusy(false)
  }

  return (
    <section className="dossier p-4 mb-4" aria-label="Dak Khana — mail vigilance">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display font-semibold text-ink text-sm">
          📬 Dak Khana <span className="font-devanagari text-xs text-ink-soft">डाक-ख़ाना</span>
          <span className="text-ink-soft font-normal"> — never miss a reply</span>
        </h2>
        <div className="flex gap-2">
          {!connected ? (
            <button className="text-[11px] font-semibold bg-ink text-paper px-3 py-1.5 rounded disabled:opacity-50" disabled={busy} onClick={connect}>
              {busy ? 'Connecting…' : 'Connect Gmail (read-only)'}
            </button>
          ) : (
            <>
              <button className="text-[11px] font-semibold border border-ink text-ink px-3 py-1.5 rounded disabled:opacity-50" disabled={busy} onClick={check}>
                {busy ? 'Checking…' : 'Check mail now'}
              </button>
              <button
                className="text-[11px] text-ink-soft hover:underline"
                onClick={() => {
                  disconnectGmail()
                  setConnected(false)
                  setNote('Disconnected — token forgotten (it only ever lived in memory).')
                }}
              >
                disconnect
              </button>
            </>
          )}
        </div>
      </div>
      <p className="mt-1 text-[10px] text-ink-soft leading-relaxed">
        Scope is <code className="font-mono">gmail.readonly</code> — this app structurally cannot send, reply, or
        modify mail (I3). Mail is read in your browser and never sent to any server of ours.
      </p>
      {note && <p className="mt-1.5 text-[11px] font-mono text-ink-soft">{note}</p>}

      {cards.length > 0 && (
        <ul className="mt-3 space-y-2">
          {cards.map((c) => (
            <li key={c.id} className="dossier p-3 border-l-4 border-l-shipped animate-dossier-in">
              <p className="text-xs font-semibold text-ink">📬 {c.company} ne jawab diya</p>
              <p className="text-xs text-ink mt-0.5">{c.subject}</p>
              <p className="text-[11px] text-ink-soft mt-0.5 leading-relaxed">{c.snippet}</p>
              <p className="font-mono text-[10px] text-ink-soft mt-1">
                {c.from} · {c.date}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <a className="text-[11px] font-semibold text-ink underline decoration-dotted" href={c.gmailUrl} target="_blank" rel="noreferrer">
                  open in Gmail ↗
                </a>
                {c.stageSuggestion && (
                  <button
                    className="text-[11px] font-semibold bg-ink text-paper px-2.5 py-1 rounded"
                    onClick={() => void confirmStage(c)}
                    title="Heuristic suggestion — you confirm, it never moves itself"
                  >
                    ✓ move to {c.stageSuggestion}
                  </button>
                )}
                <button className="text-[11px] text-ink-soft hover:underline" onClick={() => void dismissCard(c.id)}>
                  dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
