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
await page.getByRole('button',{name:/^3/}).click(); await sleep(500)
await page.getByRole('button',{name:/scan the boards|scan now/i}).first().click()
await page.waitForSelector('button:has-text("Tailor")',{timeout:90000}).catch(()=>{}); await sleep(2500)
const t0=Date.now()
await page.getByRole('button',{name:/tailor →/i}).first().click()
// measure time until the "Editor's Desk is reasoning" progress appears (instant feedback)
let feedbackMs=-1
for(let i=0;i<60;i++){await sleep(200);if((await page.getByText(/editor's desk is reasoning|compiling/i).count())>0){feedbackMs=Date.now()-t0;break}}
// then wait for the finished packet
let doneMs=-1
for(let i=0;i<40;i++){await sleep(500);if((await page.getByText('Shaurya Verma').count())>0){doneMs=Date.now()-t0;break}}
console.log('FEEDBACK_MS:',feedbackMs,'DONE_MS:',doneMs)
console.log('CONSOLE_ERRORS:',errors.length); errors.slice(0,10).forEach(e=>console.log('  ✗ '+e))
await b.close()
