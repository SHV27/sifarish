import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import type { CompiledDoc, CompiledResume } from '../../types'
import { CompileError, LINE_METRICS, PAGE } from '../compile/compiler'

/**
 * ATS-plain, true-text-layer PDF. Helvetica standard font (metrically Arial-class,
 * zero embedding risk), single column, drawn strictly top-to-bottom so extracted
 * text order equals compiled order by construction (I5, D9).
 */

/**
 * WinAnsi-safe text: swap only what Helvetica truly cannot encode.
 *
 * Session 7 typography upgrade: WinAnsi-1252 DOES encode the canon's own punctuation —
 * en dash (0x96), em dash (0x97), middot (0xB7), multiplication sign (0xD7), ellipsis (0x85) —
 * so "GLOAMING — The Board…" renders with a REAL em dash, not "--", and "2023–2027 · CGPA"
 * keeps its middot. Session 6's lesson stands: the strip's whitelist must name every glyph we
 * keep, or the strip eats it silently (D139).
 */
export function sanitizePdfText(text: string): string {
  return text
    .replace(/₹/g, 'Rs.')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, '-')
    .replace(/[^\x20-\x7E–—·×…]/g, '')
    .replace(/ {2,}/g, ' ')
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const probe = line ? line + ' ' + word : word
    if (font.widthOfTextAtSize(probe, size) <= maxWidth || line === '') {
      line = probe
    } else {
      out.push(line)
      line = word
    }
  }
  if (line) out.push(line)
  return out
}

/** Greedy wrap where the FIRST line has less room (a bold inline label precedes it). */
function wrapIndent(font: PDFFont, text: string, size: number, firstWidth: number, fullWidth: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const probe = line ? line + ' ' + word : word
    const budget = out.length === 0 ? firstWidth : fullWidth
    if (font.widthOfTextAtSize(probe, size) <= budget || line === '') {
      line = probe
    } else {
      out.push(line)
      line = word
    }
  }
  if (line) out.push(line)
  return out
}

/**
 * Session 7 "The Taaj" — the classic selected-student layout, in the same ATS-plain contract:
 * centered name + contact, section headings underscored by a hairline rule (a LINE, not text —
 * parse-back sees only text), dates right-aligned on title lines (drawn AFTER the left segment,
 * so extraction order = text + right, exactly the CompiledLine contract), grouped-skills labels
 * in bold, project taglines in oblique, hanging indents on wrapped bullets. Still one column,
 * still strictly top-to-bottom, still Helvetica — the parser remains the first reader (D5/D9).
 */
