import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { cleanSummaryForDisplay, displayTitle, displayDate, compileResume } from '../src/lib/compile/compiler'
import { needsReforge } from '../src/components/RepairBanner'
import { FORGE_VERSION } from '../src/lib/nabz/forge'
import { distillReadme } from '../src/lib/nabz/github'
import { scoreJob } from '../src/lib/radar/score'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { SEED_IDENTITY, SEED_LEDGER, fakeJob } from './helpers'
import type { Job, LedgerEntry } from '../src/types'

/**
 * Session 6.1 — the owner's own résumé screenshot was the bug report: his VAULT carried
 * pre-repair data (old fallback bullets, markdown-polluted summaries) and no code deploy can
 * reach local-first data. These gates cover the repair loop + the display sanitizers + the
 * silent-downgrade guard + the discovery geography.
 */

// ---------- Display sanitization (his screenshot: "…vercel.app**", "▶ Live:", "(2026/07)") ----------

describe('S6.1 — the description line is recruiter-clean whatever the vault holds', () => {
  it('strips markdown residue, URLs, link labels and emoji from the summary', () => {
    const dirty = 'A job-hunt chief of staff that refuses to lie — ▶ Live: https://sifarish-shv-s-projects.vercel.app · Code: https://github.com/SHV27/sifarish · sifarish-shv-s-projects.vercel.app**'
    const clean = cleanSummaryForDisplay(dirty)
    expect(clean).toBe('A job-hunt chief of staff that refuses to lie')
  })

  it('strips the 🔴 status emoji line shape too', () => {
    const dirty = '🔴 Live (proof-of-concept) — A Punjabi-first, fully-free AI screening co-pilot for Punjab\'s government hospitals.'
    const clean = cleanSummaryForDisplay(dirty)
    expect(clean).toContain('A Punjabi-first')
    expect(clean).not.toMatch(/🔴|Live \(/)
  })

  it('a clean summary passes through untouched', () => {
    expect(cleanSummaryForDisplay('A flood-alert system for villages.')).toBe('A flood-alert system for villages.')
  })

  it('repo-slug titles lift to his project-name convention; real titles untouched', () => {
    expect(displayTitle('sifarish')).toBe('SIFARISH')
    expect(displayTitle('spark-core — portfolio cockpit')).toBe('SPARK-CORE — portfolio cockpit')
    expect(displayTitle('GLOAMING — The Board That Plays Back')).toBe('GLOAMING — The Board That Plays Back')
  })

  it('machine dates render as Month Year (the 8/8-ATS format)', () => {
    expect(displayDate('2026/07')).toBe('Jul 2026')
    expect(displayDate('07/2026')).toBe('Jul 2026')
    expect(displayDate('2026-07')).toBe('Jul 2026')
    expect(displayDate('2021')).toBe('2021')
  })

  it('the compiled meta line carries no markdown/URL junk end-to-end', () => {
    const polluted: LedgerEntry = {
      ...(SEED_LEDGER.find((e) => e.kind === 'project') as LedgerEntry),
      id: 'proj-dirty',
      title: 'sifarish',
      summary: 'A job-hunt chief of staff — ▶ Live: https://x.vercel.app · x.vercel.app**',
      evidence: { url: 'https://sifarish.example.app', date: '2026/07', note: 'live' },
    }
    const ledger = [...SEED_LEDGER, polluted]
    const decode = decodeJD('AI engineer. Must have: Python.')
    const coverage = matchEvidence(decode, ledger)
    const resume = compileResume({ identity: SEED_IDENTITY, ledger, decode, coverage, jobId: 'j' })
    const title = resume.lines.find((l) => l.kind === 'entry-title' && l.ledgerIds.includes('proj-dirty'))
    expect(title?.text).toContain('SIFARISH (Jul 2026)')
    const meta = resume.lines.find((l) => l.kind === 'meta' && l.ledgerIds.includes('proj-dirty'))
    expect(meta?.text).not.toMatch(/\*\*|▶|https?:\/\/.*https?:\/\//)
    expect(meta?.text).toContain('A job-hunt chief of staff')
  })
})

// ---------- The vault repair loop ----------

describe('S6.1 — the repair loop finds pre-repair entries', () => {
  const entry = (over: Partial<LedgerEntry>): LedgerEntry =>
    ({
      id: 'e', kind: 'project', title: 'X', summary: '', bullets: [], tier: 'shipped', tags: [],
      resumeEligible: true, evidence: { repo: 'https://github.com/SHV27/x', date: '2026/07', note: '' }, ...over,
    }) as LedgerEntry

  it('repo-backed projects with an older (or absent) forge version need re-forging', () => {
    expect(needsReforge([entry({})])).toHaveLength(1)
    expect(needsReforge([entry({ forgeVersion: FORGE_VERSION - 1 })])).toHaveLength(1)
    expect(needsReforge([entry({ forgeVersion: FORGE_VERSION })])).toHaveLength(0)
  })

  it('hand-written and repo-less entries are never touched', () => {
    expect(needsReforge([entry({ evidence: { date: '2025', note: '' } })])).toHaveLength(0)
    expect(needsReforge([entry({ kind: 'skill' })])).toHaveLength(0)
    expect(needsReforge([entry({ resumeEligible: false })])).toHaveLength(0)
  })
})

describe('S6.1 — the silent-downgrade guard + spacing exist in source (RC-class checks)', () => {
  const github = readFileSync('src/lib/nabz/github.ts', 'utf8')
  const nabzPanel = readFileSync('src/components/NabzPanel.tsx', 'utf8')
  const packet = readFileSync('src/screens/PacketScreen.tsx', 'utf8')

  it('a rate-limited re-forge never overwrites existing bullets', () => {
    expect(github).toMatch(/bullets are UNTOUCHED/)
    expect(github).toMatch(/expectedDimaag/)
  })
  it('the batch re-forge paces between real LLM passes (the D73 law, in-app)', () => {
    expect(nabzPanel).toMatch(/setTimeout\(res, 15000\)/)
  })
  it('a packet older than the last repair re-tailors itself on open', () => {
    expect(packet).toMatch(/lastReforgeAt/)
  })
})

// ---------- Forge: full-README guard + scrape register ban ----------

describe('S6.1 — the drift guard reads the FULL README; scrape-claims die', () => {
  it('distillReadme exposes the uncapped fullClean alongside the capped raw', () => {
    const big = `# Title\n\nIntro prose that survives.\n\n${'filler sentence here. '.repeat(900)}\n\nThe system uses HMAC-SHA256 signed cookies.`
    const d = distillReadme(big)
    expect(d.raw.length).toBeLessThanOrEqual(14000)
    expect(d.fullClean.length).toBeGreaterThan(d.raw.length)
    expect(d.fullClean).toContain('HMAC-SHA256')
  })

  it('the forge guards against fullClean and bans scrape-claims (source-level)', () => {
    const forge = readFileSync('src/lib/nabz/forge.ts', 'utf8')
    expect(forge).toMatch(/distilled\.fullClean \|\| distilled\.raw/)
    expect(forge).toMatch(/\\bscrap\(e\|es\|ed\|ing\)\\b/)
    expect(forge).toMatch(/NEVER OPEN with a project's internal codename/)
  })
})

// ---------- Discovery: geography + unpaid ----------

describe('S6.1 — unpaid postings can never hold a queue slot on keywords alone', () => {
  const rubric = { aiRelevance: 30, roleFit: 25, remoteIndia: 15, windowFit: 15, compSignal: 10, conviction: 5 }

  it('an explicitly unpaid posting takes a visible −20', () => {
    const j: Job = { ...fakeJob('X', 'AI Intern (Unpaid)', 'LLM agents RAG python. This is an unpaid internship.'), updatedAt: new Date().toISOString() }
    const s = scoreJob(j, SEED_LEDGER, rubric, false)
    const part = s.parts.find((p) => p.key === 'unpaid')
    expect(part?.points).toBe(-20)
  })

  it('a paid posting has no such part', () => {
    const j: Job = { ...fakeJob('Y', 'AI Intern', 'LLM agents RAG python. Stipend: ₹50,000/month.'), updatedAt: new Date().toISOString() }
    const s = scoreJob(j, SEED_LEDGER, rubric, false)
    expect(s.parts.find((p) => p.key === 'unpaid')).toBeUndefined()
  })
})

describe('S6.1 — JSearch sweeps the world map, India every sweep (source-level)', () => {
  it('the market rotation exists and pins India first', () => {
    const client = readFileSync('src/lib/khabri/client.ts', 'utf8')
    expect(client).toMatch(/JSEARCH_MARKETS = \['in', 'us', 'gb', 'de', 'fr'/)
    expect(client).toMatch(/i === 0 \? 'in'/)
    expect(client).toMatch(/hunt\.country \|\| marketFor/)
  })
})
