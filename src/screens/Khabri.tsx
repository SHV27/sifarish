import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { PulseBrief, Signal, SweepYield } from '../types'
import { runSweep } from '../lib/khabri/client'
import { runPulse, acceptPulse, dismissPulse, pulseDue } from '../lib/pulse/client'
import TaleemPanel from '../components/TaleemPanel'

/**
 * Khabri — the jasoos. Multi-source discovery + a hiring-signal feed. "Reel pe dekha,
 * app ko pehle se pata tha." Every signal carries a source (I7); nothing auto-applies (I3).
 */
export function Khabri({ onOpenRadar }: { onOpenRadar: () => void }) {
  const hunts = useLiveQuery(() => db.savedHunts.toArray()) ?? []
  const signals = useLiveQuery(() => db.signals.orderBy('fetchedAt').reverse().toArray()) ?? []
  const settings = useLiveQuery(() => db.settings.get('app'))
  const newJobs = useLiveQuery(() => db.jobs.filter((j) => j.isNew === true).count()) ?? 0
  const [sweeping, setSweeping] = useState(false)
  const [step, setStep] = useState('')
  const [result, setResult] = useState<SweepYield | null>(null)
  const [newHunt, setNewHunt] = useState('')

  const sweep = async () => {
    setSweeping(true)
    setResult(null)
    try {
      const r = await runSweep((s) => setStep(s))
      setResult(r)
    } finally {
      setSweeping(false)
      setStep('')
    }
  }

  const lastSweep = settings?.lastSweepAt ? timeAgo(settings.lastSweepAt) : 'never'

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-ink">
            Khabri <span className="font-devanagari text-lg text-stamp">ख़बरी</span>
          </h1>
          <p className="text-sm text-ink-soft mt-1">
            Your informant. Sweeps live job sources worldwide — LinkedIn/Indeed/Glassdoor roles via a lawful
            aggregator, Adzuna across 18 country markets, plus keyless global-remote boards and a hiring-signal
            feed. No scraping, ever.
          </p>
        </div>
        <div className="text-right">
          <button
            className="bg-stamp text-paper font-semibold text-sm px-5 py-2.5 rounded hover:opacity-90 disabled:opacity-60"
            onClick={sweep}
            disabled={sweeping}
          >
            {sweeping ? 'Sweeping…' : 'Run Sweep'}
          </button>
          <p className="font-mono text-[10px] text-ink-soft mt-1">last sweep: {lastSweep}</p>
        </div>
      </div>

      {sweeping && step && (
        <div className="dossier p-3 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-stamp animate-nudge" />
          <span className="text-sm text-ink font-mono">{step}</span>
        </div>
      )}

      {result && <YieldReport result={result} newJobs={newJobs} onOpenRadar={onOpenRadar} />}

      <PulsePanel lastPulseAt={settings?.lastPulseAt} />

      <TaleemPanel />

      {newJobs > 0 && !result && (
        <button
          onClick={onOpenRadar}
          className="dossier w-full p-3 mb-4 text-left flex items-center justify-between hover:shadow-dossier-hover"
        >
          <span className="text-sm text-ink">
            <span className="stamp stamp-red !text-[10px] mr-2">NEW</span>
            {newJobs} freshly-discovered role{newJobs === 1 ? '' : 's'} waiting in the Radar
          </span>
          <span className="text-ink-soft">→</span>
        </button>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] gap-5">
        {/* Khabar Feed */}
        <section aria-label="Hiring signals">
          <h2 className="font-display font-semibold text-lg text-ink mb-2">Khabar Feed — hiring signals</h2>
          {signals.length === 0 ? (
            <div className="dossier p-6 text-center">
              <p className="text-sm text-ink-soft">
                No signals yet. Run a sweep — the feed fills with hiring announcements and "who's building AI
                teams" news, each with a source you can open. Without a Tavily key it stays quiet (keyless mode);
                job discovery still runs on the free lanes.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {signals.map((s) => (
                <SignalCard key={s.id} signal={s} />
              ))}
            </div>
          )}
        </section>

        {/* Saved hunts */}
        <aside>
          <h2 className="font-display font-semibold text-lg text-ink mb-2">Saved hunts</h2>
          <div className="dossier p-3 space-y-1.5">
            {hunts.map((h) => (
              <div key={h.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={(e) => db.savedHunts.update(h.id, { enabled: e.target.checked })}
                  aria-label={`Enable hunt ${h.query}`}
                />
                <span className="text-ink truncate flex-1" title={h.query}>
                  {h.query}
                </span>
                {h.remoteOnly && <span className="font-mono text-[9px] text-ink-soft">remote</span>}
                <button
                  className="text-ink-faint hover:text-stamp"
                  onClick={() => db.savedHunts.delete(h.id)}
                  aria-label={`Delete hunt ${h.query}`}
                >
                  ×
                </button>
              </div>
            ))}
            <form
              className="flex gap-1 pt-2 ledger-rule"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!newHunt.trim()) return
                await db.savedHunts.put({ id: `h-${Date.now()}`, query: newHunt.trim(), remoteOnly: false, datePosted: 'month', enabled: true })
                setNewHunt('')
              }}
            >
              <input
                className="flex-1 bg-paper-sunken px-2 py-1.5 rounded text-xs"
                value={newHunt}
                onChange={(e) => setNewHunt(e.target.value)}
                placeholder="Add a hunt query…"
                aria-label="New hunt query"
              />
              <button className="text-xs font-semibold bg-ink text-paper px-2.5 rounded" type="submit">
                +
              </button>
            </form>
          </div>
          <p className="text-[11px] text-ink-soft mt-2 leading-snug">
            Each enabled hunt runs against JSearch (LinkedIn/Indeed/Glassdoor via Google-for-Jobs) plus the
            keyless lanes. Budgets are enforced — see Settings.
          </p>
        </aside>
      </div>
    </div>
  )
}

