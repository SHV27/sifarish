import { describe, expect, it } from 'vitest'
import { distillReadme } from '../src/lib/nabz/github'
import { isResumeBullet, sanitizeBullets, forgeSystem, forgeBrief } from '../src/lib/nabz/forge'
import type { GhRepo } from '../src/lib/nabz/github'
import { detectDrift } from '../src/lib/polish/factGuard'

/**
 * LIVE FORGE PROOF (§14 Proof 1.5) — gated behind SIFARISH_LIVE=1 (the D20 pattern), so the
 * default gate suite stays keyless and deterministic.
 *
 * The unit tests prove the forge's DETERMINISTIC core. They cannot prove the thing the owner
 * actually cares about: that a real LLM, reading his real README, produces resume bullets that
 * are (a) resume-shaped and (b) free of invented facts. This drives the actual prompt against
 * the actual model over the actual repo and asserts the guard holds on real output.
 *
 *   SIFARISH_LIVE=1 npx vitest run tests/live-forge.test.ts
 */

const LIVE = process.env.SIFARISH_LIVE === '1'
const KEY = process.env.GROQ_API_KEY
// The unauth GitHub limit (60/hr) is easily spent while iterating; the PAT keeps the proof runnable.
const GH: Record<string, string> = { Accept: 'application/vnd.github.raw+json' }
if (process.env.GITHUB_PAT) GH.Authorization = `Bearer ${process.env.GITHUB_PAT}`
const d = LIVE && KEY ? describe : describe.skip

// SYSTEM is imported from src/lib/nabz/forge.ts — the ACTUAL shipped prompt, never a stale copy
// (Session 5.6: the copy here had drifted to the old prompt, so the live proof was testing text
// that no longer shipped — the exact D74 "silent drift" trap).
const BANNED = /results-driven|passionate about leveraging|dynamic professional|proven track record|spearheaded|utilized|synergies/i

async function groq(system: string, user: string) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'result',
          strict: true,
          schema: {
            type: 'object',
            properties: { summary: { type: 'string' }, bullets: { type: 'array', items: { type: 'string' } } },
            required: ['summary', 'bullets'],
            additionalProperties: false,
          },
        },
      },
      temperature: 0.2,
      max_tokens: 2000,
    }),
  })
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = await res.json()
  return JSON.parse(j.choices[0].message.content)
}

d('live forge over a REAL repo README', () => {
  it(
    'forges resume-grade, drift-free bullets from SHV27/sifarish',
    async () => {
      const r = await fetch('https://api.github.com/repos/SHV27/sifarish/readme', { headers: GH })
      expect(r.ok, 'README fetch failed').toBe(true)
      const md = await r.text()

      const distilled = distillReadme(md)
      expect(distilled.hasReadme).toBe(true)
      expect(distilled.raw.length).toBeGreaterThan(200)

      // The ACTUAL shipped input: the compact brief the model reads (token-efficient, Session 5.6).
      const repo = { name: 'sifarish', description: 'A job-hunt chief of staff that refuses to lie', language: 'TypeScript' } as GhRepo
      const user = forgeBrief(repo, distilled)
      console.log(`brief chars: ${user.length} (vs raw README ${distilled.raw.length})`)

      const out = await groq(forgeSystem(), user)
      const bullets: string[] = (out.bullets ?? []).map((b: string) => String(b).trim())

      console.log('\n--- LIVE FORGE OUTPUT (sifarish) ---')
      console.log('summary:', out.summary)
      bullets.forEach((b) => console.log(' •', b))

      expect(bullets.length).toBeGreaterThanOrEqual(3)

      const source = `${distilled.raw}\nsifarish\n${distilled.stack.join(' ')}`
      const kept: string[] = []
      for (const b of bullets) {
        const shaped = isResumeBullet(b)
        const drift = detectDrift(source, b)
        if (!shaped) console.log('   ✗ not resume-shaped:', b.slice(0, 70))
        if (!drift.ok) console.log('   ✗ drift:', [...drift.addedFacts, ...drift.addedNumbers].slice(0, 5).join(', '))
        expect(BANNED.test(b), `slop register in: ${b}`).toBe(false)
        if (shaped && drift.ok) kept.push(b)
      }

      console.log(`--- kept ${kept.length}/${bullets.length} after the guard ---\n`)
      // The forge is useful only if REAL output mostly survives the guard. If the model can't
      // stay inside his README, the deterministic path is what ships — and we want to know.
      expect(kept.length, 'no forged bullet survived the guard on a real README').toBeGreaterThanOrEqual(2)
    },
    90_000,
  )

  it(
    'the deterministic path alone already beats the old paste-the-scraps behaviour',
    async () => {
      const r = await fetch('https://api.github.com/repos/SHV27/sehat-saarthi/readme', { headers: GH })
      if (!r.ok) return // repo may be private/renamed — not this test's subject
      const distilled = distillReadme(await r.text())
      const clean = sanitizeBullets(distilled.bullets)
      console.log('\n--- sehat-saarthi: raw README items vs sanitized ---')
      distilled.bullets.forEach((b) => console.log('   raw:', b.slice(0, 80)))
      clean.forEach((b) => console.log('   kept:', b.slice(0, 80)))
      // The exact junk from his broken resume must not survive.
      for (const b of clean) {
        expect(/^(app|api|docs?|models?|live|demo):/i.test(b), `link-dump survived: ${b}`).toBe(false)
      }
    },
    60_000,
  )
})
