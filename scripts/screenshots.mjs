import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const OUT = 'screenshots'
mkdirSync(OUT, { recursive: true })
const BREAKPOINTS = [
  { name: 'mobile', width: 360, height: 780 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
]
const PORT = 4317
const BASE = `http://localhost:${PORT}`

const SAMPLE_JD = `About the role
We're hiring an AI Engineering Intern to build agentic systems on large language models.

Requirements
- Strong Python
- LLM applications, prompt engineering, and RAG
- Building AI agents and tool use
- Evals and guardrails

Nice to have
- LoRA fine-tuning
- TypeScript

Paid internship. Remote-friendly. PPO available for strong performers.`

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'inherit',
  shell: true,
})

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE)
      if (r.ok) return
    } catch {
      /* not up yet */
    }
    await sleep(500)
  }
  throw new Error('preview server did not start')
}

const consoleErrors = []

async function shoot(page, screen, note = '') {
  for (const bp of BREAKPOINTS) {
    await page.setViewportSize({ width: bp.width, height: bp.height })
    await sleep(350)
    await page.screenshot({ path: `${OUT}/${screen}-${bp.name}.png`, fullPage: true })
  }
  console.log(`  ✓ ${screen} ${note}`)
}

try {
  await waitForServer()
  const browser = await chromium.launch()
  const page = await browser.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(String(err)))

  // Fresh DB each run
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    for (const db of await indexedDB.databases?.()) if (db.name) indexedDB.deleteDatabase(db.name)
  })
  await page.reload({ waitUntil: 'networkidle' })
  await sleep(800)

  // --- Onboarding ---
  await shoot(page, '1-onboarding', '(confirm ledger)')
  await page.getByRole('button', { name: /that's my truth/i }).click()
  await sleep(400)
  await shoot(page, '2-onboarding-hunt', '(pick watchlist)')
  await page.getByRole('button', { name: /arm the radar/i }).click()
  await sleep(600)

  // --- Shelf ---
  await page.setViewportSize({ width: 1280, height: 900 })
  await shoot(page, '3-shelf', '(ledger shelf)')

  // --- Packet via paste lane (deterministic, no network) ---
  await page.getByRole('button', { name: /^3/ }).click() // nav to Packet
  await sleep(400)
  await page.getByLabel('Company').fill('Anthropic')
  await page.getByLabel('Role title').fill('AI Engineering Intern')
  await page.getByLabel('Job description text').fill(SAMPLE_JD)
  await shoot(page, '4-packet-pastelane', '(paste lane)')
  await page.getByRole('button', { name: /tailor from text/i }).click()
  await sleep(700)
  await page.getByRole('button', { name: /tailor this packet/i }).click()
  await sleep(900)
  await shoot(page, '5-packet-compiled', '(compiled dossier)')

  // Mark applied → populates Morcha
  const markBtn = page.getByRole('button', { name: /mark as applied/i })
  if (await markBtn.count()) {
    await markBtn.first().click()
    await sleep(500)
  }

  // --- Morcha ---
  await page.getByRole('button', { name: /^4/ }).click()
  await sleep(500)
  await shoot(page, '6-morcha', '(war room)')

  // --- Settings ---
  await page.getByRole('button', { name: /^5/ }).click()
  await sleep(400)
  await shoot(page, '7-settings', '(keyless mode)')

  // --- Radar (live scan attempt; empty-state fallback is also a designed screen) ---
  await page.getByRole('button', { name: /^2/ }).click()
  await sleep(400)
  await shoot(page, '8-radar-initial', '(dark radar)')

  await browser.close()

  console.log('\nConsole errors during capture:', consoleErrors.length)
  for (const e of consoleErrors.slice(0, 20)) console.log('  ✗', e)
  process.exitCode = 0
} catch (e) {
  console.error('screenshot run failed:', e)
  process.exitCode = 1
} finally {
  server.kill()
}
