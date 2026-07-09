import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'
const URL = 'https://sifarish-shv-s-projects.vercel.app'
const errors = []
const b = await chromium.launch(); const page = await b.newPage()
page.on('console', m => m.type()==='error' && errors.push(m.text()))
page.on('pageerror', e => errors.push('PAGEERROR '+e))

await page.goto(URL,{waitUntil:'networkidle'})
await page.evaluate(async()=>{for(const d of (await indexedDB.databases?.())??[])if(d.name)indexedDB.deleteDatabase(d.name)})
await page.reload({waitUntil:'networkidle'}); await sleep(900)
await page.getByRole('button',{name:/that's my truth/i}).click(); await sleep(400)
await page.getByRole('button',{name:/arm the radar/i}).click(); await sleep(600)

// Simulate the user's REAL state: promote ALL forge projects to shipped (heavy ledger).
const promoted = await page.evaluate(async () => {
  const req = indexedDB.open('sifarish')
  const db = await new Promise((res) => { req.onsuccess = () => res(req.result) })
  const tx = db.transaction('ledger', 'readwrite')
  const store = tx.objectStore('ledger')
  const all = await new Promise((res) => { const r = store.getAll(); r.onsuccess = () => res(r.result) })
  let n = 0
  for (const e of all) {
    if (e.kind === 'project' && e.tier === 'in_forge') {
      e.tier = 'shipped'; e.forgeEta = undefined
      e.evidence = { repo: 'https://github.com/SHV27/' + e.id.replace('proj-',''), date: '06/2026', note: 'promoted' }
      store.put(e); n++
    }
  }
  await new Promise((res) => { tx.oncomplete = res })
  return n
})
console.log('PROMOTED_PROJECTS:', promoted)

// Paste a real-ish JD and tailor (this is the exact flow that overflowed).
await page.getByRole('button',{name:/^4/}).click(); await sleep(400)
await page.getByLabel('Company').fill('SiliconCedars')
await page.getByLabel('Role title').fill('AI Internship – GenAI & Agentic AI')
await page.getByLabel('Job description text').fill('Requirements\n- Python\n- LLM, RAG, agents, agentic AI, guardrails, evals\n- Ship real products\nRemote. PPO available.')
const t0 = Date.now()
await page.getByRole('button',{name:/tailor from text/i}).click()
// measure instant feedback
let feedbackMs=-1
for(let i=0;i<40;i++){await sleep(150);if((await page.getByText(/compiling your dossier|shaurya verma/i).count())>0){feedbackMs=Date.now()-t0;break}}
// wait for the resume to render
let resumeMs=-1
for(let i=0;i<30;i++){await sleep(500);if((await page.getByText('Shaurya Verma').count())>0){resumeMs=Date.now()-t0;break}}
await sleep(2000)
const compileError = await page.getByText(/compile error|page overflow/i).count()
const resumeRendered = await page.getByText('Shaurya Verma').count()
// wait for enhancement (casting sheet)
let enhancedMs=-1
for(let i=0;i<30;i++){await sleep(500);if((await page.getByText(/the editor's desk/i).count())>0){enhancedMs=Date.now()-t0;break}}
console.log('FEEDBACK_MS:',feedbackMs,'RESUME_MS:',resumeMs,'ENHANCED_MS:',enhancedMs)
console.log('COMPILE_ERROR_SHOWN:',compileError,'(want 0)')
console.log('RESUME_RENDERED:',resumeRendered,'(want >=1)')
console.log('CONSOLE_ERRORS:',errors.length); errors.slice(0,8).forEach(e=>console.log('  ✗ '+e))
await b.close()
