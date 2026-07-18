import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TabStopType, TextRun } from 'docx'
import type { CompiledDoc, CompiledResume } from '../../types'
import { LINE_METRICS } from '../compile/compiler'

/**
 * DOCX export — the parse-reliability king (RESEARCH.md F6). Same compiled lines,
 * same order, plain single-column paragraphs, standard font, no tables/columns/images.
 *
 * Session 7 "The Taaj": mirrors the classic PDF layout with Word-native primitives —
 * centered name/contact, a bottom border under headings (a border, not a table), a right
 * TAB STOP for dates (plain text runs in reading order: left text, tab, date — parses
 * exactly like the PDF), bold inline skill labels, italic project taglines.
 */

// A4 usable width in twips: 11906 - 960*2 margins.
const RIGHT_TAB = 11906 - 960 * 2

function buildDoc(resume: CompiledResume): Document {
  const children = resume.lines.map((line, i) => {
    const isName = i === 0
    const m = LINE_METRICS[line.kind]
    const size = Math.round((isName ? 17 : m.size) * 2) // half-points
    const font = 'Calibri'
    const centered = isName || line.kind === 'contact'
    const italics = line.kind === 'meta'

    const runs: TextRun[] = []
    if (line.kind === 'skills') {
      const idx = line.text.indexOf(': ')
      if (idx > 0 && idx < 40) {
        runs.push(new TextRun({ text: line.text.slice(0, idx + 1), bold: true, size, font }))
        runs.push(new TextRun({ text: ` ${line.text.slice(idx + 2)}`, size, font }))
      }
    }
    if (runs.length === 0) {
      runs.push(new TextRun({ text: line.text, bold: isName || m.bold, italics, size, font }))
    }
    if (line.right) {
      runs.push(new TextRun({ children: ['\t'], size, font }))
      runs.push(new TextRun({ text: line.right, size: Math.round(m.size * 2), font }))
    }

    return new Paragraph({
      spacing: { before: Math.round(m.before * 20), after: 0, line: Math.round(m.leading * 20), lineRule: 'atLeast' },
      alignment: centered ? AlignmentType.CENTER : undefined,
      tabStops: line.right ? [{ type: TabStopType.RIGHT, position: RIGHT_TAB }] : undefined,
      border:
        line.kind === 'heading'
          ? { bottom: { style: BorderStyle.SINGLE, size: 6, space: 2, color: '0D1729' } }
          : undefined,
      children: runs,
    })
  })

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 in twips
            margin: { top: 960, bottom: 960, left: 960, right: 960 },
          },
        },
        children,
      },
    ],
  })
}

export async function renderResumeDocxBlob(resume: CompiledResume): Promise<Blob> {
  return Packer.toBlob(buildDoc(resume))
}

/** Node path for tests. */
export async function renderResumeDocxBuffer(resume: CompiledResume): Promise<Uint8Array> {
  return Packer.toBuffer(buildDoc(resume))
}

/**
 * COVER LETTER DOCX (Session 5.4) — many portals accept only .docx for the letter. Same plain
 * single-column discipline; paragraphs in compiled order, no tables/columns/images (D5).
 */
function buildLetterDoc(letter: CompiledDoc): Document {
  const children = letter.paragraphs.map(
    (p) =>
      new Paragraph({
        spacing: { before: 0, after: 180, line: 300, lineRule: 'atLeast' },
        children: [new TextRun({ text: p.text, size: 22, font: 'Calibri' })], // 11pt in half-points
      }),
  )
  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 in twips
            margin: { top: 960, bottom: 960, left: 960, right: 960 },
          },
        },
        children,
      },
    ],
  })
}

export async function renderLetterDocxBlob(letter: CompiledDoc): Promise<Blob> {
  return Packer.toBlob(buildLetterDoc(letter))
}

/** Node path for tests. */
export async function renderLetterDocxBuffer(letter: CompiledDoc): Promise<Uint8Array> {
  return Packer.toBuffer(buildLetterDoc(letter))
}
