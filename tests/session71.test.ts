import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { bulletOverlapSameProject, primaryConcept, HARD_DUPLICATE } from '../src/lib/compile/overlap'
import { compileResume } from '../src/lib/compile/compiler'
import { nazarHeuristic, bulletIdsForIssues } from '../src/lib/darzi/nazar'
import { distillReadme } from '../src/lib/nabz/github'
import { FORGE_VERSION } from '../src/lib/nabz/forge'
import { scoreJob } from '../src/lib/radar/score'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { SEED_IDENTITY, SEED_LEDGER } from './helpers'
import type { Job, LedgerEntry, VisionProfile } from '../src/types'

/**
 * Session 7.1 — the owner caught FOUR defects on his REAL page that the S7 gates missed.
 * Every gate here is built from his exact strings (§14: the test IS the apology).
 */

// His EXACT twin pair — same claim (truth-enforcement), near-zero shared words.
const TWIN_A =
  'Implemented guardrails that tag every content line with ledger IDs and reject uncited prose, guaranteeing 100% PDF round-trip fidelity to ensure all compiled resumes remain provably accurate'
const TWIN_B =
  'Developed Sifarish, an agentic job-hunt chief of staff that compiles verified role data and drafts applications while enforcing a strict human-in-the-loop policy for all outgoing content'
const DISTINCT =
  'Engineered a two-tier LLM routing core across eleven serverless functions with Gemini and Groq lanes and deterministic fallbacks'

describe('S7.1 — semantic twins die even with near-zero shared words', () => {
  it('his exact pair shares a primary concept (truth) and crosses the hard ceiling', () => {
    expect(primaryConcept(TWIN_A)).toBe('truth')
    expect(primaryConcept(TWIN_B)).toBe('truth')
    expect(bulletOverlapSameProject(TWIN_A, TWIN_B)).toBeGreaterThanOrEqual(HARD_DUPLICATE)
  })

  it('two DIFFERENT llm-adjacent accomplishments are NOT twins (a RAG pipeline vs an agent orchestrator)', () => {
    const ragB = 'Built a retrieval pipeline with embeddings and vector search over document stores'
    const agentB = 'Orchestrated multi-agent workflows with tool-use routing across LangGraph nodes'
    expect(bulletOverlapSameProject(ragB, agentB)).toBeLessThan(HARD_DUPLICATE)
  })

  it('the compiler renders at most ONE of the twin pair and backfills the distinct bullet', () => {
    const p: LedgerEntry = {
      ...(SEED_LEDGER.find((e) => e.kind === 'project' && e.tier === 'shipped') as LedgerEntry),
      id: 'proj-sifarish-twin',
      title: 'SIFARISH — job-hunt chief of staff',
      bullets: [
        { id: 't1', text: TWIN_A, keywords: ['python', 'guardrails'] },
        { id: 't2', text: TWIN_B, keywords: ['python', 'guardrails'] },
        { id: 't3', text: DISTINCT, keywords: ['python', 'llm'] },
      ],
    }
    const ledger = [...SEED_LEDGER, p]
    const decode = decodeJD('AI engineer. Must have: Python, guardrails, LLM.')
    const resume = compileResume({
      identity: SEED_IDENTITY, ledger, decode, coverage: matchEvidence(decode, ledger), jobId: 'j',
      editorial: { order: ['proj-sifarish-twin'], bullets: {} },
    })
    const bullets = resume.lines.filter((l) => l.kind === 'bullet' && l.ledgerIds.includes('proj-sifarish-twin')).map((l) => l.text)
    const twins = bullets.filter((t) => t.includes('guardrails that tag') || t.includes('chief of staff'))
    expect(twins.length).toBeLessThanOrEqual(1)
    expect(bullets.some((t) => t.includes('two-tier LLM routing'))).toBe(true)
  })
})

describe('S7.1 — identity-restatement bullets never render (the title/description already say it)', () => {
  it('a bullet naming the project itself is dropped when alternatives exist', () => {
    const p: LedgerEntry = {
      ...(SEED_LEDGER.find((e) => e.kind === 'project' && e.tier === 'shipped') as LedgerEntry),
      id: 'proj-ident',
      title: 'SIFARISH — job-hunt chief of staff',
      bullets: [
        { id: 'i1', text: TWIN_B, keywords: ['python'] }, // "Developed Sifarish, an agentic…"
        { id: 'i2', text: DISTINCT, keywords: ['python'] },
      ],
    }
    const ledger = [...SEED_LEDGER, p]
    const decode = decodeJD('AI engineer. Must have: Python.')
    const resume = compileResume({
      identity: SEED_IDENTITY, ledger, decode, coverage: matchEvidence(decode, ledger), jobId: 'j',
      editorial: { order: ['proj-ident'], bullets: {} },
    })
    const bullets = resume.lines.filter((l) => l.kind === 'bullet' && l.ledgerIds.includes('proj-ident')).map((l) => l.text)
    expect(bullets.some((t) => t.includes('Developed Sifarish'))).toBe(false)
    expect(bullets.some((t) => t.includes('two-tier LLM routing'))).toBe(true)
  })

  it('the forge bans identity bullets + twin themes at the SOURCE (wiring)', () => {
    const src = readFileSync('src/lib/nabz/forge.ts', 'utf8')
    expect(src).toMatch(/IDENTITY BAN/)
    expect(src).toMatch(/bulletOverlapSameProject/)
    expect(src).toMatch(/ONE THEME PER BULLET/)
    expect(src).toMatch(/NEVER name the project itself/)
  })
})

