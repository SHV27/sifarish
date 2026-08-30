import { describe, expect, it } from 'vitest'
import { parseLinkedInAlert, parseGenericAlert, alertToJob, htmlOfPayload, ALERT_QUERY } from '../src/lib/dak/alerts'
import { mergeDiscovered } from '../src/lib/khabri/normalize'
import { readFileSync } from 'node:fs'

/** Representative LinkedIn job-alert HTML anatomy (anchor to /jobs/view/<id> = title; next text
 *  run = "Company · Location"). The fixture mirrors the real digests' structure. */
const LI_FIXTURE = `
<html><body>
<table><tr><td>
  <a href="https://www.linkedin.com/comm/jobs/view/4012345678?trackingId=abc&refId=xyz" style="color:#0a66c2">
    <strong>AI Engineer</strong>
  </a>
  <p>Netomi &middot; Gurugram, Haryana, India (Remote)</p>
</td></tr>
<tr><td>
  <a href="https://www.linkedin.com/comm/jobs/view/4098765432?trk=email">Agentic AI Intern</a>
  <span>Sarvam AI · Bengaluru, Karnataka, India</span>
</td></tr>
<tr><td>
  <a href="https://www.linkedin.com/comm/jobs/view/4012345678?dup=1">AI Engineer</a>
  <span>Netomi · Gurugram</span>
</td></tr>
<tr><td><a href="https://www.linkedin.com/comm/jobs/view/4055555555">See all jobs</a></td></tr>
<tr><td><a href="https://www.linkedin.com/settings">Unsubscribe</a></td></tr>
</table></body></html>`

describe('Alert lane — LinkedIn digest parsing (pure core)', () => {
  it('extracts title/company/location/canonical URL; dedupes; skips nav anchors', () => {
    const jobs = parseLinkedInAlert(LI_FIXTURE)
    expect(jobs).toHaveLength(2)
    expect(jobs[0]).toMatchObject({
      externalId: '4012345678',
      title: 'AI Engineer',
      company: 'Netomi',
      url: 'https://www.linkedin.com/jobs/view/4012345678',
    })
    expect(jobs[0].location).toContain('Gurugram')
    expect(jobs[1].company).toBe('Sarvam AI')
  })
  it('an alert with no job links parses to zero (the caller counts it as unparsed)', () => {
    expect(parseLinkedInAlert('<html><body><p>Your alert settings changed.</p></body></html>')).toHaveLength(0)
  })
})

describe('Alert lane — generic (Indeed/Wellfound) fallback', () => {
  it('extracts sane job anchors, skips boilerplate anchors', () => {
    const html = `
      <a href="https://in.indeed.com/rc/clk?jk=abc123&from=ja">Machine Learning Engineer Intern</a>
      <div>Fractal · Mumbai</div>
      <a href="https://in.indeed.com/rc/clk?jk=def">Apply now</a>
      <a href="https://wellfound.com/jobs/3001-ai-engineer?utm_source=alert">AI Engineer</a><span>PolyAI – Remote</span>`
    const jobs = parseGenericAlert(html)
    expect(jobs.map((j) => j.title)).toEqual(['Machine Learning Engineer Intern', 'AI Engineer'])
    expect(jobs[1].url).toBe('https://wellfound.com/jobs/3001-ai-engineer?utm_source=alert'.split('&utm')[0])
  })
})

describe('Alert lane — jobs enter through the SAME ingest door', () => {
  it('alertToJob → mergeDiscovered stamps dedupeKey + Haq eligibility; India alert is eligible', () => {
    const a = parseLinkedInAlert(LI_FIXTURE)[0]
    const job = alertToJob(a, 'LinkedIn alert')
    expect(job.source).toBe('mail-alert')
    expect(job.updatedAt).toBeTruthy() // an alert is fresh — no staleness ghost
    const merge = mergeDiscovered([job], [])
    expect(merge.added).toBe(1)
    expect(merge.toPersist[0].dedupeKey).toBeTruthy()
    expect(merge.toPersist[0].eligibility?.verdict).toBe('eligible')
  })
  it('a US-locked alert role is hidden by the Haq filter like any other lane', () => {
    const job = alertToJob({ externalId: '9', title: 'ML Intern', company: 'Acme', location: 'New York, United States', url: 'https://www.linkedin.com/jobs/view/9' }, 'LinkedIn alert')
    const withJd = { ...job, jd: job.jd + ' Must be authorized to work in the United States.' }
    expect(mergeDiscovered([withJd], []).toPersist[0].eligibility?.verdict).toBe('ineligible')
  })
})

describe('Alert lane — mechanics + I3 boundary', () => {
  it('htmlOfPayload walks nested parts and decodes base64url', () => {
    const html = '<a href="https://www.linkedin.com/jobs/view/123456">Test</a>'
    const data = Buffer.from(html, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
    expect(htmlOfPayload({ mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', body: { data: 'aGk=' } }, { mimeType: 'text/html', body: { data } }] })).toBe(html)
  })
  it('the lane is READ-only: no send/compose/modify scope or endpoint strings in alerts.ts', () => {
    const src = readFileSync('src/lib/dak/alerts.ts', 'utf8')
    for (const banned of ['gmail.send', 'gmail.compose', 'gmail.modify', 'drafts', '/send', 'batchModify']) {
      expect(src.toLowerCase()).not.toContain(banned.toLowerCase())
    }
    expect(ALERT_QUERY).toContain('linkedin.com')
  })
})
