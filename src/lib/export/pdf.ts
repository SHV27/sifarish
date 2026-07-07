import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import type { CompiledResume } from '../../types'
import { CompileError, LINE_METRICS, PAGE } from '../compile/compiler'

/**
 * ATS-plain, true-text-layer PDF. Helvetica standard font (metrically Arial-class,
 * zero embedding risk), single column, drawn strictly top-to-bottom so extracted
 * text order equals compiled order by construction (I5, D9).
 */

/** WinAnsi-safe text: swap characters Helvetica cannot encode. */
export function sanitizePdfText(text: string): string {
  return text
    .replace(/₹/g, 'Rs.')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/—/g, '--')
    .replace(/–/g, '-')
    .replace(/•/g, '-')
    .replace(/·/g, '|')
    .replace(/[^\x20-\x7E]/g, '')
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

export async function renderResumePdf(resume: CompiledResume): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([PAGE.width, PAGE.height])
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const maxWidth = PAGE.width - PAGE.margin * 2
  const ink = rgb(0.05, 0.09, 0.16)

  let y = PAGE.height - PAGE.margin

  resume.lines.forEach((line, i) => {
    const isName = i === 0
    const m = LINE_METRICS[line.kind]
    const size = isName ? 16 : m.size
    const font = isName || m.bold ? bold : regular
    const text = sanitizePdfText(line.text)

    y -= isName ? 18 : m.before + m.leading
    for (const [j, piece] of wrap(font, text, size, maxWidth).entries()) {
      if (j > 0) y -= m.leading
      if (y < PAGE.margin) {
        throw new CompileError(
          'Page overflow at render time: the true font metrics need more room than the compiler estimated.',
          [`Overflowing line: "${text.slice(0, 70)}…" — drop a bullet in the Ledger and re-tailor.`],
        )
      }
      page.drawText(piece, { x: PAGE.margin, y, size, font, color: ink })
    }
  })

  doc.setTitle('Resume')
  doc.setProducer('SIFARISH — compiled from the Sach Ledger')
  return doc.save()
}
