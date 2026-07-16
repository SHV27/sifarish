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

/**
 * A board scan (Session 5.10): the relevant jobs to rank PLUS every open posting id on the board
 * (computed BEFORE the title filter and cap, so a known posting missing from `openIds` really is
 * closed — never a filter artifact). "Jisne hiring band kar di wo company na aaye."
 */
export interface BoardScan {
  jobs: Job[]
  openIds: string[]
}

async function fetchGreenhouse(w: WatchlistCompany): Promise<BoardScan> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${w.token}/jobs?content=true`)
  if (!res.ok) throw new Error(`greenhouse ${w.token}: HTTP ${res.status}`)
  const data = await res.json()
  const now = new Date().toISOString()
  const openIds = (data.jobs ?? []).map((j: { id: number }) => jobId(w, j.id))
  const jobs = (data.jobs ?? [])
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
  return { jobs, openIds }
}

async function fetchLever(w: WatchlistCompany): Promise<BoardScan> {
  const res = await fetch(`https://api.lever.co/v0/postings/${w.token}?mode=json&limit=100`)
  if (!res.ok) throw new Error(`lever ${w.token}: HTTP ${res.status}`)
  const data = await res.json()
  const now = new Date().toISOString()
  const raw = Array.isArray(data) ? data : []
  const openIds = raw.map((j: { id: string }) => jobId(w, j.id))
  const jobs = raw
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
  return { jobs, openIds }
}

async function fetchAshby(w: WatchlistCompany): Promise<BoardScan> {
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${w.token}?includeCompensation=true`)
  if (!res.ok) throw new Error(`ashby ${w.token}: HTTP ${res.status}`)
  const data = await res.json()
  const now = new Date().toISOString()
  const listed = (data.jobs ?? []).filter((j: { isListed?: boolean }) => j.isListed !== false)
  const openIds = listed.map((j: { id: string }) => jobId(w, j.id))
  const jobs = listed
    .filter((j: { title: string }) => TITLE_RELEVANT.test(j.title))
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
  return { jobs, openIds }
}

async function fetchSmartRecruiters(w: WatchlistCompany): Promise<BoardScan> {
  const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${w.token}/postings?limit=100`)
  if (!res.ok) throw new Error(`smartrecruiters ${w.token}: HTTP ${res.status}`)
  const data = await res.json()
  const now = new Date().toISOString()
  const openIds = (data.content ?? []).map((j: { id: string }) => jobId(w, j.id))
  // List endpoint carries no JD; it is fetched lazily at tailor time (ensureJd).
  const jobs = (data.content ?? [])
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
  return { jobs, openIds }
}

export async function fetchBoard(w: WatchlistCompany): Promise<BoardScan> {
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
  jobsClosed: number
}

/**
 * CLOSURE RECONCILIATION (Session 5.10, pure → gate-tested). Given what a board scan says is
 * still open, decide which locally-known postings from that board are now CLOSED and which have
 * REOPENED. Only untouched discoveries close (status 'found') — anything he moved into the
 * pipeline is his record, and Morcha keeps it whatever the board says.
 */
export function reconcileClosures(
  known: Pick<Job, 'id' | 'status' | 'closed'>[],
  openIds: string[],
  boardPrefix: string,
): { close: string[]; reopen: string[] } {
  const open = new Set(openIds)
  const close: string[] = []
  const reopen: string[] = []
  for (const k of known) {
    if (!k.id.startsWith(boardPrefix)) continue
    if (!open.has(k.id) && k.status === 'found' && !k.closed) close.push(k.id)
    else if (open.has(k.id) && k.closed) reopen.push(k.id)
  }
  return { close, reopen }
}

/**
 * Scan every enabled watchlist board. Existing jobs keep their pipeline status —
 * a re-scan never resets the Morcha (fetch refreshes jd/updatedAt only).
 * Session 5.10: a posting the board no longer lists is marked CLOSED and leaves the ranked
 * queue entirely ("jisne hiring band kar di wo company na aaye"); it reopens if it returns.
 */
export async function syncRadar(onProgress?: (done: number, total: number) => void): Promise<SyncResult> {
  const watch = (await db.watchlist.toArray()).filter((w) => w.enabled)
  const failed: string[] = []
  let found = 0
  let closed = 0
  let done = 0
  for (const w of watch) {
    try {
      const { jobs, openIds } = await fetchBoard(w)
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
        // Close what the board itself no longer lists; reopen what returned.
        const prefix = `${w.source}:${w.token}:`
        const known = (await db.jobs.toArray()).filter((j) => j.id.startsWith(prefix))
        const rec = reconcileClosures(known, openIds, prefix)
        for (const id of rec.close) await db.jobs.update(id, { closed: true, linkAlive: false })
        for (const id of rec.reopen) await db.jobs.update(id, { closed: false, linkAlive: true })
        closed += rec.close.length
        await db.watchlist.update(w.id, { lastJobCount: openIds.length, lastChecked: new Date().toISOString() })
      })
    } catch {
      failed.push(w.company)
      await db.watchlist.update(w.id, { lastJobCount: 0, lastChecked: new Date().toISOString() })
    }
    done += 1
    onProgress?.(done, watch.length)
  }
  return { boards: watch.length, boardsFailed: failed, jobsFound: found, jobsClosed: closed }
}
