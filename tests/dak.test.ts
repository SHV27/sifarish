import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { buildCards, matchMail, suggestStage, companySlug, type MailMeta } from '../src/lib/dak/watch'
import { GMAIL_SCOPE } from '../src/lib/dak/gis'
import { nudgeState } from '../src/lib/morcha'
import type { Job } from '../src/types'

/** P15 gates — Dak Khana: mocked Gmail fixtures + the zero-send-capability proof. */

function job(company: string, status: Job['status'], appliedDaysAgo = 10): Job {
  return {
    id: `job-${company.toLowerCase().replace(/\W+/g, '')}`,
    source: 'paste',
    company,
    title: 'AI Intern',
    location: '',
    url: `https://example.com/${company}`,
    jd: '',
    fetchedAt: new Date().toISOString(),
    appliedAt: new Date(Date.now() - appliedDaysAgo * 86400000).toISOString(),
    status,
  }
}

const JOBS: Job[] = [job('Sarvam AI', 'applied'), job('LangChain', 'followup'), job('Anthropic', 'interview'), job('Groq', 'found')]

const FIXTURES: MailMeta[] = [
  {
    id: 'm1',
    from: 'Recruiting Team <careers@sarvam.ai>',
    subject: 'Next steps — AI Intern application',
    date: 'Fri, 10 Jul 2026 10:00:00 +0530',
    snippet: 'Thanks for applying! We would like to schedule a call to discuss your application. Please share your availability…',
  },
  {
    id: 'm2',
    from: 'no-reply@us.greenhouse-mail.io',
    subject: 'Your application to LangChain',
    date: 'Sat, 11 Jul 2026 08:00:00 +0530',
    snippet: 'Unfortunately we will not be moving forward with your application at this time…',
  },
  {
    id: 'm3',
    from: 'LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>',
    subject: 'New jobs posted: 25 AI intern roles for you',
    date: 'Sat, 11 Jul 2026 09:00:00 +0530',
    snippet: 'Apply now to 25 new roles matching your profile…',
  },
  {
    id: 'm4',
    from: 'Anthropic Recruiting <recruiting@anthropic.com>',
    subject: 'Interview confirmation',
    date: 'Sun, 12 Jul 2026 09:00:00 +0530',
    snippet: 'Your interview is confirmed for Tuesday. The next round will cover systems design…',
  },
  {
    id: 'm5',
    from: 'random person <someone@gmail.com>',
    subject: 'lunch?',
    date: 'Sun, 12 Jul 2026 10:00:00 +0530',
    snippet: 'kal free ho?',
  },
]

describe('Dak Khana — reply detection on mocked fixtures', () => {
  it('matches company-domain mail to the right pipeline job', () => {
    expect(matchMail(FIXTURES[0], JOBS)?.company).toBe('Sarvam AI')
    expect(matchMail(FIXTURES[3], JOBS)?.company).toBe('Anthropic')
  })

  it('matches ATS-relay mail (greenhouse) via company name in subject', () => {
    expect(matchMail(FIXTURES[1], JOBS)?.company).toBe('LangChain')
  })

  it('ignores job-alert noise and unrelated personal mail', () => {
    expect(matchMail(FIXTURES[2], JOBS)).toBeUndefined()
    expect(matchMail(FIXTURES[4], JOBS)).toBeUndefined()
  })

  it('suggests stage moves conservatively (interview / rejected / none)', () => {
    expect(suggestStage(FIXTURES[0])).toBe('interview') // "schedule a call" + availability
    expect(suggestStage(FIXTURES[1])).toBe('rejected')
    expect(suggestStage(FIXTURES[4])).toBeUndefined()
  })

  it('buildCards only watches pipeline stages (found jobs are not watched)', () => {
    const groqMail: MailMeta = {
      id: 'm6',
      from: 'team@groq.com',
      subject: 'Welcome to our newsletter',
      date: '',
      snippet: 'Groq updates…',
    }
    const cards = buildCards([...FIXTURES, groqMail], JOBS)
    expect(cards.map((c) => c.company).sort()).toEqual(['Anthropic', 'LangChain', 'Sarvam AI'])
    for (const c of cards) {
      expect(c.gmailUrl).toContain('mail.google.com') // deep link OUT to Gmail — reading/replying happens there (I3)
      expect(c.status).toBe('pending') // owner confirms; nothing moves itself
    }
  })

  it('companySlug drops generic suffixes', () => {
    expect(companySlug('Sarvam AI')).toBe('sarvam')
    expect(companySlug('LangChain')).toBe('langchain')
  })
})

