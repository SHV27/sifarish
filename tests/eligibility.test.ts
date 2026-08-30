import { describe, expect, it } from 'vitest'
import { assessEligibility, isIneligible, withEligibility } from '../src/lib/khabri/eligibility'
import { mergeDiscovered } from '../src/lib/khabri/normalize'
import type { Job } from '../src/types'
import { readFileSync } from 'node:fs'

/**
 * HAQ FILTER gates (re-brief Pillar 3) — two-sided honesty: the guard is tested for
 * accepting the true AND rejecting the false, the day it ships (ARCHITECTURE.md law).
 */

const base = (over: Partial<Job>): Job => ({
  id: 'j1',
  source: 'remotive',
  company: 'Acme',
  title: 'AI Engineer',
  location: '',
  url: 'https://example.com',
  jd: '',
  fetchedAt: new Date().toISOString(),
  status: 'found',
  ...over,
})

describe('Haq eligibility — false-SHOW side (confirmed restrictions must hide)', () => {
  it('Remotive geo field "USA Only" → ineligible, source field', () => {
    const v = assessEligibility(base({ location: 'USA Only' }))
    expect(v.verdict).toBe('ineligible')
    expect(v.source).toBe('field')
  })
  it('Jobicy geo "Europe" → ineligible; "Canada" → ineligible', () => {
    expect(assessEligibility(base({ source: 'jobicy', location: 'Europe' })).verdict).toBe('ineligible')
    expect(assessEligibility(base({ source: 'jobicy', location: 'Canada' })).verdict).toBe('ineligible')
  })
  it('"U.S. citizens only" JD → ineligible with the phrase in the reason', () => {
    const v = assessEligibility(base({ source: 'greenhouse', jd: 'Applicants must note: US citizens only for this position.' }))
    expect(v.verdict).toBe('ineligible')
    expect(v.reason.toLowerCase()).toContain('citizens')
  })
  it('security clearance / ITAR → ineligible', () => {
    expect(assessEligibility(base({ source: 'lever', jd: 'Active TS/SCI security clearance required.' })).verdict).toBe('ineligible')
    expect(assessEligibility(base({ source: 'lever', jd: 'This role is subject to ITAR requirements.' })).verdict).toBe('ineligible')
  })
  it('"must be authorized to work in the United States" without sponsorship → ineligible', () => {
    const v = assessEligibility(base({ source: 'ashby', location: 'New York', jd: 'You must be legally authorized to work in the United States.' }))
    expect(v.verdict).toBe('ineligible')
  })
  it('no-sponsorship negation ("we are unable to sponsor visas") on a US role → ineligible', () => {
    const v = assessEligibility(base({ source: 'greenhouse', location: 'San Francisco', jd: 'Note that we are unable to sponsor visas at this time.' }))
    expect(v.verdict).toBe('ineligible')
  })
  it('Simplify "(No Sponsorship)" title suffix / "Does Not Offer Sponsorship" → ineligible', () => {
    expect(assessEligibility(base({ source: 'simplify', title: 'Software Engineer Intern (No Sponsorship)', location: 'Austin, TX' })).verdict).toBe('ineligible')
    expect(assessEligibility(base({ source: 'simplify', location: 'Seattle, WA', jd: 'Sponsorship: Does Not Offer Sponsorship. Internship listing.' })).verdict).toBe('ineligible')
  })
  it('remote but region-locked ("Remote (US)", "remote within the EU") → ineligible', () => {
    expect(assessEligibility(base({ source: 'greenhouse', jd: 'This position is Remote (US) with quarterly onsites.' })).verdict).toBe('ineligible')
    expect(assessEligibility(base({ source: 'lever', jd: 'You can work remote within the EU.' })).verdict).toBe('ineligible')
  })
  it('OPT/CPT explicitly excluded → ineligible', () => {
    expect(assessEligibility(base({ source: 'greenhouse', jd: 'Please note OPT and CPT candidates are not eligible for this role.' })).verdict).toBe('ineligible')
  })
})

