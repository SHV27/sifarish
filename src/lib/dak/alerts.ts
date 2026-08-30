import { db } from '../../db/db'
import type { Job } from '../../types'
import { getAccessToken } from './gis'
import { GmailAuthError } from './watch'
import { mergeDiscovered } from '../khabri/normalize'

/**
 * THE ALERT LANE (re-brief Pillar 5 — recon's best find). LinkedIn exposes no lawful API, but
 * his own job-alert EMAILS are his data: parsing mail he already received touches no platform,
 * costs zero credits, and arrives daily. Same gmail.readonly scope as the Dak watchman —
 * NO new scopes (the I3 send-ban grep gate still walks this file).
 *
 * Parsing is a pure core over the alert HTML (fixture-tested); an alert that parses to zero
 * jobs is COUNTED and linked (open in Gmail), never silently dropped.
 */

/** Alert senders — data, not code: extend the list, not the mechanism. */
export const ALERT_SENDERS = [
  { re: /jobalerts-noreply@linkedin\.com|jobs-noreply@linkedin\.com/i, publisher: 'LinkedIn alert' },
  { re: /@indeed\.com/i, publisher: 'Indeed alert' },
  { re: /@(?:hi\.)?wellfound\.com|@angel\.co/i, publisher: 'Wellfound alert' },
]

export const ALERT_QUERY =
  'from:(jobalerts-noreply@linkedin.com OR jobs-noreply@linkedin.com OR alert@indeed.com OR team@hi.wellfound.com) newer_than:7d'

export interface AlertJob {
  externalId: string
  title: string
  company: string
  location: string
  url: string
}

/** Strip tags/entities from an HTML fragment into readable text. */
function textOf(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&middot;/gi, '·')
    .replace(/&bull;/gi, '•')
    .replace(/&nbsp;|&#847;|&zwnj;|&#8203;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parse a LinkedIn job-alert email's HTML. Anatomy (stable for years, fixture-gated here):
 * each role is an anchor to /jobs/view/<id> whose text is the TITLE, followed in the next
 * text run by "Company · Location". Tracking params are dropped — we keep the canonical view URL.
 */
export function parseLinkedInAlert(html: string): AlertJob[] {
  const out: AlertJob[] = []
  const seen = new Set<string>()
  const anchorRe = /<a[^>]+href="([^"]*\/jobs\/view\/(\d{6,})[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = anchorRe.exec(html)) !== null) {
    const id = m[2]
    const title = textOf(m[3])
    if (!title || title.length < 4 || /^view job|^see all|^apply/i.test(title)) continue
    if (seen.has(id)) continue
    // The company · location line lives in the text right after this anchor block.
    const tail = textOf(html.slice(m.index + m[0].length, m.index + m[0].length + 600))
    const line = tail.match(/^([^·•|]{2,60})[·•|]\s*([^·•|]{2,60})/)
    seen.add(id)
    out.push({
      externalId: id,
      title,
      company: (line?.[1] ?? '').trim() || 'Unknown company',
      location: (line?.[2] ?? '').trim(),
      url: `https://www.linkedin.com/jobs/view/${id}`,
    })
  }
  return out
}

/** Indeed/Wellfound digests vary more — generic fallback: job-link anchors with sane titles. */
export function parseGenericAlert(html: string): AlertJob[] {
  const out: AlertJob[] = []
  const seen = new Set<string>()
  const anchorRe = /<a[^>]+href="(https?:\/\/[^"]*(?:indeed\.com\/(?:rc\/clk|viewjob|pagead)|wellfound\.com\/(?:jobs|l\/)|angel\.co\/l\/)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = anchorRe.exec(html)) !== null) {
    const title = textOf(m[2])
    if (!title || title.length < 6 || title.length > 90 || /apply|view|see (all|more)|unsubscribe|settings/i.test(title)) continue
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const tail = textOf(html.slice(m.index + m[0].length, m.index + m[0].length + 400))
    const line = tail.match(/^([^·•|–-]{2,60})(?:[·•|–-]\s*([^·•|]{2,60}))?/)
    out.push({
      externalId: `t${Math.abs(hash(title))}`,
      title,
      company: (line?.[1] ?? '').trim() || 'Unknown company',
      location: (line?.[2] ?? '').trim(),
      url: m[1].split('&utm')[0],
    })
  }
  return out
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

export function alertToJob(a: AlertJob, publisher: string, now = new Date().toISOString()): Job {
  return {
    id: `mail-alert:${a.externalId}`,
    source: 'mail-alert',
    externalId: a.externalId,
    company: a.company,
    title: a.title,
    location: a.location,
    url: a.url,
    // Thin JD by design — LinkedIn pages have no lawful fetch; he pastes the JD when tailoring.
    jd: `${a.title} at ${a.company}. ${a.location ? `Location: ${a.location}. ` : ''}Surfaced by your own ${publisher} email — open the posting for the full description (paste it in when tailoring).`,
    fetchedAt: now,
    updatedAt: now, // an alert IS fresh — that's the whole point of the lane
    publisher,
    status: 'found',
  }
}

