import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { compileResume, truncateAtWord } from '../src/lib/compile/compiler'
import { detectDrift, stemOf } from '../src/lib/polish/factGuard'
import { estimateQuality } from '../src/lib/ustaad/quality'
import { forgeSystem, SYSTEM } from '../src/lib/nabz/forge'
import { critique } from '../src/lib/dimaag/core'
import { getLibrary, patternById, craftClauses } from '../src/lib/ustaad/library'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { SEED_IDENTITY, SEED_LEDGER } from './helpers'
import type { LedgerEntry } from '../src/types'

/**
 * Session 6 "The Final Form" — regression gates for the five named defects from the owner's own
 * screenshots (mega brief §2) + the speed pass. Every fix ships the test that would have caught it.
 */

const AI_JD = `We are hiring an AI Engineer. Must have: LLM agents, RAG, evals, Python, embeddings.
You will build agentic pipelines with guardrails and prompt engineering. TypeScript a plus.`

// ---------- DEFECT 1 · Quantification: numbered bullets win their seat ----------

describe('Defect 1 — the ledger’s real numbers reach the page', () => {
  const project: LedgerEntry = {
    id: 'proj-num',
    kind: 'project',
    tier: 'shipped',
    resumeEligible: true,
    title: 'DARYA — flood alerts (2025)',
    summary: 'A flood-alert system for villages.',
    tags: ['python'],
    bullets: [
      { id: 'b-plain1', text: 'Built a flood-alert pipeline for village networks with resilient delivery', keywords: ['python'] },
      { id: 'b-plain2', text: 'Designed an alerting architecture that degrades gracefully during outages', keywords: ['python'] },
      { id: 'b-plain3', text: 'Shipped a monitoring dashboard for district officials with live map layers', keywords: ['python'] },
      { id: 'b-numbered', text: 'Trained a rainfall model reaching ROC-AUC 0.957 across 18 districts', keywords: ['python'] },
    ],
    evidence: { date: '2025-06', url: 'https://darya.example.app' },
  } as unknown as LedgerEntry

  const ledger = [...SEED_LEDGER.filter((e) => e.kind !== 'project'), project]
  const decode = decodeJD(AI_JD)
  const coverage = matchEvidence(decode, ledger)

  it('the compiler’s bullet selection seats the numbered bullet (equal keyword overlap)', () => {
    const resume = compileResume({ identity: SEED_IDENTITY, ledger, decode, coverage, jobId: 'j1' })
    const bulletLines = resume.lines.filter((l) => l.kind === 'bullet' && l.ledgerIds.includes('proj-num')).map((l) => l.text)
    expect(bulletLines.some((t) => t.includes('ROC-AUC 0.957'))).toBe(true)
  })

  it('quantification scores above zero whenever an eligible numbered bullet exists', () => {
    const resume = compileResume({ identity: SEED_IDENTITY, ledger, decode, coverage, jobId: 'j1' })
    const q = estimateQuality(resume, coverage, ledger)
    const quant = q.items.find((i) => i.label === 'Quantification')!
    expect(quant.points).toBeGreaterThan(0)
  })

  it('the forge SYSTEM makes README numbers mandatory, not optional', () => {
    expect(SYSTEM).toMatch(/THE NUMBERS RULE/)
    expect(SYSTEM).toMatch(/MUST carry that exact figure/)
  })
})

// ---------- DEFECT 2 · Honest keyword mirroring ----------

describe('Defect 2 — market vocabulary his README truthfully supports', () => {
  it('detectDrift accepts morphological stems of source tech words', () => {
    expect(detectDrift('built embedding search over document vectors', 'Built embeddings-based search over document vectors').ok).toBe(true)
    expect(detectDrift('an agent orchestrator coordinating pipelines', 'Engineered agent orchestration across pipelines').ok).toBe(true)
  })

  it('a tech term with no stem-relative in the source is still drift', () => {
    expect(detectDrift('built a simple todo app in JavaScript', 'Built a Kubernetes deployment pipeline').ok).toBe(false)
  })

  it('invented numbers still die regardless of stems', () => {
    expect(detectDrift('built embedding search', 'Built embeddings search with 99% recall').ok).toBe(false)
  })

  it('stemOf maps variants to one stem and leaves short words alone', () => {
    expect(stemOf('embeddings')).toBe(stemOf('embedding'))
    expect(stemOf('orchestration')).toBe(stemOf('orchestrator'))
    expect(stemOf('sql')).toBe('sql')
  })

  it('¶honest-keyword-mirroring reaches the forge pass and its prompt', () => {
    const p = patternById('honest-keyword-mirroring')!
    expect(p.passes).toContain('forge')
    expect(forgeSystem()).toContain('honest-keyword-mirroring')
    expect(SYSTEM).toMatch(/HONEST KEYWORD MIRRORING/)
  })
})

