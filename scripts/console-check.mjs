import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { writeFileSync } from 'node:fs'

const PORT = 4318
const BASE = `http://localhost:${PORT}`
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true })

const errors = []
const warnings = []
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE)).ok) break } catch { await sleep(500) }
  }
  const browser = await chromium.launch()
  const page = await browser.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
    if (m.type() === 'warning') warnings.push(m.text())
  })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e)))

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(async () => { for (const d of (await indexedDB.databases?.()) ?? []) if (d.name) indexedDB.deleteDatabase(d.name) })
  await page.reload({ waitUntil: 'networkidle' })
  await sleep(800)
  await page.getByRole('button', { name: /that's my truth/i }).click(); await sleep(300)
  await page.getByRole('button', { name: /arm the radar/i }).click(); await sleep(500)
  // Visit every screen
  for (const n of ['1', '2', '3', '4', '5']) { await page.getByRole('button', { name: new RegExp('^' + n) }).click(); await sleep(400) }
  // Tailor a packet
  await page.getByRole('button', { name: /^3/ }).click(); await sleep(300)
  await page.getByLabel('Company').fill('Anthropic')
  await page.getByLabel('Role title').fill('AI Eng Intern')
  await page.getByLabel('Job description text').fill('Requirements\n- Python\n- LLM, RAG, agents, evals\nRemote. PPO available.')
  await page.getByRole('button', { name: /tailor from text/i }).click(); await sleep(600)
  await page.getByRole('button', { name: /tailor this packet/i }).click(); await sleep(800)
  await browser.close()
} finally {
  server.kill()
}
const out = { errors, warnings }
writeFileSync('screenshots/console-report.json', JSON.stringify(out, null, 2))
console.log(`CONSOLE_ERRORS=${errors.length} CONSOLE_WARNINGS=${warnings.length}`)
errors.slice(0, 20).forEach((e) => console.log('  ✗ ' + e))
process.exit(0)
