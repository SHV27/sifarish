import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { toGeminiSchema } from '../api/dimaag'

/**
 * Session 7 (WS-R4) — the free reasoning router. The owner's demand: "keyless lane pe na
 * jaana pade" — reasoning always answers from an LLM lane unless every free brain is down,
 * and a rate limit means BACK OFF AND RETRY, never silently degrade (D73/D105/D140 law).
 */

describe('S7 — toGeminiSchema speaks Gemini dialect, not raw JSON Schema (the D80 lesson, reversed)', () => {
  it('converts nullable unions to nullable:true', () => {
    const g = toGeminiSchema({
      type: 'object',
      properties: { refuse: { type: ['string', 'null'] }, name: { type: 'string' } },
      required: ['refuse', 'name'],
      additionalProperties: false,
    })!
    const props = g.properties as Record<string, Record<string, unknown>>
    expect(props.refuse.nullable).toBe(true)
    expect(props.refuse.type).toBe('string')
    expect(props.name.nullable).toBeUndefined()
    expect('additionalProperties' in g).toBe(false)
  })

  it('recurses through items and nested objects', () => {
    const g = toGeminiSchema({
      type: 'object',
      properties: {
        ops: { type: 'array', items: { type: 'object', properties: { id: { type: ['number', 'null'] } } } },
      },
    })!
    const ops = (g.properties as Record<string, Record<string, unknown>>).ops
    const items = ops.items as Record<string, unknown>
    const idProp = (items.properties as Record<string, Record<string, unknown>>).id
    expect(idProp.nullable).toBe(true)
    expect(idProp.type).toBe('number')
  })

  it('keeps enum and required; drops strict/$schema noise', () => {
    const g = toGeminiSchema({
      type: 'object',
      $schema: 'x',
      strict: true,
      properties: { verdict: { type: 'string', enum: ['PASS', 'REVISE'] } },
      required: ['verdict'],
    })!
    expect(g.required).toEqual(['verdict'])
    expect((g.properties as Record<string, Record<string, unknown>>).verdict.enum).toEqual(['PASS', 'REVISE'])
    expect('$schema' in g).toBe(false)
    expect('strict' in g).toBe(false)
  })
})

describe('S7 — the router lane order is law (source-level, keyless-deterministic)', () => {
  const src = readFileSync('api/dimaag.ts', 'utf8')

  it('pins explicit Gemini model ids — never the silently-jumping -latest aliases', () => {
    expect(src).toContain("'gemini-3-flash-preview'")
    expect(src).toContain("'gemini-3.1-flash-lite'")
    expect(src).not.toMatch(/gemini-flash-latest|gemini-pro-latest/)
  })

  it('reasoning tries Gemini before Groq; classify tries Groq (cheap, high-RPM) first', () => {
    expect(src).toMatch(/tier === 'classify'\) \{\s*\n\s*if \(groqKey\) lanes\.push/)
    expect(src).toMatch(/\} else \{\s*\n\s*if \(geminiKey\) for \(const m of GEMINI_REASONING\) lanes\.push/)
  })

  it('a rate limit anywhere surfaces rateLimited so the client retries the LLM path — never a silent heuristic', () => {
    expect(src).toContain("rateLimited: true }, 200)")
    expect(src).toMatch(/all lanes rate-limited/)
  })

  it('a lane that answers non-JSON is a FAILED lane — the next brain gets its turn', () => {
    expect(src).toMatch(/continue \/\/ a lane that answered garbage is a failed lane/)
  })

  it('remains a self-contained edge function (D22)', () => {
    expect(src).toContain("export const config = { runtime: 'edge' }")
    expect(src).not.toMatch(/from '\.\/_/)
  })
})

// ---------- The angle fast-path (D130 pattern: a decided question spends no call) ----------

import { surgeryPass } from '../src/lib/darzi/editor'
import { archetypeById } from '../src/lib/darzi/archetypes'
import { decodeJD } from '../src/lib/jd/decode'
import { SEED_LEDGER } from './helpers'
import type { LedgerEntry } from '../src/types'

describe('S7 — angle fast-path: evidence answering ≥2 must-haves decides without a model', () => {
  it('picks the jd-focus angle heuristically and names the matched must-haves', async () => {
    const project = {
      ...(SEED_LEDGER.find((e) => e.kind === 'project' && e.tier === 'shipped') as LedgerEntry),
      id: 'proj-fast',
      tags: ['llm', 'rag'],
      bullets: [
        { id: 'f1', text: 'Built a RAG pipeline with evals and guardrails for LLM agents', keywords: ['rag', 'evals', 'llm', 'agents'] },
      ],
    }
    const decode = decodeJD('AI engineer. Must have: RAG, evals, agents, Python.')
    const arch = archetypeById('applied-ai')
    const r = await surgeryPass(project, arch, decode, undefined, undefined, false)
    expect(r.choice.angleRationale.by).toBe('heuristic')
    expect(r.choice.angleRationale.confidence).toBeGreaterThanOrEqual(0.8)
    expect(r.choice.angleRationale.why).toMatch(/must-haves/)
    expect(r.choice.angleId).toBe('jd-focus')
  })
})

// ---------- WS-R5: the vault repair reaches Session-7 craft ----------

import { needsReforge } from '../src/components/RepairBanner'
import { FORGE_VERSION } from '../src/lib/nabz/forge'

describe('S7 — vault repair v3: Session-6-forged entries are offered the new craft', () => {
  it('FORGE_VERSION is 3 and a v2-forged repo project needs re-forge', () => {
    expect(FORGE_VERSION).toBe(4)
    const v2entry = {
      ...(SEED_LEDGER.find((e) => e.kind === 'project' && e.tier === 'shipped') as LedgerEntry),
      id: 'proj-v2',
      forgeVersion: 2,
      evidence: { repo: 'https://github.com/SHV27/x', date: '2026-07', note: '' },
    }
    expect(needsReforge([v2entry]).map((e) => e.id)).toContain('proj-v2')
  })
})
