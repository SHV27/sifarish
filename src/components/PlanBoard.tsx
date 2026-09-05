import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { GamePlan, Packet, Reading } from '../types'
import { sectionLabel } from '../lib/strategist/plan'
import { overrulePlan } from '../lib/darzi'

/**
 * v2 — THE PLAYED / BENCHED BOARD: the game plan is the interface. Every fact in the dossier is
 * ON PAGE or BENCHED with the reason in the company's words; the reading that caused it sits on
 * top with its receipts; the mode that wrote it is printed (gemini / groq / heuristic — I4);
 * the critic's verdict is shown, skipped included. Click a fact to read the evidence text
 * behind it (checkable citations, RESEARCH v2 verdict 8 — never a badge alone).
 */
export default function PlanBoard({ packet }: { packet: Packet }) {
  const plan = packet.plan as GamePlan
  const reading = packet.reading as Reading
  const ledger = useLiveQuery(() => db.ledger.toArray(), []) ?? []
  const [busy, setBusy] = useState(false)
  const [wall, setWall] = useState<string | null>(null)
  const [open, setOpen] = useState<'reading' | 'board' | 'skills' | null>('board')
  const title = (id: string) => ledger.find((e) => e.id === id)?.title.split('—')[0].trim() ?? id
  const evidence = (id: string) => {
    const e = ledger.find((x) => x.id === id)
    if (!e) return 'not in the dossier any more'
    return `${e.title}${e.summary ? ` — ${e.summary}` : ''}${e.evidence?.url ? ` · ${e.evidence.url}` : ''}`
  }
  const mode = packet.strategistMode ?? plan.by
  const modeLabel = mode === 'heuristic' ? 'template strategist (keyless floor)' : `${mode} deep pass`
  const pages = packet.resume.pages ?? 1

  const overrule = async (opts: { playId?: string; benchId?: string }) => {
    setBusy(true)
    setWall(null)
    try {
      await overrulePlan(packet, opts)
    } catch (e) {
      // Hunter (05-Sep-2026): in demo mode the vault is read-only at the database — say so (I4/I12).
      const msg = e instanceof Error ? e.message : String(e)
      setWall(/darbaan|locked|read-only/i.test(msg) ? 'Demo mode is read-only — this board is yours to edit in Owner Mode.' : `Could not apply: ${msg.slice(0, 140)}`)
    } finally {
      setBusy(false)
    }
  }

  const bySection = new Map<string, GamePlan['played']>()
  for (const p of plan.played) bySection.set(p.section, [...(bySection.get(p.section) ?? []), p])
  const sectionsInOrder = [...plan.sectionOrder.filter((k) => bySection.has(k)), ...[...bySection.keys()].filter((k) => !plan.sectionOrder.includes(k))]

  return (
    <section className="dossier p-4 mb-3" aria-label="The game plan">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-display font-semibold text-ink text-sm">The team's notes — why this page looks like this</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`stamp !text-[9px] !rotate-0 ${mode === 'heuristic' ? 'stamp-forge' : 'stamp-shipped'}`} title="which brain wrote the reading + plan">
            {modeLabel}
          </span>
          <span className="stamp !text-[9px] !rotate-0 stamp-forge" title="pages the page-solver settled on (spacing tightened first)">
            {pages === 1 ? 'one page' : `${pages} pages`}
            {packet.resume.tighten ? ` · tightened ${packet.resume.tighten}` : ''}
          </span>
          {packet.critic && (
            <span
              className={`stamp !text-[9px] !rotate-0 ${packet.critic.verdict === 'PASS' ? 'stamp-shipped' : packet.critic.verdict === 'REVISE' ? 'stamp-red' : 'stamp-forge'}`}
              title={packet.critic.issues.join('\n') || 'no issues'}
            >
              critic: {packet.critic.verdict}
              {packet.critic.revised ? ' · revised once' : ''}
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-ink mt-2 leading-relaxed">{plan.rationale}</p>

      {/* The reading — what the company said, with receipts */}
      <div className="mt-3 ledger-rule pt-2">
        <button className="text-xs font-semibold text-ink hover:underline" onClick={() => setOpen(open === 'reading' ? null : 'reading')}>
          {open === 'reading' ? '▾' : '▸'} THE READER — what {reading.company || 'they'} said
          <span className="ml-2 font-mono text-[10px] text-ink-soft">
            {reading.roleWindow} · reader: {reading.readerPersona} · {reading.archetype}
          </span>
        </button>
        {open === 'reading' && (
          <div className="mt-2 space-y-2">
            <p className="text-[11px] text-ink-soft">{reading.summary}</p>
            {reading.cares.length > 0 && (
              <div>
                <p className="font-mono text-[10px] text-shipped">THEY CARE ABOUT</p>
                <ul className="flex flex-wrap gap-1 mt-1">
                  {reading.cares.map((q, i) => (
                    <li key={i} className="text-[11px] bg-ink-wash rounded px-2 py-0.5" title={`“${q.quote}”`}>
                      {q.phrase}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {reading.doesNotCare.length > 0 && (
              <div>
                <p className="font-mono text-[10px] text-stamp">THEY SAY THEY DO NOT CARE ABOUT</p>
                <ul className="flex flex-wrap gap-1 mt-1">
                  {reading.doesNotCare.map((q, i) => (
                    <li key={i} className="text-[11px] bg-ink-wash rounded px-2 py-0.5 line-through decoration-stamp/60" title={`“${q.quote}”`}>
                      {q.phrase}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[11px] text-ink-soft">
              Skills asked for: {reading.skills.must.join(', ') || '—'}
              {reading.skills.nice.length ? ` · nice: ${reading.skills.nice.join(', ')}` : ''}
            </p>
            <div>
              <p className="font-mono text-[10px] text-ink-soft">THE RESEARCHER — beyond the posting</p>
              {reading.research && reading.research.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                  {reading.research.slice(0, 6).map((r, i) => (
                    <li key={i} className="text-[11px] text-ink">
                      {r.text}{' '}
                      <a href={r.url} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-ink-soft underline decoration-dotted">
                        source ↗
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-ink-faint">no cited research this time — keyless, or nothing found for this company; the reading stands on the posting alone.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* The board */}
      <div className="mt-2 ledger-rule pt-2">
        <button className="text-xs font-semibold text-ink hover:underline" onClick={() => setOpen(open === 'board' ? null : 'board')}>
          {open === 'board' ? '▾' : '▸'} THE STRATEGIST — played {plan.played.length} · benched {plan.benched.length}
          {packet.bulletOverrides && Object.keys(packet.bulletOverrides).length > 0 && (
            <span className="ml-2 stamp stamp-shipped !text-[9px] !rotate-0" title="bullets re-aimed for this reader; facts frozen by the drift guard">
              THE TAILOR re-aimed {Object.keys(packet.bulletOverrides).length}
            </span>
          )}
          <span className="ml-2 font-mono text-[10px] text-ink-soft">order: {plan.sectionOrder.map((k) => sectionLabel(k).toLowerCase()).join(' → ')}</span>
        </button>
        {open === 'board' && (
          <div className="mt-2 space-y-2">
            <p className="text-[11px] text-ink">
              <span className="font-mono text-[10px] text-ink-soft mr-1">THREE LINES</span>
              <strong>{plan.threeLines.headline}</strong> — {plan.threeLines.summary}
              <span className="font-mono text-[10px] text-shipped ml-1" title={plan.threeLines.factIds.map(evidence).join('\n')}>
                ⛁{plan.threeLines.factIds.length}
              </span>
            </p>
            {sectionsInOrder.map((key) => (
              <div key={key}>
                <p className="font-mono text-[10px] text-ink-soft">{sectionLabel(key)}</p>
                <ul className="mt-0.5 space-y-0.5">
                  {(bySection.get(key) ?? []).map((p) => (
                    <li key={p.factId} className="text-[11px] text-ink flex items-start gap-2">
                      <details className="flex-1">
                        <summary className="cursor-pointer">
                          <strong>{title(p.factId)}</strong> <span className="text-ink-soft">— {p.reason}</span>
                          {p.framing && <span className="text-forge"> · angle: {p.framing}</span>}
                        </summary>
                        <p className="text-[10px] text-ink-soft mt-0.5 pl-3">{evidence(p.factId)}</p>
                      </details>
                      {key !== 'education' && (
                        <button className="text-[10px] text-ink-soft hover:text-stamp shrink-0" disabled={busy} onClick={() => overrule({ benchId: p.factId })} title="bench this fact for THIS company (your call, recorded)">
                          bench
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {plan.benched.length > 0 && (
              <div>
                <p className="font-mono text-[10px] text-stamp">BENCHED (each with its reason)</p>
                <ul className="mt-0.5 space-y-0.5">
                  {plan.benched.map((b) => (
                    <li key={b.factId} className="text-[11px] text-ink-soft flex items-start gap-2">
                      <details className="flex-1">
                        <summary className="cursor-pointer">
                          <span className="line-through">{title(b.factId)}</span> — {b.reason}
                        </summary>
                        <p className="text-[10px] mt-0.5 pl-3">{evidence(b.factId)}</p>
                      </details>
                      <button className="text-[10px] text-shipped hover:underline shrink-0" disabled={busy} onClick={() => overrule({ playId: b.factId })} title="put this fact on the page for THIS company (your call, recorded)">
                        play
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[11px] text-ink-soft">
              <span className="font-mono text-[10px] mr-1">REVEAL</span>
              {plan.reveal.on ? 'on' : 'off'} — {plan.reveal.reason}
            </p>
          </div>
        )}
      </div>

      {/* Skills rows */}
      <div className="mt-2 ledger-rule pt-2">
        <button className="text-xs font-semibold text-ink hover:underline" onClick={() => setOpen(open === 'skills' ? null : 'skills')}>
          {open === 'skills' ? '▾' : '▸'} THE TAILOR — skills assembled for this posting ({plan.skills.reduce((n, r) => n + r.items.length, 0)}, every one proven)
        </button>
        {open === 'skills' && (
          <ul className="mt-1 space-y-0.5">
            {plan.skills.map((r) => (
              <li key={r.label} className="text-[11px] text-ink">
                <strong>{r.label}:</strong>{' '}
                {r.items.map((i, k) => (
                  <span key={i.text} title={i.factIds.map(evidence).join('\n')}>
                    {i.text}
                    <span className="font-mono text-[9px] text-shipped">⛁{i.factIds.length}</span>
                    {k < r.items.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>

      {plan.lens && (
        <div className="mt-2 ledger-rule pt-2" aria-label="The lens — the angle chosen for this company">
          <p className="font-mono text-[10px] text-ink-soft">THE LENS — the angle the team chose</p>
          <p className="text-[11px] text-ink mt-0.5">
            <span className="font-semibold">{plan.lens.label}</span>
            <span className="text-ink-soft"> — the posting says "{plan.lens.because}". {plan.lens.why}.</span>
          </p>
        </div>
      )}

      {plan.memory && plan.memory.length > 0 && (
        <div className="mt-2 ledger-rule pt-2" aria-label="The memory — recorded outcomes this plan read">
          <p className="font-mono text-[10px] text-ink-soft">THE MEMORY — what past applications taught this plan</p>
          <ul className="mt-0.5 space-y-0.5">
            {plan.memory.map((n, i) => (
              <li key={`m${i}`} className="text-[11px] text-ink-soft">
                · {n}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(plan.notes.length > 0 || (packet.critic && packet.critic.issues.length > 0)) && (
        <div className="mt-2 ledger-rule pt-2">
          <p className="font-mono text-[10px] text-ink-soft">THE CRITIC and the validator</p>
          <ul className="mt-0.5 space-y-0.5">
            {plan.notes.map((n, i) => (
              <li key={`n${i}`} className="text-[11px] text-ink-soft">
                · {n}
              </li>
            ))}
            {packet.critic?.issues.map((n, i) => (
              <li key={`c${i}`} className="text-[11px] text-ink-soft">
                · critic: {n}
              </li>
            ))}
          </ul>
        </div>
      )}
      {busy && <p className="mt-2 text-[11px] text-ink-soft font-mono">Re-executing the plan…</p>}
      {wall && (
        <p className="mt-2 text-[11px] text-stamp" role="status">
          {wall}
        </p>
      )}
    </section>
  )
}
