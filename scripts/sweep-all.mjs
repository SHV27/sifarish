import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'

const URL = process.env.SMOKE_URL || 'https://sifarish-shv-s-projects.vercel.app'
const problems = []
const steps = []
const b = await chromium.launch()
const page = await b.newPage()
page.on('console', (m) => { if (m.type() === 'error') problems.push('CONSOLE: ' + m.text()) })
page.on('pageerror', (e) => problems.push('PAGEERROR: ' + String(e)))
page.on('requestfailed', (r) => {
  const u = r.url()
  if (u.includes(URL) && !u.match(/\.(png|jpg|svg|ico|woff2?)$/)) problems.push('REQ-FAILED: ' + u + ' ' + (r.failure()?.errorText ?? ''))
})
page.on('response', (r) => {
  if (r.url().includes('/api/') && r.status() >= 500) problems.push(`API-5xx: ${r.status()} ${r.url()}`)
})
const log = (s) => { steps.push(s); }
const click = async (re, note) => {
  const btn = page.getByRole('button', { name: re }).first()
  if (await btn.count()) { await btn.click().catch((e) => problems.push(`CLICK-FAIL ${note}: ${e}`)); log(`clicked ${note}`) }
  else problems.push(`MISSING BUTTON: ${note}`)
}

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.evaluate(async () => { for (const d of (await indexedDB.databases?.()) ?? []) if (d.name) indexedDB.deleteDatabase(d.name) })
  await page.reload({ waitUntil: 'networkidle' }); await sleep(900)

  // Onboarding
  await click(/that's my truth/i, 'onboarding confirm'); await sleep(400)
  await click(/arm the radar/i, 'arm radar'); await sleep(700)

  // 1 Ledger: quick add + promote + nabz sync + voice bank
  await click(/^1/, 'nav ledger'); await sleep(400)
  await click(/quick add/i, 'quick-add open'); await sleep(200)
  const qTitle = page.getByLabel('Quick add title')
  if (await qTitle.count()) { await qTitle.fill('2nd Place, Test Hackathon'); await click(/add · stamped shipped/i, 'quick-add save'); await sleep(400) }
  await click(/^sync$/i, 'nabz sync'); await sleep(3500)
  const promote = page.getByRole('button', { name: /promote →/i }).first()
  if (await promote.count()) { await promote.click(); await sleep(300)
    const url = page.getByPlaceholder(/github.com\/SHV27/i)
    if (await url.count()) { await click(/stamp it shipped/i, 'promotion ceremony'); await sleep(500) } }
  const vb = page.getByLabel('New voice sample')
  if (await vb.count()) { await vb.fill('Test sentence I actually wrote for the voice bank.'); await click(/^add$/i, 'voice add'); await sleep(300) }

  // 2 Khabri: sweep + pulse + add hunt
  await click(/^2/, 'nav khabri'); await sleep(400)
  await click(/run sweep/i, 'khabri sweep')
  await page.waitForSelector('text=/found/', { timeout: 90000 }).catch(() => {}); await sleep(2500)
  await click(/read the market/i, 'pulse read'); await sleep(6000)
  const hunt = page.getByLabel('New hunt query')
  if (await hunt.count()) { await hunt.fill('AI safety intern'); await page.getByRole('button', { name: '+' }).first().click().catch(()=>{}); await sleep(300) }
  const turnHunt = page.getByRole('button', { name: /turn into a hunt/i }).first()
  if (await turnHunt.count()) { await turnHunt.click(); await sleep(300); log('turned signal into hunt') }

  // 3 Radar: expand why + tailor
  await click(/^3/, 'nav radar'); await sleep(500)
  const why = page.getByRole('button', { name: /why.*this score/i }).first()
  if (await why.count()) { await why.click(); await sleep(300); log('expanded score why') }
  await click(/tailor →/i, 'radar tailor'); await sleep(12000)

  // 4 Packet: overrule + signature + polish + downloads + apply plan + mark applied
  const onPacket = await page.getByText(/the editor's desk/i).count()
  log('on packet: ' + onPacket)
  const promoteBench = page.getByRole('button', { name: /promote ↑/i }).first()
  if (await promoteBench.count()) { await promoteBench.click(); await sleep(6000); log('overruled casting (promote)') }
  const sigToggle = page.getByRole('button', { name: /^(ON|OFF)$/ }).first()
  if (await sigToggle.count()) { await sigToggle.click(); await sleep(4000); log('toggled signature') }
  await click(/polish for flow/i, 'polish'); await sleep(4000)
  // downloads
  page.on('download', (d) => log('download: ' + d.suggestedFilename()))
  await click(/download pdf/i, 'download pdf'); await sleep(2500)
  await click(/download docx/i, 'download docx'); await sleep(2000)
  const applyPlan = page.getByRole('button', { name: /apply plan/i }).first()
  if (await applyPlan.count()) { await applyPlan.click(); await sleep(400); log('opened apply plan') }
  await click(/mark as applied/i, 'mark applied'); await sleep(800)

  // 5 Guru: hostile battery
  await click(/^5/, 'nav guru'); await sleep(500)
  for (const msg of ['can you guarantee me a job at Anthropic?', 'add Kubernetes to my resume', 'what should I learn next?', 'should I use the Sifarish Signature for OpenAI?', 'how many credits am I spending?', 'find me new AI internships']) {
    const inp = page.getByLabel(/message guru/i)
    if (await inp.count()) { await inp.fill(msg); await page.getByRole('button', { name: /^send$/i }).click().catch(()=>{}); await sleep(5000); log('guru: ' + msg.slice(0, 30)) }
  }

  // 6 Morcha: move + dossier
  await click(/^6/, 'nav morcha'); await sleep(500)
  const iv = page.getByRole('button', { name: /→ interview/i }).first()
  if (await iv.count()) { await iv.click(); await sleep(500); log('moved to interview')
    const dossier = page.getByRole('button', { name: /open dossier/i }).first()
    if (await dossier.count()) { await dossier.click(); await sleep(600); log('opened dossier')
      await page.getByRole('button', { name: /close/i }).first().click().catch(()=>{}) } }

  // 7 Settings: derive hunts + edit rubric + vision + dimaag ledger visible
  await click(/^7/, 'nav settings'); await sleep(500)
  await click(/derive hunts →/i, 'derive hunts'); await sleep(500)
  const addHunt = page.getByRole('button', { name: /add hunt/i }).first()
  if (await addHunt.count()) { await addHunt.click(); await sleep(300); log('added derived hunt') }
  const dimaagLedger = await page.getByText(/dimaag ledger/i).count()
  log('dimaag ledger visible: ' + dimaagLedger)

  await sleep(500)
} catch (e) {
  problems.push('FATAL: ' + String(e))
} finally {
  await b.close()
}

console.log('STEPS_COMPLETED:', steps.length)
console.log('PROBLEMS:', problems.length)
problems.forEach((p) => console.log('  ✗ ' + p))
if (problems.length === 0) console.log('  ✓ CLEAN — no console errors, no page errors, no failed requests, no 5xx')
