/** Session 5.5 — focused proof: a REAL packet build (OPEN#2) + demo entry (persona a). */
import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'
import { mkdirSync } from 'node:fs'
const URL = process.env.SMOKE_URL || 'https://sifarish-shv-s-projects.vercel.app'
const PASS = process.env.SIFARISH_PASS
const OUT = process.env.SHOT_DIR || 'shots-s55'
mkdirSync(OUT, { recursive: true })
const log = (...a) => console.log(...a)
const browser = await chromium.launch()

const errors = []
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`))
const txt = async () => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')
const click = async (rx) => { const b = page.getByRole('button', { name: rx }).first(); if (!(await b.count())) return false; await b.click().catch(() => {}); return true }

await page.goto(URL, { waitUntil: 'networkidle' }); await sleep(1000)
await click(/owner mode|i am the owner/i); await sleep(600)
await page.getByLabel('Passcode', { exact: true }).fill(PASS)
await click(/unlock|set & unlock/i); await sleep(5000) // unlock + sync pull of his vault (D54)
for (let i = 0; i < 3; i++) { if (!(await click(/that's my truth|arm the radar/i))) break; await sleep(1400) }
await sleep(1000)

await click(/Radar/i); await sleep(3000) // nav is "3 Radar …" — unanchored match
await page.screenshot({ path: `${OUT}/radar-live.png` }).catch(() => {})
const r = await txt()
log('radar roles present:', /of \d+ roles|\d+ of \d+|Tailor/i.test(r))

// Tailor the first job → PacketScreen (the two-phase build: fast, then live-reasoned refine).
const clicked = await page.getByRole('button', { name: /Tailor/i }).first().click().then(() => true).catch(() => false)
log('clicked Tailor:', clicked)
await sleep(3500)
await page.screenshot({ path: `${OUT}/packet-fast.png` }).catch(() => {})
await sleep(18000) // full Editor's Desk with live reasoning refines + swaps in
const pkt = await txt()
await page.screenshot({ path: `${OUT}/packet-full.png`, fullPage: true }).catch(() => {})
log('PacketScreen reached:', /Compiled|Application Packet|Export|Download PDF|Cover letter|Alignment/i.test(pkt))
log('compile error visible:', /Compile error/i.test(pkt))
log('packet names a real project:', /GLOAMING|DARYA|SUTRADHAR|sehat|flood|Rupnagar|SIFARISH/i.test(pkt))
log('OWNER ERRORS:', errors.length); [...new Set(errors)].slice(0, 8).forEach((e) => log('  ✗', String(e).slice(0, 140)))
await ctx.close()

// DEMO (persona a): the button is "Show me the demo →".
const dctx = await browser.newContext({ viewport: { width: 1200, height: 850 } })
const dp = await dctx.newPage()
const spent = []
dp.on('request', (rq) => /\/api\/(dimaag|guru|intel|pulse|polish|khabri)/.test(rq.url()) && spent.push(rq.url()))
await dp.goto(URL, { waitUntil: 'networkidle' }); await sleep(1000)
const enteredDemo = await dp.getByRole('button', { name: /show me the demo|demo mode|explore/i }).first().click().then(() => true).catch(() => false)
log('\nDEMO clicked:', enteredDemo)
await sleep(4000)
await dp.screenshot({ path: `${OUT}/demo-home.png` }).catch(() => {})
const d = (await dp.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')
log('demo shows Arjun (fictional persona):', /arjun/i.test(d))
log('demo shows a ledger/projects (usable showcase):', /projects|ledger|radar|shipped/i.test(d))
await dp.getByRole('button', { name: /hunt now|sweep|tailor/i }).first().click().catch(() => {})
await sleep(4000)
log('metered API calls by DEMO:', spent.length)
await dctx.close()
await browser.close()
