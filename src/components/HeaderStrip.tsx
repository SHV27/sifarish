import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { resumeStrength } from '../lib/strength'
import { isoWeekKey } from '../db/seed'

/** Compact war-status strip, persistent across the app (vision §P5). */
export function HeaderStrip() {
  const settings = useLiveQuery(() => db.settings.get('app'))
  const jobs = useLiveQuery(() => db.jobs.toArray()) ?? []
  const entries = useLiveQuery(() => db.ledger.toArray()) ?? []

  const currentWeek = isoWeekKey()
  const appliedThisWeek = settings?.weekKey === currentWeek ? (settings?.appliedThisWeek ?? 0) : 0
  const quota = settings?.weeklyQuota ?? 10
  const awaiting = jobs.filter((j) => j.status === 'applied' || j.status === 'followup').length
  const interviews = jobs.filter((j) => j.status === 'interview').length
  const strength = resumeStrength(entries)

  const Stat = ({ label, value, alert }: { label: string; value: string; alert?: boolean }) => (
    <div className="flex items-baseline gap-1.5 min-w-0">
      <span className={`font-mono text-sm font-semibold ${alert ? 'text-stamp' : 'text-ink'}`}>{value}</span>
      <span className="text-[11px] text-ink-soft truncate">{label}</span>
    </div>
  )

  return (
    <header className="border-b border-paper-edge bg-paper-raised/70 px-4 sm:px-6 py-2 flex items-center gap-4 sm:gap-6 overflow-x-auto">
      <Stat label="applied this week" value={`${appliedThisWeek}/${quota}`} alert={appliedThisWeek >= quota} />
      <Stat label="awaiting reply" value={String(awaiting)} />
      <Stat label="interviews" value={String(interviews)} />
      <div className="flex items-center gap-2 ml-auto shrink-0" title="Moves only when truth moves">
        <span className="text-[11px] text-ink-soft">Resume strength</span>
        <div
          className="w-24 h-2 rounded-full bg-paper-sunken border border-paper-edge overflow-hidden"
          role="meter"
          aria-valuenow={strength.pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Resume strength"
        >
          <div className="h-full bg-shipped transition-all duration-500" style={{ width: `${strength.pct}%` }} />
        </div>
        <span className="font-mono text-xs font-semibold text-shipped">{strength.pct}%</span>
      </div>
    </header>
  )
}
