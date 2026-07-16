/**
 * Owner-requested: remove the 6 in-forge (repo-less) placeholder projects from his LIVE vault via
 * the app's own Tidy button (removeRepolessProjects → onOwnerMutation → sync to cloud, reversible),
 * then re-capture the clean ledger + briefing + packet. SAFETY GUARD: only tidies when his real
 * vault is loaded (GLOAMING + a placeholder both present) — never pushes a partial/seed vault.
 */
import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'
import { mkdirSync } from 'node:fs'

const URL = process.env.SMOKE_URL || 'https://sifarish-shv-s-projects.vercel.app'
const PASS = process.env.SIFARISH_PASS
const OUT = 'docs/screenshots'
mkdirSync(OUT, { recursive: true })
const log = (...a) => console.log(...a)

const browser = await chromium.launch()
const errors = []
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`))
const txt = async () => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')
const click = async (rx) => { const b = page.getByRole('button', { name: rx }).first(); if (!(await b.count())) return false; await b.click().catch(() => {}); return true }
const nav = async (label) => { await click(new RegExp(label, 'i')); await sleep(2600) }
const shot = async (name, full = false) => { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }).catch(() => {}); log('  ✓', name) }

log('→', URL)
await page.goto(URL, { waitUntil: 'networkidle' }); await sleep(1200)
await click(/owner mode|i am the owner/i); await sleep(700)
await page.getByLabel('Passcode', { exact: true }).fill(PASS)
await click(/unlock|set & unlock/i); await sleep(7000) // unlock + sync pull of his real cloud vault
for (let i = 0; i < 3; i++) { if (!(await click(/that's my truth|arm the radar/i))) break; await sleep(1500) }
await sleep(2500)

await nav('Ledger')
let body = await txt()
const hasReal = /GLOAMING/i.test(body)
const hasPlaceholder = /(DARYA|MUNSHI|KATHA|YOJANA|SUTRADHAR|Braillix)/i.test(body)
log('SAFETY: real vault loaded (GLOAMING present):', hasReal, '· placeholders present:', hasPlaceholder)

if (hasReal && hasPlaceholder) {
  // The Tidy button lives in Nabz's "Make every project deep" block, which renders only after Nabz
  // has read the linked repos from GitHub. Force that read (Sync), then wait for it to complete.
  await click(/^Sync$/)
  for (let i = 0; i < 10; i++) { await sleep(3000); if ((await page.getByRole('button', { name: /Tidy up/i }).count()) > 0) break }
  const t1 = await click(/Tidy up/i)
  await sleep(1000)
  const t2 = await click(/Yes, remove them/i)
  log('  clicked Tidy up:', t1, '· confirmed:', t2)
  await sleep(2500)
  body = await txt()
  const stillThere = /(DARYA|MUNSHI|KATHA|YOJANA|SUTRADHAR|Braillix)/i.test(body)
  log('  placeholders still on ledger after tidy:', stillThere, stillThere ? '*** CHECK ***' : '(removed ✓)')
  // Let the debounced sync (2.5s) + push complete before we close.
  await sleep(5000)
} else if (hasReal && !hasPlaceholder) {
  log('  placeholders already gone — nothing to tidy.')
} else {
  log('  *** ABORTED tidy: real vault not confirmed loaded — not touching cloud data. ***')
}

// Re-capture the clean surfaces.
await nav('Ledger')
await shot('feat-briefing')
await shot('feat-ledger', true)
await nav('Radar')
await page.getByRole('button', { name: /Tailor/i }).first().click().catch(() => {})
await sleep(4000); await sleep(16000)
await shot('feat-packet', true)

log('\nERRORS (' + errors.length + ')')
;[...new Set(errors)].slice(0, 8).forEach((e) => log('  ✗ ' + String(e).slice(0, 150)))
await browser.close()
