import { db } from '../../db/db'
import type { DakCard, Job } from '../../types'
import { getAccessToken } from './gis'

/**
 * DAK KHANA watch logic (P15) — "never miss a reply". Client-side, on demand + on app open:
 * recent Gmail messages are matched against Morcha companies (domain + name heuristics) and
 * become "📬 {Company} ne jawab diya" cards. Stage moves are SUGGESTED, never applied — the
 * owner confirms (Nabz pattern). Nudges auto-clear when a reply is detected.
 *
 * The matching core is pure (mocked-fixture-tested, no network).
 */

export interface MailMeta {
  id: string
  from: string
  subject: string
  date: string
  snippet: string
}

/** Heuristics for stage suggestions — conservative on purpose; the human decides. */
export const INTERVIEW_RE = /\b(interview|schedule a (call|chat|conversation)|availability|next (round|step|stage)|assessment|take.?home|coding (challenge|round)|phone screen)\b/i
export const REJECT_RE = /\b(unfortunately|not (be )?(moving|going) forward|regret to inform|other candidates|position has been filled|won'?t be proceeding)\b/i
/** Bulk noise a job-hunt inbox is full of — never a card. */
const NOISE_RE = /\b(job alert|jobs? for you|newsletter|digest|recommended jobs|new jobs posted|apply now to \d+)\b/i

/** Company slug for domain/name matching: "Sarvam AI" → "sarvam". */
export function companySlug(company: string): string {
  const first = company
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter((w) => !['ai', 'labs', 'inc', 'the', 'hq', 'technologies', 'tech'].includes(w))
  return first[0] ?? company.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Pure matcher: which watched job does this message belong to (if any)? */
export function matchMail(meta: MailMeta, jobs: Job[]): Job | undefined {
  if (NOISE_RE.test(`${meta.subject} ${meta.snippet}`)) return undefined
  const fromDomain = (/@([a-z0-9.-]+)/i.exec(meta.from)?.[1] ?? '').toLowerCase()
  const hay = `${meta.from} ${meta.subject} ${meta.snippet}`.toLowerCase()
  return jobs.find((j) => {
    const slug = companySlug(j.company)
    if (slug.length < 3) return false
    // Domain heuristic beats name heuristic: a mail FROM the company's domain is near-certain.
    if (fromDomain.includes(slug)) return true
    // ATS senders (greenhouse/lever/ashby) put the company in the display name or subject.
    const viaAts = /(greenhouse|lever|ashby|smartrecruiters|myworkday)/.test(fromDomain)
    return viaAts && hay.includes(slug)
  })
}

export function suggestStage(meta: MailMeta): DakCard['stageSuggestion'] {
  const hay = `${meta.subject} ${meta.snippet}`
  if (INTERVIEW_RE.test(hay)) return 'interview'
  if (REJECT_RE.test(hay)) return 'rejected'
  return undefined
}

/** Pure core: metas + watched jobs → cards (dedupe against known ids handled by caller). */
export function buildCards(metas: MailMeta[], jobs: Job[], now = new Date()): DakCard[] {
  const watched = jobs.filter((j) => ['applied', 'followup', 'interview'].includes(j.status))
  const cards: DakCard[] = []
  for (const m of metas) {
    const job = matchMail(m, watched)
    if (!job) continue
    cards.push({
      id: m.id,
      jobId: job.id,
      company: job.company,
      subject: m.subject,
      from: m.from,
      date: m.date,
      snippet: m.snippet.slice(0, 200),
      gmailUrl: `https://mail.google.com/mail/u/0/#all/${m.id}`,
      stageSuggestion: suggestStage(m),
      status: 'pending',
      fetchedAt: now.toISOString(),
    })
  }
  return cards
}

// ---------------- network path (token required; degrades to nothing gracefully) ----------------

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'

async function gmailGet<T>(path: string, tokenValue: string): Promise<T | null> {
  try {
    const res = await fetch(`${GMAIL_API}${path}`, { headers: { Authorization: `Bearer ${tokenValue}` } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function header(headers: { name: string; value: string }[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

/**
 * Sweep recent mail for the Morcha companies. Read-only listing + metadata fetches; results
 * land as pending cards. Returns how many NEW cards appeared. No token → 0, silently (the
 * feature hides when unconnected; nothing else degrades).
 */
export async function sweepMail(): Promise<{ newCards: number; checked: number }> {
  const tokenValue = getAccessToken()
  if (!tokenValue) return { newCards: 0, checked: 0 }
  const jobs = await db.jobs.toArray()
  const watched = jobs.filter((j) => ['applied', 'followup', 'interview'].includes(j.status))
  if (watched.length === 0) return { newCards: 0, checked: 0 }

  const list = await gmailGet<{ messages?: { id: string }[] }>(
    `/messages?q=${encodeURIComponent('newer_than:45d in:inbox -category:promotions')}&maxResults=40`,
    tokenValue,
  )
  const ids = list?.messages?.map((m) => m.id) ?? []
  const known = new Set((await db.dak.toArray()).map((c) => c.id))
  const metas: MailMeta[] = []
  for (const id of ids) {
    if (known.has(id)) continue
    const msg = await gmailGet<{
      id: string
      snippet?: string
      payload?: { headers?: { name: string; value: string }[] }
    }>(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, tokenValue)
    if (!msg) continue
    metas.push({
      id: msg.id,
      from: header(msg.payload?.headers, 'From'),
      subject: header(msg.payload?.headers, 'Subject'),
      date: header(msg.payload?.headers, 'Date'),
      snippet: msg.snippet ?? '',
    })
  }

  const cards = buildCards(metas, jobs)
  let added = 0
  for (const card of cards) {
    await db.dak.put(card)
    added += 1
    // A detected reply clears the follow-up nudge (the job heard back — no need to poke them).
    if (card.jobId) await db.jobs.update(card.jobId, { replyDetectedAt: card.fetchedAt })
  }
  return { newCards: added, checked: metas.length }
}

/** Owner confirms a suggested stage move (Nabz pattern — never automatic). */
export async function confirmStage(card: DakCard): Promise<void> {
  if (card.jobId && card.stageSuggestion) {
    await db.jobs.update(card.jobId, { status: card.stageSuggestion })
  }
  await db.dak.update(card.id, { status: 'confirmed' })
}

export async function dismissCard(id: string): Promise<void> {
  await db.dak.update(id, { status: 'dismissed' })
}