// ---------- DEFECT 3 · Typesetting ----------

describe('Defect 3 — the page reads like a typesetter set it', () => {
  it('truncateAtWord never cuts mid-word and closes with an ellipsis', () => {
    const s = 'A job-hunt chief of staff with hand-authored fallbacks and a deterministic compiler core'
    const t = truncateAtWord(s, 40)
    expect(t.length).toBeLessThanOrEqual(41)
    expect(t.endsWith('…')).toBe(true)
    const lastWord = t.slice(0, -1).trim().split(' ').pop()!
    expect(s).toMatch(new RegExp(`(^|\\s)${lastWord}(\\s|$)`)) // the last kept word is a REAL word
  })

  it('short strings pass through untouched', () => {
    expect(truncateAtWord('short and sweet', 160)).toBe('short and sweet')
  })

  it('education renders as ONE coherent line per qualification — no orphan year', () => {
    const decode = decodeJD(AI_JD)
    const coverage = matchEvidence(decode, SEED_LEDGER)
    const resume = compileResume({ identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, jobId: 'j1' })
    const lines = resume.lines
    const eduHeading = lines.findIndex((l) => l.kind === 'heading' && l.text === 'EDUCATION')
    expect(eduHeading).toBeGreaterThanOrEqual(0)
    // Every education line is an entry-title carrying its year/score inline; a bare-year meta
    // line ("2021" floating alone) must not exist anywhere in the section.
    for (let i = eduHeading + 1; i < lines.length && lines[i].kind !== 'heading'; i++) {
      expect(lines[i].kind).toBe('entry-title')
      expect(/^\d{4}$/.test(lines[i].text.trim())).toBe(false)
    }
    const xii = lines.find((l) => l.text.includes('Class X,'))
    expect(xii?.text).toMatch(/98\.6%.*2021/)
    // Session 6 (live-proof catch): education is reverse-chronological — B.Tech, then XII, then X
    // (Dexie's primary-key order had put Class X above Class XII).
    const eduLines = []
    for (let i = eduHeading + 1; i < lines.length && lines[i].kind !== 'heading'; i++) eduLines.push(lines[i].text)
    const iBtech = eduLines.findIndex((t) => t.includes('B.Tech'))
    const iXII = eduLines.findIndex((t) => t.includes('Class XII'))
    const iX = eduLines.findIndex((t) => t.includes('Class X,'))
    expect(iBtech).toBeLessThan(iXII)
    expect(iXII).toBeLessThan(iX)
  })

  it('positions render one per bullet — never a semicolon-joined run-on', () => {
    const decode = decodeJD(AI_JD)
    const coverage = matchEvidence(decode, SEED_LEDGER)
    const resume = compileResume({ identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, jobId: 'j1' })
    for (const l of resume.lines) {
      if (l.kind !== 'bullet') continue
      expect(l.text.includes('; Executive Committee')).toBe(false)
    }
  })

  it('the project description line never ends mid-word', () => {
    const long: LedgerEntry = {
      ...(SEED_LEDGER.find((e) => e.kind === 'project') as LedgerEntry),
      id: 'proj-long',
      summary:
        'A personal job-hunt chief of staff that compiles truthful evidence-linked resumes, hunts roles across lawful APIs, and drafts every artifact with hand-authored fallbacks everywhere',
    }
    const ledger = [...SEED_LEDGER, long]
    const decode = decodeJD(AI_JD)
    const coverage = matchEvidence(decode, ledger)
    const resume = compileResume({ identity: SEED_IDENTITY, ledger, decode, coverage, jobId: 'j1' })
    const meta = resume.lines.find((l) => l.kind === 'meta' && l.ledgerIds.includes('proj-long'))
    expect(meta).toBeDefined()
    const desc = meta!.text.split(' · ')[0]
    if (desc.endsWith('…')) {
      const lastWord = desc.slice(0, -1).trim().split(' ').pop()!
      expect(long.summary).toMatch(new RegExp(`(^|\\s)${lastWord}(\\s|$)`))
    }
  })
})

