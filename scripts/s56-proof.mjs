/** Session 5.6 — §14 fresh-eyes: the Chief-of-Staff briefing on the landing screen + a live packet. */
import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'
import { mkdirSync } from 'node:fs'
const URL = process.env.SMOKE_URL || 'https://sifarish-shv-s-projects.vercel.app'
const PASS = process.env.SIFARISH_PASS
const OUT = process.env.SHOT_DIR || 'shots-s56'
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
await click(/unlock|set & unlock/i); await sleep(5000)
for (let i = 0; i < 3; i++) { if (!(await click(/that's my truth|arm the radar/i))) break; await sleep(1400) }
await sleep(1500)

// Landing screen = Ledger (Shelf), which now carries the Chief-of-Staff briefing at the top.
await click(/Ledger/i); await sleep(2000)
await page.screenshot({ path: `${OUT}/landing-briefing.png` }).catch(() => {})
const home = await txt()
log('BRIEFING present ("here\'s what matters"):', /here's what matters/i.test(home))
log('  greets by name (Namaste):', /namaste/i.test(home))
log('  shows a next action ("Next:"):', /Next:/i.test(home))
log('  ranks matches for him:', /Ranked for you|matches waiting/i.test(home))

// Vision drives the queue — Radar top roles.
await click(/Radar/i); await sleep(2500)
await page.screenshot({ path: `${OUT}/radar-ranked.png` }).catch(() => {})
const r = await txt()
log('Radar has ranked roles:', /of \d+ roles|\d+ of \d+|Tailor/i.test(r))

// Packet still compiles (OPEN#2 regression).
const tailored = await page.getByRole('button', { name: /Tailor/i }).first().click().then(() => true).catch(() => false)
log('clicked Tailor:', tailored); await sleep(4000)
await sleep(15000)
const pkt = await txt()
await page.screenshot({ path: `${OUT}/packet.png`, fullPage: true }).catch(() => {})
log('PacketScreen reached:', /Compiled|Compile Quality|Alignment|Export|Download PDF/i.test(pkt), '· compile error:', /Compile error/i.test(pkt))
log('OWNER ERRORS:', errors.length); [...new Set(errors)].slice(0, 8).forEach((e) => log('  ✗', String(e).slice(0, 140)))
await ctx.close()

// DEMO: briefing greets Arjun, spends nothing.
const dctx = await browser.newContext({ viewport: { width: 1200, height: 850 } })
const dp = await dctx.newPage()
const spent = []
dp.on('request', (rq) => /\/api\/(dimaag|guru|intel|pulse|polish|khabri)/.test(rq.url()) && spent.push(rq.url()))
await dp.goto(URL, { waitUntil: 'networkidle' }); await sleep(1000)
await dp.getByRole('button', { name: /show me the demo|demo mode|explore/i }).first().click().catch(() => {})
await sleep(4000)
await dp.screenshot({ path: `${OUT}/demo-briefing.png` }).catch(() => {})
const d = (await dp.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')
log('\nDEMO greets Arjun (not Shaurya):', /arjun/i.test(d), '· leaks owner name in ledger:', /shaurya verma/i.test(d))
log('DEMO metered API calls:', spent.length)
await dctx.close()
await browser.close()
