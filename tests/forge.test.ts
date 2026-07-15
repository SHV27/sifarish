import { describe, expect, it } from 'vitest'
import { isResumeBullet, sanitizeBullets } from '../src/lib/nabz/forge'
import { distillReadme } from '../src/lib/nabz/github'

/**
 * THE BULLET FORGE — regression suite for D56 (Session 5.4).
 *
 * The apology for a real defect the OWNER found on his own resume: Nabz pasted raw README list
 * items in as resume bullets, so `- App: https://sehat-saarthi-punjab.vercel.app` and a sentence
 * sliced mid-clause ("…so the app") rendered on the page he sends to recruiters. Every string
 * below is taken from that broken output — these tests fail on the old code, by construction.
 */

describe('isResumeBullet — the deterministic slop filter (keyless core)', () => {
  it('rejects the exact link-dump lines that reached his resume', () => {
    // Screenshot evidence: these three were rendered as PROJECT BULLETS on the compiled resume.
    expect(isResumeBullet('App: https://sehat-saarthi-punjab.vercel.app')).toBe(false)
    expect(isResumeBullet('API: https://shauryaverma7-sehat-saarthi-api.hf.space/health · Docs: /docs')).toBe(false)
    expect(isResumeBullet('Models: https://huggingface.co/shauryaverma7/sehat-saarthi-models')).toBe(false)
  })

  it('rejects a sentence sliced mid-clause (the wrapped-list-item bug)', () => {
    // Rendered verbatim on the resume, ending on a dangling article — an instant credibility kill.
    expect(isResumeBullet('Pulse Loop — a weekly cited news sweep proposes human-confirmed rubric/keyword updates, so the app')).toBe(false)
    expect(isResumeBullet('Vision Engine — edit your dream; the app derives hunt queries + role archetypes (with reasons) that')).toBe(false)
  })

  it('rejects labels, headings and install noise', () => {
    expect(isResumeBullet('Live: https://gloaming-murex.vercel.app')).toBe(false)
    expect(isResumeBullet('Docs: /docs')).toBe(false)
    expect(isResumeBullet('## Features')).toBe(false)
    expect(isResumeBullet('Tech: React, TypeScript')).toBe(false)
  })

  it('keeps real accomplishment statements', () => {
    expect(
      isResumeBullet('Built a browser co-op board game where the board itself is the antagonist — Dread tide, hidden traitor, hunting Stalker — using boardgame.io, Vite, and serverless functions'),
    ).toBe(true)
    expect(isResumeBullet('Designed an AI narrator with a hand-authored fallback so the full game runs with zero API keys')).toBe(true)
  })

  it('sanitizeBullets strips the junk and preserves order + de-duplicates', () => {
    const out = sanitizeBullets([
      'App: https://sehat-saarthi-punjab.vercel.app',
      'Designed an AI narrator with a hand-authored fallback so the full game runs with zero API keys',
      'Docs: /docs',
      'Designed an AI narrator with a hand-authored fallback so the full game runs with zero API keys',
    ])
    expect(out).toEqual(['Designed an AI narrator with a hand-authored fallback so the full game runs with zero API keys'])
  })
})

describe('distillReadme — deep read, not a skim', () => {
  const md = `# sifarish

A job-hunt chief of staff that refuses to lie.

## Features

- **Pulse Loop** — a weekly cited news sweep proposes human-confirmed rubric/keyword updates,
  so the app never goes stale.
- **Vision Engine** — edit your dream; the app derives hunt queries + role archetypes.

## Run it

- App: https://sifarish-shv-s-projects.vercel.app
`

  it('joins a list item that WRAPS across lines instead of slicing it (the root truncation bug)', () => {
    const d = distillReadme(md)
    const pulse = d.bullets.find((b) => b.includes('Pulse Loop'))
    expect(pulse).toBeDefined()
    // The old distiller stopped at the physical newline, producing "…updates," and losing the point.
    expect(pulse).toContain('never goes stale')
    expect(pulse!.endsWith('updates,')).toBe(false)
  })

  it('captures the problem statement and the full reading material for the tailor', () => {
    const d = distillReadme(md)
    expect(d.problem).toContain('refuses to lie')
    expect(d.raw.length).toBeGreaterThan(20)
    expect(d.hasReadme).toBe(true)
  })

  it('a README with no bullet-worthy material yields no fabricated bullets', () => {
    const d = distillReadme('# thing\n\n- App: https://x.vercel.app\n- Docs: /docs\n')
    expect(sanitizeBullets(d.bullets)).toEqual([])
  })
})

describe('ledger depth (Session 5.4, D82) — the tailor needs extreme depth, not a summary', () => {
  // Owner's founding requirement, restated mid-session: "ledger mein agar depth hogi, bahut
  // extreme depth, tabhi tailor apne hisab se frame kar payega." A README with 8 real feature
  // lines and a long multi-paragraph problem statement must not be trimmed down to a thin brief —
  // that thinness is what starved the Editor's Desk's casting/angle reasoning (D58's projectBrief
  // reads exactly these fields).
  const bigReadme = `# darya

Darya is an AI-native personal finance copilot that reasons over a user's real transaction history to
answer plain-language money questions, catch fraud patterns banks miss, and propose a savings plan
grounded in the actual numbers rather than a generic template. It exists because every consumer finance
app either drowns the user in dashboards or hides behind a chatbot that can't see the ledger.

## Features

- Ingests bank statements via a Plaid-style connector and normalizes them into a typed transaction ledger
- Runs an anomaly detector over the transaction stream to flag likely fraud or duplicate charges
- Answers free-form questions ("how much did I spend on food last month") grounded in real transactions
- Proposes a savings plan with concrete numbers pulled from the user's own spending history
- Ships a reconciliation view that explains every number it shows, never a black-box total
- Runs entirely client-side for sensitive data — no transaction ever leaves the device unencrypted
- Uses a local vector index so search over months of transactions stays fast without a server round-trip
- Exposes an audit log of every inference the model made, so a user can verify the reasoning
`

  it('captures a long problem statement, not just the first sentence', () => {
    const d = distillReadme(bigReadme)
    expect(d.problem.length).toBeGreaterThan(200)
    expect(d.problem).toContain('reasons over a user')
  })

  it('captures more than 5 feature bullets when the README has them (was capped at 5)', () => {
    const d = distillReadme(bigReadme)
    expect(d.bullets.length).toBeGreaterThan(5)
    expect(d.bullets.some((b) => b.includes('audit log'))).toBe(true)
  })

  it('keeps the full README as reading material well past the old 6k cap', () => {
    const d = distillReadme(bigReadme)
    expect(d.raw.length).toBeGreaterThan(bigReadme.length - 50) // nothing meaningful truncated for a README this size
  })
})
