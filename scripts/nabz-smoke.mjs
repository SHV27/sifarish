import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'

const URL = 'https://sifarish-shv-s-projects.vercel.app'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.evaluate(async () => { for (const d of (await indexedDB.databases?.()) ?? []) if (d.name) indexedDB.deleteDatabase(d.name) })
await page.reload({ waitUntil: 'networkidle' })
await sleep(900)
await page.getByRole('button', { name: /that's my truth/i }).click(); await sleep(400)
await page.getByRole('button', { name: /arm the radar/i }).click(); await sleep(600)

await page.getByRole('button', { name: /^1/ }).click(); await sleep(500)
await page.getByRole('button', { name: /^sync$/i }).click()
await page.waitForSelector('text=/repos scanned/', { timeout: 20000 }).catch(() => {})
await sleep(1500)
const noteText = await page.getByText(/repos scanned/).innerText().catch(() => 'NOT FOUND')
const sifarishSuggestion = await page.getByText(/sifarish/i).count()
console.log('SYNC_NOTE:', noteText)
console.log('SIFARISH_MENTIONS:', sifarishSuggestion)
console.log('CONSOLE_ERRORS:', errors.length)
await browser.close()
