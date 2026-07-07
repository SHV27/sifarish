import { Document, Packer, Paragraph, TextRun } from 'docx'
import type { CompiledResume } from '../../types'
import { LINE_METRICS } from '../compile/compiler'

/**
 * DOCX export — the parse-reliability king (RESEARCH.md F6). Same compiled lines,
 * same order, plain single-column paragraphs, standard font, no tables/columns/images.
 */

function buildDoc(resume: CompiledResume): Document {
  const children = resume.lines.map((line, i) => {
    const isName = i === 0
    const m = LINE_METRICS[line.kind]
    return new Paragraph({
      spacing: { before: Math.round(m.before * 20), after: 0, line: Math.round(m.leading * 20), lineRule: 'atLeast' },
      children: [
        new TextRun({
          text: line.text,
          bold: isName || m.bold,
          size: Math.round((isName ? 16 : m.size) * 2), // half-points
          font: 'Calibri',
        }),
      ],
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
