/**
 * RESUME EYE (v2, 05-Sep-2026) — render a packet to PNG so a human (or the studio) can READ it.
 *
 * The brief's verification standard is "read it as a recruiter would", not "tests pass". This
 * script compiles the seed dossier against a posting through the SAME strategist + compiler the
 * app uses (keyless floor by default; `--live` routes the reasoning calls to production with the
 * owner token, like live-tailor-proof.mts), writes the PDF, then rasterises every page with
 * pdf.js inside headless Chromium (no native canvas dependency) and saves PNGs.
 *
 * Run:  npx tsx scripts/resume-eye.mts <posting.txt> <company> <title> [outdir] [--live]
 */
import 'fake-indexeddb/auto'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

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

const [, , postingPath, company = 'Company', title = 'Role', outdir = 'shots-eye', ...flags] = process.argv
const live = flags.includes('--live')
if (!postingPath || !existsSync(postingPath)) {
  console.error('usage: npx tsx scripts/resume-eye.mts <posting.txt> <company> <title> [outdir] [--live]')
  process.exit(1)
}
mkdirSync(outdir, { recursive: true })

if (live) {
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
}

const { SEED_IDENTITY, SEED_LEDGER, fakeJob } = await import('../tests/helpers')
const { DEFAULT_VISION } = await import('../src/db/seed')
const { strategize, strategizeFast, judgePage } = await import('../src/lib/strategist')
const { compileResume } = await import('../src/lib/compile/compiler')
const { decodeJD } = await import('../src/lib/jd/decode')
const { matchEvidence } = await import('../src/lib/match/evidence')
const { renderResumePdf } = await import('../src/lib/export/pdf')
const { extractPdfText, verifyLines } = await import('../src/lib/export/parseback')

const posting = readFileSync(postingPath, 'utf8')
const job = fakeJob(company, title, posting)
const t0 = Date.now()
const strategy = live ? await strategize({ job, ledger: SEED_LEDGER, identity: SEED_IDENTITY, vision: DEFAULT_VISION }) : strategizeFast({ job, ledger: SEED_LEDGER, identity: SEED_IDENTITY, vision: DEFAULT_VISION })
const decode = decodeJD(job.jd)
const coverage = matchEvidence(decode, SEED_LEDGER)
const resume = compileResume({ identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, jobId: job.id, plan: strategy.plan, pagePolicy: 'two-ok' })
const critic = live ? await judgePage(resume.lines.map((l) => `${l.text}${l.right ? ` ${l.right}` : ''}`).join('\n'), strategy.reading, strategy.plan, true) : null
const pdf = await renderResumePdf(resume)
const pdfPath = join(outdir, `${company.replace(/\W+/g, '_')}.pdf`)
writeFileSync(pdfPath, pdf)
const pb = verifyLines(resume, await extractPdfText(new Uint8Array(pdf)))

writeFileSync(
  join(outdir, `${company.replace(/\W+/g, '_')}.plan.json`),
  JSON.stringify({ mode: strategy.mode, reading: strategy.reading, plan: strategy.plan, critic, pages: resume.pages, tighten: resume.tighten, parseback: pb.ok, ms: Date.now() - t0 }, null, 2),
)

// Rasterise with pdf.js in headless Chromium.
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1 })
const b64 = Buffer.from(pdf).toString('base64')
await page.setContent(`<html><body style="margin:0;background:#fff"><script type="module">
import * as pdfjs from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs'
pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'
const bytes = Uint8Array.from(atob('${b64}'), c => c.charCodeAt(0))
const doc = await pdfjs.getDocument({ data: bytes }).promise
for (let p = 1; p <= doc.numPages; p++) {
  const pg = await doc.getPage(p)
  const vp = pg.getViewport({ scale: 2 })
  const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.id = 'p' + p
  document.body.appendChild(c)
  await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
}
document.body.setAttribute('data-done', String(doc.numPages))
</script></body></html>`)
await page.waitForSelector('body[data-done]', { timeout: 60000 })
const n = Number(await page.getAttribute('body', 'data-done'))
for (let p = 1; p <= n; p++) {
  const el = await page.$(`#p${p}`)
  await el!.screenshot({ path: join(outdir, `${company.replace(/\W+/g, '_')}-p${p}.png`) })
}
await browser.close()
console.log(`${company}: mode=${strategy.mode} pages=${resume.pages} tighten=${resume.tighten} parseback=${pb.ok ? 'ok' : 'FAIL'} critic=${critic?.verdict ?? 'n/a'} → ${outdir}/ (${n} png) in ${Date.now() - t0}ms`)
console.log('headline:', strategy.plan.threeLines.headline)
console.log('summary :', strategy.plan.threeLines.summary)
console.log('order   :', strategy.plan.sectionOrder.join(' → '))
console.log('benched :', strategy.plan.benched.map((b) => `${b.factId} (${b.reason.slice(0, 60)})`).join(' | ') || 'none')
if (critic) console.log('critic  :', critic.verdict, critic.issues.join(' | '))
