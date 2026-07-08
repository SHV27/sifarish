import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Job, ScoreBreakdown } from '../types'
import { syncRadar, ensureJd, type SyncResult } from '../lib/radar/feeds'
import { scoreJob } from '../lib/radar/score'
import { buildPacket, savePacket } from '../lib/darzi'

const VISIBLE_CAP = 15 // sniper, not spray — the cap is a feature (vision §P3)

export function Radar({ onTailor }: { onTailor: (jobId: string) => void }) {
  const jobs = useLiveQuery(() => db.jobs.toArray()) ?? []
  const ledger = useLiveQuery(() => db.ledger.toArray()) ?? []
  const settings = useLiveQuery(() => db.settings.get('app'))
  const watchlist = useLiveQuery(() => db.watchlist.toArray()) ?? []
  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<SyncResult | null>(null)

  const starred = useMemo(() => new Set(watchlist.filter((w) => w.starred).map((w) => w.company)), [watchlist])

  const ranked = useMemo(() => {
    if (!settings) return []
    return jobs
      .filter((j) => j.status === 'found')
      .map((j) => ({ job: j, score: scoreJob(j, ledger, settings.rubric, starred.has(j.company)) }))
      .sort((a, b) => b.score.total - a.score.total)
  }, [jobs, ledger, settings, starred])

  const runSync = async () => {
    setSyncing(true)
    setResult(null)
    setProgress({ done: 0, total: watchlist.filter((w) => w.enabled).length })
    try {
      const r = await syncRadar((done, total) => setProgress({ done, total }))
      setResult(r)
    } finally {
      setSyncing(false)
      setProgress(null)
    }
  }

  const tailor = async (job: Job) => {
    const withJd = await ensureJd(job)
    if (job.isNew) await db.jobs.update(job.id, { isNew: false })
    const packet = await buildPacket(withJd)
    await savePacket(packet)
    onTailor(withJd.id)
  }

  const enabledCount = watchlist.filter((w) => w.enabled).length

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-ink">Shikaar Radar</h1>
          <p className="text-sm text-ink-soft mt-1">
            {enabledCount} keyless boards · ranked, capped at {VISIBLE_CAP}. Few, deep, truthful — a sniper's queue.
          </p>
        </div>
        <button
          className="bg-ink text-paper font-semibold text-sm px-4 py-2.5 rounded hover:opacity-90 disabled:opacity-50"
          onClick={runSync}
          disabled={syncing}
        >
          {syncing ? `Scanning ${progress?.done}/${progress?.total}…` : 'Scan the boards'}
        </button>
      </div>

      {result && (
        <div className="dossier p-3 mb-4 text-sm text-ink flex flex-wrap gap-x-4 gap-y-1">
          <span>
            <strong className="font-mono">{result.jobsFound}</strong> roles from{' '}
            <strong className="font-mono">{result.boards - result.boardsFailed.length}</strong> live boards
          </span>
          {result.boardsFailed.length > 0 && (
            <span className="text-ink-soft">
              {result.boardsFailed.length} board(s) quiet today: {result.boardsFailed.join(', ')}
            </span>
          )}
        </div>
      )}

      {ranked.length === 0 ? (
        <EmptyRadar synced={result !== null} onSync={runSync} />
      ) : (
        <>
          {ranked.length > VISIBLE_CAP && (
            <p className="text-xs text-ink-soft mb-3">
              Showing the top {VISIBLE_CAP} of {ranked.length}. The cap is deliberate — the ones below the line
              aren't worth your hours. Raise your rubric bar in Settings, not the cap.
            </p>
          )}
          <div className="space-y-3">
            {ranked.slice(0, VISIBLE_CAP).map(({ job, score }) => (
              <JobCard key={job.id} job={job} score={score} onTailor={() => tailor(job)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function EmptyRadar({ synced, onSync }: { synced: boolean; onSync: () => void }) {
  return (
    <div className="dossier p-8 text-center animate-dossier-in">
      <p className="font-display text-lg text-ink">
        {synced ? 'No open roles cleared the bar today.' : 'The radar is dark — scan to light it up.'}
      </p>
      <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
        {synced
          ? 'Boards go quiet when companies pause hiring or switch ATS. Try again tomorrow, or paste a specific job in the Packet screen.'
          : 'One scan pulls live roles from every enabled board, scores each against your rubric, and ranks them. No keys, no accounts.'}
      </p>
      {!synced && (
        <button className="mt-4 bg-stamp text-paper font-semibold text-sm px-5 py-2.5 rounded" onClick={onSync}>
          Scan now
        </button>
      )}
    </div>
  )
}

function JobCard({ job, score, onTailor }: { job: Job; score: ScoreBreakdown; onTailor: () => void }) {
  const [open, setOpen] = useState(false)
  const fresh = job.updatedAt ? daysAgo(job.updatedAt) : null
  const band = score.total >= 70 ? 'shipped' : score.total >= 45 ? 'forge' : 'stamp'
  const bandCls = { shipped: 'text-shipped border-shipped', forge: 'text-forge border-forge', stamp: 'text-ink-soft border-paper-edge' }[band]

  return (
    <article className="dossier p-4 animate-dossier-in hover:shadow-dossier-hover transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-12 h-12 rounded-full border-2 grid place-items-center font-mono font-bold ${bandCls}`}>
          {score.total}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink leading-snug flex items-center gap-2">
            {job.isNew && <span className="stamp stamp-red !text-[9px] shrink-0">NEW</span>}
            {job.title}
          </h3>
          <p className="text-sm text-ink-soft">
            {job.company}
            {job.location && ` · ${job.location}`}
            {job.publisher && <span className="font-mono text-[10px] ml-2 text-ink-faint">via {job.publisher}</span>}
            {fresh !== null && (
              <span className="font-mono text-[11px] ml-2 text-ink-faint">
                {fresh === 0 ? 'updated today' : `updated ${fresh}d ago`}
              </span>
            )}
          </p>
        </div>
        <button
          className="shrink-0 bg-stamp text-paper font-semibold text-sm px-4 py-2 rounded hover:opacity-90"
          onClick={onTailor}
        >
          Tailor →
        </button>
      </div>

      <button
        className="mt-2 text-xs text-ink-soft hover:text-ink font-mono"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? '▾ hide' : '▸ why'} this score
      </button>
      {open && (
        <div className="mt-2 ledger-rule pt-2 space-y-1.5">
          {score.parts.map((p) => (
            <div key={p.key} className="grid grid-cols-[auto_1fr] gap-x-2 text-xs">
              <span className="font-mono text-ink tabular-nums">
                {String(p.points).padStart(2)}/{p.max}
              </span>
              <span className="text-ink-soft">
                <strong className="text-ink font-medium">{p.label}.</strong> {p.why}
              </span>
            </div>
          ))}
          <div className="grid grid-cols-[auto_1fr] gap-x-2 text-xs pt-1 border-t border-paper-edge">
            <span className="font-mono text-ink font-bold tabular-nums">{String(score.total).padStart(2)}/100</span>
            <span className="text-ink font-medium">total</span>
          </div>
          {job.url && (
            <a className="inline-block mt-1 font-mono text-[11px] text-ink underline decoration-dotted" href={job.url} target="_blank" rel="noreferrer">
              official posting ↗
            </a>
          )}
        </div>
      )}
    </article>
  )
}

function daysAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
}
