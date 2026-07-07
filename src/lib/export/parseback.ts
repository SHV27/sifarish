import type { CompiledResume } from '../../types'
import { sanitizePdfText } from './pdf'

/**
 * I5 — Round-trip fidelity referee. Extract the text layer from the generated PDF and
 * assert 100% of compiled lines are present, in order. What the ATS reads IS what we wrote.
 * Runs in dev on every export and as a CI gate (pdfjs-dist).
 */

export interface ParsebackResult {
  ok: boolean
  missing: string[]
  outOfOrder: string[]
  extractedChars: number
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

export async function extractPdfText(pdfBytes: Uint8Array): Promise<string> {
  // Dynamic import keeps pdfjs out of the main bundle; legacy build works in Node and browsers.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: pdfBytes, useSystemFonts: true }).promise
  let text = ''
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + ' '
  }
  return text
}

export function verifyLines(resume: CompiledResume, extracted: string): ParsebackResult {
  const hay = norm(extracted)
  const missing: string[] = []
  const outOfOrder: string[] = []
  let cursor = 0
  for (const line of resume.lines) {
    const needle = norm(sanitizePdfText(line.text))
    if (needle.length === 0) continue
    const at = hay.indexOf(needle, cursor)
    if (at === -1) {
      if (hay.includes(needle)) outOfOrder.push(line.text)
      else missing.push(line.text)
    } else {
      cursor = at + needle.length
    }
  }
  return { ok: missing.length === 0 && outOfOrder.length === 0, missing, outOfOrder, extractedChars: extracted.length }
}

export async function parsebackTest(resume: CompiledResume, pdfBytes: Uint8Array): Promise<ParsebackResult> {
  const extracted = await extractPdfText(pdfBytes)
  return verifyLines(resume, extracted)
}
