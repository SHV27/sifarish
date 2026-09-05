/**
 * Rasterise a PDF's pages to PNG with pdf.js inside headless Chromium (no native canvas).
 * Usage: npx tsx scripts/pdf-to-png.mts <file.pdf> <out-prefix> [scale=2]
 */
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const [, , pdfPath, prefix = 'page', scaleArg = '2'] = process.argv
const b64 = readFileSync(pdfPath).toString('base64')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } })
await page.setContent(`<html><body style="margin:0;background:#fff"><script type="module">
import * as pdfjs from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs'
pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'
const bytes = Uint8Array.from(atob('${b64}'), c => c.charCodeAt(0))
const doc = await pdfjs.getDocument({ data: bytes }).promise
for (let p = 1; p <= doc.numPages; p++) {
  const pg = await doc.getPage(p)
  const vp = pg.getViewport({ scale: ${Number(scaleArg)} })
  const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.id = 'p' + p
  document.body.appendChild(c)
  await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
}
document.body.setAttribute('data-done', String(doc.numPages))
</script></body></html>`)
await page.waitForSelector('body[data-done]', { timeout: 60000 })
const n = Number(await page.getAttribute('body', 'data-done'))
for (let p = 1; p <= n; p++) {
  const el = await page.$(`#p${p}`)
  await el!.screenshot({ path: `${prefix}-p${p}.png` })
}
await browser.close()
console.log(`${pdfPath}: ${n} page(s) → ${prefix}-p*.png`)
