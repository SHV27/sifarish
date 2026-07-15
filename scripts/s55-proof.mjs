/**
 * Session 5.5 — §14 Fresh-eyes + Adversary(a/e) proof against the LIVE deployment.
 * Wiped browser profile each run (Playwright fresh context). Passcode from env only (SIFARISH_PASS).
 * Drives: owner walk · a live JD→packet build (OPEN#2) · a Guru turn (OPEN#3a) · demo-mode adversary.
 */
import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'
import { mkdirSync } from 'node:fs'

const URL = process.env.SMOKE_URL || 'https://sifarish-shv-s-projects.vercel.app'
const PASS = process.env.SIFARISH_PASS
const OUT = process.env.SHOT_DIR || 'shots-s55'
mkdirSync(OUT, { recursive: true })
const log = (...a) => console.log(...a)

const browser = await chromium.launch()

// ---------------------------------------------------------------- OWNER (fresh-eyes + persona e)
const errors = []
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } })
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e))
page.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`))
const body = async () => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: false }).catch(() => {}) }
const click = async (rx) => { const b = page.getByRole('button', { name: rx }).first(); if ((await b.count()) === 0) return false; await b.click().catch(() => {}); return true }

log('→', URL, '(OWNER, wiped profile)')
await page.goto(URL, { waitUntil: 'networkidle' })
await sleep(1200)
await shot('00-gate')
await click(/i am the owner/i)
await sleep(700)
await page.getByLabel('Passcode', { exact: true }).fill(PASS)
await click(/unlock|set & unlock/i)
await sleep(4500)
for (let i = 0; i < 3; i++) { if (!(await click(/that's my truth|arm the radar/i))) break; await sleep(1500) }
await sleep(1000)
const home = await body()
log('   greets Shaurya:', /shaurya/i.test(home), '· demo persona leaked:', /arjun/i.test(home))

// ---- OPEN#2: build a real packet and screenshot it ----
await click(/^Radar/i)
await sleep(2500)
await shot('01-radar')
// If the radar is empty, run a hunt first (spends a little owner budget — authorised proof).
if (!/of \d+ roles|Tailor/i.test(await body())) { await click(/hunt now/i); await sleep(12000) }
const tailored = await click(/Tailor/i)
log('   clicked Tailor:', tailored)
await sleep(4000)
await shot('02-packet-fast')
// Let the full Editor's Desk (archetype→casting→angle→red-team, live reasoning) refine + swap in.
await sleep(16000)
const pkt = await body()
await shot('03-packet-full')
log('   packet has a résumé lineup:', /PROJECTS|EDUCATION|SKILLS/i.test(pkt), '· compile error visible:', /Compile error/i.test(pkt))

// ---- OPEN#3a: Guru turn — dossier-grounded, ledger-aware ----
await click(/^Guru/i)
await sleep(2200)
const gInput = page.getByRole('textbox').first()
if ((await gInput.count()) > 0) {
  await gInput.fill('What are my two strongest shipped projects and why?')
  await (page.getByRole('button', { name: /send|ask|→/i }).first().click().catch(() => {}))
  await sleep(12000)
  const g = await body()
  log('   Guru replied (chars):', g.length, '· mentions a real project:', /GLOAMING|SIFARISH|sehat|flood|SUTRADHAR/i.test(g))
  await shot('04-guru')
}

// ---- Responsive: key screens at tablet + mobile ----
for (const [w, h, tag] of [[820, 1180, 'tablet'], [390, 844, 'mobile']]) {
  await page.setViewportSize({ width: w, height: h })
  await click(/^Ledger/i); await sleep(1500); await shot(`resp-${tag}-ledger`)
  await click(/^Radar/i); await sleep(1500); await shot(`resp-${tag}-radar`)
}

log('\nOWNER ERRORS (' + errors.length + ')')
;[...new Set(errors)].slice(0, 12).forEach((e) => log('  ✗ ' + String(e).slice(0, 150)))
await ctx.close()

// ---------------------------------------------------------------- DEMO (adversary persona a)
const dErrors = []
const dctx = await browser.newContext({ viewport: { width: 1200, height: 850 } })
const dpage = await dctx.newPage()
const spent = []
dpage.on('console', (m) => m.type() === 'error' && dErrors.push(m.text()))
dpage.on('request', (r) => { const u = r.url(); if (/\/api\/(dimaag|guru|intel|pulse|polish|khabri)/.test(u)) spent.push(u) })
log('\n→ DEMO (fresh visitor — must reach demo, spend ₹0, mutate nothing)')
await dpage.goto(URL, { waitUntil: 'networkidle' })
await sleep(1200)
await dpage.getByRole('button', { name: /explore the demo|see the demo|demo/i }).first().click().catch(() => {})
await sleep(3500)
const dbody = (await dpage.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')
log('   demo shows fictional persona (Arjun):', /arjun/i.test(dbody), '· leaks owner (Shaurya):', /shaurya verma/i.test(dbody))
// Try to trigger a sweep in demo — it must NOT spend.
await dpage.getByRole('button', { name: /hunt now|sweep|tailor/i }).first().click().catch(() => {})
await sleep(4000)
log('   metered API calls made by DEMO:', spent.length, spent.length ? '*** SPEND LEAK ***' : '(zero — structurally keyless)')
log('   DEMO console errors:', dErrors.length)
await dctx.close()

await browser.close()
