import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { createHash } from 'crypto'
import routing from '../data/config/routing.json'
import registry from '../data/prompts/registry.json'

/**
 * Studio Protocol W2 gates — CONFIG OVER CODE, enforced mechanically.
 * D22 forbids cross-file imports in the serverless functions, so the model ids are inlined
 * there and data/config/routing.json is the SOURCE OF TRUTH these gates keep them synced to.
 */

const read = (f: string) => readFileSync(f, 'utf8')
const norm = (s: string) => s.replace(/\r\n/g, '\n')

describe('W2 — routing.json is the truth; the api functions cannot drift from it', () => {
  it('dimaag lanes match', () => {
    const src = read('api/dimaag.ts')
    const [g1, g2, groqR] = routing.lanes.reasoning
    expect(src).toContain(`'${g1}'`)
    expect(src).toContain(`'${g2}'`)
    expect(src).toContain(`reasoning: '${groqR}'`)
    expect(src).toContain(`classify: '${routing.lanes.classify[0]}'`)
    expect(src).toContain(`'${routing.lanes.classify[1]}'`)
  })
  it('polish lanes match (Groq first, Gemini fallback)', () => {
    const src = read('api/polish.ts')
    expect(src).toContain(`'${routing.lanes.polish[0]}'`)
    expect(src).toContain(routing.lanes.polish[1])
  })
  it('guru lane matches', () => {
    const src = read('api/guru.ts')
    expect(src).toContain(routing.lanes.guru[0])
  })
  it('no -latest alias in any lane (D144: pinned ids only)', () => {
    for (const lanes of Object.values(routing.lanes)) for (const m of lanes) expect(m).not.toMatch(/-latest$/)
    // The const arrays in the router must be alias-free too (comments may DISCUSS the alias rule).
    const consts = /const GEMINI_REASONING = \[[^\]]*\]|const GEMINI_CLASSIFY = \[[^\]]*\]/g
    for (const m of read('api/dimaag.ts').match(consts) ?? []) expect(m).not.toContain('-latest')
  })
})

describe('W2 — guard-drift gate (AUDIT Class E: the D55 disease, made impossible)', () => {
  const FILES = [
    'api/dimaag.ts',
    'api/guru.ts',
    'api/intel.ts',
    'api/polish.ts',
    'api/pulse.ts',
    'api/khabri/aggregators.ts',
    'api/khabri/jobs.ts',
    'api/khabri/signals.ts',
  ]
  const extract = (src: string, start: string) => {
    const i = src.indexOf(start)
    if (i === -1) return null
    const end = src.indexOf('\n}', i)
    return norm(src.slice(i, end + 2))
  }
  it('all 8 metered functions carry BYTE-IDENTICAL guardRequest + sha256Hex copies', () => {
    const guards = new Set<string>()
    const hashes = new Set<string>()
    for (const f of FILES) {
      const src = read(f)
      const g = extract(src, 'async function guardRequest')
      const h = extract(src, 'async function sha256Hex')
      expect(g, `${f} must carry the guard`).toBeTruthy()
      expect(h, `${f} must carry sha256Hex`).toBeTruthy()
      guards.add(g!)
      hashes.add(h!)
    }
    expect(guards.size, 'guardRequest drifted between functions — sync every copy in the same commit').toBe(1)
    expect(hashes.size, 'sha256Hex drifted between functions').toBe(1)
  })
})

describe('W2 — prompt-version gate (AUDIT #15: a craft edit can never silently skip the repair banner)', () => {
  it('every prompt-bearing file matches its registered hash (changed one? bump registry.version + FORGE_VERSION when forge/reframe craft moved, and re-record the hash)', () => {
    for (const e of registry.entries) {
      const actual = createHash('sha256').update(norm(read(e.file))).digest('hex')
      expect(actual, `${e.file} changed without a registry bump (versionedBy: ${e.versionedBy})`).toBe(e.sha256)
    }
  })
  it('the registry version tracks FORGE_VERSION', () => {
    const forge = read('src/lib/nabz/forge.ts')
    const m = /FORGE_VERSION = (\d+)/.exec(forge)
    expect(m).toBeTruthy()
    expect(registry.version, 'registry.version must be ≥ FORGE_VERSION (bump together)').toBeGreaterThanOrEqual(Number(m![1]))
  })
})

describe('W1 — the boundary exists and the old cast class is dying', () => {
  it('boundary.ts owns parse/catchAs; core fetch sites route through it', () => {
    const b = read('src/lib/boundary.ts')
    expect(b).toContain('export function parse<')
    expect(b).toContain('export function catchAs')
    for (const f of ['src/lib/dimaag/core.ts', 'src/lib/khabri/client.ts', 'src/lib/nabz/github.ts', 'src/lib/intel/client.ts']) {
      expect(read(f), `${f} must import the boundary`).toContain("from '../boundary'")
    }
  })
  it('the errlog ring is bounded and infra-writable', () => {
    const db = read('src/db/db.ts')
    expect(db).toContain("errlog: 'id, at, category'")
    expect(db).toMatch(/INFRA_TABLES = new Set\(\[[^\]]*'errlog'/)
  })
})