export interface AlertSweepResult {
  alerts: number
  jobsParsed: number
  added: number
  duplicate: number
  /** Alerts that parsed to zero jobs — counted + linked, never silently dropped. */
  unparsed: { id: string; subject: string; gmailUrl: string }[]
  authExpired?: boolean
}

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const SEEN_KEY = 'dak:alerts:seen'

async function seenIds(): Promise<Set<string>> {
  try {
    const row = await db.nabzCache.get(SEEN_KEY)
    return new Set(row ? (JSON.parse(row.json) as string[]) : [])
  } catch {
    return new Set()
  }
}
async function saveSeen(ids: Set<string>): Promise<void> {
  const arr = [...ids].slice(-300) // bounded (Class F law)
  await db.nabzCache.put({ key: SEEN_KEY, json: JSON.stringify(arr), fetchedAt: new Date().toISOString() })
}

function b64urlDecode(data: string): string {
  try {
    return decodeURIComponent(
      atob(data.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
  } catch {
    try {
      return atob(data.replace(/-/g, '+').replace(/_/g, '/'))
    } catch {
      return ''
    }
  }
}

interface GmailPart {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPart[]
}
export function htmlOfPayload(p: GmailPart | undefined): string {
  // HTML-first across the WHOLE tree, then any text/* — a flat one-pass walk returned the
  // text/plain sibling before the text/html part (caught by this module's first gate run).
  const find = (node: GmailPart | undefined, mime: string): string => {
    if (!node) return ''
    if (node.mimeType?.startsWith(mime) && node.body?.data) return b64urlDecode(node.body.data)
    for (const part of node.parts ?? []) {
      const h = find(part, mime)
      if (h) return h
    }
    return ''
  }
  return find(p, 'text/html') || find(p, 'text/')
}

/** Sweep job-alert emails → candidate jobs through the SAME ingest door as every lane. */
export async function sweepAlerts(): Promise<AlertSweepResult> {
  const empty: AlertSweepResult = { alerts: 0, jobsParsed: 0, added: 0, duplicate: 0, unparsed: [] }
  const token = getAccessToken()
  if (!token) return empty

  const get = async <T>(path: string): Promise<T | null> => {
    let res: Response
    try {
      res = await fetch(`${GMAIL_API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    } catch {
      return null
    }
    if (res.status === 401 || res.status === 403) throw new GmailAuthError('gmail token expired')
    if (!res.ok) return null
    try {
      return (await res.json()) as T
    } catch {
      return null
    }
  }

  try {
    const list = await get<{ messages?: { id: string }[] }>(`/messages?q=${encodeURIComponent(ALERT_QUERY)}&maxResults=15`)
    const ids = list?.messages?.map((m) => m.id) ?? []
    const seen = await seenIds()
    const fresh = ids.filter((id) => !seen.has(id))
    if (fresh.length === 0) return empty

    const discovered: Job[] = []
    const unparsed: AlertSweepResult['unparsed'] = []
    let alerts = 0
    for (const id of fresh) {
      const msg = await get<{ id: string; payload?: GmailPart & { headers?: { name: string; value: string }[] } }>(`/messages/${id}?format=full`)
      if (!msg) continue
      alerts++
      seen.add(id)
      const from = msg.payload?.headers?.find((h) => h.name.toLowerCase() === 'from')?.value ?? ''
      const subject = msg.payload?.headers?.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '(no subject)'
      const sender = ALERT_SENDERS.find((s) => s.re.test(from))
      const html = htmlOfPayload(msg.payload)
      const parsed = sender?.publisher === 'LinkedIn alert' ? parseLinkedInAlert(html) : parseGenericAlert(html)
      if (parsed.length === 0) {
        unparsed.push({ id, subject, gmailUrl: `https://mail.google.com/mail/u/0/#all/${id}` })
        continue
      }
      for (const a of parsed) discovered.push(alertToJob(a, sender?.publisher ?? 'job alert'))
    }
    await saveSeen(seen)

    const workAuth = (await db.settings.get('app'))?.visionProfile?.workAuth
    const merge = mergeDiscovered(discovered, await db.jobs.toArray(), workAuth ?? undefined)
    await db.jobs.bulkPut(merge.toPersist)
    return { alerts, jobsParsed: discovered.length, added: merge.added, duplicate: merge.duplicate, unparsed }
  } catch (e) {
    if (e instanceof GmailAuthError) return { ...empty, authExpired: true }
    return empty
  }
}
