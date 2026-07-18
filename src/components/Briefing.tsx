import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { buildBriefing } from '../lib/briefing'

type NavTarget = 'radar' | 'morcha' | 'khabri'

/**
 * The Chief-of-Staff briefing on the landing screen (Session 5.6). Read-only: it aggregates what
 * already exists (buildBriefing) and renders "what matters today" + one next action. It never
 * sweeps or mutates — autopilot owns discovery. Renders nothing until the vault warms up.
 */
export function Briefing({ onNav, onTailor }: { onNav: (t: NavTarget) => void; onTailor: (jobId: string) => void }) {
  const jobs = useLiveQuery(() => db.jobs.toArray())
  const ledger = useLiveQuery(() => db.ledger.toArray())
  const settings = useLiveQuery(() => db.settings.get('app'))
  const identity = useLiveQuery(() => db.identity.get('me'))
  const watchlist = useLiveQuery(() => db.watchlist.toArray())

  // Session 7.2 (C12): buildBriefing scores every found role — on a 1,000-role radar that is an
  // O(n) sweep, and it used to run on EVERY render tick of the LANDING screen. Memoized off the
  // live-query identities: it now recomputes only when the underlying data actually changed.
  const b = useMemo(() => {
    if (!jobs || !ledger || !settings || !watchlist) return null
    const starred = new Set(watchlist.filter((w) => w.starred).map((w) => w.company))
    return buildBriefing(jobs, ledger, settings, starred)
  }, [jobs, ledger, settings, watchlist])

  if (!b) return null
  const name = (identity?.name ?? 'Shaurya').split(' ')[0]
  const bandCls = (t: number) => (t >= 70 ? 'text-shipped border-shipped' : t >= 45 ? 'text-forge border-forge' : 'text-ink-soft border-paper-edge')
  const goNext = () => (b.next.target === 'packet' && b.next.jobId ? onTailor(b.next.jobId) : onNav(b.next.target as NavTarget))
  const quiet = b.topMatches.length === 0 && b.dueFollowups.length === 0 && b.interviews.length === 0 && b.tailoredCount === 0

  return (
    <section className="dossier p-4 mb-6 animate-dossier-in" aria-label="Your briefing for today">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="font-display font-semibold text-lg text-ink">
          Namaste, {name} <span className="text-ink-soft font-normal text-base">— here's what matters today</span>
        </h2>
        {b.newCount > 0 && <span className="stamp stamp-red">{b.newCount} new for you</span>}
      </div>

      {/* THE ONE next action — an assistant gives one move, not a dashboard */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-paper-sunken rounded px-3 py-2 mb-3">
        <p className="text-sm text-ink">
          <span className="font-semibold text-stamp">Next:</span> {b.next.text}
        </p>
        <button onClick={goNext} className="shrink-0 bg-stamp text-paper font-semibold text-xs px-3 py-1.5 rounded hover:opacity-90">
          {b.next.cta}
        </button>
      </div>

      {/* Top matches — ranked by HIS vision, each with the reason (L4) */}
      {b.topMatches.length > 0 && (
        <div>
          <button onClick={() => onNav('radar')} className="text-xs font-medium text-ink-soft mb-2 hover:text-stamp">
            Ranked for you — your strongest matches waiting in the Radar →
          </button>
          <div className="space-y-2">
            {b.topMatches.map(({ job, score, visionWhy, freshForVision }) => (
              <div key={job.id} className="flex items-center gap-3">
                <div className={`shrink-0 w-9 h-9 rounded-full border-2 grid place-items-center font-mono text-xs font-bold ${bandCls(score.total)}`}>
                  {score.total}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate">
                    {/* Session 6 — "Khabri tells me FIRST": a fresh on-vision role wears its flag. */}
                    {freshForVision ? (
                      <span className="stamp stamp-shipped !text-[9px] mr-1 align-middle" title="Freshly found, matched to your vision">naya · tumhare vision ka</span>
                    ) : (
                      job.isNew && <span className="stamp stamp-red !text-[9px] mr-1 align-middle">NEW</span>
                    )}
                    <span className="font-medium">{job.title}</span> <span className="text-ink-soft">· {job.company}</span>
                  </p>
                  {visionWhy && <p className="text-[11px] text-ink-faint truncate">{visionWhy}</p>}
                </div>
                <button onClick={() => onTailor(job.id)} className="shrink-0 text-xs text-stamp font-semibold hover:underline">
                  Tailor →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(b.dueFollowups.length > 0 || b.interviews.length > 0 || b.week.applied > 0 || b.week.replies > 0) && <div className="ledger-rule my-3" />}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {/* Session 6 (P1): the week's state of the hunt — an agent's check-in line, from real data. */}
        {(b.week.applied > 0 || b.week.replies > 0 || b.week.interviews > 0) && (
          <span className="text-ink-soft font-mono text-[11px]">
            this week: {b.week.applied} applied · {b.week.replies} repl{b.week.replies === 1 ? 'y' : 'ies'} · {b.week.interviews} interview{b.week.interviews === 1 ? '' : 's'}
          </span>
        )}
        {b.dueFollowups.length > 0 && (
          <button onClick={() => onNav('morcha')} className="text-ink hover:text-stamp">
            <span className="inline-block w-2 h-2 rounded-full bg-stamp-red mr-1 align-middle" />
            {b.dueFollowups.length} follow-up{b.dueFollowups.length > 1 ? 's' : ''} due — {b.dueFollowups[0].company}
            {b.dueFollowups.length > 1 ? ' +more' : ''} →
          </button>
        )}
        {b.interviews.length > 0 && (
          <button onClick={() => onNav('morcha')} className="text-ink hover:text-stamp">
            🗓 {b.interviews.length} interview{b.interviews.length > 1 ? 's' : ''} to prep →
          </button>
        )}
      </div>

      {quiet && (
        <p className="text-xs text-ink-soft">
          Your board is clear. Your assistant sweeps job boards worldwide for the roles YOU want — {b.next.text.toLowerCase()}.
        </p>
      )}
    </section>
  )
}
