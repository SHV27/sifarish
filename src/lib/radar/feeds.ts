import type { Job, WatchlistCompany } from '../../types'
import { stripHtml } from '../util/html'
import { db } from '../../db/db'

/**
 * Keyless public ATS feed adapters — shapes verified live 07-Jul-2026 (RESEARCH.md §3),
 * CORS `*` confirmed for all four. Fetch-at-view; results cached in Dexie with fetchedAt.
 */

/** Title prefilter: boards return hundreds of roles; keep the ones worth scoring. */
const TITLE_RELEVANT =
  /intern|graduate|new grad|entry|early|junior|residen|apprentice|ai|ml|machine learning|llm|research|applied|data|forward deployed|member of technical staff|software|developer|engineer/i
const PER_BOARD_CAP = 40

function jobId(w: WatchlistCompany, externalId: string | number): string {
  return `${w.source}:${w.token}:${externalId}`
}

async function fetchGreenhouse(w: WatchlistCompany): Promise<Job[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${w.token}/jobs?content=true`)
  if (!res.ok) throw new Error(`greenhouse ${w.token}: HTTP ${res.status}`)
  const data = await res.json()
  const now = new Date().toISOString()
  return (data.jobs ?? [])
    .filter((j: { title: string }) => TITLE_RELEVANT.test(j.title))
    .slice(0, PER_BOARD_CAP)
    .map(
      (j: {
        id: number
        title: string
        updated_at: string
        location?: { name: string }
        content?: string
        absolute_url: string
        company_name?: string
      }): Job => ({
        id: jobId(w, j.id),
        source: 'greenhouse',
        externalId: String(j.id),
        company: j.company_name ?? w.company,
        title: j.title,
        location: j.location?.name ?? '',
        url: j.absolute_url,
        jd: stripHtml(j.content ?? ''),
        updatedAt: j.updated_at,
        fetchedAt: now,
        status: 'found',
      }),
    )
}

async function fetchLever(w: WatchlistCompany): Promise<Job[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${w.token}?mode=json&limit=100`)
  if (!res.ok) throw new Error(`lever ${w.token}: HTTP ${res.status}`)
  const data = await res.json()
  const now = new Date().toISOString()
  return (Array.isArray(data) ? data : [])
    .filter((j: { text: string }) => TITLE_RELEVANT.test(j.text))
    .slice(0, PER_BOARD_CAP)
    .map(
      (j: {
        id: string
        text: string
        hostedUrl: string
        createdAt?: number
        descriptionPlain?: string
        description?: string
        lists?: { text: string; content: string }[]
        categories?: { location?: string }
        workplaceType?: string
      }): Job => ({
        id: jobId(w, j.id),
        source: 'lever',
        externalId: j.id,
        company: w.company,
        title: j.text,
        location: [j.categories?.location, j.workplaceType].filter(Boolean).join(' · '),
        url: j.hostedUrl,
        jd: [
          j.descriptionPlain ?? stripHtml(j.description ?? ''),
          ...(j.lists ?? []).map((l) => `${l.text}\n${stripHtml(l.content)}`),
        ]
          .filter(Boolean)
          .join('\n\n'),
        updatedAt: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
        fetchedAt: now,
        status: 'found',
      }),
    )
}

async function fetchAshby(w: WatchlistCompany): Promise<Job[]> {
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${w.token}?includeCompensation=true`)
  if (!res.ok) throw new Error(`ashby ${w.token}: HTTP ${res.status}`)
  const data = await res.json()
  const now = new Date().toISOString()
  return (data.jobs ?? [])
    .filter((j: { isListed?: boolean; title: string }) => j.isListed !== false && TITLE_RELEVANT.test(j.title))
    .slice(0, PER_BOARD_CAP)
    .map(
      (j: {
        id: string
        title: string
        location?: string
        isRemote?: boolean
        descriptionPlain?: string
        descriptionHtml?: string
        jobUrl?: string
        applyUrl?: string
        publishedAt?: string
        compensation?: { compensationTierSummary?: string }
      }): Job => ({
        id: jobId(w, j.id),
        source: 'ashby',
        externalId: j.id,
        company: w.company,
        title: j.title,
        location: [j.location, j.isRemote ? 'Remote' : ''].filter(Boolean).join(' · '),
        url: j.jobUrl ?? j.applyUrl ?? '',
        jd: [
          j.descriptionPlain ?? stripHtml(j.descriptionHtml ?? ''),
          j.compensation?.compensationTierSummary ? `Compensation: ${j.compensation.compensationTierSummary}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        updatedAt: j.publishedAt,
        fetchedAt: now,
        status: 'found',
      }),
    )
}

