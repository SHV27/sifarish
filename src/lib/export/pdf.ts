import { PDFDocument, PDFName, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFRef } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { loadSerifFaces } from './fonts'
import type { CompiledDoc, CompiledLine, CompiledResume } from '../../types'
import { CompileError, NAME_SIZE, PAGE, estimateLineHeight, metricsFor } from '../compile/compiler'
import { sanitizePdfText } from '../compile/typeset'
import { layoutRuns } from '../compile/emphasis'

/**
 * ATS-plain, true-text-layer PDF. Times standard fonts (the campus-LaTeX canon register, zero
 * embedding risk), single column, drawn strictly top-to-bottom so extracted text order equals
 * compiled order by construction (I5, D9).
 *
 * v2 THE PAGE (05-Sep-2026):
 *   • 36pt margins, name 19pt — the full-size register of the six canon samples.
 *   • MULTI-PAGE: page breaks are decided by the compiler's own estimator (`paginate` rule:
 *     keep-with-next on headings/titles), so the estimator and the renderer agree on where a page
 *     ends exactly as they agree on widths (authority 2). The overflow guard stays as the backstop.
 *   • LINK ANNOTATIONS: contact handles, the name (→ GitHub), project titles and their live URLs
 *     are clickable. The visible text stays a readable handle/URL — parsers read anchor text, not
 *     the annotation (RESEARCH v2 verdict 1). Annotations add NO extractable text (I5 intact).
 *   • The tighten level the solver chose scales leading/before exactly as the estimator did.
 */

export { sanitizePdfText } from '../compile/typeset'

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

interface Annot {
  x: number
  y: number
  w: number
  h: number
  url: string
}

/** Which face the last render embedded — 'tinos' (embedded, viewer-stable) or 'standard' (fallback, declared). */
export let lastFontMode: 'tinos' | 'standard' = 'standard'

