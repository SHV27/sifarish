import type { Identity, Job, LedgerEntry, Packet, VisionProfile } from '../../types'
import { TYPESET_VERSION } from '../darzi'

/**
 * APPLY COCKPIT — the per-packet dossier + PRE-FLIGHT check (re-brief Pillar 2).
 * All pure and deterministic: the cockpit adds ZERO metered surface. The pre-flight is
 * poka-yoke for "none lost because of a mistake at my end" — every check names its evidence.
 */

export interface DossierField {
  label: string
  value: string
}

export function buildDossierFields(identity: Identity, education: LedgerEntry[], vision?: VisionProfile, job?: Job): DossierField[] {
  const degreeEntry = education.find((e) => /b\.?tech|bachelor|degree/i.test(e.title)) ?? education[0]
  const fields: DossierField[] = [
    { label: 'Full name', value: identity.name },
    { label: 'Email', value: identity.email },
    { label: 'Phone', value: identity.phone },
    { label: 'LinkedIn', value: identity.linkedin.startsWith('http') ? identity.linkedin : `https://${identity.linkedin}` },
    { label: 'GitHub', value: identity.github.startsWith('http') ? identity.github : `https://${identity.github}` },
    { label: 'Location', value: identity.location },
  ]
  if (degreeEntry) {
    const meta = degreeEntry.summary || degreeEntry.evidence?.date || ''
    fields.push({ label: 'Education', value: `${degreeEntry.title}${meta ? ` (${meta})` : ''}` })
  }
  if (vision) {
    fields.push({
      label: 'Work authorization (honest answer)',
      value:
        `Authorized to work in ${(vision.workAuth?.authorizedIn ?? ['india']).map((c) => c[0].toUpperCase() + c.slice(1)).join(', ')}. ` +
        'For roles elsewhere: remote-from-India works today; on-site would need visa sponsorship.',
    })
    fields.push({ label: 'Availability', value: `Internship window ${vision.windowStart}–${vision.windowEnd}${vision.openToOctoberStart ? ' (earlier/October start possible)' : ''}.` })
    fields.push({ label: 'Expected stipend (floor, stated honestly)', value: `₹${vision.compFloorStipend.toLocaleString('en-IN')}/month or market equivalent.` })
  }
  if (job) fields.push({ label: 'Role applying for', value: `${job.title} — ${job.company}` })
  return fields
}

/** Email-application lane: a mailto: link when the JD itself asks for email applications. */
export function mailtoFromJd(job: Job, identity: Identity, outreachText: string): string | null {
  const jd = job.jd ?? ''
  const m = /(?:apply|send|resume|cv|application)[^.!?\n]{0,80}?([\w.+-]+@[\w-]+(?:\.[\w-]+)+)|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)[^.!?\n]{0,60}?(?:to apply|with your resume|with your cv)/i.exec(jd)
  const email = m?.[1] ?? m?.[2]
  if (!email) return null
  const subject = `Application — ${job.title} — ${identity.name}`
  const body = `${outreachText.slice(0, 1400)}\n\n(Resume and cover letter attached.)`
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// ---------------------------------------------------------------------------------------------

export interface PreflightCheck {
  id: 'work-auth' | 'register' | 'pay' | 'freshness' | 'link'
  label: string
  status: 'green' | 'amber' | 'red'
  why: string
}

