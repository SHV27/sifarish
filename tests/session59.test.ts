import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '../src/db/db'
import { readFileSync } from 'node:fs'
import { getLibrary, isValidLibrary, craftClauses, sourcesOf, patternById } from '../src/lib/ustaad/library'
import { forgeSystem, SYSTEM } from '../src/lib/nabz/forge'
import { reframeSystem } from '../src/lib/polish/reframe'
import { framingDirection } from '../src/lib/darzi/editor'
import { decodeJD } from '../src/lib/jd/decode'
import { applyEdit } from '../src/lib/baithak/execute'
import { compileResume } from '../src/lib/compile/compiler'
import { matchEvidence } from '../src/lib/match/evidence'
import { SEED_IDENTITY, SEED_LEDGER, fakeJob } from './helpers'
import type { Packet } from '../src/types'

/**
 * Session 5.9 "The Boutique Firm" — the Darzi gets a studied library that actually reaches the
 * model, JD-picked framings, and a whole-résumé reframe op. Every claim below is a gate.
 */

// ---------- 1 · The library grew materially, cited and dated ----------

describe('Ustaad library v1.1.0 — hundreds-of-résumés research landed as DATA (I13)', () => {
  const lib = getLibrary()

  it('grew materially and still validates', () => {
    expect(lib.version).toBe('1.1.0')
    expect(lib.updatedAt).toBe('2026-07-16')
    expect(lib.sources.length).toBeGreaterThanOrEqual(55)
    expect(lib.patterns.length).toBeGreaterThanOrEqual(28)
    expect(isValidLibrary(lib)).toBe(true)
  })

  it('every new framing pattern carries a dated, resolvable receipt', () => {
    for (const id of ['plain-language-what-it-is', 'name-the-model-and-eval', 'shipped-not-notebook', 'context-built-consequence', 'honest-non-numeric-impact', 'varied-bullet-rhythm', 'cost-latency-eval-metrics', 'honest-keyword-mirroring']) {
      const p = patternById(id)
      expect(p, `pattern ${id} must exist`).toBeDefined()
      const srcs = sourcesOf(p!)
      expect(srcs.length, `${id} must cite a resolvable source`).toBeGreaterThan(0)
      expect(srcs.every((s) => /^https:\/\//.test(s.url) && !!s.accessed)).toBe(true)
    }
  })

  it('the new pass kinds (forge/reframe) yield craft clauses', () => {
    expect(craftClauses('forge').length).toBeGreaterThanOrEqual(4)
    expect(craftClauses('reframe').length).toBeGreaterThanOrEqual(4)
  })
})

// ---------- 2 · The library reaches the PAYLOAD, not just the UI ----------

describe('craft in the payload — a value not in the request body does not exist (D93/CASE_STUDY 3.17)', () => {
  const core = readFileSync('src/lib/dimaag/core.ts', 'utf8')
  const editor = readFileSync('src/lib/darzi/editor.ts', 'utf8')
  const forge = readFileSync('src/lib/nabz/forge.ts', 'utf8')
  const reframe = readFileSync('src/lib/polish/reframe.ts', 'utf8')

  it('decide() serializes craft into the user payload', () => {
    expect(core).toMatch(/craft: input\.craft/)
    // and the cache key busts when craft changes (a library update must not serve stale reasoning)
    expect(core).toMatch(/cr: input\.craft/)
  })

  it('casting + surgery pass library craft to decide()', () => {
    expect(editor).toMatch(/craft: craftClauses\('casting'/)
    expect(editor).toMatch(/craft: craftClauses\('surgery'/)
  })

  it('the forge and the reframer send the as-composed system prompt (library included)', () => {
    expect(forge).toMatch(/system: forgeSystem\(\)/)
    expect(reframe).toMatch(/system: reframeSystem\(\)/)
  })

  it('forgeSystem()/reframeSystem() actually contain the studied rules', () => {
    const f = forgeSystem()
    expect(f.startsWith(SYSTEM)).toBe(true)
    expect(f).toMatch(/STUDIED CRAFT/)
    expect(f).toMatch(/plain-language-what-it-is|name-the-model-and-eval/)
    expect(reframeSystem()).toMatch(/STUDIED CRAFT/)
  })
})

// ---------- 3 · Same ledger, two JDs → materially different framing directions ----------

describe('framingDirection — the same truth aimed at two different readers', () => {
  const agenticJd = decodeJD('Build LLM agents with tool use, RAG pipelines, evals and guardrails. Python required.')
  const solutionsJd = decodeJD('Customer-facing solution engineering: deploy AI workflows, integrate APIs, present to enterprise stakeholders, TypeScript.')

  it('two JDs produce genuinely different directions, each naming its own priorities', () => {
    const a = framingDirection('Lead with agents & RAG', 'Agent Engineer', agenticJd, 'Netomi')
    const b = framingDirection('Lead with integration & deployment', 'Solutions Engineer', solutionsJd, 'Netomi')
    expect(a).not.toBe(b)
    expect(a.toLowerCase()).toContain('agent')
    expect(b.toLowerCase()).toContain('solutions')
    expect(a).toContain('Netomi')
  })

  it('facts stay out of the direction — it instructs the HOW, never adds a claim', () => {
    const d = framingDirection('angle', 'Agent Engineer', agenticJd)
    expect(d).toMatch(/keep every fact/i)
  })

  it('the editor threads framing overrides to the compiler (source gate)', () => {
    const editor = readFileSync('src/lib/darzi/editor.ts', 'utf8')
    const darzi = readFileSync('src/lib/darzi.ts', 'utf8')
    expect(editor).toMatch(/reframeProject\(project, direction\)/)
    expect(darzi).toMatch(/compileResume\(\{[^}]*bulletOverrides/)
    expect(darzi).toMatch(/bulletOverrides, \/\/ Session 5\.9/)
  })

  it('an override renders under the SAME evidence link — I1 survives the framing', () => {
    const job = fakeJob('Netomi', 'Agentic Engineer', 'LLM agents, RAG, evals, Python.')
    const decode = decodeJD(job.jd)
    const coverage = matchEvidence(decode, SEED_LEDGER)
    const project = SEED_LEDGER.find((e) => e.kind === 'project' && e.tier === 'shipped' && e.bullets.length > 0)!
    const b = project.bullets[0]
    const resume = compileResume({
      identity: SEED_IDENTITY,
      ledger: SEED_LEDGER,
      decode,
      coverage,
      jobId: job.id,
      bulletOverrides: { [b.id]: `Engineered ${b.text.charAt(0).toLowerCase()}${b.text.slice(1)}` },
    })
    const line = resume.lines.find((l) => l.kind === 'bullet' && l.text.includes('Engineered '))
    expect(line).toBeDefined()
    expect(line!.ledgerIds).toContain(project.id)
  })
})

// ---------- 4 · rewrite-angle: the whole-résumé ask ----------

describe('rewrite-angle — "poora resume is angle se frame kar" is now a real op', () => {
  beforeAll(async () => {
    await db.ledger.bulkPut(SEED_LEDGER) // the executor resolves leading projects from Dexie
  })

  function packetWithChosen(): Packet {
    const job = fakeJob('Netomi', 'Agentic Engineer', 'LLM agents, RAG, evals, Python.')
    const decode = decodeJD(job.jd)
    const coverage = matchEvidence(decode, SEED_LEDGER)
    const resume = compileResume({ identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, jobId: job.id })
    const chosen = SEED_LEDGER.filter((e) => e.kind === 'project' && e.tier === 'shipped' && e.bullets.length > 0)
      .slice(0, 2)
      .map((e) => ({ ledgerId: e.id, title: e.title, angleId: 'agent-eng', angleLabel: 'x', angleRationale: { question: '', criteria: [], choice: '', why: '', confidence: 0.5, by: 'heuristic' as const, at: '' } }))
    return {
      id: 'p-test-59',
      jobId: job.id,
      createdAt: new Date().toISOString(),
      resume,
      coverLetter: { paragraphs: [], ledgerIds: [] },
      outreach: { subject: '', body: '', ledgerIds: [] },
      coverage,
      gapNote: { items: [] },
      decode,
      polished: false,
      editorial: {
        archetype: { id: 'agent-eng', label: 'Agent Engineer', priorities: [], confidence: 0.9, by: 'heuristic', reviewerNote: '' },
        casting: { question: '', criteria: [], choice: '', why: '', confidence: 0.5, by: 'heuristic', at: '' },
        chosen,
        benched: [],
        sectionOrder: ['skills', 'projects', 'forge', 'education', 'achievements', 'certs'],
        redTeam: { verdict: 'PASS', fixes: [], by: 'heuristic', at: '' },
        redTeamRounds: 0,
      },
      ready: true,
    } as unknown as Packet
  }

  it('keyless mode refuses honestly instead of pretending (I4 made visible)', async () => {
    const r = await applyEdit(packetWithChosen(), { kind: 'rewrite-angle', direction: 'agentic systems angle' }, 'poora resume agentic angle se frame kar')
    expect(r.ok).toBe(false)
    expect(r.note).toMatch(/keyless/i)
  })

  it('with no leading projects there is nothing to rewrite — honest refusal, no crash', async () => {
    const p = packetWithChosen()
    p.editorial!.chosen = []
    const r = await applyEdit(p, { kind: 'rewrite-angle', direction: 'agentic' }, 'x')
    expect(r.ok).toBe(false)
    expect(r.note).toMatch(/no leading projects/i)
  })

  it('the smart layer advertises the op to the model (source gate)', () => {
    const smart = readFileSync('src/lib/baithak/smart.ts', 'utf8')
    expect(smart).toMatch(/"kind":"rewrite-angle"/)
    expect(smart).toMatch(/case 'rewrite-angle'/)
  })
})
