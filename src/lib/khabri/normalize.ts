import type { Job } from '../../types'

/**
 * Cross-source normalization + dedupe for the Khabri Engine.
 * Discovery surfaces the same role from many publishers (a LinkedIn listing, an Indeed
 * listing, the company's own ATS). We collapse them on a fuzzy company+title+location key
 * so the queue shows one card per real role — the Jasoos gate reports the duplicate count.
 */

const STOP_TITLE = /\b(intern|internship|engineer|developer|scientist|full[\s-]?time|remote|senior|junior|i{1,3}|202\d|h\/f|m\/f)\b/gi

export function dedupeKey(company: string, title: string, location: string): string {
  const c = company.toLowerCase().replace(/\b(inc|llc|ltd|technologies|technology|labs|ai|the)\b/g, '').replace(/[^a-z0-9]/g, '')
  // Session 7 (H3): 14 chars over-merged distinct roles of one company ("agentic ai platform
  // developer" vs "agentic ai developer" collided). 40 keeps real cross-source dupes collapsing
  // while distinct roles stay distinct.
  const t = title.toLowerCase().replace(STOP_TITLE, '').replace(/[^a-z0-9]/g, '').slice(0, 40)
  const l = location.toLowerCase().match(/[a-z]+/)?.[0] ?? ''
  return `${c}|${t}|${l}`
}

export function withDedupeKey(job: Job): Job {
  return { ...job, dedupeKey: dedupeKey(job.company, job.title, job.location) }
}

/**
 * Merge freshly-discovered jobs into the existing set.
 * - existing jobs (same id) keep their pipeline status; only jd/updatedAt refresh.
 * - a discovered job whose dedupeKey already exists (different source) is a DUPLICATE, dropped.
 * Returns the list to persist + a yield tally.
 */
export interface MergeResult {
  toPersist: Job[]
  found: number
  added: number
  duplicate: number
}

export function mergeDiscovered(discovered: Job[], existing: Job[]): MergeResult {
  const existingById = new Map(existing.map((j) => [j.id, j]))
  const existingKeys = new Set(existing.map((j) => j.dedupeKey ?? dedupeKey(j.company, j.title, j.location)))
  const seenThisRun = new Set<string>()
  const toPersist: Job[] = []
  let added = 0
  let duplicate = 0

  for (const raw of discovered) {
    const job = withDedupeKey(raw)
    const key = job.dedupeKey!
    if (existingById.has(job.id)) {
      // Same posting re-seen: refresh volatile fields, keep status.
      const prev = existingById.get(job.id)!
      toPersist.push({ ...prev, jd: job.jd || prev.jd, updatedAt: job.updatedAt ?? prev.updatedAt, fetchedAt: job.fetchedAt, salary: job.salary ?? prev.salary })
      continue
    }
    if (existingKeys.has(key) || seenThisRun.has(key)) {
      duplicate += 1
      continue
    }
    seenThisRun.add(key)
    toPersist.push({ ...job, isNew: true })
    added += 1
  }

  return { toPersist, found: discovered.length, added, duplicate }
}