describe('S7.1 — "How it works" can never become a project description again', () => {
  it('a spark-core-shaped README yields a real summary, not the section heading', () => {
    const md = [
      '# spark-core', '',
      '## How it works', '',
      'An edge-first portfolio engine that fetches its content manifest from GitHub at runtime, so edits go live without a redeploy.',
      '', '## Features', '- Edge middleware', '- HMAC-signed sessions',
    ].join('\n')
    const d = distillReadme(md)
    expect(d.summary.toLowerCase().startsWith('how it works')).toBe(false)
    expect(d.summary).toMatch(/portfolio engine|content manifest/i)
  })

  it('short section-y headings are rejected as taglines generally', () => {
    const d = distillReadme('# X\n\n## Quick start\n\nSome real prose about what this project does for its users, at length.')
    expect(d.summary.toLowerCase().startsWith('quick start')).toBe(false)
  })
})

describe('S7.1 — leadership-titled roles are out of an intern window, whatever the JD says', () => {
  const RUBRIC = { aiRelevance: 30, roleFit: 20, remoteIndia: 15, windowFit: 15, compSignal: 15, conviction: 5 }
  const VISION: VisionProfile = {
    dream: 'AI engineer building agentic LLM systems', targetRoles: ['AI Engineer Intern'], notInterested: [],
    remoteInternational: true, dreamCompanies: [], compFloorStipend: 20000, ppoFloorLpa: 10,
    windowStart: '2026-09', windowEnd: '2027-02', openToOctoberStart: true,
  }
  const managerJob = {
    id: 'j-em', company: 'Postman', title: 'Engineering Manager, Postman AI', location: 'Bengaluru, India',
    jd: 'Lead the AI team. Python, LLM, agents, evals. Roadmap through 2027.', url: 'https://x', source: 't',
    status: 'found', fetchedAt: new Date().toISOString(),
  } as unknown as Job

  it('windowFit is ZERO for a manager title — the 2027-mention boost cannot resurrect it', () => {
    const s = scoreJob(managerJob, SEED_LEDGER, RUBRIC, false, VISION)
    const win = s.parts.find((p) => p.key === 'windowFit')!
    expect(win.points).toBe(0)
    expect(win.why).toMatch(/management|leadership/i)
  })

  it('the management family takes the visible role-family demotion too', () => {
    const s = scoreJob(managerJob, SEED_LEDGER, RUBRIC, false, VISION)
    const fam = s.parts.find((p) => p.key === 'roleFamily')
    expect(fam).toBeDefined()
    expect(fam!.points).toBeLessThan(0)
  })
})

describe('S7.1 — the Nazar: the page-level judge (deterministic floor + exclusion door)', () => {
  it('nazarHeuristic flags a same-project twin pair on a compiled page', () => {
    const resume = {
      jobId: 'j',
      lines: [
        { kind: 'bullet' as const, text: TWIN_A, ledgerIds: ['p1'] },
        { kind: 'bullet' as const, text: TWIN_B, ledgerIds: ['p1'] },
      ],
    }
    const issues = nazarHeuristic(resume)
    expect(issues.length).toBe(1)
    expect(issues[0].type).toBe('duplicate')
  })

  it('bulletIdsForIssues maps a flagged text to the REAL ledger bullet id — and to nothing else', () => {
    const ledger = [
      { ...(SEED_LEDGER.find((e) => e.kind === 'project') as LedgerEntry), id: 'p1', bullets: [{ id: 'bx', text: TWIN_B, keywords: [] }] },
    ]
    expect(bulletIdsForIssues([{ type: 'duplicate', drop: TWIN_B, keep: TWIN_A, why: 'twin' }], ledger)).toEqual(['bx'])
    expect(bulletIdsForIssues([{ type: 'duplicate', drop: 'a line that exists nowhere on any ledger entry at all', keep: '', why: '' }], ledger)).toEqual([])
  })

  it('the compiler excludes Nazar-dropped bullet ids and backfills', () => {
    const p: LedgerEntry = {
      ...(SEED_LEDGER.find((e) => e.kind === 'project' && e.tier === 'shipped') as LedgerEntry),
      id: 'proj-nazar',
      title: 'NZTEST — thing',
      bullets: [
        { id: 'z1', text: TWIN_A, keywords: ['python'] },
        { id: 'z2', text: DISTINCT, keywords: ['python'] },
      ],
    }
    const ledger = [...SEED_LEDGER, p]
    const decode = decodeJD('AI engineer. Must have: Python.')
    const resume = compileResume({
      identity: SEED_IDENTITY, ledger, decode, coverage: matchEvidence(decode, ledger), jobId: 'j',
      editorial: { order: ['proj-nazar'], bullets: {} }, excludedBulletIds: ['z1'],
    })
    const bullets = resume.lines.filter((l) => l.kind === 'bullet' && l.ledgerIds.includes('proj-nazar')).map((l) => l.text)
    expect(bullets.some((t) => t.includes('guardrails that tag'))).toBe(false)
    expect(bullets.some((t) => t.includes('two-tier LLM routing'))).toBe(true)
  })

  it('nazar is WIRED on the default packet path and its removals are visible (source)', () => {
    const src = readFileSync('src/lib/darzi.ts', 'utf8')
    expect(src).toMatch(/nazarPass\(resume\)/)
    expect(src).toMatch(/excludedBulletIds: dropIds/)
    expect(src).toMatch(/gapNote\.push\(\.\.\.nazarNotes\)/)
  })
})

describe('S7.1 — vault repair v4', () => {
  it('FORGE_VERSION is 4 so his vault inherits the source-side fixes via the banner', () => {
    expect(FORGE_VERSION).toBe(4)
  })
})