function PulsePanel({ lastPulseAt }: { lastPulseAt?: string }) {
  const briefs = useLiveQuery(() => db.pulse.where('status').equals('pending').reverse().toArray()) ?? []
  const [running, setRunning] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const due = pulseDue(lastPulseAt)

  const run = async () => {
    setRunning(true)
    setNote(null)
    try {
      const r = await runPulse()
      setNote(r.keyless ? 'Keyless — add TAVILY_API_KEY for the market pulse.' : `${r.count} new brief(s).`)
    } finally {
      setRunning(false)
    }
  }

  if (briefs.length === 0 && !note && !due) return null

  return (
    <section className="dossier p-4 mb-4" aria-label="Industry pulse">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display font-semibold text-lg text-ink">
          Industry Pulse {due && <span className="stamp stamp-red !text-[9px] ml-1">due</span>}
        </h2>
        <button className="text-xs font-semibold bg-ink text-paper px-3 py-1.5 rounded disabled:opacity-50" onClick={run} disabled={running}>
          {running ? 'Reading the market…' : 'Read the market'}
        </button>
      </div>
      <p className="text-xs text-ink-soft mt-1">
        Weekly cited news sweep. Emerging keywords become human-confirmed rubric suggestions — the app stays present-tense.
      </p>
      {note && <p className="text-[11px] text-ink-soft mt-1 font-mono">{note}</p>}
      {briefs.length > 0 && (
        <ul className="mt-3 space-y-2">
          {briefs.map((b) => (
            <PulseBriefRow key={b.id} brief={b} />
          ))}
        </ul>
      )}
    </section>
  )
}