export async function renderResumePdf(resume: CompiledResume): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([PAGE.width, PAGE.height])
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique)
  const maxWidth = PAGE.width - PAGE.margin * 2
  const ink = rgb(0.05, 0.09, 0.16)

  let y = PAGE.height - PAGE.margin

  const guard = (text: string) => {
    if (y < PAGE.margin) {
      throw new CompileError(
        'Page overflow at render time: the true font metrics need more room than the compiler estimated.',
        [`Overflowing line: "${text.slice(0, 70)}…" — drop a bullet in the Ledger and re-tailor.`],
      )
    }
  }

  resume.lines.forEach((line, i) => {
    const isName = i === 0
    const m = LINE_METRICS[line.kind]
    const size = isName ? 17 : m.size
    const font = isName || m.bold ? bold : line.kind === 'meta' || line.kind === 'forge' ? oblique : regular
    const text = sanitizePdfText(line.text)
    const right = line.right ? sanitizePdfText(line.right) : ''

    y -= isName ? 21 : m.before + m.leading

    // Name + contact block: centered (the canon's letterhead).
    if (isName || line.kind === 'contact') {
      for (const [j, piece] of wrap(font, text, size, maxWidth).entries()) {
        if (j > 0) y -= m.leading
        guard(piece)
        const w = font.widthOfTextAtSize(piece, size)
        page.drawText(piece, { x: PAGE.margin + (maxWidth - w) / 2, y, size, font, color: ink })
      }
      return
    }

    // Section heading + hairline rule beneath (visual only — adds no extractable text).
    if (line.kind === 'heading') {
      guard(text)
      page.drawText(text, { x: PAGE.margin, y, size, font, color: ink })
      const ruleY = y - 3.5
      page.drawLine({ start: { x: PAGE.margin, y: ruleY }, end: { x: PAGE.width - PAGE.margin, y: ruleY }, thickness: 0.7, color: ink })
      y -= 4 // the room the rule consumes (mirrored in the compiler's estimator)
      return
    }

    // Grouped skills: bold inline label ("AI & ML:") + regular list, hanging wrap.
    if (line.kind === 'skills') {
      const idx = text.indexOf(': ')
      if (idx > 0 && idx < 40) {
        const label = text.slice(0, idx + 1)
        const rest = text.slice(idx + 2)
        // Fixed gap after the bold label — a lone space-width collapsed visually (caught by
        // READING the rendered page, D139).
        const labelW = bold.widthOfTextAtSize(label, size) + size * 0.45
        guard(text)
        page.drawText(label, { x: PAGE.margin, y, size, font: bold, color: ink })
        const pieces = wrapIndent(regular, rest, size, maxWidth - labelW, maxWidth)
        for (const [j, piece] of pieces.entries()) {
          if (j > 0) {
            y -= m.leading
            guard(piece)
          }
          page.drawText(piece, { x: j === 0 ? PAGE.margin + labelW : PAGE.margin, y, size, font: regular, color: ink })
        }
        return
      }
    }

    // Title/meta/bullet lines — with an optional right-aligned segment (dates) on the first
    // visual line, drawn AFTER the left text so extracted order = text then right (I5 contract).
    const rightW = right ? regular.widthOfTextAtSize(right, m.size) : 0
    const leftWidth = (right ? maxWidth - rightW - 14 : maxWidth) - (line.kind === 'bullet' ? 9 : 0)
    const firstY = y
    for (const [j, piece] of wrap(font, text, size, leftWidth).entries()) {
      if (j > 0) y -= m.leading
      guard(piece)
      const x = line.kind === 'bullet' && j > 0 ? PAGE.margin + 9 : PAGE.margin
      page.drawText(piece, { x, y, size, font, color: ink })
    }
    if (right) {
      page.drawText(right, { x: PAGE.width - PAGE.margin - rightW, y: firstY, size: m.size, font: regular, color: ink })
    }
  })

  doc.setTitle('Resume')
  doc.setProducer('SIFARISH — compiled from the Sach Ledger')
  return doc.save()
}

/**
 * COVER LETTER PDF (Session 5.4) — companies routinely require the letter as a PDF/DOCX upload,
 * not pasted text, so a copy-to-clipboard letter was a packet that stopped one step short.
 *
 * Same ATS-plain discipline as the resume (Helvetica text layer, single column, drawn strictly
 * top-to-bottom so extracted order equals compiled order). It differs in one way: a letter has no
 * one-page constraint, so instead of throwing on overflow it starts a new page. The letter is
 * prose; the resume is the artifact under the one-page law.
 */
export async function renderLetterPdf(letter: CompiledDoc, title = 'Cover Letter'): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const maxWidth = PAGE.width - PAGE.margin * 2
  const ink = rgb(0.05, 0.09, 0.16)
  const SIZE = 11
  const LEADING = 15
  const PARA_GAP = 9

  let page = doc.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - PAGE.margin

  for (const para of letter.paragraphs) {
    const text = sanitizePdfText(para.text)
    if (!text.trim()) {
      y -= PARA_GAP
      continue
    }
    for (const piece of wrap(regular, text, SIZE, maxWidth)) {
      if (y - LEADING < PAGE.margin) {
        page = doc.addPage([PAGE.width, PAGE.height])
        y = PAGE.height - PAGE.margin
      }
      y -= LEADING
      page.drawText(piece, { x: PAGE.margin, y, size: SIZE, font: regular, color: ink })
    }
    y -= PARA_GAP
  }

  doc.setTitle(title)
  doc.setProducer('SIFARISH — compiled from the Sach Ledger')
  return doc.save()
}
