/**
 * LIVE TAILOR PROOF (Session 5.9, addendum §5 — "first output = final output").
 *
 * Drives the REAL Editor's Desk (archetype → casting → surgery → framing rewrite → red-team)
 * over the owner's REAL seed ledger against TWO REAL Netomi JDs (fetched live from their Lever
 * board), with every reasoning call going to the PRODUCTION /api/dimaag (owner-token-gated —
 * the passcode is read from gitignored owner-code.local.txt and never printed).
 *
 * Run:  npx tsx scripts/live-tailor-proof.mts
 * Requires: owner-code.local.txt at repo root; the two JD files in the scratchpad (or pass paths).
 */
import 'fake-indexeddb/auto'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

// --- owner-mode + token shims (same shape as tests/setup.ts) ---
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

// --- fetch shim: relative /api/* → production, with the owner token + Origin ---
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

async function main() {
  const { db } = await import('../src/db/db')
  // Prefer his REAL vault: the app's own server-blind sync path (D54) — key derived from the
  // owner code locally, ciphertext pulled from prod, restore-on-empty. Falls back to the seed.
  try {
    const sync = await import('../src/lib/sync')
    await sync.establishSyncKey(PASS)
    const r = await sync.pullVault()
    console.log(`cloud vault pull: restored=${r.restored}`)
  } catch (e) {
    console.log('cloud vault pull failed:', String(e).slice(0, 120))
  }
  if ((await db.ledger.count()) === 0) {
    const seed = JSON.parse(readFileSync('seed/ledger.seed.json', 'utf8'))
    await db.ledger.bulkPut(seed.entries)
    await db.identity.put(seed.identity)
    console.log('(fell back to the public seed ledger)')
  }
  await db.budgets.clear() // fresh budget month for the proof

  const { decodeJD } = await import('../src/lib/jd/decode')
  const { matchEvidence } = await import('../src/lib/match/evidence')
  const { compileResume } = await import('../src/lib/compile/compiler')
  const { runEditor, redTeamPass } = await import('../src/lib/darzi/editor')
  const { estimateQuality } = await import('../src/lib/ustaad/quality')
  const { scanSlop, scanGuarantee } = await import('../src/lib/slop/scan')
  const { detectDrift } = await import('../src/lib/polish/factGuard')
  const { extractPdfLikeText } = await import('../src/lib/compile/compiler').then((m) => ({ extractPdfLikeText: null as null })).catch(() => ({ extractPdfLikeText: null }))
  void extractPdfLikeText

  const scratch = process.env.SCRATCH || 'C:/Users/Lenovo/AppData/Local/Temp/claude/c--Users-Lenovo-Downloads-Sifarish/515298a5-bc36-462a-8fd5-819e02622f2c/scratchpad'
  const jds = [
    JSON.parse(readFileSync(`${scratch}/jd-agentic-engineer.json`, 'utf8')),
    JSON.parse(readFileSync(`${scratch}/jd-fde-lead.json`, 'utf8')),
  ] as { title: string; url: string; jd: string }[]

  const ledger = await db.ledger.toArray()
  const identity = (await db.identity.get('me'))!
  const projects = ledger.filter((e) => e.resumeEligible && e.tier === 'shipped' && e.kind === 'project')
  console.log(`Ledger: ${ledger.length} entries · ${projects.length} shipped projects · identity: ${identity.name}`)

  const framingsByJd: Record<string, string[]> = {}

  for (const item of jds) {
    console.log(`\n${'='.repeat(90)}\n== NETOMI · ${item.title} · ${item.url}\n${'='.repeat(90)}`)
    const decode = decodeJD(item.jd)
    const coverage = matchEvidence(decode, ledger)
    const t0 = Date.now()
    const ed = await runEditor({ projects, decode, jd: item.jd, company: 'Netomi' })
    const ms = Date.now() - t0

    console.log(`archetype: ${ed.plan.archetype.label} (${ed.plan.archetype.by}, conf ${ed.plan.archetype.confidence})`)
    console.log(`casting by: ${ed.plan.casting.by} · order: ${ed.order.join(' > ')}`)
    for (const c of ed.plan.chosen) console.log(`  angle[${c.title}]: "${c.angleLabel}" (${c.angleRationale.by})`)
    const overrides = ed.bulletOverrides ?? {}
    console.log(`framing rewrites applied: ${Object.keys(overrides).length} (editor ${ms}ms)`)
    framingsByJd[item.title] = Object.values(overrides)

    // Drift re-verification, independently of the reframer's own guard:
    let driftFail = 0
    for (const [bid, text] of Object.entries(overrides)) {
      const entry = ledger.find((e) => e.bullets.some((b) => b.id === bid))
      if (!entry) continue
      const truth = [
        ...entry.bullets.map((b) => `${b.text} ${b.metrics ?? ''}`),
        entry.summary ?? '', (entry.tags ?? []).join(' '),
        entry.context?.problem ?? '', (entry.context?.features ?? []).join(' '),
        (entry.context?.stack ?? []).join(' '), entry.context?.readme ?? '',
      ].join('\n')
      if (!detectDrift(truth, text).ok) driftFail++
    }
    console.log(`independent drift re-check on overrides: ${driftFail} failures`)

    const resume = compileResume({
      identity, ledger, decode, coverage, jobId: `live-${item.title}`,
      editorial: { order: ed.order, bullets: ed.bullets, sectionOrder: ed.sectionOrder },
      bulletOverrides: ed.bulletOverrides,
    })
    const text = resume.lines.map((l) => l.text).join('\n')
    const rt = await redTeamPass(text, decode, { label: ed.plan.archetype.label, priorities: ed.plan.archetype.priorities })
    const q = estimateQuality(resume, coverage, ledger)
    const slop = scanSlop(text)
    const guarantee = scanGuarantee(text)
    console.log(`red-team: ${rt.verdict} (${rt.by}) fixes: ${rt.fixes.length ? rt.fixes.join(' | ').slice(0, 300) : 'none'}`)
    console.log(`compile quality: ${q.score}/100 · slop hits: ${slop.length} · guarantee hits: ${guarantee.length} (I9)`)
    console.log(`\n---------- RÉSUMÉ TEXT (${item.title}) ----------`)
    console.log(text)
  }

  // The two-JD framing difference (addendum gate 2, live):
  const [a, b] = Object.values(framingsByJd)
  const overlap = a?.filter((x) => b?.includes(x)) ?? []
  console.log(`\n${'='.repeat(90)}`)
  console.log(`FRAMING DIFF: JD-A rewrites=${a?.length ?? 0} · JD-B rewrites=${b?.length ?? 0} · identical lines across JDs=${overlap.length}`)

  const usage = await db.dimaagUsage.toArray()
  const calls = usage.reduce((n, r) => n + r.calls, 0)
  const fallbacks = usage.reduce((n, r) => n + r.fallbacks, 0)
  console.log(`dimaag usage this run: ${calls} real calls · ${fallbacks} fallbacks · features: ${usage.map((u) => `${u.feature}(${u.calls}c/${u.fallbacks}f)`).join(', ')}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