describe('Dak Khana — nudge auto-clear (a reply means stop poking them)', () => {
  it('day-7 nudge clears once a reply is detected', () => {
    const j = job('Sarvam AI', 'applied', 8)
    expect(nudgeState(j).due).toBe(true)
    const heard = { ...j, replyDetectedAt: new Date().toISOString() }
    expect(nudgeState(heard).due).toBe(false)
  })
})

describe('Dak Khana — ZERO send capability (I3, proven at the source level)', () => {
  it('the only Gmail scope in the app is gmail.readonly', () => {
    expect(GMAIL_SCOPE).toBe('https://www.googleapis.com/auth/gmail.readonly')
  })

  it('no send-capable scope, endpoint, or SMTP reference anywhere in src/ or api/', () => {
    const banned = [
      'gmail.send',
      'gmail.compose',
      'gmail.modify',
      'gmail.insert', // (Session 5.5) draft/insert-based send paths — I3 defense-in-depth
      'drafts.create',
      '/drafts/send',
      'settings.sendas',
      'batchmodify',
      'mail.google.com/auth', // full-access scope
      '/messages/send',
      'smtp://',
      'nodemailer',
      'sendmail',
    ]
    const files: string[] = []
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(f)) files.push(p)
      }
    }
    walk('src')
    walk('api')
    for (const f of files) {
      const text = readFileSync(f, 'utf8').toLowerCase()
      for (const b of banned) {
        expect(text.includes(b), `${f} contains banned send-capable reference "${b}"`).toBe(false)
      }
    }
  })
})

// ============================================================================================
// Session 5.5 — Dak matcher fixes (audit bugs A1 + A4)
// ============================================================================================
describe('Dak — matcher fixes (Session 5.5)', () => {
  const mail = (from: string, subject: string, snippet: string): MailMeta => ({ id: 'x', from, subject, date: 'Fri, 10 Jul 2026 10:00:00 +0530', snippet })

  it('A1: a rejection that MENTIONS the interview is classified rejected, not interview', () => {
    const m = mail('careers@x.com', 'Update on your application', 'Thank you for interviewing with us. Unfortunately, we won\'t be moving forward at this time.')
    expect(suggestStage(m)).toBe('rejected')
  })
  it('A1: a weak "unfortunately" next to a real interview cue stays interview', () => {
    const m = mail('careers@x.com', 'Interview reschedule', 'Unfortunately our interviewer is out sick; let us reschedule your interview for Friday.')
    expect(suggestStage(m)).toBe('interview')
  })

  it('A4: substring domains no longer false-match (scaleway.com ⊄ "Scale AI", clever.com ⊄ "Lever")', () => {
    const scaleway = mail('noreply@scaleway.com', 'Your cloud invoice', 'Your Scaleway account statement is ready.')
    expect(matchMail(scaleway, [job('Scale AI', 'applied')])).toBeUndefined()
    const clever = mail('team@clever.com', 'Clever product update', 'Whats new this month.')
    expect(matchMail(clever, [job('Lever', 'applied')])).toBeUndefined()
  })
  it('A4: the real company domain still matches at a label boundary', () => {
    const legit = mail('jobs@lever.co', 'Your Lever application', 'Thanks for applying.')
    expect(matchMail(legit, [job('Lever', 'applied')])?.company).toBe('Lever')
  })
})
