import { describe, it, expect } from 'vitest'
import { JD_FIXTURES } from './fixtures/jds'
import { compilePacketPure, fakeJob } from './helpers'
import { renderResumePdf } from '../src/lib/export/pdf'
import { renderResumeDocxBuffer } from '../src/lib/export/docx'
import { parsebackTest } from '../src/lib/export/parseback'

/**
 * I5 — Round-trip fidelity. The most important gate: what the ATS reads IS what we wrote.
 * Render a real PDF, extract its text layer with pdfjs, assert 100% of compiled lines
 * are present and in order.
 */
describe('I5 — Parse-back fidelity: 100% of compiled lines present & in order', () => {
  for (const fx of JD_FIXTURES.filter((f) => f.strongFit)) {
    it(`${fx.company}: PDF text layer round-trips exactly`, async () => {
      const packet = compilePacketPure(fakeJob(fx.company, fx.title, fx.jd))
      const bytes = await renderResumePdf(packet.resume)
      const result = await parsebackTest(packet.resume, bytes)
      expect(result.missing, `missing: ${result.missing.join(' | ')}`).toHaveLength(0)
      expect(result.outOfOrder, `out of order: ${result.outOfOrder.join(' | ')}`).toHaveLength(0)
      expect(result.ok).toBe(true)
    }, 30000)
  }

  it('DOCX renders as a non-trivial buffer', async () => {
    const packet = compilePacketPure(fakeJob('Anthropic', 'AI Eng Intern', JD_FIXTURES[0].jd))
    const buf = await renderResumeDocxBuffer(packet.resume)
    expect(buf.length).toBeGreaterThan(2000)
    // DOCX is a zip: starts with 'PK'
    expect(buf[0]).toBe(0x50)
    expect(buf[1]).toBe(0x4b)
  })

  it('PDF has a real text layer (not an image)', async () => {
    const packet = compilePacketPure(fakeJob('Sarvam AI', 'ML Intern', JD_FIXTURES[1].jd))
    const bytes = await renderResumePdf(packet.resume)
    const { extractPdfText } = await import('../src/lib/export/parseback')
    const text = await extractPdfText(bytes)
    expect(text).toContain('Shaurya Verma')
    expect(text.length).toBeGreaterThan(400)
  }, 30000)
})
