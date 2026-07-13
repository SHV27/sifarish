import { useState } from 'react'
import { db } from '../db/db'
import type { Packet } from '../types'
import { parseLetterUtterance, type LetterProposal } from '../lib/atelier/baithak'
import { refineLetter } from '../lib/darzi'

/**
 * ATELIER BAITHAK (Session 5) — talk to the cover letter. Same safe pattern as the Darzi Baithak:
 * utterance → proposed refinement op → diff card → ✓ → deterministic recompose + guards re-run.
 * Unevidenced claims are refused with a Gap Note (I11 extended to the letter).
 */
export default function AtelierBaithak({ packet }: { packet: Packet }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [items, setItems] = useState<{ role: 'owner' | 'darzi'; text: string; proposals?: LetterProposal[] }[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Record<string, string>>({})

  const send = async () => {
    const u = input.trim()
    if (!u || busy) return
    setInput('')
    setItems((xs) => [...xs, { role: 'owner', text: u }])
    const ledger = await db.ledger.toArray()
    const parse = parseLetterUtterance(u, packet, ledger)
    setItems((xs) => [...xs, { role: 'darzi', text: parse.reply, proposals: parse.proposals }])
  }

  const approve = async (p: LetterProposal) => {
    setBusy(true)
    try {
      const fresh = (await db.packets.get(packet.id)) ?? packet
      const r = await refineLetter(fresh, p.op)
      setDone((d) => ({ ...d, [p.id]: r.note }))
    } catch (e) {
      setDone((d) => ({ ...d, [p.id]: `Failed: ${e instanceof Error ? e.message : String(e)}` }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="dossier p-4 mt-3" aria-label="Atelier Baithak — talk to the letter">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-ink text-sm">
          Letter Baithak <span className="text-ink-soft font-normal">— talk to the cover letter</span>
        </h2>
        <button className="text-[11px] text-ink-soft hover:underline" onClick={() => setOpen((o) => !o)}>
          {open ? 'close' : 'open'}
        </button>
      </div>
      {!open && (
        <p className="mt-1 text-[11px] text-ink-soft">
          “signature on” · “thoda formal tone” · “letter chhota kar” · “GLOAMING ko proof bana” — refinements as diff
          cards; nothing unevidenced ever enters (I11).
        </p>
      )}
      {open && (
        <>
          <div className="mt-2 max-h-64 overflow-y-auto space-y-2 pr-1">
            {items.length === 0 && (
              <p className="text-[11px] text-ink-soft leading-relaxed">Bolo — Hinglish chalega. Try: “signature on karo” · “tighten this letter”.</p>
            )}
            {items.map((m, i) => (
              <div key={i} className={m.role === 'owner' ? 'text-right' : ''}>
                <div className={`inline-block text-xs leading-relaxed rounded px-2.5 py-1.5 max-w-[95%] text-left ${m.role === 'owner' ? 'bg-ink text-paper' : 'bg-ink-wash text-ink'}`}>{m.text}</div>
                {m.proposals?.map((p) => (
                  <div key={p.id} className="dossier p-3 mt-1.5 border-l-4 border-l-forge text-left">
                    <p className="text-[11px] text-ink-soft"><span className="line-through">{p.before}</span></p>
                    <p className="text-xs text-ink font-medium">→ {p.after}</p>
                    <p className="mt-1 text-[10px] text-ink-soft">touches: {p.invariants.join(' · ')}</p>
                    {done[p.id] ? (
                      <p className="mt-1.5 text-[11px] font-mono text-shipped">{done[p.id]}</p>
                    ) : (
                      <div className="mt-1.5 flex gap-2">
                        <button className="text-[11px] font-semibold bg-ink text-paper px-3 py-1 rounded disabled:opacity-50" disabled={busy} onClick={() => approve(p)}>✓ apply</button>
                        <button className="text-[11px] text-ink-soft hover:underline" onClick={() => setDone((d) => ({ ...d, [p.id]: 'Rejected — nothing changed.' }))}>✗ reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send() }}>
            <input className="flex-1 text-xs border border-ink-wash rounded px-2.5 py-2 bg-paper text-ink placeholder:text-ink-faint" placeholder="Letter ke baare mein bolo…" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Message the letter" />
            <button className="text-xs font-semibold bg-ink text-paper px-3.5 py-2 rounded disabled:opacity-50" disabled={busy || !input.trim()}>bhejo</button>
          </form>
        </>
      )}
    </section>
  )
}