async function fetchSmartRecruiters(w: WatchlistCompany): Promise<Job[]> {
  const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${w.token}/postings?limit=100`)
  if (!res.ok) throw new Error(`smartrecruiters ${w.token}: HTTP ${res.status}`)
  const data = await res.json()
  const now = new Date().toISOString()
  // List endpoint carries no JD; it is fetched lazily at tailor time (ensureJd).
  return (data.content ?? [])
    .filter((j: { name: string }) => TITLE_RELEVANT.test(j.name))
    .slice(0, PER_BOARD_CAP)
    .map(
      (j: {
        id: string
        name: string
        releasedDate?: string
        location?: { city?: string; country?: string; remote?: boolean }
        company?: { name?: string }
      }): Job => ({
        id: jobId(w, j.id),
        source: 'smartrecruiters',
        externalId: j.id,
        company: j.company?.name ?? w.company,
        title: j.name,
        location: [j.location?.city, j.location?.country, j.location?.remote ? 'Remote' : ''].filter(Boolean).join(', '),
        url: `https://jobs.smartrecruiters.com/${w.token}/${j.id}`,
        jd: '',
        updatedAt: j.releasedDate,
        fetchedAt: now,
        status: 'found',
      }),
    )
}

export async function fetchBoard(w: WatchlistCompany): Promise<Job[]> {
  switch (w.source) {
    case 'greenhouse':
      return fetchGreenhouse(w)
    case 'lever':
      return fetchLever(w)
    case 'ashby':
      return fetchAshby(w)
    case 'smartrecruiters':
      return fetchSmartRecruiters(w)
  }
}

/** SmartRecruiters list rows have no JD — pull the posting detail before tailoring. */
export async function ensureJd(job: Job): Promise<Job> {
  if (job.jd.trim().length > 0 || job.source !== 'smartrecruiters') return job
  const [, token] = job.id.split(':')
  const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${token}/postings/${job.externalId}`)
  if (!res.ok) return job
  const detail = await res.json()
  const sections = detail.jobAd?.sections ?? {}
  const jd = ['jobDescription', 'qualifications', 'additionalInformation']
    .map((k) => stripHtml(sections[k]?.text ?? ''))
    .filter(Boolean)
    .join('\n\n')
  const updated = { ...job, jd }
  await db.jobs.put(updated)
  return updated
}

export interface SyncResult {
  boards: number
  boardsFailed: string[]
  jobsFound: number
}

/**
 * Scan every enabled watchlist board. Existing jobs keep their pipeline status —
 * a re-scan never resets the Morcha (fetch refreshes jd/updatedAt only).
 */
export async function syncRadar(onProgress?: (done: number, total: number) => void): Promise<SyncResult> {
  const watch = (await db.watchlist.toArray()).filter((w) => w.enabled)
  const failed: string[] = []
  let found = 0
  let done = 0
  for (const w of watch) {
    try {
      const jobs = await fetchBoard(w)
      found += jobs.length
      await db.transaction('rw', [db.jobs, db.watchlist], async () => {
        for (const job of jobs) {
          const existing = await db.jobs.get(job.id)
          if (existing) {
            await db.jobs.update(job.id, { jd: job.jd || existing.jd, updatedAt: job.updatedAt, fetchedAt: job.fetchedAt, linkAlive: true })
          } else {
            await db.jobs.put({ ...job, linkAlive: true })
          }
        }
        await db.watchlist.update(w.id, { lastJobCount: jobs.length, lastChecked: new Date().toISOString() })
      })
    } catch {
      failed.push(w.company)
      await db.watchlist.update(w.id, { lastJobCount: 0, lastChecked: new Date().toISOString() })
    }
    done += 1
    onProgress?.(done, watch.length)
  }
  return { boards: watch.length, boardsFailed: failed, jobsFound: found }
}
