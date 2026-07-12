import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { lock, setPasscode } from '../src/lib/darbaan/lock'
import { decide, classify } from '../src/lib/dimaag/core'
import { streamGuru } from '../src/lib/guru/client'
import { getIntel } from '../src/lib/intel/client'
import { runSweep } from '../src/lib/khabri/client'
import { runPulse } from '../src/lib/pulse/client'
import { distillReadme } from '../src/lib/nabz/github'
import dimaagHandler from '../api/dimaag'
import guruHandler from '../api/guru'
import polishHandler from '../api/polish'

/**
 * v4.1 "bulletproof" gates (D44/D45):
 *  - Darshak/demo mode is STRUCTURALLY KEYLESS — a locked browser can never spend a token.
 *  - The API functions refuse foreign origins and honor the optional owner token.
 *  - Nabz distills READMEs into substantive, lexicon-keyed ledger drafts.
 */

describe('D44 — Darshak mode spends ZERO tokens (client chokepoints)', () => {
  const realFetch = globalThis.fetch
  let apiCalls: string[] = []

  beforeAll(() => {
    lock()
    apiCalls = []
    // Any reach for a metered endpoint while locked is a certification-blocking defect.
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/')) apiCalls.push(url)
      return new Response(JSON.stringify({ keyless: true }), { status: 200 })
    }) as typeof fetch
  })

  afterAll(async () => {
    globalThis.fetch = realFetch
    await setPasscode('test-owner') // restore owner mode for any later suite in this file
  })

  it('decide() falls to the deterministic heuristic without touching /api/dimaag', async () => {
    const r = await decide({
      feature: 'test.darshak',
      question: 'which?',
      options: [
        { id: 'a', label: 'Option A about agents' },
        { id: 'b', label: 'Option B about paperwork' },
      ],
      criteria: ['agents'],
    })
    expect(r.by).toBe('heuristic')
    expect(apiCalls.filter((u) => u.includes('/api/dimaag'))).toHaveLength(0)
  })

  it('classify() likewise', async () => {
    const r = await classify({
      feature: 'test.darshak',
      text: 'an agentic llm role',
      labels: [{ id: 'x', label: 'X', cues: ['agentic'] }],
      instruction: 'pick',
    })
    expect(r.by).toBe('heuristic')
    expect(apiCalls.filter((u) => u.includes('/api/dimaag'))).toHaveLength(0)
  })

  it('streamGuru() returns null (router text stands) without touching /api/guru', async () => {
    const out = await streamGuru([{ role: 'user', content: 'hello' }], () => {})
    expect(out).toBeNull()
    expect(apiCalls.filter((u) => u.includes('/api/guru'))).toHaveLength(0)
  })

  it('getIntel() serves cache-or-keyless without touching /api/intel', async () => {
    const intel = await getIntel('SomeCompany')
    expect(intel.keyless).toBe(true)
    expect(apiCalls.filter((u) => u.includes('/api/intel'))).toHaveLength(0)
  })

  it('runSweep() refuses honestly — no lanes, no spend', async () => {
    const y = await runSweep()
    expect(y.found).toBe(0)
    expect(y.creditsSpent).toBe(0)
    expect(y.failed[0]).toMatch(/owner mode/i)
    expect(apiCalls.filter((u) => u.includes('/api/khabri'))).toHaveLength(0)
  })

  it('runPulse() no-ops keylessly without touching /api/pulse', async () => {
    const p = await runPulse()
    expect(p).toEqual({ keyless: true, count: 0 })
    expect(apiCalls.filter((u) => u.includes('/api/pulse'))).toHaveLength(0)
  })

  it('grand total: zero /api calls across every locked path', () => {
    expect(apiCalls).toHaveLength(0)
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
