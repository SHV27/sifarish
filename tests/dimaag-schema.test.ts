import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * D74/D75 REGRESSION — the test that would have caught the silent LLM.
 *
 * openai/gpt-oss cannot reliably satisfy Groq's `json_object` mode. Measured live 15-Jul-2026:
 *   json_object (either temperature)                      → 0/3
 *   json_schema + a prompt that ALSO spells out the shape → still fails
 *   json_schema + a prompt describing only MEANING        → 3/3 (decide, classify, forge)
 *
 * Two rules fall out, and both are invisible at code-review time — which is exactly why they get
 * asserted here instead of trusted:
 *   1. Every metered reasoning call passes a schema.
 *   2. No such prompt re-states the JSON shape in prose; the schema owns structure. Prose
 *      "Return JSON: {…}" instructions FIGHT the schema and bring the 400s back.
 *
 * This is a source-level gate on purpose. The live probe (tests/live-forge.test.ts) needs a key
 * and costs money; this runs in the default keyless suite forever and fails the moment someone
 * re-adds a shape instruction or drops a schema.
 */

const read = (p: string) => readFileSync(p, 'utf8')

describe('every reasoning call site passes a JSON Schema (D74)', () => {
  const core = read('src/lib/dimaag/core.ts')

  it('decide, critique and classify each pass a schema to callDimaag', () => {
    // These three were the last on the broken path — the whole Editor's Desk (archetype →
    // casting → angle → red-team) silently ran on heuristics in production because of it.
    for (const s of ['SCHEMA_DECIDE', 'SCHEMA_CRITIQUE', 'SCHEMA_CLASSIFY']) {
      expect(core, `${s} must be defined`).toContain(`const ${s} =`)
      expect(core.split(`${s} as unknown`).length, `${s} must be PASSED to callDimaag, not just defined`).toBeGreaterThan(1)
    }
  })

  it('callDimaag forwards the schema to the server', () => {
    expect(core).toMatch(/body: JSON\.stringify\(\{ tier, system, user, maxTokens, schema \}\)/)
  })

  it('the server asks for json_schema whenever a schema is supplied', () => {
    const api = read('api/dimaag.ts')
    expect(api).toContain("type: 'json_schema'")
    expect(api).toMatch(/strict: true/)
  })
})

describe('every schema obeys Groq/OpenAI strict-mode rules (D74)', () => {
  /**
   * `strict: true` requires that EVERY key in `properties` also appears in `required`; an optional
   * field must instead be a nullable union (`type: ['string','null']`). Break it and Groq rejects
   * the request outright — 0/2 live, no output at all.
   *
   * This is precisely how the smart Baithak's schema failed while decide/classify/forge passed:
   * theirs happened to have every property required, its `refuse` was optional. Invisible at code
   * review, fatal at runtime, and it looks identical to "the LLM is just dumb". Hence this gate.
   */
  const strictOk = (schema: any, path = 'root'): string[] => {
    const errs: string[] = []
    if (!schema || typeof schema !== 'object') return errs
    if (schema.properties) {
      const props = Object.keys(schema.properties)
      const req: string[] = schema.required ?? []
      for (const p of props) {
        if (!req.includes(p)) errs.push(`${path}.${p} is in properties but not required`)
      }
      if (schema.additionalProperties !== false) errs.push(`${path} must set additionalProperties:false`)
      for (const p of props) errs.push(...strictOk(schema.properties[p], `${path}.${p}`))
    }
    if (schema.items) errs.push(...strictOk(schema.items, `${path}[]`))
    return errs
  }

  it('the smart Baithak schema is strict-compliant (it was not — 0/2 live)', () => {
    const src = read('src/lib/baithak/smart.ts')
    // The op fields must be nullable unions, not optional keys.
    for (const f of ['ledgerId', 'bulletId', 'on', 'url', 'direction']) {
      expect(src, `op field ${f} must be a nullable union under strict mode`).toMatch(
        new RegExp(`${f}: \\{ type: \\['(string|boolean)', 'null'\\] \\}`),
      )
    }
    expect(src).toContain("required: ['kind', 'ledgerId', 'bulletId', 'on', 'url', 'direction', 'sectionOrder']")
    expect(src).toContain("required: ['reply', 'ops', 'refuse']")
    expect(src).toMatch(/refuse: \{\s*type: \['object', 'null'\]/)
  })

  it('the reference shapes we ship are themselves strict-valid', () => {
    // A live-verified schema, asserted structurally so the rule is executable, not folklore.
    expect(
      strictOk({
        type: 'object',
        properties: { summary: { type: 'string' }, bullets: { type: 'array', items: { type: 'string' } } },
        required: ['summary', 'bullets'],
        additionalProperties: false,
      }),
    ).toEqual([])
    // And the rule actually bites when a property is optional.
    expect(
      strictOk({
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'string' } },
        required: ['a'],
        additionalProperties: false,
      }),
    ).toContain('root.b is in properties but not required')
  })
})

describe('no prompt re-states the JSON shape in prose (D74)', () => {
  // The shape belongs to the schema. A prompt that also dictates it measurably reintroduces
  // HTTP 400 "Failed to generate JSON" — this is the subtle half of the bug.
  const files = [
    'src/lib/dimaag/core.ts',
    'src/lib/nabz/forge.ts',
    'src/lib/polish/reframe.ts',
    'src/lib/baithak/smart.ts',
  ]

  it.each(files)('%s contains no "Return JSON: {…}" shape instruction', (f) => {
    const src = read(f)
    // Match a prose instruction that dictates structure, e.g. Return JSON: {"a":string}
    const offenders = src.match(/Return(?:s)?\s+(?:ONLY\s+)?(?:compact\s+)?JSON\s*:?\s*\{/gi) ?? []
    expect(offenders, `shape instructions fight the schema and bring the 400s back: ${offenders.join(' | ')}`).toEqual([])
  })
})
