/** Session 5.6 — drive the live app: re-forge his ledger with the NEW forge, capture the new résumé. */
import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'
import { mkdirSync } from 'node:fs'
const URL = process.env.SMOKE_URL || 'https://sifarish-shv-s-projects.vercel.app'
const PASS = process.env.SIFARISH_PASS
const OUT = process.env.SHOT_DIR || 'shots-s56b'
mkdirSync(OUT, { recursive: true })
const log = (...a) => console.log(...a)
const browser = await chromium.launch()
const errors = []
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`))
const txt = async () => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')
const click = async (rx) => { const b = page.getByRole('button', { name: rx }).first(); if (!(await b.count())) return false; await b.click().catch(() => {}); return true }
const nav = async (label) => { await click(new RegExp(label, 'i')); await sleep(2600) }

await page.goto(URL, { waitUntil: 'networkidle' }); await sleep(1200)
await click(/owner mode|i am the owner/i); await sleep(700)
await page.getByLabel('Passcode', { exact: true }).fill(PASS)
await click(/unlock|set & unlock/i); await sleep(7000)
for (let i = 0; i < 3; i++) { if (!(await click(/that's my truth|arm the radar/i))) break; await sleep(1500) }
await sleep(2000)

// Nabz → load repos → Re-forge all (the new forge: efficient brief + accomplishment bullets).
await nav('Ledger')
await click(/^Sync$/)
for (let i = 0; i < 10; i++) { await sleep(3000); if ((await page.getByRole('button', { name: /Re-forge all/i }).count()) > 0) break }
const started = await click(/Re-forge all/i)
log('clicked Re-forge all:', started)
// The forge calls run one per project; with backoff on the free tier this can take a bit.
for (let i = 0; i < 24; i++) {
  await sleep(5000)
  const b = await txt()
  if (/Re-forged \d+ entr/i.test(b)) { log('reforge note:', (b.match(/Re-forged[^.]*\.[^.]*\./) || [''])[0].slice(0, 220)); break }
}
await sleep(2000)
await page.screenshot({ path: `${OUT}/ledger-reforged.png`, fullPage: true }).catch(() => {})

// Tailor a job → the new résumé.
await nav('Radar')
await page.getByRole('button', { name: /Tailor/i }).first().click().catch(() => {})
await sleep(4000); await sleep(18000) // full Editor's Desk with the improved bullets
const pkt = await txt()
await page.screenshot({ path: `${OUT}/packet-new.png`, fullPage: true }).catch(() => {})
log('packet compiled:', /Compiled|Compile Quality|Alignment/i.test(pkt), '· compile error:', /Compile error/i.test(pkt))
log('OWNER ERRORS:', errors.length); [...new Set(errors)].slice(0, 8).forEach((e) => log('  ✗', String(e).slice(0, 140)))
await browser.close()
