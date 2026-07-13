import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Job, JobStatus } from '../types'
import { nudgeState, setJobStatus, clearFound } from '../lib/morcha'
import { buildDossier, type InterviewDossier } from '../lib/dossier'
import DakPanel from '../components/DakPanel'

const COLUMNS: { status: JobStatus; label: string; hindi: string }[] = [
  { status: 'found', label: 'Found', hindi: 'मिला' },
  { status: 'tailored', label: 'Tailored', hindi: 'सिला' },
  { status: 'applied', label: 'Applied', hindi: 'भेजा' },
  { status: 'followup', label: 'Follow-up', hindi: 'याद' },
  { status: 'interview', label: 'Interview', hindi: 'भेंट' },
]

const VERDICTS: { status: JobStatus; label: string }[] = [
  { status: 'offer', label: 'Offer' },
  { status: 'rejected', label: 'Rejected' },
  { status: 'ghosted', label: 'Ghosted' },
]

export function Morcha({ onOpenPacket }: { onOpenPacket: (jobId: string) => void }) {
  const jobs = useLiveQuery(() => db.jobs.toArray()) ?? []
  const ledger = useLiveQuery(() => db.ledger.toArray()) ?? []
  const [dossier, setDossier] = useState<InterviewDossier | null>(null)

  const byStatus = useMemo(() => {
    const map = new Map<JobStatus, Job[]>()
    for (const j of jobs) map.set(j.status, [...(map.get(j.status) ?? []), j])
    return map
  }, [jobs])

  const tracked = jobs.filter((j) => j.status !== 'found').length

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-ink">Morcha Board</h1>
          <p className="text-sm text-ink-soft mt-1">
            The war room. Every card carries its packet. Tracking is a side effect — you never fill a form.
          </p>
        </div>
        <p className="font-mono text-xs text-ink-soft">{tracked} in the pipeline</p>
      </div>

      {tracked > 0 && <DakPanel />}

      {tracked === 0 ? (
        <div className="dossier p-8 text-center animate-dossier-in">
          <p className="font-display text-lg text-ink">The board is empty — that's the starting line.</p>
          <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
            Tailor a packet in the Radar or Packet screen. The moment you do, a card lands here in{' '}
            <em>Tailored</em>, and it walks these columns as your hunt moves.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {COLUMNS.map((col) => (
              <Column
                key={col.status}
                col={col}
                jobs={byStatus.get(col.status) ?? []}
                onOpenPacket={onOpenPacket}
                onDossier={(job) => setDossier(buildDossier(job, ledger))}
              />
            ))}
            <div className="w-56 shrink-0">
              <h2 className="font-display font-semibold text-sm text-ink mb-2 flex items-center gap-2">
                Verdict <span className="font-devanagari text-xs text-stamp">फ़ैसला</span>
              </h2>
              <div className="space-y-3">
                {VERDICTS.map((v) => (
                  <VerdictBucket key={v.status} label={v.label} jobs={byStatus.get(v.status) ?? []} onOpenPacket={onOpenPacket} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {dossier && <DossierModal dossier={dossier} onClose={() => setDossier(null)} />}
    </div>
  )
}

const PAGE = 8 // cards shown per column before "show more" — keeps the board scannable (Found had 996)

function Column({
  col,
  jobs,
  onOpenPacket,
  onDossier,
}: {
  col: { status: JobStatus; label: string; hindi: string }
  jobs: Job[]
  onOpenPacket: (id: string) => void
  onDossier: (job: Job) => void
}) {
  const [limit, setLimit] = useState(PAGE)
  const [clearing, setClearing] = useState(false)
  // Highest-scoring first so the cap always shows the best of a big column.
  const sorted = useMemo(() => jobs.slice().sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0)), [jobs])
  const shown = sorted.slice(0, limit)

  return (
    <div className="w-56 shrink-0">
      <h2 className="font-display font-semibold text-sm text-ink mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2">
          {col.label} <span className="font-devanagari text-xs text-ink-soft">{col.hindi}</span>
        </span>
        <span className="font-mono text-[11px] text-ink-soft">{jobs.length}</span>
      </h2>
      {col.status === 'found' && jobs.length > 0 && (
        <button
          className="mb-1.5 text-[10px] font-mono text-ink-soft hover:text-stamp disabled:opacity-50"
          disabled={clearing}
          onClick={async () => {
            setClearing(true)
            try {
              await clearFound()
            } finally {
              setClearing(false)
            }
          }}
          title="Removes only untailored Found jobs; tailored/applied are never touched. Re-sweep anytime."
        >
          {clearing ? 'clearing…' : '✕ clear found'}
        </button>
      )}
      <div className="space-y-2 min-h-16 bg-paper-sunken/30 rounded p-1.5">
        {shown.map((job) => (
          <MorchaCard key={job.id} job={job} onOpenPacket={onOpenPacket} onDossier={() => onDossier(job)} />
        ))}
        {jobs.length > limit && (
          <button className="w-full text-[11px] font-mono text-ink-soft hover:text-ink py-1" onClick={() => setLimit((l) => l + PAGE)}>
            show {Math.min(PAGE, jobs.length - limit)} more ({jobs.length - limit} hidden)
          </button>
        )}
      </div>
    </div>
  )
}

const NEXT: Partial<Record<JobStatus, { status: JobStatus; label: string }[]>> = {
  tailored: [{ status: 'applied', label: 'Mark applied' }],
  applied: [
    { status: 'interview', label: '→ Interview' },
    { status: 'rejected', label: 'Rejected' },
    { status: 'ghosted', label: 'Ghosted' },
  ],
  followup: [
    { status: 'interview', label: '→ Interview' },
    { status: 'rejected', label: 'Rejected' },
    { status: 'ghosted', label: 'Ghosted' },
  ],
  interview: [
    { status: 'offer', label: '🎉 Offer' },
    { status: 'rejected', label: 'Rejected' },
  ],
}

function MorchaCard({ job, onOpenPacket, onDossier }: { job: Job; onOpenPacket: (id: string) => void; onDossier: () => void }) {
  const nudge = nudgeState(job)
  const actions = NEXT[job.status] ?? []

  return (
    <div className="dossier p-2.5 animate-dossier-in">
      <button className="text-left w-full" onClick={() => onOpenPacket(job.id)}>
        <p className="text-xs font-semibold text-ink leading-snug">{job.title}</p>
        <p className="text-[11px] text-ink-soft">{job.company}</p>
      </button>

      {nudge.due && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-stamp animate-nudge" aria-hidden />
          <span className="text-[10px] text-stamp font-medium">Day {nudge.day} — follow up</span>
        </div>
      )}

      {job.status === 'interview' && (
        <button className="mt-1.5 text-[11px] font-medium text-ink underline decoration-dotted" onClick={onDossier}>
          Open dossier ↗
        </button>
      )}

      {actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {job.status === 'applied' && !nudge.due && (
            <button
              className="text-[10px] font-mono text-ink-soft hover:text-ink px-1.5 py-0.5 rounded border border-paper-edge"
              onClick={() => setJobStatus(job.id, 'followup')}
            >
              → follow-up
            </button>
          )}
          {actions.map((a) => (
            <button
              key={a.status}
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                a.status === 'offer'
                  ? 'text-shipped border-shipped'
                  : a.status === 'rejected' || a.status === 'ghosted'
                    ? 'text-ink-soft border-paper-edge'
                    : 'text-ink border-ink'
              }`}
              onClick={() => setJobStatus(job.id, a.status)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function VerdictBucket({ label, jobs, onOpenPacket }: { label: string; jobs: Job[]; onOpenPacket: (id: string) => void }) {
  const tone = label === 'Offer' ? 'stamp-shipped' : 'stamp-red'
  return (
    <div className="bg-paper-sunken/30 rounded p-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className={`stamp ${tone} !text-[10px]`}>{label}</span>
        <span className="font-mono text-[11px] text-ink-soft">{jobs.length}</span>
      </div>
      <div className="space-y-1.5">
        {jobs.map((j) => (
          <button
            key={j.id}
            className="dossier w-full text-left p-2 text-[11px] text-ink"
            onClick={() => onOpenPacket(j.id)}
          >
            <span className="font-semibold">{j.title}</span> · {j.company}
          </button>
        ))}
      </div>
    </div>
  )
}

function DossierModal({ dossier, onClose }: { dossier: InterviewDossier; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 bg-ink/40 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Interview dossier for ${dossier.company}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dossier p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto animate-dossier-in">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display font-bold text-xl text-ink">Interview Dossier</h2>
            <p className="text-sm text-ink-soft">
              {dossier.title} · {dossier.company}
            </p>
          </div>
          <button className="text-ink-soft hover:text-stamp text-xl leading-none" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {dossier.focus.length > 0 && (
          <div className="mt-4">
            <h3 className="font-mono text-[11px] uppercase text-ink-soft tracking-wide">They will test</h3>
            <div className="flex flex-wrap gap-1 mt-1">
              {dossier.focus.map((f) => (
                <span key={f} className="stamp stamp-red !text-[10px] !rotate-0">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <h3 className="font-mono text-[11px] uppercase text-ink-soft tracking-wide">Your talking points (all real)</h3>
          <ul className="mt-2 space-y-2">
            {dossier.talkingPoints.map((t) => (
              <li key={t.ledgerId} className="ledger-rule pt-2">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                <p className="text-xs text-ink-soft leading-relaxed">{t.hook}</p>
                {t.evidence && (
                  <a className="font-mono text-[11px] text-ink underline decoration-dotted" href={t.evidence} target="_blank" rel="noreferrer">
                    {t.evidence.replace(/^https?:\/\//, '')} ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>

        {dossier.probe.length > 0 && (
          <div className="mt-4">
            <h3 className="font-mono text-[11px] uppercase text-stamp tracking-wide">Rehearse the honest answer</h3>
            <ul className="mt-1 space-y-1">
              {dossier.probe.map((p, i) => (
                <li key={i} className="text-xs text-ink-soft leading-relaxed">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
