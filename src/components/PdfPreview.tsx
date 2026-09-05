import { useEffect, useRef, useState } from 'react'
import type { CompiledResume } from '../types'

/**
 * OWNER-CAUGHT (05-Sep-2026): he judged the HTML approximation ("ek ek line ka gap ye voh") — it
 * was never the page. The preview is now the PDF itself: the same bytes he downloads, rasterised
 * with pdf.js. What he sees IS what exports. The HTML line view stays behind a toggle as the
 * evidence view (⛁ counts per line).
 */
export default function PdfPreview({ resume, version }: { resume: CompiledResume; version: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'rendering' | 'ok' | 'failed'>('rendering')
  const [pages, setPages] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setState('rendering')
      try {
        const { renderResumePdf } = await import('../lib/export/pdf')
        const bytes = await renderResumePdf(resume)
        const pdfjs = await import('pdfjs-dist')
        const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default as string
        pdfjs.GlobalWorkerOptions.workerSrc = worker
        const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise
        if (cancelled || !host.current) return
        host.current.replaceChildren()
        const width = Math.min(host.current.clientWidth || 700, 820)
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p)
          const base = page.getViewport({ scale: 1 })
          const scale = (width / base.width) * (window.devicePixelRatio || 1)
          const vp = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = vp.width
          canvas.height = vp.height
          canvas.style.width = `${width}px`
          canvas.style.height = `${(vp.height / vp.width) * width}px`
          canvas.className = 'block shadow-dossier bg-white mb-3 border border-paper-edge'
          canvas.setAttribute('aria-label', `Résumé page ${p} of ${doc.numPages}`)
          if (cancelled) return
          host.current.appendChild(canvas)
          await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
        }
        if (!cancelled) {
          setPages(doc.numPages)
          setState('ok')
        }
      } catch {
        if (!cancelled) setState('failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [version, resume])

  return (
    <div aria-label="Compiled resume preview (the PDF itself)">
      <div ref={host} className="w-full" />
      {state === 'rendering' && <p className="text-[11px] text-ink-soft font-mono py-6 text-center">Setting the page…</p>}
      {state === 'failed' && <p className="text-[11px] text-stamp font-mono py-2">The PDF preview could not render in this browser — the download still works; the evidence view below shows every line.</p>}
      {state === 'ok' && pages > 1 && <p className="text-[10px] text-ink-soft font-mono">{pages} pages</p>}
    </div>
  )
}
