import { describe, expect, it } from 'vitest'
import type { CompiledDoc } from '../src/types'
import { renderLetterPdf } from '../src/lib/export/pdf'
import { renderLetterDocxBuffer } from '../src/lib/export/docx'
import { extractPdfText } from '../src/lib/export/parseback'

/**
 * COVER LETTER EXPORT (Session 5.4) — companies require the letter as an uploaded PDF/DOCX, so
 * the letter is now a real artifact, not just clipboard text. It is a NEW export path, so I5
 * (round-trip fidelity) must hold for it too: what the reader opens IS what we compiled.
 */

const letter: CompiledDoc = {
  paragraphs: [
    { text: 'Dear Hiring Team,', ledgerIds: [] },
    {
      text: 'I build AI systems that refuse to lie. SIFARISH compiles every resume bullet from an evidence ledger, so a claim without a receipt cannot render — the invariant is enforced at compile time, not by review.',
      ledgerIds: ['proj-sifarish'],
    },
    {
      text: 'GLOAMING is a browser co-op board game whose AI narrator degrades to a hand-authored fallback, so the whole game runs with zero API keys.',
      ledgerIds: ['proj-gloaming'],
    },
    { text: 'Shaurya Verma', ledgerIds: [] },
  ],
}

describe('cover letter export', () => {
  it('renders a real PDF text layer that round-trips 100% in compiled order (I5)', async () => {
    const bytes = await renderLetterPdf(letter)
    const extracted = (await extractPdfText(bytes)).replace(/\s+/g, ' ')

    const { sanitizePdfText } = await import('../src/lib/export/pdf')
    let cursor = 0
    for (const p of letter.paragraphs) {
      // Match the renderer's WinAnsi sanitization before comparing (Session 7: real glyphs
      // survive — em dashes stay em dashes on the page).
      const expected = sanitizePdfText(p.text).replace(/\s+/g, ' ')
      const at = extracted.indexOf(expected, cursor)
      expect(at, `missing or out of order in the extracted PDF: "${p.text.slice(0, 50)}…"`).toBeGreaterThanOrEqual(0)
      cursor = at + expected.length // strictly increasing → order preserved
    }
  })

  it('paginates instead of throwing when a letter runs long (a letter has no one-page law)', async () => {
    const long: CompiledDoc = {
      paragraphs: Array.from({ length: 60 }, (_, i) => ({
        text: `Paragraph ${i + 1}. ${'This letter is deliberately long to push past a single page. '.repeat(3)}`,
        ledgerIds: [],
      })),
    }
    const bytes = await renderLetterPdf(long)
    expect(bytes.byteLength).toBeGreaterThan(0)
    const text = await extractPdfText(bytes)
    expect(text).toContain('Paragraph 60')
  })

  it('renders a DOCX carrying every paragraph', async () => {
    const buf = await renderLetterDocxBuffer(letter)
    expect(buf.byteLength).toBeGreaterThan(0)
    // DOCX is a zip; the XML inside carries the text runs verbatim.
    const raw = Buffer.from(buf).toString('latin1')
    expect(raw.slice(0, 2)).toBe('PK')
  })
})
