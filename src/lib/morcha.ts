import { db } from '../db/db'
import { isoWeekKey } from '../db/seed'
import type { Job, JobStatus } from '../types'

/** Marking applied IS the tracker write — never a separate chore (F7). */
export async function markApplied(jobId: string): Promise<void> {
  const settings = await db.settings.get('app')
  const week = isoWeekKey()
  const applied = settings?.weekKey === week ? (settings.appliedThisWeek ?? 0) + 1 : 1
  await db.transaction('rw', [db.jobs, db.settings], async () => {
    await db.jobs.update(jobId, { status: 'applied', appliedAt: new Date().toISOString() })
    await db.settings.update('app', { weekKey: week, appliedThisWeek: applied })
  })
}

export async function setJobStatus(jobId: string, status: JobStatus): Promise<void> {
  await db.jobs.update(jobId, { status })
}

/** Day-7 / day-14 follow-up nudges: due when applied N days ago and still waiting. */
export function nudgeState(job: Job): { due: boolean; day: 7 | 14 | null } {
  if (job.status !== 'applied' && job.status !== 'followup') return { due: false, day: null }
  if (!job.appliedAt) return { due: false, day: null }
  const days = (Date.now() - new Date(job.appliedAt).getTime()) / 86400000
  if (days >= 14) return { due: true, day: 14 }
  if (days >= 7 && job.status === 'applied') return { due: true, day: 7 }
  return { due: false, day: null }
}
