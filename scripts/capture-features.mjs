/**
 * Feature gallery capture (owner mode, real data, retina) → docs/screenshots/feat-*.png.
 * Drives the LIVE deployment as the owner and captures every feature for the README. Passcode via env.
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

const click = async (rx) => { const b = page.getByRole('button', { name: rx }).first(); if (!(await b.count())) return false; await b.click().catch(() => {}); return true }
const nav = async (label) => { await click(new RegExp(label, 'i')); await sleep(2600) }
const shot = async (name, full = false) => { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }).catch(() => {}); log('  ✓', name) }

log('→', URL)
await page.goto(URL, { waitUntil: 'networkidle' }); await sleep(1200)

// The Gate (before unlock) — server-verified ownership.
await shot('feat-gate')

// Owner unlock + sync-pull of his real vault.
await click(/owner mode|i am the owner/i); await sleep(700)
await page.getByLabel('Passcode', { exact: true }).fill(PASS)
await click(/unlock|set & unlock/i); await sleep(6000)
for (let i = 0; i < 3; i++) { if (!(await click(/that's my truth|arm the radar/i))) break; await sleep(1500) }
await sleep(2500)

// 1) LEDGER + the Chief-of-Staff briefing (landing) — the lead image.
await nav('Ledger')
await shot('feat-briefing') // viewport: briefing sits at the top
await shot('feat-ledger', true) // full page: the whole evidence ledger

// 2) RADAR — vision-ranked roles with inspectable scores.
await nav('Radar')
// expand the first job card's "why this score" for depth (click the title area, not the Tailor button).
await page.locator('article').first().click().catch(() => {})
await sleep(1200)
await shot('feat-radar')

// 3) A compiled PACKET — the money shot (JD coverage, Compile Quality, Alignment Map).
await nav('Radar')
await page.getByRole('button', { name: /Tailor/i }).first().click().catch(() => {})
await sleep(4000)
await sleep(16000) // full Editor's Desk (live reasoning) refine
await shot('feat-packet', true)

// 4) MORCHA — the pipeline war room.
await nav('Morcha')
await shot('feat-morcha')

// 5) GURU — a real dossier-grounded reply.
await nav('Guru')
const gi = page.getByRole('textbox').first()
if ((await gi.count()) > 0) {
  await gi.fill('What are my two strongest shipped projects, and how should I pitch them?')
  await page.getByRole('button', { name: /send|ask|→/i }).first().click().catch(() => {})
  await sleep(15000)
}
await shot('feat-guru')

// 6) KHABRI — cited discovery + market signals.
await nav('Khabri')
await shot('feat-khabri')

// 7) SETTINGS — the Vision Profile (tunable target roles) + budgets.
await nav('Settings')
await shot('feat-settings', true)

log('\nERRORS (' + errors.length + ')')
;[...new Set(errors)].slice(0, 10).forEach((e) => log('  ✗ ' + String(e).slice(0, 150)))
await browser.close()