export async function renderResumePdf(resume: CompiledResume): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  // v2 THE PAGE — embed the serif (see fonts.ts): identical spacing in every viewer, the way every
  // LaTeX sample renders. The files are PRE-subsetted to Latin-1 (~31 KB each; pdf-lib's runtime
  // subsetter drops glyphs in pdf.js — read on the page, 05-Sep-2026), so they embed whole.
  // Fallback to the standard Times is DECLARED (lastFontMode).
  const faces = await loadSerifFaces()
  let regular: PDFFont
  let bold: PDFFont
  let oblique: PDFFont
  if (faces) {
    doc.registerFontkit(fontkit)
    regular = await doc.embedFont(faces.regular, { subset: false })
    bold = await doc.embedFont(faces.bold, { subset: false })
    oblique = await doc.embedFont(faces.italic, { subset: false })
    lastFontMode = 'tinos'
  } else {
    regular = await doc.embedFont(StandardFonts.TimesRoman)
    bold = await doc.embedFont(StandardFonts.TimesRomanBold)
    oblique = await doc.embedFont(StandardFonts.TimesRomanItalic)
    lastFontMode = 'standard'
  }
  const maxWidth = PAGE.width - PAGE.margin * 2
  const ink = rgb(0.05, 0.09, 0.16)
  const tighten = resume.tighten ?? 0

  const pages: { page: PDFPage; annots: Annot[] }[] = []
  const newPage = () => {
    const page = doc.addPage([PAGE.width, PAGE.height])
    pages.push({ page, annots: [] })
    return pages[pages.length - 1]
  }
  let cur = newPage()
  let y = PAGE.height - PAGE.margin
  let usedOnPage = 0

  const guard = (text: string) => {
    if (y < PAGE.margin) {
      throw new CompileError(
        'Page overflow at render time: the true font metrics need more room than the compiler estimated.',
        [`Overflowing line: "${text.slice(0, 70)}…" — drop a bullet in the Ledger and re-tailor.`],
      )
    }
  }
  const link = (x: number, baseline: number, w: number, size: number, url: string) => {
    if (!url || w <= 0) return
    cur.annots.push({ x, y: baseline - size * 0.25, w, h: size * 1.1, url })
  }
  /** Annotate a substring of a drawn piece: measure the prefix to find x. */
  const linkSub = (piece: string, font: PDFFont, size: number, x0: number, baseline: number, sub: string, url: string) => {
    const idx = piece.indexOf(sub)
    if (idx === -1) return false
    const x = x0 + font.widthOfTextAtSize(piece.slice(0, idx), size)
    link(x, baseline, font.widthOfTextAtSize(sub, size), size, url)
    return true
  }

  const lines = resume.lines
  lines.forEach((line: CompiledLine, i) => {
    const isName = i === 0
    const m = metricsFor(line.kind, tighten)
    const size = isName ? NAME_SIZE : m.size
    const font = isName || m.bold ? bold : line.kind === 'meta' || line.kind === 'forge' ? oblique : regular
    const text = sanitizePdfText(line.text)
    const right = line.right ? sanitizePdfText(line.right) : ''

    // Page break decided by the SAME rule as the compiler's paginate(): keep-with-next on
    // headings/titles, measured with the estimator (never under the drawn height).
    const h = estimateLineHeight(line, isName, tighten)
    const keep = line.kind === 'heading' || line.kind === 'entry-title'
    const next = keep && lines[i + 1] ? estimateLineHeight(lines[i + 1], false, tighten) : 0
    if (usedOnPage > 0 && usedOnPage + h + next > PAGE.height - PAGE.margin * 2) {
      cur = newPage()
      y = PAGE.height - PAGE.margin
      usedOnPage = 0
    }
    usedOnPage += h

    y -= isName ? NAME_SIZE + 4 : m.before + m.leading

    // Name + contact block + headline: centered (the canon's letterhead).
    if (isName || line.kind === 'contact' || line.kind === 'headline') {
      for (const [j, piece] of wrap(font, text, size, maxWidth).entries()) {
        if (j > 0) y -= m.leading
        guard(piece)
        const w = font.widthOfTextAtSize(piece, size)
        const x = PAGE.margin + (maxWidth - w) / 2
        cur.page.drawText(piece, { x, y, size, font, color: ink })
        if (isName && line.link) link(x, y, w, size, line.link)
        for (const l of line.links ?? []) linkSub(piece, font, size, x, y, sanitizePdfText(l.text), l.url)
      }
      return
    }

    // Section heading + hairline rule beneath (visual only — adds no extractable text).
    if (line.kind === 'heading') {
      guard(text)
      cur.page.drawText(text, { x: PAGE.margin, y, size, font, color: ink })
      const ruleY = y - 3.5
      cur.page.drawLine({ start: { x: PAGE.margin, y: ruleY }, end: { x: PAGE.width - PAGE.margin, y: ruleY }, thickness: 0.7, color: ink })
      y -= 4 // the room the rule consumes (mirrored in the compiler's estimator)
      return
    }

    // Grouped skills: bold inline label ("AI & ML:") + regular list, hanging wrap.
    if (line.kind === 'skills') {
      const idx = text.indexOf(': ')
      if (idx > 0 && idx < 40) {
        const label = text.slice(0, idx + 1)
        const rest = text.slice(idx + 2)
        const labelW = bold.widthOfTextAtSize(label, size) + size * 0.45
        guard(text)
        cur.page.drawText(label, { x: PAGE.margin, y, size, font: bold, color: ink })
        const pieces = wrapIndent(regular, rest, size, maxWidth - labelW, maxWidth)
        for (const [j, piece] of pieces.entries()) {
          if (j > 0) {
            y -= m.leading
            guard(piece)
          }
          cur.page.drawText(piece, { x: j === 0 ? PAGE.margin + labelW : PAGE.margin, y, size, font: regular, color: ink })
        }
        return
      }
    }

    // Title/meta/bullet lines — with an optional right-aligned segment (dates) on the first
    // visual line, drawn AFTER the left text so extracted order = text then right (I5 contract).
    const rightW = right ? regular.widthOfTextAtSize(right, m.size) : 0
    const leftWidth = (right ? maxWidth - rightW - 14 : maxWidth) - (line.kind === 'bullet' ? 9 : 0)
    const firstY = y

    if (line.runs && line.runs.length > 0) {
      const fontOf = (b: boolean) => (b ? bold : regular)
      const visual = layoutRuns(line.runs, (t, b) => (b ? bold : regular).widthOfTextAtSize(t, size), leftWidth, leftWidth)
      for (const [j, segs] of visual.entries()) {
        if (j > 0) y -= m.leading
        guard(segs.map((s) => s.text).join(''))
        let x = line.kind === 'bullet' && j > 0 ? PAGE.margin + 9 : PAGE.margin
        const x0 = x
        for (const s of segs) {
          const f = fontOf(s.bold)
          // READ on the rendered page (05-Sep-2026): "the LLM" drew as "theLLM" — a segment's leading
          // space (the style boundary) was not advancing the pen. Draw the visible glyphs after the
          // space and advance by the FULL measured width, so spacing never depends on font quirks.
          const lead = s.text.length - s.text.trimStart().length
          const gap = lead > 0 ? f.widthOfTextAtSize(s.text.slice(0, lead), size) : 0
          cur.page.drawText(s.text.trimStart(), { x: x + gap, y, size, font: f, color: ink })
          x += f.widthOfTextAtSize(s.text, size)
        }
        // A titled line links on its first visual line (the bold name segment).
        if (j === 0 && line.link) link(x0, y, (segs[0] ? fontOf(segs[0].bold).widthOfTextAtSize(segs[0].text, size) : x - x0), size, line.link)
      }
      if (right) {
        cur.page.drawText(right, { x: PAGE.width - PAGE.margin - rightW, y: firstY, size: m.size, font: regular, color: ink })
      }
      return
    }

    for (const [j, piece] of wrap(font, text, size, leftWidth).entries()) {
      if (j > 0) y -= m.leading
      guard(piece)
      const x = line.kind === 'bullet' && j > 0 ? PAGE.margin + 9 : PAGE.margin
      cur.page.drawText(piece, { x, y, size, font, color: ink })
      if (j === 0 && line.link && !line.links?.length) link(x, y, font.widthOfTextAtSize(piece, size), size, line.link)
      for (const l of line.links ?? []) linkSub(piece, font, size, x, y, sanitizePdfText(l.text), l.url)
    }
    if (right) {
      cur.page.drawText(right, { x: PAGE.width - PAGE.margin - rightW, y: firstY, size: m.size, font: regular, color: ink })
    }
  })

  // Link annotations — registered per page; they carry no text (I5 untouched).
  for (const { page, annots } of pages) {
    if (annots.length === 0) continue
    const refs: PDFRef[] = annots.map((a) =>
      doc.context.register(
        doc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [a.x, a.y, a.x + a.w, a.y + a.h],
          Border: [0, 0, 0],
          A: { Type: 'Action', S: 'URI', URI: PDFString.of(a.url) },
        }),
      ),
    )
    page.node.set(PDFName.of('Annots'), doc.context.obj(refs))
  }

  doc.setTitle('Resume')
  doc.setProducer('SIFARISH — compiled from the Sach Ledger')
  // No object streams: every dictionary (text, annotations) stays a plain object — the most
  // conservative structure for older ATS parsers, and greppable in gates.
  return doc.save({ useObjectStreams: false })
}

/**
 * COVER LETTER PDF (Session 5.4) — companies routinely require the letter as a PDF/DOCX upload,
 * not pasted text, so a copy-to-clipboard letter was a packet that stopped one step short.
 *
 * Same ATS-plain discipline as the resume (single column, drawn strictly top-to-bottom so
 * extracted order equals compiled order). A letter has no one-page constraint: it paginates.
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