function PulseBriefRow({ brief }: { brief: PulseBrief }) {
  return (
    <li className="ledger-rule pt-2">
      <a href={brief.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-ink hover:underline">
        {brief.headline}
      </a>
      <p className="text-xs text-ink-soft mt-0.5 leading-relaxed">{brief.insight}</p>
      {brief.suggestion && (
        <p className="text-xs text-stamp mt-1">
          <span className="stamp stamp-red !text-[9px] mr-1">rubric</span>
          {brief.suggestion}
        </p>
      )}
      {brief.proposedHunt && (
        <p className="text-xs text-ink mt-1">
          <span className="stamp stamp-shipped !text-[9px] mr-1">hunt</span>
          Accept to start hunting <span className="font-mono">“{brief.proposedHunt.query}”</span> on the Radar — {brief.proposedHunt.why}
        </p>
      )}
      <div className="mt-1 flex items-center gap-3 text-[11px]">
        <a href={brief.url} target="_blank" rel="noreferrer" className="font-mono text-ink underline decoration-dotted">
          {(() => {
            try {
              return new URL(brief.url).hostname.replace(/^www\./, '')
            } catch {
              return 'source'
            }
          })()} ↗
        </a>
        <button className="ml-auto font-medium text-shipped hover:underline" onClick={() => acceptPulse(brief)}>
          {brief.proposedHunt ? 'Add hunt ✓' : brief.suggestion ? 'Log it ✓' : 'Got it ✓'}
        </button>
        <button className="text-ink-soft hover:underline" onClick={() => dismissPulse(brief.id)}>
          dismiss
        </button>
      </div>
    </li>
  )
}

function YieldReport({ result, newJobs, onOpenRadar }: { result: SweepYield; newJobs: number; onOpenRadar: () => void }) {
  return (
    <div className="dossier p-4 mb-4 animate-dossier-in">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="text-ink">
          <strong className="font-mono text-lg">{result.found}</strong> found
        </span>
        <span className="text-shipped">
          <strong className="font-mono text-lg">{result.new}</strong> new
        </span>
        <span className="text-ink-soft">
          <strong className="font-mono">{result.duplicate}</strong> duplicate (deduped)
        </span>
        <span className="text-ink-soft font-mono text-xs ml-auto">
          {result.creditsSpent} credit{result.creditsSpent === 1 ? '' : 's'} spent
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        {result.keyedLanes.map((l) => (
          <span key={l} className="stamp stamp-shipped !text-[9px] !rotate-0">
            {l}
          </span>
        ))}
        {result.keylessLanes.map((l) => (
          <span key={l} className="stamp stamp-forge !text-[9px] !rotate-0">
            {l} · keyless
          </span>
        ))}
        {result.failed.map((l) => (
          <span key={l} className="stamp stamp-red !text-[9px] !rotate-0">
            {l} quiet
          </span>
        ))}
      </div>
      {newJobs > 0 && (
        <button onClick={onOpenRadar} className="mt-3 text-sm font-semibold text-stamp hover:underline">
          See {newJobs} new role{newJobs === 1 ? '' : 's'} in the Radar →
        </button>
      )}
    </div>
  )
}

function SignalCard({ signal }: { signal: Signal }) {
  const [hunted, setHunted] = useState(false)
  return (
    <article className="dossier p-3 animate-dossier-in">
      <div className="flex items-start justify-between gap-2">
        <a href={signal.url} target="_blank" rel="noreferrer" className="font-semibold text-ink text-sm leading-snug hover:underline">
          {signal.headline}
        </a>
        {!signal.seen && <span className="stamp stamp-red !text-[9px] shrink-0">NEW</span>}
      </div>
      <p className="text-xs text-ink-soft mt-1 leading-relaxed">{signal.whyItMatters}</p>
      <div className="mt-2 flex items-center gap-3 text-[11px]">
        <a href={signal.url} target="_blank" rel="noreferrer" className="font-mono text-ink underline decoration-dotted">
          {sourceHost(signal.url)} ↗
        </a>
        {signal.publishedAt && <span className="text-ink-faint font-mono">{signal.publishedAt.slice(0, 10)}</span>}
        <button
          className="ml-auto text-ink-soft hover:text-ink disabled:text-shipped"
          disabled={hunted}
          onClick={async () => {
            const q = signal.headline.split(/[—:|]/)[0].trim().slice(0, 60)
            await db.savedHunts.put({ id: `h-sig-${signal.id}`, query: q, remoteOnly: false, datePosted: 'month', enabled: true })
            await db.signals.update(signal.id, { seen: true })
            setHunted(true)
          }}
        >
          {hunted ? 'added to hunts ✓' : 'turn into a hunt →'}
        </button>
      </div>
    </article>
  )
}

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'source'
  }
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
