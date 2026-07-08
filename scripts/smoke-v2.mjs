import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'
import { mkdirSync } from 'node:fs'

const URL = process.env.SMOKE_URL || 'https://sifarish-shv-s-projects.vercel.app'
const OUT = 'screenshots'
mkdirSync(OUT, { recursive: true })
const errors = []
const out = {}

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e))

async function shoot(name) {
  for (const [bp, w] of [['mobile', 360], ['desktop', 1280]]) {
    await page.setViewportSize({ width: w, height: 900 })
    await sleep(300)
    await page.screenshot({ path: `${OUT}/v2-${name}-${bp}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 1280, height: 900 })
}

await page.goto(URL, { waitUntil: 'networkidle' })
await page.evaluate(async () => { for (const d of (await indexedDB.databases?.()) ?? []) if (d.name) indexedDB.deleteDatabase(d.name) })
await page.reload({ waitUntil: 'networkidle' })
await sleep(900)

// Onboard
await page.getByRole('button', { name: /that's my truth/i }).click(); await sleep(400)
await page.getByRole('button', { name: /arm the radar/i }).click(); await sleep(600)

// --- Khabri: run a sweep (live keys → JSearch + signals + keyless lanes) ---
await page.getByRole('button', { name: /^2/ }).click(); await sleep(500)
await page.getByRole('button', { name: /run sweep/i }).click()
// wait for yield report
await page.waitForSelector('text=/found/', { timeout: 90000 }).catch(() => {})
await sleep(3000)
out.khabriHasYield = await page.getByText(/found/).count()
out.khabriHasSignals = await page.locator('section[aria-label="Hiring signals"] article').count()
await shoot('khabri')

// --- Guru: honest reply + guarantee refusal ---
await page.getByRole('button', { name: /^5/ }).click(); await sleep(500)
await page.getByLabel(/message guru/i).fill('can you guarantee me a job at Anthropic?')
await page.getByRole('button', { name: /send/i }).click()
await sleep(2500)
const guruText = await page.locator('div.justify-start').last().innerText().catch(() => '')
out.guruRefusesGuarantee = /won't promise|no one can guarantee|interviews decide/i.test(guruText)
await page.getByLabel(/message guru/i).fill('what should I learn next?')
await page.getByRole('button', { name: /send/i }).click()
await sleep(6000)
out.guruAnswered = await page.locator('div.justify-start').count()
await shoot('guru')

// --- Radar: NEW stamps + tailor a discovered job (triggers Intel Pass) ---
await page.getByRole('button', { name: /^3/ }).click(); await sleep(600)
out.radarNewStamps = await page.getByText('NEW', { exact: true }).count()
const tailorBtn = page.getByRole('button', { name: /tailor →/i }).first()
if (await tailorBtn.count()) {
  await tailorBtn.click()
  await sleep(9000) // intel pass + compile
  out.packetCompiled = await page.getByText('Shaurya Verma').count()
  out.hasIntelPanel = await page.getByText(/company intel|intel dossier/i).count()
  out.hasApplyPlan = await page.getByText(/apply plan/i).count()
  out.hasHonestyNote = await page.getByText(/no tool can guarantee selection/i).count()
  await shoot('packet-v2')
}

await browser.close()
out.consoleErrors = errors.length
console.log('SMOKE_V2 ' + JSON.stringify(out))
errors.slice(0, 8).forEach((e) => console.log('  ✗ ' + e))
