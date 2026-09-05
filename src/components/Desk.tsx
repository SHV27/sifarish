import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { buildBriefing } from '../lib/briefing'
import { getMode } from '../lib/pehchaan'
import { SHOWCASE_JOB_ID } from '../lib/showcase/babaclick'
import type { Job } from '../types'

type NavTarget = 'radar' | 'morcha' | 'khabri' | 'guru'

/**
 * v2 THE DESK — the landing screen (VISION-BRIEF v2: "har cheez aankhon ke saamne").
 *
 * One screen, three truths and one door:
 *   1. THE NEXT MOVE — one action (a chief of staff gives one move, not a dashboard).
 *   2. WHERE EACH APPLICATION STANDS — every role he moved, with the last signal Gmail saw
 *      (received / under review / interview / rejected) stamped with its date and a link to read
 *      it in Gmail; a status that lives only inside LinkedIn's inbox is his to mark by hand.
 *   3. FRESH ROLES RANKED FOR HIM — the strongest matches with the one-sentence why.
 *   4. EK BAAT — tell the team anything, from here.
 * In demo mode the worked example (Appendix A) sits on top so a recruiter reads the product cold.
 */
export function Desk({ onNav, onTailor, onAsk }: { onNav: (t: NavTarget) => void; onTailor: (jobId: string) => void; onAsk: (utterance: string) => void }) {
  const jobs = useLiveQuery(() => db.jobs.toArray())
  const ledger = useLiveQuery(() => db.ledger.toArray())
  const settings = useLiveQuery(() => db.settings.get('app'))
  const identity = useLiveQuery(() => db.identity.get('me'))
  const watchlist = useLiveQuery(() => db.watchlist.toArray())
  const dak = useLiveQuery(() => db.dak.toArray())
  const [ask, setAsk] = useState('')
  const demo = getMode() !== 'owner'

  const b = useMemo(() => {
    if (!jobs || !ledger || !settings || !watchlist) return null
    const starred = new Set(watchlist.filter((w) => w.starred).map((w) => w.company))
    return buildBriefing(jobs, ledger, settings, starred)
  }, [jobs, ledger, settings, watchlist])

  const moving = useMemo(() => {
    const order: Record<string, number> = { interview: 0, offer: 1, followup: 2, applied: 3, tailored: 4, rejected: 5, ghosted: 6 }
    return (jobs ?? [])
      .filter((j) => j.status !== 'found' && j.id !== SHOWCASE_JOB_ID)
      .sort((a, c) => (order[a.status] ?? 9) - (order[c.status] ?? 9) || (c.appliedAt ?? c.fetchedAt).localeCompare(a.appliedAt ?? a.fetchedAt))
      .slice(0, 12)
  }, [jobs])
  const signalFor = (j: Job) => {
    if (j.lastSignal) return j.lastSignal
    const card = (dak ?? []).filter((c) => c.jobId === j.id).sort((a, c) => c.fetchedAt.localeCompare(a.fetchedAt))[0]
    return card ? { kind: card.stageSuggestion ?? 'reply', at: card.date || card.fetchedAt, subject: card.subject, gmailUrl: card.gmailUrl } : undefined
  }

  if (!b) return null
  const name = (identity?.name ?? 'there').split(' ')[0]
  const bandCls = (t: number) => (t >= 70 ? 'text-shipped border-shipped' : t >= 45 ? 'text-forge border-forge' : 'text-ink-soft border-paper-edge')
  const goNext = () => (b.next.target === 'packet' && b.next.jobId ? onTailor(b.next.jobId) : onNav(b.next.target as NavTarget))
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '')
  const SIGNAL_LABEL: Record<string, string> = { received: 'application received', 'under-review': 'under review', interview: 'interview', rejected: 'rejected', reply: 'a reply' }

  const submitAsk = () => {
    const t = ask.trim()
    if (!t) return
    setAsk('')
    onAsk(t)
  }

  return (
    <section className="dossier p-4 mb-6 animate-dossier-in" aria-label="The desk — your briefing for today">
      {demo && (
        <div className="mb-4 rounded border border-stamp/40 bg-paper-sunken px-3 py-2.5" aria-label="How this works">
          <p className="text-sm text-ink">
            <strong>What this is.</strong> Paste a whole job posting. Sifarish READS what the company says it cares about — and what it says it
            does not — then writes a game plan: which true facts play, which sit out, and why, in the company's own words. The page is
            executed from that plan; nothing is invented, every line carries its evidence.
          </p>
          <button onClick={() => onTailor(SHOWCASE_JOB_ID)} className="mt-2 text-xs font-semibold bg-stamp text-paper px-3 py-1.5 rounded hover:opacity-90">
            Open the worked example — a posting that says "we do not care about LeetCode or certificates" →
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="font-display font-semibold text-lg text-ink">
          Namaste, {name} <span className="text-ink-soft font-normal text-base">— the desk, today</span>
        </h2>
        {b.newCount > 0 && <span className="stamp stamp-red">{b.newCount} new for you</span>}
      </div>

      {/* 1 · THE NEXT MOVE */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-paper-sunken rounded px-3 py-2 mb-4">
        <p className="text-sm text-ink">
          <span className="font-mono text-[10px] text-ink-soft mr-2">NEXT</span>
          {b.next.text}
        </p>
        <button onClick={goNext} className="shrink-0 bg-stamp text-paper font-semibold text-xs px-3 py-1.5 rounded hover:opacity-90">
          {b.next.cta}
        </button>
      </div>

      {/* 2 · WHERE EACH APPLICATION STANDS */}
      <div className="mb-4">
        <button onClick={() => onNav('morcha')} className="text-xs font-medium text-ink-soft mb-2 hover:text-stamp">
          Where each application stands — every role you moved, with the last signal Gmail saw →
        </button>
        {moving.length === 0 ? (
          <p className="text-[11.5px] text-ink-soft">
            Nothing in motion yet. Tailor a role from the Radar, apply on the official page, then say <em>"mark Acme as applied"</em> here — the desk tracks it from there.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-left text-ink-soft font-mono text-[10px]">
                  <th className="py-1 pr-3 font-normal">role</th>
                  <th className="py-1 pr-3 font-normal">status</th>
                  <th className="py-1 pr-3 font-normal">applied</th>
                  <th className="py-1 pr-3 font-normal">last signal</th>
                </tr>
              </thead>
              <tbody>
                {moving.map((j) => {
                  const sig = signalFor(j)
                  return (
                    <tr key={j.id} className="border-t border-paper-edge/60">
                      <td className="py-1.5 pr-3 max-w-[280px]">
                        <button onClick={() => onTailor(j.id)} className="text-ink hover:text-stamp text-left">
                          <span className="font-medium">{j.company}</span> <span className="text-ink-soft">· {j.title}</span>
                        </button>
                      </td>
                      <td className="py-1.5 pr-3">
                        <span className={`stamp !text-[9px] !rotate-0 ${j.status === 'interview' || j.status === 'offer' ? 'stamp-shipped' : j.status === 'rejected' ? 'stamp-red' : 'stamp-forge'}`}>{j.status}</span>
                      </td>
                      <td className="py-1.5 pr-3 font-mono text-[10px] text-ink-soft">{fmt(j.appliedAt) || '—'}</td>
                      <td className="py-1.5 pr-3 text-ink-soft">
                        {sig ? (
                          <>
                            {SIGNAL_LABEL[sig.kind] ?? sig.kind} · {fmt(sig.at)}{' '}
                            <a href={sig.gmailUrl} target="_blank" rel="noreferrer" className="font-mono text-[10px] underline decoration-dotted" title={sig.subject}>
                              read in Gmail ↗
                            </a>
                          </>
                        ) : (
                          <span className="text-ink-faint">no mail seen — a LinkedIn-inbox reply is yours to mark</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3 · FRESH ROLES RANKED FOR HIM */}
      {b.topMatches.length > 0 && (
        <div className="mb-4">
          <button onClick={() => onNav('radar')} className="text-xs font-medium text-ink-soft mb-2 hover:text-stamp">
            Ranked for you — the strongest fresh matches, each with its reason →
          </button>
          <div className="space-y-2">
            {b.topMatches.map(({ job, score, freshForVision }) => (
              <div key={job.id} className="flex items-center gap-3">
                <div className={`shrink-0 w-9 h-9 rounded-full border-2 grid place-items-center font-mono text-xs font-bold ${bandCls(score.total)}`}>{score.total}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate">
                    {freshForVision ? (
                      <span className="stamp stamp-shipped !text-[9px] mr-1 align-middle">naya · tumhare vision ka</span>
                    ) : (
                      job.isNew && <span className="stamp stamp-red !text-[9px] mr-1 align-middle">NEW</span>
                    )}
                    <span className="font-medium">{job.title}</span> <span className="text-ink-soft">· {job.company}</span>
                  </p>
                  {score.why && <p className="text-[11px] text-ink-faint truncate">{score.why}</p>}
                </div>
                <button onClick={() => onTailor(job.id)} className="shrink-0 text-xs text-stamp font-semibold hover:underline">
                  Tailor →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 · EK BAAT — tell the team, from here */}
      <form
        className="flex gap-2 items-center border-t border-paper-edge pt-3"
        onSubmit={(e) => {
          e.preventDefault()
          submitAsk()
        }}
        aria-label="Tell the team"
      >
        <input
          className="flex-1 bg-paper-sunken px-3 py-2 rounded text-sm"
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          placeholder={demo ? 'Tell the team (demo: proposals only) — "add fact: district-level badminton player, 2019"' : 'Tell the team — "add fact: …", "I know LoRA now", "mark Acme as applied", "hunt for RAG intern"'}
          aria-label="Tell the team"
        />
        <button type="submit" className="text-xs font-semibold bg-ink text-paper px-3 py-2 rounded">
          Say it →
        </button>
      </form>
    </section>
  )
}
