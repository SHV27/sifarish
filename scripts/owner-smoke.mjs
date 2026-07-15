/**
 * OWNER-MODE LIVE SMOKE (§14 Proof 2/3) — drives the REAL deployment as the real owner.
 * Passcode from env only (SIFARISH_PASS); never written into the repo.
 */
import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'
import { mkdirSync } from 'node:fs'

const URL = process.env.SMOKE_URL || 'https://sifarish-shv-s-projects.vercel.app'
const PASS = process.env.SIFARISH_PASS
const OUT = process.env.SHOT_DIR || 'shots'
mkdirSync(OUT, { recursive: true })

const errors = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } })
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e))
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`)
})

const log = (...a) => console.log(...a)
const body = async () => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')
const shot = async (n) => {
  await page.screenshot({ path: `${OUT}/${n}.png` }).catch(() => {})
}
const click = async (rx) => {
  const b = page.getByRole('button', { name: rx }).first()
  if ((await b.count()) === 0) return false
  await b.click().catch(() => {})
  return true
}

log('→', URL)
await page.goto(URL, { waitUntil: 'networkidle' })
await sleep(1200)
await shot('00-gate')

await click(/i am the owner/i)
await sleep(700)
const pw = page.getByLabel('Passcode', { exact: true })
const serverVerified = (await page.getByLabel('Confirm passcode').count()) === 0
await pw.fill(PASS)
await click(/unlock|set & unlock/i)
await sleep(4000)
log('   server-verified owner (not local fallback):', serverVerified)

// Fresh vault → onboarding. This IS the fresh-eyes condition (§14 Proof 2).
for (let i = 0; i < 3; i++) {
  if (!(await click(/that's my truth|arm the radar/i))) break
  await sleep(1600)
}
await sleep(1200)
const home = await body()
log('   greets Shaurya:', /shaurya/i.test(home), '· demo persona leaked:', /arjun/i.test(home))
await shot('01-ledger')

const go = async (label) => {
  const ok = await click(new RegExp(label, 'i'))
  await sleep(2600)
  return ok
}

for (const [label, name] of [
  ['Ledger', 'ledger'],
  ['Khabri', 'khabri'],
  ['Radar', 'radar'],
  ['Guru', 'guru'],
  ['Morcha', 'morcha'],
  ['Settings', 'settings'],
]) {
  const ok = await go(label)
  await shot(`nav-${name}`)
  log(`   nav ${name}:`, ok ? 'ok' : 'NOT FOUND')
}

// ---- RADAR: search + hunt panel + vision hunts (D64 / D67 / D69) ----
await go('Radar')
log('\n== RADAR ==')
log('   hunt panel:', (await page.getByRole('region', { name: /hunts/i }).count()) > 0)
log('   "from my vision" button:', (await page.getByRole('button', { name: /from my vision/i }).count()) > 0)
log('   "Hunt now" button:', (await page.getByRole('button', { name: /hunt now/i }).count()) > 0)

const search = page.getByRole('searchbox').first()
if ((await search.count()) > 0) {
  await search.fill('ai')
  await sleep(1400)
  const t = await body()
  log('   search "ai":', (t.match(/(\d+) of (\d+) roles match/) || ['(no match line — empty radar?)'])[0])
  await shot('radar-search-ai')
  await search.fill('')
  await sleep(600)
} else {
  log('   SEARCHBOX MISSING (radar may be empty)')
}

if (await click(/from my vision/i)) {
  await sleep(1600)
  const t = await body()
  log('   vision hunts:', (t.match(/implies (\d+) hunt[s]?/) || t.match(/nothing you aren/) || ['(no proposal line)'])[0])
  await shot('radar-vision-hunts')
}

log('\nERRORS (' + errors.length + ')')
;[...new Set(errors)].slice(0, 12).forEach((e) => log('  ✗ ' + String(e).slice(0, 160)))
await browser.close()
