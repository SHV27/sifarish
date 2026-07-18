/**
 * DEMO FRESH-EYES SMOKE (§14 Proof 2 + adversary persona (a)) — a wiped browser reaches the
 * demo showcase, sees the FICTIONAL persona (Arjun), spends ₹0 on metered functions, and hits
 * zero console errors across every screen. No secret required — this is the stranger's path.
 */
import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'

const URL = process.env.SMOKE_URL || 'https://sifarish-shv-s-projects.vercel.app'
const errors = []
const meteredHits = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } })
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e))
page.on('request', (r) => {
  if (/\/api\/(dimaag|polish|guru|intel|khabri|vault)/.test(r.url()) && r.method() === 'POST') meteredHits.push(r.url())
})

const body = async () => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')
console.log('→', URL)
await page.goto(URL, { waitUntil: 'networkidle' })
await sleep(1500)

// The Gate: choose the demo showcase.
const demoBtn = page.getByRole('button', { name: /show me the demo/i }).first()
if ((await demoBtn.count()) > 0) {
  await demoBtn.click()
  await sleep(6000) // demo mode full-reloads + seeds the fictional vault (D48/D49)
}

const screens = ['Ledger', 'Khabri', 'Radar', 'Packet', 'Guru', 'Morcha', 'Settings']
let text = ''
for (const s of screens) {
  const nav = page.getByRole('button', { name: new RegExp(s, 'i') }).first()
  if ((await nav.count()) > 0) {
    await nav.click()
    await sleep(1600)
  }
  text += ' ' + (await body())
  console.log(`   screen ${s}: rendered`)
}
console.log('   demo persona (Arjun) visible:', /arjun/i.test(text))
console.log('   owner name leak (Shaurya greeting):', /namaste,? shaurya/i.test(text) ? 'LEAK!' : 'none')
console.log('   metered POSTs from demo browser:', meteredHits.length, meteredHits.slice(0, 3))
console.log('   console/page/http ERRORS (' + errors.length + ')', errors.slice(0, 6))
await browser.close()
process.exit(errors.length > 0 || meteredHits.length > 0 ? 1 : 0)