describe('Defect 3 — the PDF sanitizer keeps the typesetting (caught by READING the PDF)', () => {
  it('ellipsis and multiplication sign survive as ASCII, never vanish', async () => {
    const { sanitizePdfText } = await import('../src/lib/export/pdf')
    expect(sanitizePdfText('with a hand-authored…')).toBe('with a hand-authored...')
    expect(sanitizePdfText('TIET × LinkedIn Learning')).toBe('TIET x LinkedIn Learning')
    expect(sanitizePdfText('a  b')).toBe('a b')
  })
})

// ---------- DEFECT 5 · Red-team fast path ----------

describe('Defect 5 — the red-team’s deterministic checks short-circuit the model', () => {
  it('a heuristic hit resolves REVISE with zero LLM involvement', async () => {
    const res = await critique({
      feature: 'test.redteam',
      artifact: '- worked on some stuff\n- helped with things',
      persona: 'a hostile recruiter',
      standard: 'no weak openers',
      heuristicChecks: (a) => (a.includes('worked on') ? ['Weak bullet opener — lead with a strong verb.'] : []),
    })
    expect(res.verdict).toBe('REVISE')
    expect(res.by).toBe('heuristic')
    expect(res.fixes.length).toBeGreaterThan(0)
  })
})

// ---------- Library v1.2.0 ----------

describe('Ustaad library v1.2.0 — Session 6 hired-résumé research landed as DATA (I13)', () => {
  const lib = getLibrary()

  it('grew to ≥69 sources / ≥33 patterns and the new patterns carry receipts', () => {
    expect(lib.sources.length).toBeGreaterThanOrEqual(69)
    expect(lib.patterns.length).toBeGreaterThanOrEqual(33)
    for (const id of ['metric-first-half', 'verb-context-result', 'two-metric-bullet', 'education-line-india', 'summary-verifiable-facts']) {
      const p = patternById(id)
      expect(p, `pattern ${id} must exist`).toBeDefined()
      expect(p!.sourceIds.length).toBeGreaterThan(0)
    }
  })

  it('every forge pattern actually reaches the forge prompt (cap covers the set)', () => {
    const forgePatterns = lib.patterns.filter((p) => p.passes.includes('forge'))
    const clauses = craftClauses('forge', undefined, 12)
    expect(clauses.length).toBe(forgePatterns.length)
    expect(forgeSystem()).toContain('metric-first-half')
  })
})

// ---------- Speed pass wiring (source-level, keyless) ----------