export function preflight(job: Job, packet: Packet, vision?: VisionProfile, now = Date.now()): PreflightCheck[] {
  const checks: PreflightCheck[] = []

  // 1 · Work authorization — the check that has already cost him time once (VISION-BRIEF).
  const e = job.eligibility
  if (e?.verdict === 'ineligible' && !job.eligibilityOverride) {
    checks.push({ id: 'work-auth', label: 'Work authorization', status: 'red', why: e.reason })
  } else if (e?.verdict === 'ineligible' && job.eligibilityOverride) {
    checks.push({ id: 'work-auth', label: 'Work authorization', status: 'amber', why: `${e.reason} — you restored it; double-check before spending the effort.` })
  } else if (e?.verdict === 'ambiguous') {
    checks.push({ id: 'work-auth', label: 'Work authorization', status: 'amber', why: e.reason })
  } else {
    checks.push({ id: 'work-auth', label: 'Work authorization', status: 'green', why: e?.reason ?? 'no restriction signals found' })
  }

  // 2 · The page is current craft — an old-register export is a preventable own-goal.
  const current = (packet.typesetVersion ?? 1) >= TYPESET_VERSION
  checks.push({
    id: 'register',
    label: 'Resume register current',
    status: current ? 'green' : 'amber',
    why: current ? 'compiled under the current canon register' : 're-open the packet once — it re-tailors into the current register automatically',
  })

  // 3 · Pay vs his stated floor (never silent, never a guess).
  const hay = `${job.title} ${job.jd}`.toLowerCase()
  if (/\bunpaid\b|\bno stipend\b|\bwithout (a )?stipend\b/.test(hay)) {
    checks.push({ id: 'pay', label: 'Compensation', status: 'red', why: 'the posting says UNPAID — below your stated floor by definition' })
  } else if (job.salary) {
    checks.push({ id: 'pay', label: 'Compensation', status: 'green', why: `posting states: ${job.salary.slice(0, 60)}` })
  } else if (/stipend|salary|compensation|ctc|lpa|\$|₹|€|£/.test(hay)) {
    checks.push({ id: 'pay', label: 'Compensation', status: 'green', why: 'comp language present in the JD' })
  } else {
    checks.push({ id: 'pay', label: 'Compensation', status: 'amber', why: `no comp signal — worth asking early (your floor: ₹${vision?.compFloorStipend?.toLocaleString('en-IN') ?? '35,000'}/mo)` })
  }

  // 4 · Freshness / verified-open (the D65/D131 laws, surfaced at the moment of spend).
  const seenOpen = job.lastSeenOpenAt ? now - new Date(job.lastSeenOpenAt).getTime() : NaN
  const age = job.updatedAt ? Math.floor((now - new Date(job.updatedAt).getTime()) / 86400000) : NaN
  if (Number.isFinite(seenOpen) && seenOpen <= 10 * 86400000) {
    checks.push({ id: 'freshness', label: 'Posting freshness', status: 'green', why: 'its own board listed it open within the last 10 days — verified open' })
  } else if (!Number.isFinite(age)) {
    checks.push({ id: 'freshness', label: 'Posting freshness', status: 'amber', why: 'no posting date published — not penalised, but apply fast' })
  } else if (age <= 30) {
    checks.push({ id: 'freshness', label: 'Posting freshness', status: 'green', why: `posted ${age}d ago` })
  } else if (age <= 60) {
    checks.push({ id: 'freshness', label: 'Posting freshness', status: 'amber', why: `posted ${age}d ago — going cold` })
  } else {
    checks.push({ id: 'freshness', label: 'Posting freshness', status: 'red', why: `posted ${age}d ago and not board-verified — likely filled` })
  }

  // 5 · The apply link answers.
  checks.push(
    job.linkAlive === false
      ? { id: 'link', label: 'Apply link', status: 'red', why: 'the last probe found this link dead — find the live posting first' }
      : { id: 'link', label: 'Apply link', status: 'green', why: job.linkAlive ? 'probed alive' : 'not probed dead' },
  )

  return checks
}

export function preflightSummary(checks: PreflightCheck[]): { ok: boolean; line: string } {
  const red = checks.filter((c) => c.status === 'red')
  const amber = checks.filter((c) => c.status === 'amber')
  if (red.length > 0) return { ok: false, line: `${red.length} blocker${red.length > 1 ? 's' : ''} — read before you spend the effort` }
  if (amber.length > 0) return { ok: true, line: `clear, with ${amber.length} to double-check` }
  return { ok: true, line: 'all clear — go' }
}
