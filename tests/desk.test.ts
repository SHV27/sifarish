import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/db/db'
import { SEED_LEDGER, SEED_IDENTITY } from './helpers'
import { suggestStage, buildCards, confirmStage, RECEIVED_RE, REVIEW_RE } from '../src/lib/dak/watch'
import { seedDemoShowcase, SHOWCASE_JOB_ID, showcaseJob } from '../src/lib/showcase/babaclick'
import type { Job } from '../src/types'
import type { MailMeta } from '../src/lib/dak/watch'

/**
 * v2 Arc 4 — THE DESK gates. Gmail signals (received / under review) are stamped as signals and
 * never move the pipeline; verdicts still need his confirmation. The demo's worked example compiles
 * keyless with a reading + plan so a recruiter reads the product cold.
 */

const meta = (subject: string, snippet = '', from = 'careers@acme.com'): MailMeta => ({ id: `m-${subject.replace(/\W+/g, '-')}`, from, subject, date: '2026-09-05', snippet })
const job = (over: Partial<Job> = {}): Job => ({ id: 'j-acme', source: 'paste', company: 'Acme', title: 'AI Engineer Intern', location: '', url: 'https://acme.com/jobs/1', jd: 'x', fetchedAt: '2026-09-01', status: 'applied', ...over })

describe('signals from the inbox — received / under review are signals, not stages', () => {
  it('reads the auto-ack and the review mail; a rejection still outranks both', () => {
    expect(suggestStage(meta('Thank you for applying to Acme'))).toBe('received')
    expect(suggestStage(meta('Your application was received'))).toBe('received')
    expect(suggestStage(meta('Update on your application', 'Your application is currently under review by our team.'))).toBe('under-review')
    expect(suggestStage(meta('Your application', 'Unfortunately, we will not be moving forward with your application.'))).toBe('rejected')
    expect(suggestStage(meta('Interview availability', 'Can you share your availability for a phone screen?'))).toBe('interview')
    expect(RECEIVED_RE.test('random newsletter about hiring trends')).toBe(false)
    expect(REVIEW_RE.test('please review our updated privacy policy')).toBe(false)
  })
  it('cards carry the suggestion; confirming a "received" card never moves the pipeline, confirming "interview" does', async () => {
    await db.jobs.clear()
    await db.dak.clear()
    await db.jobs.put(job())
    const cards = buildCards([meta('Thank you for applying to Acme — application received', '', 'no-reply@acme.com'), meta('Acme interview: next steps', 'schedule a call', 'recruiter@acme.com')], await db.jobs.toArray())
    expect(cards.length).toBe(2)
    const received = cards.find((c) => c.stageSuggestion === 'received')!
    const interview = cards.find((c) => c.stageSuggestion === 'interview')!
    expect(received && interview).toBeTruthy()
    for (const c of cards) await db.dak.put(c)
    await confirmStage(received)
    expect((await db.jobs.get('j-acme'))?.status).toBe('applied')
    await confirmStage(interview)
    expect((await db.jobs.get('j-acme'))?.status).toBe('interview')
  })
})

describe('the demo worked example', () => {
  beforeEach(async () => {
    await db.ledger.clear()
    await db.jobs.clear()
    await db.packets.clear()
    await db.nabzCache.clear()
    await db.ledger.bulkPut(SEED_LEDGER)
    await db.identity.put(SEED_IDENTITY)
  })
  it('seeds a Babaclick job + a keyless packet with a reading and a plan; idempotent', async () => {
    expect(showcaseJob().jd).toMatch(/We do not care about/)
    expect(await seedDemoShowcase()).toBe(false) // owner mode (the suite's frozen mode): never seeded
    expect(await seedDemoShowcase({ force: true })).toBe(true)
    const j = await db.jobs.get(SHOWCASE_JOB_ID)
    expect(j?.status).toBe('tailored')
    const p = (await db.packets.where('jobId').equals(SHOWCASE_JOB_ID).toArray())[0]
    expect(p?.plan && p?.reading).toBeTruthy()
    expect(p!.reading!.doesNotCare.some((q) => /leetcode/i.test(q.phrase))).toBe(true)
    expect(p!.plan!.benched.some((b) => /certificates/i.test(b.reason))).toBe(true)
    expect(p!.strategistMode).toBe('heuristic')
    expect(p!.resume.lines.some((l) => l.kind === 'headline')).toBe(true)
    expect(await seedDemoShowcase({ force: true })).toBe(false) // idempotent
  })
})
