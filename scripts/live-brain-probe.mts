/**
 * LIVE BRAIN PROBE (Session 5.10, D82's law: a passing sibling proves nothing — probe EACH
 * reasoning path separately against the LIVE deployment and show real output, not a heuristic).
 * Paths: decide · classify · critique · forge-shaped generate · reframe-shaped generate ·
 * Baithak structured ops · Guru stream · polish. Owner token from gitignored owner-code.local.txt.
 *
 * Run: npx tsx scripts/live-brain-probe.mts
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const PASS = readFileSync('owner-code.local.txt', 'utf8').trim()
const TOKEN = createHash('sha256').update(PASS).digest('hex')
const BASE = process.env.SMOKE_URL || 'https://sifarish-shv-s-projects.vercel.app'
const H = { Origin: BASE, 'x-sifarish-token': TOKEN, 'Content-Type': 'application/json' }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * D73's law, obeyed: a fast probe rate-limits ITSELF and poisons the reading. Every probe is
 * spaced (free-tier TPM window) and a 429 waits out the window and retries — a rate limit is
 * not a dead brain.
 */
async function dimaag(tier: string, system: string, user: string, schema: Record<string, unknown>, maxTokens = 1500) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${BASE}/api/dimaag`, { method: 'POST', headers: H, body: JSON.stringify({ tier, system, user, maxTokens, schema }) })
    const j = (await res.json()) as { keyless?: boolean; result?: unknown; model?: string; rateLimited?: boolean }
    if (!j.rateLimited && j.result) return j
    if (attempt < 3) await sleep(22000)
  }
  const res = await fetch(`${BASE}/api/dimaag`, { method: 'POST', headers: H, body: JSON.stringify({ tier, system, user, maxTokens, schema }) })
  return (await res.json()) as { keyless?: boolean; result?: unknown; model?: string; rateLimited?: boolean }
}

const results: [string, boolean, string][] = []
async function reportImpl(path: string, ok: boolean, detail: string) {
  results.push([path, ok, detail])
  console.log(`${ok ? '✅' : '❌'} ${path}: ${detail.slice(0, 220)}`)
  await sleep(15000) // space probes so the probe itself never trips the TPM window (D73)
}

// 1 · decide (reasoning)
{
  const r = await dimaag('reasoning',
    'You are a career strategist. choiceId: winning option id. ranking: all ids best-first. why: 2 sentences. confidence: 0..1.',
    JSON.stringify({
      question: 'Which project should LEAD an Agent Engineer resume?',
      criteria: ['agentic depth', 'shipped to production'],
      craft: ['¶six-second-skim: the strongest material must sit in the top third.'],
      options: [
        { id: 'a', label: 'GLOAMING', detail: 'LLM narrator agent with fallback, shipped live' },
        { id: 'b', label: 'static blog', detail: 'plain HTML site' },
      ],
    }),
    { type: 'object', properties: { choiceId: { type: 'string' }, ranking: { type: 'array', items: { type: 'string' } }, why: { type: 'string' }, confidence: { type: 'number' } }, required: ['choiceId', 'ranking', 'why', 'confidence'], additionalProperties: false })
  const res = r.result as { choiceId?: string; why?: string } | undefined
  await reportImpl('decide', !r.keyless && res?.choiceId === 'a', `choice=${res?.choiceId} why="${res?.why ?? ''}"`)
}

// 2 · classify
{
  const r = await dimaag('classify',
    'Triage into ONE archetype label from: applied-ai, agent-eng, research-intern, forward-deployed, ml-generalist, platform-infra. label + confidence.',
    'Keywords: agents, rag, evals\n\nRole: build and orchestrate LLM agents with tool use and guardrails for enterprise CX.',
    { type: 'object', properties: { label: { type: 'string' }, confidence: { type: 'number' } }, required: ['label', 'confidence'], additionalProperties: false }, 800)
  const res = r.result as { label?: string; confidence?: number } | undefined
  await reportImpl('classify', !r.keyless && !!res?.label && /agent|applied/.test(res.label), `label=${res?.label}@${res?.confidence} (${r.model})`)
}

// 3 · critique (reasoning)
{
  const r = await dimaag('reasoning',
    'You are a hostile, time-starved recruiter doing a 6-second skim. verdict: PASS or REVISE. fixes: array of concrete fixes (empty if PASS). why: 1-2 sentences.',
    'RESUME:\n- App: https://example.com\n- Docs: /docs\n- worked on various projects',
    { type: 'object', properties: { verdict: { type: 'string' }, fixes: { type: 'array', items: { type: 'string' } }, why: { type: 'string' } }, required: ['verdict', 'fixes', 'why'], additionalProperties: false })
  const res = r.result as { verdict?: string; fixes?: string[] } | undefined
  await reportImpl('critique', !r.keyless && res?.verdict === 'REVISE' && (res.fixes?.length ?? 0) > 0, `verdict=${res?.verdict} fixes=${res?.fixes?.length}`)
}

// 4 · forge-shaped generate (the real forge prompt end-to-end shape)
{
  const { forgeSystem } = await import('../src/lib/nabz/forge')
  const r = await dimaag('reasoning', forgeSystem(),
    'PROJECT: gloaming (TypeScript)\nDescription: co-op board game with an AI narrator\nPROBLEM IT ATTACKS: board games need a game master; this makes the board itself the antagonist.\nFEATURE NOTES:\n- AI narrator (Groq LLM) with a hand-authored fallback so the game runs with zero API keys\n- deployed live on Vercel',
    { type: 'object', properties: { summary: { type: 'string' }, bullets: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'bullets'], additionalProperties: false }, 1400)
  const res = r.result as { bullets?: string[] } | undefined
  await reportImpl('forge', !r.keyless && (res?.bullets?.length ?? 0) >= 3, `bullets=${res?.bullets?.length} first="${res?.bullets?.[0] ?? ''}"`)
}

// 5 · reframe-shaped generate (the real reframe prompt)
{
  const { reframeSystem } = await import('../src/lib/polish/reframe')
  const r = await dimaag('reasoning', reframeSystem(),
    'Project: GLOAMING\nWhat it attacks (context only — never a source of new bullet facts): board games need a game master.\n\nHOW HE WANTS IT FRAMED: agentic systems angle, plain language\n\nBullets to re-express (keep the ids):\n- b1: Designed an AI narrator with a hand-authored fallback so the full game runs with zero API keys',
    { type: 'object', properties: { bullets: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'text'], additionalProperties: false } } }, required: ['bullets'], additionalProperties: false })
  const res = r.result as { bullets?: { id?: string; text?: string }[] } | undefined
  await reportImpl('reframe', !r.keyless && res?.bullets?.[0]?.id === 'b1' && !!res.bullets[0].text, `text="${res?.bullets?.[0]?.text ?? ''}"`)
}

// 6 · Baithak structured op (the strict-schema path, D80)
{
  const r = await dimaag('reasoning',
    'Turn the request into ops. Available: {"kind":"set-entry","ledgerId":"...","on":false}. LEDGER: skill-python (Python), proj-gloaming (GLOAMING). reply: brief. On each op set unused fields to null. refuse: null unless unevidenced.',
    'ye Python skill hata do',
    { type: 'object', properties: { reply: { type: 'string' }, ops: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string' }, ledgerId: { type: ['string', 'null'] }, on: { type: ['boolean', 'null'] } }, required: ['kind', 'ledgerId', 'on'], additionalProperties: false } }, refuse: { type: ['object', 'null'], properties: { term: { type: 'string' }, reason: { type: 'string' } }, required: ['term', 'reason'], additionalProperties: false } }, required: ['reply', 'ops', 'refuse'], additionalProperties: false })
  const res = r.result as { ops?: { kind?: string; ledgerId?: string }[] } | undefined
  const op = res?.ops?.[0]
  await reportImpl('baithak', !r.keyless && op?.kind === 'set-entry' && op.ledgerId === 'skill-python', `op=${op?.kind}(${op?.ledgerId})`)
}

// 7 · Guru stream
{
  const res = await fetch(`${BASE}/api/guru`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ system: 'You are a concise career guru. Answer in one sentence.', messages: [{ role: 'user', content: 'What single skill matters most for agent engineering interviews?' }] }),
  })
  const text = await res.text()
  const alive = res.ok && text.length > 20 && !/keyless/i.test(text.slice(0, 100))
  await reportImpl('guru', alive, `HTTP ${res.status}, ${text.length} bytes, head="${text.replace(/\n/g, ' ').slice(0, 100)}"`)
}

// 8 · polish (the D74 fix on api/polish — was silently dead on json_object)
{
  const res = await fetch(`${BASE}/api/polish`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ lines: ['worked on an AI narrator that helped make the game fun'], voice: '' }),
  })
  const j = (await res.json()) as { polished?: string[] | null; reason?: string }
  await reportImpl('polish', Array.isArray(j.polished) && j.polished.length === 1 && j.polished[0].length > 10, j.polished ? `polished="${j.polished[0]}"` : `DEAD: reason=${j.reason}`)
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} reasoning paths alive${failed.length ? ` — FAILED: ${failed.map(([p]) => p).join(', ')}` : ''}`)
process.exit(failed.length ? 1 : 0)
