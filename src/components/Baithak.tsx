import { useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import type { Packet, ProposedEdit } from '../types'
import { parseUtterance } from '../lib/baithak/intent'
import { applyEdit } from '../lib/baithak/execute'

/**
 * DARZI BAITHAK (P14) — talk to the tailor. Utterance → proposed EditOps rendered as diff
 * cards → owner taps ✓ → deterministic executor → passes re-run → gates re-check (I11).
 * The refusal path is a feature: unevidenced claims get a Gap Note, never ink.
 */

interface ChatItem {
  role: 'owner' | 'darzi'
  text: string
  proposals?: ProposedEdit[]
  citations?: { title: string; url: string }[]
}

export default function Baithak({ packet }: { packet: Packet }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [items, setItems] = useState<ChatItem[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Record<string, string>>({}) // proposal id → outcome note
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [items, done])

  const send = async () => {
    const utterance = input.trim()
    if (!utterance || busy) return
    setInput('')
    setItems((xs) => [...xs, { role: 'owner', text: utterance }])
    const ledger = await db.ledger.toArray()
    const parse = parseUtterance(utterance, { packet, ledger })
    setItems((xs) => [...xs, { role: 'darzi', text: parse.reply, proposals: parse.proposals, citations: parse.citations }])
    if (parse.refused) {
      // The refusal leaves a paper trail: the gap lands in the packet's Baithak log.
      const entry = { at: new Date().toISOString(), utterance, summary: `REFUSED: ${parse.refused.gapNote}` }
      await db.packets.put({ ...packet, baithakLog: [...(packet.baithakLog ?? []), entry] })
    }
  }

  const approve = async (p: ProposedEdit, utterance: string) => {
    setBusy(true)
    try {
      const fresh = (await db.packets.get(packet.id)) ?? packet
      const r = await applyEdit(fresh, p.op, utterance)
      setDone((d) => ({ ...d, [p.id]: r.note }))
    } catch (e) {
      setDone((d) => ({ ...d, [p.id]: `Failed: ${e instanceof Error ? e.message : String(e)}` }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="dossier p-4 mt-4" aria-label="Darzi Baithak — talk to the tailor">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-ink text-sm">
          Baithak <span className="text-ink-soft font-normal">— talk to the tailor</span>
        </h2>
        <button className="text-[11px] text-ink-soft hover:underline" onClick={() => setOpen((o) => !o)}>
          {open ? 'close' : 'open'}
        </button>
      </div>
      {!open && (
        <p className="mt-1 text-[11px] text-ink-soft">
          “GLOAMING aage kar” · “ye le link https://…” · “thoda technical tone” — instinct in, diff cards out.
          Nothing applies without your ✓, and nothing unevidenced ever applies (I11).
        </p>
      )}
      {open && (
        <>
          <div className="mt-2 max-h-72 overflow-y-auto space-y-2 pr-1">
            {items.length === 0 && (
              <p className="text-[11px] text-ink-soft leading-relaxed">
                Bolo — Hinglish chalega. Try: “SUTRADHAR hata, GLOAMING aage kar” · “skills upar” · “ye kyun chuna?”
              </p>
            )}
            {items.map((m, i) => (
              <div key={i} className={m.role === 'owner' ? 'text-right' : ''}>
                <div
                  className={`inline-block text-xs leading-relaxed rounded px-2.5 py-1.5 max-w-[95%] text-left ${
                    m.role === 'owner' ? 'bg-ink text-paper' : 'bg-ink-wash text-ink'
                  }`}
                >
                  {m.text}
                  {m.citations && m.citations.length > 0 && (
                    <span className="block mt-1 text-[10px] opacity-80">
                      {m.citations.map((c) => (
                        <a key={c.url} className="underline decoration-dotted mr-2" href={c.url} target="_blank" rel="noreferrer">
                          {c.title.split(':')[0]}
                        </a>
                      ))}
                    </span>
                  )}
                </div>
                {m.proposals?.map((p) => {
                  const owner = items[i - 1]?.text ?? ''
                  return (
                    <div key={p.id} className="dossier p-3 mt-1.5 border-l-4 border-l-forge text-left" aria-label="Proposed edit">
                      <p className="text-[11px] text-ink-soft">
                        <span className="line-through">{p.before}</span>
                      </p>
                      <p className="text-xs text-ink font-medium">→ {p.after}</p>
                      <p className="mt-1 text-[10px] text-ink-soft">touches: {p.invariants.join(' · ')}</p>
                      {done[p.id] ? (
                        <p className="mt-1.5 text-[11px] font-mono text-shipped">{done[p.id]}</p>
                      ) : (
                        <div className="mt-1.5 flex gap-2">
                          <button
                            className="text-[11px] font-semibold bg-ink text-paper px-3 py-1 rounded disabled:opacity-50"
                            disabled={busy}
                            onClick={() => approve(p, owner)}
                          >
                            ✓ apply
                          </button>
                          <button
                            className="text-[11px] text-ink-soft hover:underline"
                            onClick={() => setDone((d) => ({ ...d, [p.id]: 'Rejected — nothing changed.' }))}
                          >
                            ✗ reject
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <input
              className="flex-1 text-xs border border-ink-wash rounded px-2.5 py-2 bg-paper text-ink placeholder:text-ink-faint"
              placeholder="Darzi se baat karo…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Message the tailor"
            />
            <button className="text-xs font-semibold bg-ink text-paper px-3.5 py-2 rounded disabled:opacity-50" disabled={busy || !input.trim()}>
              bhejo
            </button>
          </form>
        </>
      )}
    </section>
  )
}
