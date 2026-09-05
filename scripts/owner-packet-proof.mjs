/**
 * OWNER PACKET PROOF (v2, 05-Sep-2026) — the strategist on HIS data, on the deployed app.
 * Unlocks owner mode (passcode from env SIFARISH_PASS only), waits for the vault, opens the Packet
 * screen, picks the first already-tailored role (no new job is created), waits for the game plan
 * to render, and records: the mode badge, played/benched counts, the three lines, the first
 * headings of the page, console errors. Screenshots to SHOT_DIR.
 */
import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'
import { mkdirSync } from 'node:fs'
const URL = process.env.SMOKE_URL || 'https://sifarish-shv-s-projects.vercel.app'
const PASS = process.env.SIFARISH_PASS
const OUT = process.env.SHOT_DIR || 'shots-owner'
if (!PASS) throw new Error('SIFARISH_PASS missing')
mkdirSync(OUT, { recursive: true })
const errors = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } })
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e))
const log = (...a) => console.log(...a)
const body = async () => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')

await page.goto(URL, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /i am the owner/i }).click()
await page.getByLabel('Passcode', { exact: true }).fill(PASS)
await page.getByRole('button', { name: /unlock|set & unlock/i }).click()
// The vault (encrypted, ~800 jobs) takes a while — wait for the primary nav.
await page.getByRole('button', { name: /Packet/ }).waitFor({ timeout: 90000 })
await sleep(1500)
log('   vault open; greets Shaurya:', /shaurya/i.test(await body()))
await page.getByRole('button', { name: /Packet/ }).click()
await sleep(1500)
await page.screenshot({ path: `${OUT}/packet-list.png` })
// The tailored list: buttons under the paste lane that name a role (not the nav / paste buttons).
const cands = page.locator('section[aria-label="Existing packets"] button')
const n = await cands.count()
log('   tailored roles listed:', n)
if (n === 0) {
  log('   no tailored role in his vault — nothing to open without creating a job (not done by a script)')
} else {
  const first = cands.first()
  log('   opening:', (await first.innerText()).replace(/\s+/g, ' ').slice(0, 100))
  await first.click()
  // The instant packet lands in ~1s; the deep pass (Gemini reading + plan + critic) follows.
  await page.getByText(/The game plan — why this page looks like this/).waitFor({ timeout: 60000 })
  await page.screenshot({ path: `${OUT}/packet-instant.png`, fullPage: true })
  for (let i = 0; i < 24; i++) {
    const t = await body()
    if (/gemini deep pass|groq deep pass/.test(t) && !/still working|refining/i.test(t)) break
    await sleep(5000)
  }
  await sleep(1500)
  await page.screenshot({ path: `${OUT}/packet-reasoned.png`, fullPage: true })
  const t = await body()
  const badge = /template strategist \(keyless floor\)|gemini deep pass|groq deep pass/.exec(t)?.[0]
  const counts = /Played (\d+) · benched (\d+)/.exec(t)
  const critic = /critic: (PASS|REVISE|SKIPPED)/.exec(t)?.[1]
  const pages = /(one page|\d pages)/.exec(t)?.[1]
  log('   mode badge:', badge ?? 'NOT FOUND')
  log('   played/benched:', counts ? `${counts[1]}/${counts[2]}` : 'NOT FOUND', '· pages:', pages ?? '?', '· critic:', critic ?? 'n/a')
  const heads = (await page.locator('[aria-label="Compiled resume preview"] p').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  log('   page (first 8 lines):')
  for (const h of heads.slice(0, 8)) log('     ', h.slice(0, 120))
  const headings = heads.filter((h) => /^[A-Z &]{6,}$/.test(h))
  log('   section order:', headings.join(' → '))
}
log(`ERRORS (${errors.length})`)
for (const e of errors.slice(0, 8)) log('   ', e.slice(0, 160))
await browser.close()
