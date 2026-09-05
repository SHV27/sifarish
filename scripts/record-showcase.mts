/**
 * record-showcase — runs THE TEAM's deep pass (reading → plan → critic) ONCE, live against
 * production's /api/dimaag with the owner token, on the DEMO persona's ledger and the Babaclick
 * posting, and records the result as data (data/showcase/babaclick.strategy.json).
 *
 * Why: demo mode spends nothing, so a visitor would otherwise see the template strategist — the
 * exact failure mode the product exists to replace. The recorded pass is the worked example a
 * recruiter opens cold: the reasoned plan, honestly labelled "recorded on <date>".
 *
 *   npx tsx scripts/record-showcase.mts          (needs owner-code.local.txt; never commits secrets)
 */
import 'fake-indexeddb/auto'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
  clear() { this.m.clear() }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  get length() { return this.m.size }
}
const g = globalThis as Record<string, unknown>
if (!g.localStorage) g.localStorage = new MemStorage()
if (!g.sessionStorage) g.sessionStorage = new MemStorage()

const PASS = readFileSync('owner-code.local.txt', 'utf8').trim()
const TOKEN = createHash('sha256').update(PASS).digest('hex')
const BASE = process.env.SMOKE_URL || 'https://sifarish-shv-s-projects.vercel.app'
localStorage.setItem('sifarish.darbaan.unlocked', '1')
localStorage.setItem('sifarish.apitoken', TOKEN)
const realFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith('/')) {
    url = BASE + url
    const headers = new Headers(init?.headers ?? {})
    headers.set('Origin', BASE)
    if (!headers.get('x-sifarish-token')) headers.set('x-sifarish-token', TOKEN)
    return realFetch(url, { ...init, headers })
  }
  return realFetch(input as RequestInfo, init)
}) as typeof fetch

const demo = JSON.parse(readFileSync('seed/demo.seed.json', 'utf8')) as { identity: unknown; entries: unknown[] }
const { showcaseJob } = await import('../src/lib/showcase/babaclick')
const { strategize, judgePage } = await import('../src/lib/strategist')
const { makePlan } = await import('../src/lib/strategist/plan')
const { compileResume } = await import('../src/lib/compile/compiler')
const { decodeJD } = await import('../src/lib/jd/decode')
const { matchEvidence } = await import('../src/lib/match/evidence')
const { DEFAULT_SECTIONS } = await import('../src/lib/dossier/sections')
const { pageTextOf } = await import('../src/lib/darzi')

type Identity = import('../src/types').Identity
type LedgerEntry = import('../src/types').LedgerEntry
const identity = demo.identity as Identity
const ledger = demo.entries as LedgerEntry[]
const job = showcaseJob()
const t0 = Date.now()
const OUT = 'data/showcase/babaclick.strategy.json'
type Rec = { recordedAt: string; mode: import('../src/types').StrategistMode; reading: import('../src/types').Reading; plan: import('../src/types').GamePlan; critic: import('../src/types').CriticVerdict }
if (process.argv.includes('--critic-only')) {
  // The critic is the LAST call of a burst and the free lanes count per minute — when it was
  // rate-limited, judge the recorded plan again on its own, without re-spending the deep pass.
  const rec = JSON.parse(readFileSync(OUT, 'utf8')) as Rec
  const decode0 = decodeJD(job.jd)
  const coverage0 = matchEvidence(decode0, ledger)
  const resume0 = compileResume({ identity, ledger, decode: decode0, coverage: coverage0, jobId: job.id, plan: rec.plan, pagePolicy: 'two-ok', sections: DEFAULT_SECTIONS, summaryOn: true })
  let plan0 = rec.plan
  let critic0 = await judgePage(pageTextOf(resume0), rec.reading, plan0, true)
  console.log(`critic-only: ${critic0.verdict} — ${critic0.issues.join(' | ') || '—'}`)
  if (critic0.verdict === 'REVISE' && critic0.issues.length > 0) {
    // The same bounded revise the owner path runs (darzi.buildPacket): one new plan on the notes, judged again.
    const revisedReading = { ...rec.reading, summary: `${rec.reading.summary}\nCRITIC ISSUES TO FIX IN THIS PLAN: ${critic0.issues.slice(0, 5).join(' | ')}` }
    const revised = await makePlan({ reading: revisedReading, ledger, identity, sections: DEFAULT_SECTIONS }).catch(() => null)
    if (revised && revised.by !== 'heuristic') {
      plan0 = revised
      const resume1 = compileResume({ identity, ledger, decode: decode0, coverage: coverage0, jobId: job.id, plan: plan0, pagePolicy: 'two-ok', sections: DEFAULT_SECTIONS, summaryOn: true })
      const again = await judgePage(pageTextOf(resume1), rec.reading, plan0, true)
      critic0 = { ...again, revised: true }
      console.log(`revised → ${critic0.verdict} — order ${plan0.sectionOrder.join(' → ')} — ${critic0.issues.join(' | ') || '—'}`)
    } else console.log('revise did not get a brain — recorded plan kept')
  }
  if (critic0.verdict !== 'SKIPPED') {
    writeFileSync(OUT, JSON.stringify({ ...rec, plan: plan0, critic: critic0 }, null, 2) + '\n')
    console.log('recorded plan/critic updated')
  }
  process.exit(0)
}
const strategy = await strategize({ job, ledger, identity, sections: DEFAULT_SECTIONS })
if (strategy.mode === 'heuristic') {
  console.error('the deep pass fell to the heuristic floor — nothing recorded (check keys / rate limits and rerun)')
  process.exit(2)
}
const decode = decodeJD(job.jd)
const coverage = matchEvidence(decode, ledger)
const compile = (plan: import('../src/types').GamePlan) => compileResume({ identity, ledger, decode, coverage, jobId: job.id, plan, pagePolicy: 'two-ok', sections: DEFAULT_SECTIONS, summaryOn: true })
let plan = strategy.plan
let resume = compile(plan)
let critic = await judgePage(pageTextOf(resume), strategy.reading, plan, true)
if (critic.verdict === 'REVISE' && critic.issues.length > 0) {
  console.log('critic asked for a revise:', critic.issues.join(' | '))
  const revisedReading = { ...strategy.reading, summary: `${strategy.reading.summary}\nCRITIC ISSUES TO FIX IN THIS PLAN: ${critic.issues.slice(0, 5).join(' | ')}` }
  const revised = await makePlan({ reading: revisedReading, ledger, identity, sections: DEFAULT_SECTIONS }).catch(() => null)
  if (revised && revised.by !== 'heuristic') {
    plan = revised
    resume = compile(plan)
    critic = { ...(await judgePage(pageTextOf(resume), strategy.reading, plan, true)), revised: true }
  }
}
const record = {
  recordedAt: new Date().toISOString().slice(0, 10),
  mode: strategy.mode,
  reading: strategy.reading,
  plan,
  critic,
}
mkdirSync('data/showcase', { recursive: true })
writeFileSync(OUT, JSON.stringify(record, null, 2) + '\n')
console.log(`recorded: mode=${strategy.mode} played=${plan.played.length} benched=${plan.benched.length} critic=${critic.verdict}${critic.revised ? ' (after one revise)' : ''} pages=${resume.pages} in ${Date.now() - t0}ms`)
console.log('headline:', plan.threeLines.headline)
console.log('order   :', plan.sectionOrder.join(' → '))
console.log('benched :', plan.benched.map((b) => `${b.factId} (${b.reason.slice(0, 60)})`).join(' | ') || '—')
console.log('critic  :', critic.issues.join(' | ') || '—')
