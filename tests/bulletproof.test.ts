import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { distillReadme } from '../src/lib/nabz/github'
import dimaagHandler from '../api/dimaag'
import guruHandler from '../api/guru'
import polishHandler from '../api/polish'
import darbaanHandler from '../api/darbaan'

/**
 * Bulletproof gates (D44/D45/D46/Session-5):
 *  - MONEY PROOF (§14): every metered client is gated by meteredCallsAllowed() (owner-only) AND
 *    every metered API function is token-gated server-side. Proven structurally by source scan +
 *    runtime handler tests — the runtime "darshak can't spend" belongs in the live Adversary Proof
 *    (mode is frozen per page-load by design, so it cannot be flipped inside one test process).
 *  - The API functions refuse foreign origins and honor the server owner token.
 *  - Nabz distills READMEs into substantive, lexicon-keyed ledger drafts.
 */

describe('MONEY PROOF (§14) — every metered client is owner-gated client-side', () => {
  // Each file that can hit a keyed serverless endpoint MUST consult meteredCallsAllowed()
  // before it can spend. A new metered path that forgets the gate fails this test.
  const meteredClients = [
    'src/lib/dimaag/core.ts',
    'src/lib/guru/client.ts',
    'src/lib/polish/client.ts',
    'src/lib/intel/client.ts',
    'src/lib/khabri/client.ts',
    'src/lib/pulse/client.ts',
  ]
  for (const f of meteredClients) {
    it(`${f} gates on meteredCallsAllowed()`, () => {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} fetches /api without importing the owner gate`).toMatch(/meteredCallsAllowed/)
    })
  }

  it('meteredCallsAllowed resolves to the single PEHCHAAN owner check', () => {
    const guard = readFileSync('src/lib/apiGuard.ts', 'utf8')
    expect(guard).toMatch(/isOwnerMode/)
    expect(guard).not.toMatch(/localStorage|ownerUnlocked/) // no ad-hoc identity inference
  })
})

describe('D44 — server-side request guard (origin wall + optional owner token)', () => {
  const post = (handler: (req: Request) => Promise<Response>, origin?: string, token?: string) =>
    handler(
      new Request('https://x/api/x', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(origin ? { Origin: origin } : {}),
          ...(token ? { 'x-sifarish-token': token } : {}),
        },
        body: JSON.stringify({ tier: 'classify', system: 's', user: 'u', messages: [], lines: ['x'], voiceSamples: [] }),
      }),
    )

  it('no Origin (curl/scripts) → 403 before any key is touched', async () => {
    for (const h of [dimaagHandler, guruHandler, polishHandler]) {
      expect((await post(h)).status).toBe(403)
    }
  })

  it('foreign origin → 403; own origins pass through to the keyless path', async () => {
    expect((await post(dimaagHandler, 'https://evil.example.com')).status).toBe(403)
    expect((await post(dimaagHandler, 'https://not-mine.vercel.app')).status).toBe(403)
    for (const origin of ['https://sifarish-shv-s-projects.vercel.app', 'https://sifarish-abc123-shv-s-projects.vercel.app', 'http://localhost:5173']) {
      const res = await post(dimaagHandler, origin)
      expect(res.status).toBe(200)
      expect((await res.json()).keyless).toBe(true) // no GROQ key in tests → keyless, never 403
    }
  })

  it('SIFARISH_OWNER_TOKEN set → wrong/missing header degrades to keyless; right header proceeds', async () => {
    process.env.SIFARISH_OWNER_TOKEN = 'sher'
    try {
      const wrong = await post(dimaagHandler, 'https://sifarish-shv-s-projects.vercel.app', 'galat')
      expect((await wrong.json()).reason).toBe('owner token required')
      const missing = await post(dimaagHandler, 'https://sifarish-shv-s-projects.vercel.app')
      expect((await missing.json()).reason).toBe('owner token required')
      const right = await post(dimaagHandler, 'https://sifarish-shv-s-projects.vercel.app', 'sher')
      const body = await right.json()
      expect(body.reason).toBeUndefined()
      expect(body.keyless).toBe(true) // through the guard, into the (keyless) handler
    } finally {
      delete process.env.SIFARISH_OWNER_TOKEN
    }
  })
})

describe('D46 — ownership is server-verified (a stranger cannot become the owner)', () => {
  const OWN_ORIGIN = 'https://sifarish-shv-s-projects.vercel.app'
  const sha256Hex = async (s: string) => {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  const post = (handler: (req: Request) => Promise<Response>, body: unknown, origin = OWN_ORIGIN) =>
    handler(
      new Request('https://x/api/darbaan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify(body),
      }),
    )

  it('unconfigured deployment says so (self-hosted clones use the local flow)', async () => {
    delete process.env.SIFARISH_OWNER_PASSCODE
    const g = await darbaanHandler(new Request('https://x/api/darbaan', { method: 'GET' }))
    expect((await g.json()).configured).toBe(false)
  })

  it('wrong owner code is refused; right code returns the API token (= sha256 of the code)', async () => {
    process.env.SIFARISH_OWNER_PASSCODE = 'sahi-code-123'
    try {
      const wrong = await post(darbaanHandler, { passcode: 'galat' })
      const wb = await wrong.json()
      expect(wb.ok).toBe(false)
      expect(wb.token).toBeUndefined()
      const right = await post(darbaanHandler, { passcode: 'sahi-code-123' })
      const rb = await right.json()
      expect(rb.ok).toBe(true)
      expect(rb.token).toBe(await sha256Hex('sahi-code-123'))
    } finally {
      delete process.env.SIFARISH_OWNER_PASSCODE
    }
  }, 15000)

  it('darbaan itself refuses foreign origins (no off-site brute-forcing)', async () => {
    process.env.SIFARISH_OWNER_PASSCODE = 'sahi-code-123'
    try {
      const res = await post(darbaanHandler, { passcode: 'sahi-code-123' }, 'https://evil.example.com')
      expect(res.status).toBe(403)
    } finally {
      delete process.env.SIFARISH_OWNER_PASSCODE
    }
  })

  it('with the owner passcode set, metered APIs demand its hash — nothing else spends', async () => {
    process.env.SIFARISH_OWNER_PASSCODE = 'sahi-code-123'
    try {
      const call = (token?: string) =>
        dimaagHandler(
          new Request('https://x/api/dimaag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: OWN_ORIGIN, ...(token ? { 'x-sifarish-token': token } : {}) },
            body: JSON.stringify({ tier: 'classify', system: 's', user: 'u' }),
          }),
        )
      expect((await (await call()).json()).reason).toBe('owner token required')
      expect((await (await call('self-appointed-owner-token')).json()).reason).toBe('owner token required')
      const good = await (await call(await sha256Hex('sahi-code-123'))).json()
      expect(good.reason).toBeUndefined()
      expect(good.keyless).toBe(true) // through the guard, into the (keyless-in-tests) handler
    } finally {
      delete process.env.SIFARISH_OWNER_PASSCODE
    }
  })
})

describe('D45 — Nabz README deep-read (substance for the tailor)', () => {
  const README = `# DARYA
[![build](https://img.shields.io/badge/build-passing-green)](x)

![screenshot](docs/shot.png)

DARYA is a village-level flood intelligence agent that fuses dam-release, river-gauge, and IMD
forecast data into per-village Punjabi alerts, delivered through a trusted human relay.

**Live demo:** https://darya-demo.vercel.app/try

## Features
- Fuses three public data sources into a village-level flood risk score with replayable evals
- Delivers alerts in Punjabi through Groq Whisper voice notes and an agentic escalation loop
- npm install and run
- Built with LangGraph orchestration, RAG over district gazetteers, and deterministic guardrails

## License
MIT
`

  it('distills summary, feature bullets, lexicon keywords, and the live URL', () => {
    const d = distillReadme(README)
    expect(d.summary).toContain('village-level flood intelligence')
    expect(d.summary.length).toBeLessThanOrEqual(240)
    expect(d.bullets.length).toBeGreaterThanOrEqual(2)
    expect(d.bullets.length).toBeLessThanOrEqual(3)
    expect(d.bullets.join(' ')).not.toMatch(/npm install/i) // install noise filtered
    expect(d.bullets.join(' ')).not.toMatch(/license/i)
    // Keywords speak the SAME lexicon as the JD decoder → evidence matching just works.
    expect(d.keywords).toContain('rag')
    expect(d.keywords).toContain('langgraph')
    expect(d.keywords).toContain('guardrails')
    expect(d.keywords).toContain('speech')
    expect(d.liveUrl).toBe('https://darya-demo.vercel.app/try')
  })

  it('badge-only / empty READMEs degrade gracefully (no fake summary)', () => {
    const d = distillReadme('# repo\n[![b](https://img.shields.io/x)](y)\n')
    expect(d.summary).toBe('')
    expect(d.bullets).toHaveLength(0)
  })

  it('markdown noise (links, bold, code) is cleaned out of bullets', () => {
    const d = distillReadme('intro paragraph that is long enough to be the summary of this repo.\n\n- Ships a **[voice](https://x)** pipeline with `whisper` and honest evals for every release cycle\n')
    expect(d.bullets[0]).not.toMatch(/[*`[\]]/)
    expect(d.bullets[0]).toContain('voice')
  })
})
