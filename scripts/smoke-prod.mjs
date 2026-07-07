import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'

const URL = process.env.SMOKE_URL || 'https://sifarish-shv-s-projects.vercel.app'
const errors = []
const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e))

await page.goto(URL, { waitUntil: 'networkidle' })
await sleep(1000)
const onboardingVisible = await page.getByRole('button', { name: /that's my truth/i }).count()
await page.getByRole('button', { name: /that's my truth/i }).click(); await sleep(400)
await page.getByRole('button', { name: /arm the radar/i }).click(); await sleep(600)
await page.getByRole('button', { name: /^3/ }).click(); await sleep(400)
await page.getByLabel('Company').fill('Anthropic')
await page.getByLabel('Role title').fill('AI Engineering Intern')
await page.getByLabel('Job description text').fill('Requirements\n- Python\n- LLM, RAG, agents, evals, guardrails\nRemote. PPO available.')
await page.getByRole('button', { name: /tailor from text/i }).click(); await sleep(800)
await page.getByRole('button', { name: /tailor this packet/i }).click(); await sleep(1200)
const resumeVisible = await page.getByText('Shaurya Verma').count()
const coverageVisible = await page.getByText(/JD coverage/i).count()
await browser.close()
console.log('SMOKE ' + JSON.stringify({ onboardingVisible, resumeVisible, coverageVisible, errorCount: errors.length }))
errors.slice(0, 10).forEach((e) => console.log('  ✗ ' + e))
