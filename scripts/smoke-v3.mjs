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
    await page.screenshot({ path: `${OUT}/v3-${name}-${bp}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 1280, height: 900 })
}

await page.goto(URL, { waitUntil: 'networkidle' })
await page.evaluate(async () => { for (const d of (await indexedDB.databases?.()) ?? []) if (d.name) indexedDB.deleteDatabase(d.name) })
await page.reload({ waitUntil: 'networkidle' })
await sleep(900)
await page.getByRole('button', { name: /that's my truth/i }).click(); await sleep(400)
await page.getByRole('button', { name: /arm the radar/i }).click(); await sleep(600)

// Tailor via paste lane (deterministic JD) — triggers the four-pass Editor's Desk with live Dimaag.
await page.getByRole('button', { name: /^4/ }).click(); await sleep(400)
await page.getByLabel('Company').fill('Anthropic')
await page.getByLabel('Role title').fill('Applied AI Engineering Intern')
await page.getByLabel('Job description text').fill('About the role\nBuild agentic LLM systems with guardrails and evals.\n\nRequirements\n- Python\n- LLM, RAG, agents, tool use\n- Evals and guardrails\n\nRemote. PPO available.')
await page.getByRole('button', { name: /tailor from text/i }).click(); await sleep(700)
await page.getByRole('button', { name: /tailor this packet/i }).click()
await sleep(14000) // four Dimaag passes (archetype+casting+angles+redteam) + atelier signature decision
out.castingSheet = await page.getByText(/the editor's desk/i).count()
out.whyExpanders = await page.getByText(/why this lineup/i).count()
out.redTeamStamp = await page.getByText(/red-team:/i).count()
out.signatureToggle = await page.getByText(/sifarish signature/i).count()
await shoot('packet-editorsdesk')

// Expand a Why to capture reasoning
const whyBtn = page.getByRole('button', { name: /why this lineup/i }).first()
if (await whyBtn.count()) { await whyBtn.click(); await sleep(600) }
await shoot('casting-why')

// Settings → Dimaag Ledger
await page.getByRole('button', { name: /^7/ }).click(); await sleep(700)
out.dimaagLedger = await page.getByText(/dimaag ledger/i).count()
await shoot('settings-dimaag')

await browser.close()
out.consoleErrors = errors.length
console.log('SMOKE_V3 ' + JSON.stringify(out))
errors.slice(0, 8).forEach((e) => console.log('  ✗ ' + e))
