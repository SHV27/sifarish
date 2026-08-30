import { describe, expect, it } from 'vitest'
import { buildBookmarklet, buildProfile } from '../src/lib/cockpit/bookmarklet'
import { buildDossierFields, mailtoFromJd, preflight, preflightSummary } from '../src/lib/cockpit/dossier'
import { TYPESET_VERSION } from '../src/lib/darzi'
import type { Identity, Job, LedgerEntry, Packet, VisionProfile } from '../src/types'

/**
 * APPLY COCKPIT gates (re-brief Pillar 2). The bookmarklet's limits are STRUCTURAL — proven
 * on the artifact, not promised (the I3 discipline extended to generated client code).
 */

const identity: Identity = {
  id: 'me', name: 'Shaurya Verma', email: 's@x.com', phone: '+91-90000', github: 'github.com/SHV27',
  linkedin: 'linkedin.com/in/shv', location: 'Patiala, Punjab, India', headline: 'AI engineer',
}
const edu: LedgerEntry[] = [
  { id: 'e1', kind: 'education', title: 'B.Tech Computer Science — Thapar Institute', summary: '2023–2027 · CGPA 7.7', bullets: [], tier: 'shipped', evidence: { date: '05/2027', note: '' }, tags: [], resumeEligible: true },
]
const vision: VisionProfile = {
  dream: 'x', targetRoles: ['AI Engineer Intern'], notInterested: [], compFloorStipend: 35000, ppoFloorLpa: 16,
  windowStart: 'Jan 2027', windowEnd: 'May 2027', remoteInternational: true, openToOctoberStart: true,
  workAuth: { home: 'india', authorizedIn: ['india'], remoteOk: true },
}
const job = (over: Partial<Job>): Job => ({
  id: 'j1', source: 'greenhouse', company: 'Acme', title: 'AI Intern', location: 'Remote', url: 'https://a',
  jd: 'Build agents. Stipend paid.', fetchedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'tailored', ...over,
})
const packet = (over: Partial<Packet> = {}): Packet =>
  ({ id: 'p1', jobId: 'j1', createdAt: new Date().toISOString(), typesetVersion: TYPESET_VERSION, resume: { lines: [], jobId: 'j1' }, coverLetter: { paragraphs: [] }, outreach: { paragraphs: [{ text: 'Namaste — I built the tool that compiled this.' }] }, gapNote: [], ...over }) as Packet

describe('bookmarklet — structural limits proven on the artifact', () => {
  const url = buildBookmarklet(buildProfile(identity, edu))
  const src = decodeURIComponent(url.replace(/^javascript:/, ''))
  it('is a javascript: URL that fills and reports — and can do NOTHING else', () => {
    expect(url.startsWith('javascript:')).toBe(true)
    for (const banned of ['fetch(', 'XMLHttpRequest', 'WebSocket', '.submit(', 'click(', 'location.href', 'window.open', 'import(', 'eval(']) {
      expect(src).not.toContain(banned)
    }
    // No secrets, no API paths — identity facts only.
    for (const banned of ['api/', 'x-sifarish', 'gsk_', 'AIza', 'Bearer']) expect(src).not.toContain(banned)
  })
  it('demographic/self-ID fields are DENY-listed and matching is word-bounded (the live "ethniCITY" bug)', () => {
    expect(src).toContain('DENY=/(gender|race|ethnic|hispanic|veteran|disab|pronoun|orientation|religio|caste)/')
    expect(src).toContain('hasWord') // substring matching is dead — word boundaries only
  })
  it('never overwrites what he typed, skips files/checkboxes/radios/passwords, and never answers auth questions', () => {
    expect(src).toContain('if(el.value&&el.value.trim().length>0)return;')
    for (const t of ['"hidden"', '"file"', '"checkbox"', '"radio"', '"password"']) expect(src).toContain(t)
    for (const never of ['sponsor', 'authorized to work', 'visa', 'citizen']) expect(src.toLowerCase()).not.toContain(never)
  })
  it('profile carries normalized links + split name + education facts', () => {
    const p = buildProfile(identity, edu)
    expect(p).toMatchObject({ firstName: 'Shaurya', lastName: 'Verma', linkedin: 'https://linkedin.com/in/shv', school: 'Thapar Institute', degree: 'B.Tech Computer Science' })
  })
})

describe('pre-flight — two-sided (blocks the bad, passes the good)', () => {
  it('all-green on a fresh, eligible, paid, current packet', () => {
    const checks = preflight(job({ eligibility: { verdict: 'eligible', reason: 'India named', source: 'field' }, salary: '₹40k/mo' }), packet(), vision)
    expect(checks.every((c) => c.status === 'green')).toBe(true)
    expect(preflightSummary(checks).ok).toBe(true)
  })
  it('red-flags: ineligible work-auth · unpaid · dead link · 90d-old ghost', () => {
    const checks = preflight(
      job({
        eligibility: { verdict: 'ineligible', reason: 'US citizens only', source: 'jd-text' },
        jd: 'This is an unpaid internship.',
        linkAlive: false,
        updatedAt: new Date(Date.now() - 90 * 86400000).toISOString(),
      }),
      packet(),
      vision,
    )
    const byId = Object.fromEntries(checks.map((c) => [c.id, c.status]))
    expect(byId['work-auth']).toBe('red')
    expect(byId['pay']).toBe('red')
    expect(byId['link']).toBe('red')
    expect(byId['freshness']).toBe('red')
    expect(preflightSummary(checks).ok).toBe(false)
  })
  it('softens honestly: restored-by-owner → amber with the reason; board-verified-open beats age', () => {
    const restored = preflight(job({ eligibility: { verdict: 'ineligible', reason: 'US only', source: 'field' }, eligibilityOverride: true }), packet(), vision)
    expect(restored.find((c) => c.id === 'work-auth')?.status).toBe('amber')
    const verified = preflight(job({ updatedAt: new Date(Date.now() - 90 * 86400000).toISOString(), lastSeenOpenAt: new Date().toISOString() }), packet(), vision)
    expect(verified.find((c) => c.id === 'freshness')?.status).toBe('green')
  })
  it('old-register packet → amber with the self-healing instruction', () => {
    const checks = preflight(job({}), packet({ typesetVersion: 1 }), vision)
    expect(checks.find((c) => c.id === 'register')?.status).toBe('amber')
  })
})

describe('dossier + mailto lane', () => {
  it('fields carry the honest work-auth answer and the stated floor — never a fabricated yes', () => {
    const fields = buildDossierFields(identity, edu, vision, job({}))
    const auth = fields.find((f) => f.label.startsWith('Work authorization'))!
    expect(auth.value).toContain('Authorized to work in India')
    expect(auth.value).toContain('sponsorship')
    expect(fields.find((f) => f.label.includes('stipend'))?.value).toContain('35,000')
  })
  it('mailto only when the JD itself asks; carries subject + outreach body; none otherwise', () => {
    const withEmail = job({ jd: 'To apply, send your resume to careers@acme.ai with a note.' })
    const m = mailtoFromJd(withEmail, identity, 'Namaste — short note.')
    expect(m).toContain('mailto:careers@acme.ai')
    expect(m).toContain(encodeURIComponent('AI Intern'))
    // A support address for QUESTIONS is not an application channel — correctly null (the
    // sentence boundary stops the apply-context window; caught by this gate's first run).
    expect(mailtoFromJd(job({ jd: 'Apply on our website. Contact support@acme.ai for questions.' }), identity, 'x')).toBeNull()
    expect(mailtoFromJd(job({ jd: 'Apply on our careers portal only.' }), identity, 'x')).toBeNull()
  })
})
