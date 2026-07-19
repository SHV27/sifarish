import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { getLibrary, isValidLibrary, craftClauses, patternById } from '../src/lib/ustaad/library'
import { forgeSystem, FORGE_VERSION, SYSTEM } from '../src/lib/nabz/forge'
import { buildSummaryLine } from '../src/lib/darzi/summary'
import { scanSlop } from '../src/lib/slop/scan'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { DEFAULT_VISION } from '../src/db/seed'
import { JD_FIXTURES } from './fixtures/jds'
import { SEED_IDENTITY, SEED_LEDGER } from './helpers'

/**
 * THE FINAL JANG — W1 gates (ELEVATION.md E1, Locks 1 & 4).
 * Library v2.0.0 carries the 2026 authorship-signal research (RESEARCH.md §8.1-8.2) as cited
 * DATA, and the two previously library-blind consumers (summary, letter) finally read it.
 */

const read = (f: string) => readFileSync(f, 'utf8')

describe('W1a — library v2.0.0: the 2026 research is data, cited, and reaches its passes', () => {
  it('version, honest counts, and citation integrity', () => {
    const lib = getLibrary()
    expect(lib.version).toBe('2.0.0')
    expect(lib.sources.length).toBeGreaterThanOrEqual(93)
    expect(lib.patterns.length).toBeGreaterThanOrEqual(63)
    expect(isValidLibrary(lib)).toBe(true)
  })
  it('the six Final Jang patterns exist and cite live-fetched sources', () => {
    for (const id of [
      'blt-authorship-register',
      'skl-demonstrated-only',
      'fmt-unabbreviated-titles',
      'lnk-footprint-match',
      'ltr-no-template-cadence',
      'sum-jd-proven-emphasis',
    ]) {
      const p = patternById(id)
      expect(p, `pattern ${id} must exist`).toBeTruthy()
      expect(p!.sourceIds.length).toBeGreaterThan(0)
    }
  })
  it('summary and letter passes are no longer library-blind (each carries studied craft)', () => {
    expect(craftClauses('summary').length).toBeGreaterThanOrEqual(2)
    expect(craftClauses('letter').length).toBeGreaterThanOrEqual(2)
  })
})

describe('W1c — the forge writes in the 2026 authorship register (FORGE_VERSION 5)', () => {
  it('FORGE_VERSION is 5 so the vault-repair banner reaches his real data (D140 law)', () => {
    expect(FORGE_VERSION).toBe(5)
  })
  it('the SYSTEM prompt bans the verb carousel and demands named, front-loaded metrics', () => {
    expect(SYSTEM).toContain('AUTHORSHIP REGISTER')
    for (const v of ['spearheaded', 'orchestrated', 'pioneered', 'revolutionized']) expect(SYSTEM).toContain(v)
    expect(SYSTEM).toContain('NAME THE METRIC')
    expect(SYSTEM).toContain('FIRST HALF')
    // The studied craft still rides the payload (D118 — stored must equal in-the-payload).
    expect(forgeSystem()).toContain('STUDIED CRAFT')
    expect(forgeSystem()).toContain('blt-authorship-register')
  })
})

describe('W1b — summary + letter surfaces consume the craft', () => {
  it('polish client sends letter/forge craft clauses; the server accepts them (bounded)', () => {
    const client = read('src/lib/polish/client.ts')
    expect(client).toMatch(/craft: craftClauses\('forge'/)
    expect(client).toMatch(/craft: craftClauses\('letter'/)
    const server = read('api/polish.ts')
    expect(server).toContain('body.craft')
    expect(server).toMatch(/slice\(0, 10\)/) // bounded — a hostile client cannot balloon the prompt
  })
  it('the deterministic summary obeys ¶sum-jd-proven-emphasis: one sentence, no inflation, evidence-linked', () => {
    const decode = decodeJD(JD_FIXTURES[0].jd)
    const coverage = matchEvidence(decode, SEED_LEDGER)
    const line = buildSummaryLine({ identity: SEED_IDENTITY, vision: DEFAULT_VISION, ledger: SEED_LEDGER, decode, coverage })
    expect(line).toBeTruthy()
    const text = line!.text
    // One sentence: a single terminal period, no mid-text sentence break.
    expect(text.trim().endsWith('.')).toBe(true)
    expect(text.trim().slice(0, -1)).not.toMatch(/\.\s+[A-Z]/)
    // Zero inflation modifiers (the 2026 register ban).
    for (const bad of ['innovative', 'revolutionary', 'meticulously', 'strategically', 'seamlessly', 'passionate']) {
      expect(text.toLowerCase()).not.toContain(bad)
    }
    expect(line!.ledgerIds.length).toBeGreaterThan(0)
  })
})

describe('W1d — the slop scan knows the 2026 tells', () => {
  it('verb-carousel words and template letter cadence are caught', () => {
    expect(scanSlop('Spearheaded an innovative platform').length).toBeGreaterThan(0)
    expect(scanSlop('Meticulously revolutionized the pipeline').length).toBeGreaterThan(0)
    expect(scanSlop('I am writing to express my interest').length).toBeGreaterThan(0)
  })
  it("the NOUN 'orchestration' stays legal (honest keyword mirroring must survive the ban)", () => {
    expect(scanSlop('Built multi-agent orchestration with LLM routing')).toEqual([])
  })
})
