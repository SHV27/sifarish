import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'

const URL = process.env.SMOKE_URL || 'https://sifarish-shv-s-projects.vercel.app'
const errors = []
const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e)))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.evaluate(async () => { for (const d of (await indexedDB.databases?.()) ?? []) if (d.name) indexedDB.deleteDatabase(d.name) })
await page.reload({ waitUntil: 'networkidle' })
await sleep(900)
await page.getByRole('button', { name: /that's my truth/i }).click(); await sleep(400)
await page.getByRole('button', { name: /arm the radar/i }).click(); await sleep(600)

// Radar → scan → click first Tailor
await page.getByRole('button', { name: /^3/ }).click(); await sleep(500)
await page.getByRole('button', { name: /scan the boards|scan now/i }).first().click()
await page.waitForSelector('button:has-text("Tailor")', { timeout: 90000 }).catch(() => {})
await sleep(3000)
const tailorButtons = await page.getByRole('button', { name: /tailor →/i }).count()
console.log('TAILOR_BUTTONS:', tailorButtons)

const t0 = Date.now()
if (tailorButtons > 0) {
  await page.getByRole('button', { name: /tailor →/i }).first().click()
  // Wait up to 30s for either the packet screen (resume) or an error
  let landed = false
  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    if ((await page.getByText('Shaurya Verma').count()) > 0 || (await page.getByText(/compile error|compiling/i).count()) > 0) { landed = true; break }
  }
  console.log('ELAPSED_MS:', Date.now() - t0, 'LANDED:', landed)
  console.log('ON_PACKET_SCREEN:', (await page.getByText(/the editor's desk|tailor this packet|shaurya verma/i).count()) > 0)
}
console.log('CONSOLE_ERRORS:', errors.length)
errors.slice(0, 10).forEach((e) => console.log('  ✗ ' + e))
await browser.close()