describe('Defect 5 — the parallel passes are real, not claimed', () => {
  const editor = readFileSync('src/lib/darzi/editor.ts', 'utf8')
  const darzi = readFileSync('src/lib/darzi.ts', 'utf8')
  const smart = readFileSync('src/lib/baithak/smart.ts', 'utf8')

  it('surgery passes run concurrently and merge in casting order', () => {
    expect(editor).toMatch(/Promise\.all\(\s*chosenIds\.map/)
  })
  it('red-team and signature decide concurrently', () => {
    expect(darzi).toMatch(/Promise\.all\(\[\s*redTeamPass/)
  })
  it('the smart Baithak is metered through the same usage ledger as every reasoning feature', () => {
    expect(smart).toMatch(/recordUsage\('baithak\.smart', 'reasoning', 'call'/)
    expect(smart).toMatch(/recordUsage\('baithak\.smart', 'reasoning', 'fallback'/)
  })
})

// ---------- WS-2 · Discovery: age ≠ death, rotation, harvest, new lanes ----------

import { stalenessPart } from '../src/lib/radar/score'
import { rotateHunts, atsTokenFromUrl, ADZUNA_COUNTRIES } from '../src/lib/khabri/client'
import { mapSimplifyListings } from '../src/lib/khabri/keyless'
import { deriveHunts } from '../src/lib/vision/derive'
import { buildBriefing } from '../src/lib/briefing'
import type { Job, VisionProfile, Settings } from '../src/types'

const dayMs = 86400000
const NOW = Date.now()
const iso = (daysAgo: number) => new Date(NOW - daysAgo * dayMs).toISOString()
const baseJob = (over: Partial<Job>): Job => ({
  id: 'j-x', source: 'jsearch', company: 'X', title: 'AI Engineer', location: '', url: 'https://x.example',
  jd: 'AI', fetchedAt: iso(0), status: 'found', ...over,
})

describe('WS-2 — board-verified-open softens staleness (his rule: hiring chal rahi ho)', () => {
  it('a 90-day-old posting the board still lists loses at most 8 points', () => {
    const p = stalenessPart(baseJob({ updatedAt: iso(90), lastSeenOpenAt: iso(1) }), NOW)
    expect(p.points).toBe(-8)
    expect(p.why).toMatch(/verified open/)
  })

  it('an equally old aggregator ghost keeps the full deduction', () => {
    const p = stalenessPart(baseJob({ updatedAt: iso(90) }), NOW)
    expect(p.points).toBe(-12)
  })

  it('so the verified-open 90-day posting outranks the equal 90-day ghost', () => {
    const verified = stalenessPart(baseJob({ updatedAt: iso(90), lastSeenOpenAt: iso(2) }), NOW)
    const ghost = stalenessPart(baseJob({ updatedAt: iso(90) }), NOW)
    expect(verified.points).toBeGreaterThan(ghost.points)
  })

  it('a STALE open-scan (>10d old) proves nothing — full penalty stands', () => {
    const p = stalenessPart(baseJob({ updatedAt: iso(300), lastSeenOpenAt: iso(20) }), NOW)
    expect(p.points).toBe(-30)
  })

  it('fresh postings are never touched by the softener', () => {
    const p = stalenessPart(baseJob({ updatedAt: iso(5), lastSeenOpenAt: iso(1) }), NOW)
    expect(p.points).toBe(0)
  })
})

describe('WS-2 — hunt rotation: no enabled hunt starves forever', () => {
  it('rotates deterministically and preserves every element', () => {
    const l = ['a', 'b', 'c', 'd', 'e']
    expect(rotateHunts(l, 0)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(rotateHunts(l, 2)).toEqual(['c', 'd', 'e', 'a', 'b'])
    expect(rotateHunts(l, 7)).toEqual(['c', 'd', 'e', 'a', 'b'])
    expect(new Set(rotateHunts(l, 3))).toEqual(new Set(l))
    expect(rotateHunts([], 4)).toEqual([])
    expect(rotateHunts(['x'], 9)).toEqual(['x'])
  })

  it('with budget 10 and 15 hunts, rotation funds more hunts than any fixed window', () => {
    const hunts = Array.from({ length: 15 }, (_, i) => `h${i}`)
    const funded = new Set([...rotateHunts(hunts, 0).slice(0, 10), ...rotateHunts(hunts, 1).slice(0, 10)])
    expect(funded.size).toBeGreaterThan(10)
  })
})

describe('WS-2 — ATS-token harvesting (the watchlist grows itself, lawfully)', () => {
  it('extracts tokens from every public-ATS apply URL shape', () => {
    expect(atsTokenFromUrl('https://boards.greenhouse.io/netomi/jobs/123')).toEqual({ source: 'greenhouse', token: 'netomi' })
    expect(atsTokenFromUrl('https://job-boards.greenhouse.io/acme/jobs/9')).toEqual({ source: 'greenhouse', token: 'acme' })
    expect(atsTokenFromUrl('https://jobs.lever.co/Netomi/abc-def')).toEqual({ source: 'lever', token: 'netomi' })
    expect(atsTokenFromUrl('https://jobs.ashbyhq.com/openai/xyz')).toEqual({ source: 'ashby', token: 'openai' })
    expect(atsTokenFromUrl('https://careers.smartrecruiters.com/Writer/role')).toEqual({ source: 'smartrecruiters', token: 'Writer' })
  })

  it('rejects everything else — never an open harvest', () => {
    expect(atsTokenFromUrl('https://www.linkedin.com/jobs/view/1')).toBeNull()
    expect(atsTokenFromUrl('https://acme.wd1.myworkdayjobs.com/careers')).toBeNull()
    expect(atsTokenFromUrl('not a url')).toBeNull()
  })
})

describe('WS-2 — SimplifyJobs lane (intern/new-grad index, active-flagged)', () => {
  const listing = (over: Record<string, unknown>) => ({
    id: 'l1', active: true, company_name: 'Acme AI', title: 'AI/ML Intern', locations: ['Remote'],
    url: 'https://boards.greenhouse.io/acme/jobs/1', category: 'AI/ML/Data',
    date_posted: Math.floor(NOW / 1000) - 86400, date_updated: Math.floor(NOW / 1000), ...over,
  })

  it('keeps only ACTIVE AI/ML listings and maps them to Jobs', () => {
    const jobs = mapSimplifyListings([
      listing({}),
      listing({ id: 'l2', active: false }),
      listing({ id: 'l3', category: 'Quant', title: 'Trading Intern' }),
    ] as never)
    expect(jobs).toHaveLength(1)
    expect(jobs[0].source).toBe('simplify')
    expect(jobs[0].company).toBe('Acme AI')
    expect(jobs[0].updatedAt).toBeDefined()
  })

  it('a non-AI/ML category still passes when the TITLE is AI-relevant', () => {
    const jobs = mapSimplifyListings([listing({ id: 'l4', category: 'Software', title: 'Machine Learning Intern' })] as never)
    expect(jobs).toHaveLength(1)
  })
})

describe('WS-2 — dream-company hunts (the lawful door to closed-ATS companies)', () => {
  const vision: VisionProfile = {
    dream: 'I direct AI to build what one person alone never could.',
    targetRoles: ['AI Engineer'],
    notInterested: [],
    compFloorStipend: 20000,
    ppoFloorLpa: 16,
    windowStart: 'Jan 2027',
    windowEnd: 'May 2027',
    remoteInternational: true,
    openToOctoberStart: false,
    dreamCompanies: ['Netomi', 'Weekday', '  '],
  }

  it('each named dream company becomes a per-company aggregator hunt', () => {
    const hunts = deriveHunts(vision)
    expect(hunts.some((h) => h.query === 'Netomi AI engineer')).toBe(true)
    expect(hunts.some((h) => h.query === 'Weekday AI engineer')).toBe(true)
    expect(hunts.filter((h) => / AI engineer$/.test(h.query) && /Netomi|Weekday/.test(h.query))).toHaveLength(2)
  })
})

describe('WS-2 — "naya, tumhare vision ka": the briefing flags fresh on-vision roles', () => {
  const settings = {
    id: 'app',
    rubric: { aiRelevance: 30, roleFit: 25, remoteIndia: 15, windowFit: 15, compSignal: 10, conviction: 5 },
    visionProfile: {
      dream: 'agentic AI', targetRoles: ['AI Engineer'], notInterested: [], compFloorStipend: 0, ppoFloorLpa: 0,
      windowStart: '', windowEnd: '', remoteInternational: true, openToOctoberStart: false,
    },
  } as unknown as Settings

  it('a new on-vision role wears freshForVision; a seen one does not', () => {
    const fresh = baseJob({ id: 'j-fresh', title: 'AI Engineer', jd: 'LLM agents RAG evals python agentic ai machine learning', isNew: true, updatedAt: iso(1) })
    const seen = baseJob({ id: 'j-seen', title: 'AI Engineer', jd: 'LLM agents RAG evals python agentic ai machine learning', isNew: false, updatedAt: iso(1) })
    const b = buildBriefing([fresh, seen], [], settings)
    const freshMatch = b.topMatches.find((m) => m.job.id === 'j-fresh')
    const seenMatch = b.topMatches.find((m) => m.job.id === 'j-seen')
    expect(freshMatch?.freshForVision).toBe(true)
    expect(seenMatch?.freshForVision).toBe(false)
  })
})

describe('WS-2 — Adzuna covers its full swagger index', () => {
  it('19 markets including Switzerland, India pinned first', () => {
    expect(ADZUNA_COUNTRIES).toHaveLength(19)
    expect(ADZUNA_COUNTRIES[0]).toBe('in')
    expect(ADZUNA_COUNTRIES).toContain('ch')
  })
})