describe('Haq eligibility — false-HIDE side (the true must stay visible)', () => {
  it('"visa sponsorship available" is NEVER hidden — the positive guard', () => {
    const v = assessEligibility(base({ source: 'greenhouse', location: 'Berlin', jd: 'Visa sponsorship available for exceptional candidates. You must be authorized to work in Germany or we will sponsor you.' }))
    expect(v.verdict).not.toBe('ineligible')
  })
  it('worldwide/anywhere remote → eligible', () => {
    expect(assessEligibility(base({ location: 'Worldwide' })).verdict).toBe('eligible')
    expect(assessEligibility(base({ source: 'greenhouse', location: 'Remote', jd: 'Work from anywhere on earth. Async-first.' })).verdict).toBe('eligible')
  })
  it('India roles → eligible (onsite AND remote)', () => {
    expect(assessEligibility(base({ source: 'greenhouse', location: 'Bengaluru, India' })).verdict).toBe('eligible')
    expect(assessEligibility(base({ source: 'jobicy', location: 'APAC' })).verdict).toBe('eligible')
  })
  it('a plain remote role with no signals → eligible with source none (never punished on a guess)', () => {
    const v = assessEligibility(base({ source: 'greenhouse', location: 'Remote', jd: 'Build agents with LLMs. Great team.' }))
    expect(v.verdict).toBe('eligible')
    expect(v.source).toBe('none')
  })
  it('foreign ON-SITE with no signals demotes (ambiguous) — it does NOT hide', () => {
    const v = assessEligibility(base({ source: 'greenhouse', location: 'London', jd: 'Work from our London office five days a week.' }))
    expect(v.verdict).toBe('ambiguous')
  })
  it('OPT/CPT welcome → ambiguous (US-targeted), never ineligible', () => {
    expect(assessEligibility(base({ source: 'greenhouse', location: 'Remote', jd: 'OPT/CPT candidates welcome to apply.' })).verdict).toBe('ambiguous')
  })
  it('negation in ANOTHER sentence cannot kill a sponsor mention ("no problem… we sponsor visas")', () => {
    const v = assessEligibility(base({ source: 'greenhouse', location: 'Amsterdam', jd: 'No prior LLM experience? Not a problem. We sponsor visas and support relocation.' }))
    expect(v.verdict).not.toBe('ineligible')
  })
})

describe('Haq wiring — the verdict rides ingest and the owner outranks it', () => {
  it('mergeDiscovered stamps eligibility on every new job', () => {
    const merge = mergeDiscovered([base({ id: 'n1', location: 'USA Only' }), base({ id: 'n2', company: 'Zeta', title: 'LLM Engineer', location: 'Worldwide' })], [])
    expect(merge.toPersist.every((j) => j.eligibility)).toBe(true)
    expect(merge.toPersist.find((j) => j.id === 'n1')?.eligibility?.verdict).toBe('ineligible')
    expect(merge.toPersist.find((j) => j.id === 'n2')?.eligibility?.verdict).toBe('eligible')
  })
  it('isIneligible: owner override wins over a confirmed verdict', () => {
    const j = withEligibility(base({ location: 'USA Only' }))
    expect(isIneligible(j)).toBe(true)
    expect(isIneligible({ ...j, eligibilityOverride: true })).toBe(false)
  })
  it('a re-seen posting keeps an overridden verdict (merge does not re-stamp over his word)', () => {
    const existing = { ...withEligibility(base({ id: 'e1', location: 'USA Only' })), eligibilityOverride: true, dedupeKey: undefined }
    const merge = mergeDiscovered([base({ id: 'e1', location: 'USA Only', jd: 'now with new text' })], [existing])
    const out = merge.toPersist.find((j) => j.id === 'e1')!
    expect(out.eligibilityOverride).toBe(true)
    expect(isIneligible(out)).toBe(false)
  })
  it('SOURCE GATE: every discovery persist path runs finalizeIngest (not bare withDedupeKey)', () => {
    const feeds = readFileSync('src/lib/radar/feeds.ts', 'utf8')
    expect(feeds).toContain('finalizeIngest(')
    expect(feeds).not.toMatch(/withDedupeKey\(/)
    const paste = readFileSync('src/lib/radar/pasteLane.ts', 'utf8')
    expect(paste).toContain('finalizeIngest(')
    const queue = readFileSync('src/screens/Radar.tsx', 'utf8')
    expect(queue).toContain('isIneligible')
    expect(readFileSync('src/lib/briefing.ts', 'utf8')).toContain('isIneligible')
  })
})
