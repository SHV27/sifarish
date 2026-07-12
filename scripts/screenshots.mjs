import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
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
  const apiMisses = []
  page.on('response', (res) => {
    if (res.status() >= 400) {
      const url = new URL(res.url())
      // /api/* 404s under `vite preview` are the DESIGNED keyless degradation (no serverless
      // functions locally; every caller falls back deterministically). Anything else is a defect.
      if (url.pathname.startsWith('/api/')) apiMisses.push(url.pathname)
      else consoleErrors.push(`HTTP ${res.status()} on ${res.url()}`)
    }
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/failed to load resource.*404/i.test(msg.text())) consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(String(err)))

  // Fresh visitor each run: wipe IndexedDB AND localStorage (Darbaan state lives there)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    localStorage.clear()
    for (const db of await indexedDB.databases?.()) if (db.name) indexedDB.deleteDatabase(db.name)
  })
  await page.reload({ waitUntil: 'networkidle' })
  await sleep(800)

  // --- The Gate (D46): every fresh browser chooses its door ---
  await shoot(page, '0-gate', '(owner vs demo gate)')
  await page.getByRole('button', { name: /show me the demo/i }).click()
  await sleep(600)
  await shoot(page, '0-darshak-showcase', '(demo mode, fictional persona)')

  // --- Owner Mode via the gate. Local preview has no server secret → local first-run flow ---
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: /owner mode/i }).click()
  await sleep(400)
  await page.getByRole('button', { name: /i am the owner/i }).click()
  await sleep(400)
  await page.getByLabel('Passcode', { exact: true }).fill('screenshot-run')
  await page.getByLabel('Confirm passcode').fill('screenshot-run')
  await page.getByRole('button', { name: /set & unlock/i }).click()
  await sleep(600)

  // --- Onboarding (owner, not yet onboarded) ---
  await shoot(page, '1-onboarding', '(confirm ledger)')
  await page.getByRole('button', { name: /that's my truth/i }).click()
  await sleep(400)
  await shoot(page, '2-onboarding-hunt', '(pick watchlist)')
  await page.getByRole('button', { name: /arm the radar/i }).click()
  await sleep(600)

  // --- Shelf ---
  await page.setViewportSize({ width: 1280, height: 900 })
  await shoot(page, '3-shelf', '(ledger shelf)')

  // --- Packet via paste lane (deterministic, no network). Nav: 4 = Packet (v4 order) ---
  await page.getByRole('button', { name: /^4/ }).click()
  await sleep(400)
  await page.getByLabel('Company').fill('Anthropic')
  await page.getByLabel('Role title').fill('AI Engineering Intern')
  await page.getByLabel('Job description text').fill(SAMPLE_JD)
  await shoot(page, '4-packet-pastelane', '(paste lane)')
  await page.getByRole('button', { name: /tailor from text/i }).click()
  await sleep(900)
  const tailorBtn = page.getByRole('button', { name: /tailor this packet/i })
  if (await tailorBtn.count()) {
    await tailorBtn.click()
    await sleep(1200)
  } else {
    await sleep(1500) // auto-tailor path
  }
  await shoot(page, '5-packet-compiled', '(compiled dossier + quality + baithak)')

  // Mark applied → populates Morcha
  const markBtn = page.getByRole('button', { name: /mark as applied/i })
  if (await markBtn.count()) {
    await markBtn.first().click()
    await sleep(500)
  }

  // --- Morcha (6) with Dak Khana panel ---
  await page.getByRole('button', { name: /^6/ }).click()
  await sleep(500)
  await shoot(page, '6-morcha', '(war room + dak khana)')

  // --- Khabri (2) with Taleem Radar ---
  await page.getByRole('button', { name: /^2/ }).click()
  await sleep(400)
  await shoot(page, '7-khabri-taleem', '(khabri + taleem radar)')

  // --- Settings (7): darbaan, ustaad, budgets ---
  await page.getByRole('button', { name: /^7/ }).click()
  await sleep(400)
  await shoot(page, '8-settings', '(darbaan + ustaad + budgets)')

  // --- Radar (3) ---
  await page.getByRole('button', { name: /^3/ }).click()
  await sleep(400)
  await shoot(page, '9-radar-initial', '(radar)')

  await browser.close()

  console.log('\nConsole errors during capture:', consoleErrors.length)
  for (const e of consoleErrors.slice(0, 20)) console.log('  ✗', e)
  writeFileSync(
    `${OUT}/console-report.json`,
    JSON.stringify(
      { errors: consoleErrors, keylessApiFallbacks: [...new Set(apiMisses)], at: new Date().toISOString() },
      null,
      2,
    ),
  )
  server.kill()
  process.exit(0) // hard exit: on Windows the shell-wrapped preview server otherwise keeps the run alive
} catch (e) {
  console.error('screenshot run failed:', e)
  writeFileSync(`${OUT}/console-report.json`, JSON.stringify({ failed: String(e), errors: consoleErrors }, null, 2))
  server.kill()
  process.exit(1)
}
