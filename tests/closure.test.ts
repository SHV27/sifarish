import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { textWidth } from '../src/lib/compile/helvetica-metrics'
import { timesWidth } from '../src/lib/compile/times-metrics'
import { compileResume } from '../src/lib/compile/compiler'
import { sanitizePdfText } from '../src/lib/compile/typeset'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { SEED_IDENTITY, SEED_LEDGER } from './helpers'

/**
 * CLOSURE PROTOCOL gates — the finish list, pinned.
 * F1: estimation is DEAD — the compiler measures with the renderer's own Helvetica widths.
 * F3: the last judge — everything cast appears on the page, or the bench is DECLARED.
 */

describe('F1 — the estimator measures with the renderer\'s EXACT font metrics', () => {
  it('textWidth() equals pdf-lib widthOfTextAtSize() for real résumé strings (reg/bold/oblique)', async () => {
    const doc = await PDFDocument.create()
    const fonts = {
      reg: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      obl: await doc.embedFont(StandardFonts.HelveticaOblique),
    } as const
    const samples = [
      'Engineered a keyless core so every pillar runs without API keys',
      sanitizePdfText('SEHAT-SAARTHI — 0.957 ROC-AUC · 2023–2027 · CGPA 7.7 × evals…'),
      'AI & ML: RAG + Guardrails + Evals, Prompt & Agent Design (Claude Code)',
      'B.Tech Computer Science & Engineering — Thapar Institute',
      'shaurya.verma2705@gmail.com | +91-9041523296 | github.com/SHV27',
    ]
    for (const s of samples) {
      for (const f of ['reg', 'bold', 'obl'] as const) {
        for (const size of [9.5, 10.5, 17]) {
          const est = textWidth(s, size, f)
          const drawn = fonts[f].widthOfTextAtSize(s, size)
          // pdf-lib kerns (negative pairs) — the estimator must NEVER measure under the drawn
          // width (that's the overflow/silent-bench direction) and stays within 1% over.
          expect(est, `"${s.slice(0, 30)}…" ${f}@${size} must not under-measure`).toBeGreaterThanOrEqual(drawn - 0.05)
          // Kerning around dashes/punctuation can reach ~1.7% on dense strings — conservative
          // over-measure is bounded at 2%, never under.
          expect(est - drawn, `"${s.slice(0, 30)}…" ${f}@${size} within 2%`).toBeLessThanOrEqual(Math.max(0.6, drawn * 0.02))
        }
      }
    }
  })

  it('character-count estimation is gone from the compiler (the concept is dead)', () => {
    const src = readFileSync('src/lib/compile/compiler.ts', 'utf8')
    expect(src).not.toContain('CHARS_PER_LINE')
    // Re-brief Arc 2: the register is Times — the estimator measures with the Times AFM tables
    // the renderer draws with (same F1 law, new face).
    expect(src).toContain("from './times-metrics'")
  })

  it('timesWidth() parity with the EMBEDDED serif (Tinos reg/bold/italic) — never under, ≤3% over (kerning)', async () => {
    // v2 (05-Sep-2026): the renderer embeds Tinos (public/fonts); the estimator's tables are generated
    // from the same files — the gate pins the two together, exactly as it pinned the standard Times.
    const { loadSerifFaces } = await import('../src/lib/export/fonts')
    const faces = (await loadSerifFaces())!
    expect(faces, 'public/fonts/Tinos-*.ttf must load in Node').toBeTruthy()
    const fontkit = (await import('@pdf-lib/fontkit')).default
    const doc = await PDFDocument.create()
    doc.registerFontkit(fontkit)
    const fonts = {
      reg: await doc.embedFont(faces.regular, { subset: false }),
      bold: await doc.embedFont(faces.bold, { subset: false }),
      obl: await doc.embedFont(faces.italic, { subset: false }),
    } as const
    const samples = [
      'Engineered a keyless core so every pillar runs without API keys',
      sanitizePdfText('SEHAT-SAARTHI — 0.957 ROC-AUC · 2023–2027 · CGPA 7.7 × evals…'),
      'AI & ML: RAG + Guardrails + Evals, Prompt & Agent Design (Claude Code)',
      'SIFARISH | TypeScript, React, Dexie, pdf-lib',
      'shaurya.verma2705@gmail.com | +91-9041523296 | github.com/SHV27',
    ]
    for (const s of samples) {
      for (const f of ['reg', 'bold', 'obl'] as const) {
        for (const size of [9.5, 10.5, 17]) {
          const est = timesWidth(s, size, f)
          const drawn = fonts[f].widthOfTextAtSize(s, size)
          expect(est, `"${s.slice(0, 30)}…" ${f}@${size} must not under-measure`).toBeGreaterThanOrEqual(drawn - 0.05)
          // Times kern pairs are heavier than Helvetica's (measured ~2.1-2.3% on kern-heavy
          // text, 30-Aug-2026) — conservative over-measure bounded at 3%, never under.
          expect(est - drawn, `"${s.slice(0, 30)}…" ${f}@${size} within 3%`).toBeLessThanOrEqual(Math.max(0.6, drawn * 0.03))
        }
      }
    }
  })
})

describe('F3 — THE LAST JUDGE: cast-vs-page coverage is checked after every compile', () => {
  const decode = decodeJD('AI engineer. Must have: Python, LLM.')
  const coverage = matchEvidence(decode, SEED_LEDGER)
  const realProj = SEED_LEDGER.find((e) => e.kind === 'project' && e.tier === 'shipped')!

  it('a cast project missing from the page is DECLARED on the result, never silent', () => {
    const resume = compileResume({
      identity: SEED_IDENTITY,
      ledger: SEED_LEDGER,
      decode,
      coverage,
      jobId: 'j-judge',
      // 'proj-ghost' can never render (not in the ledger) — the judge must say so.
      editorial: { order: [realProj.id, 'proj-ghost'], bullets: {} },
    })
    expect(resume.benchedByPage).toBeDefined()
    expect(resume.benchedByPage!.join(' ').toLowerCase()).toContain('proj-ghost')
    // …and the project that COULD render, did.
    expect(resume.lines.some((l) => l.kind === 'entry-title' && l.ledgerIds.includes(realProj.id))).toBe(true)
  })

  it('a fully-rendered cast declares nothing', () => {
    const resume = compileResume({
      identity: SEED_IDENTITY,
      ledger: SEED_LEDGER,
      decode,
      coverage,
      jobId: 'j-clean',
      editorial: { order: [realProj.id], bullets: {} },
    })
    expect(resume.benchedByPage).toBeUndefined()
  })

  it('the declaration reaches the packet gap note on every recompile path (source gate)', () => {
    const src = readFileSync('src/lib/darzi.ts', 'utf8')
    expect(src.match(/Benched by page pressure/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })
})

describe('F2 — Class C: autopilot failures are categorized, never bare-swallowed', () => {
  it('every autopilot catch routes through catchAs', () => {
    const src = readFileSync('src/lib/autopilot.ts', 'utf8')
    expect(src).not.toMatch(/catch\(\(\) => \{\}\)/)
    expect(src.match(/catchAs\(/g)?.length ?? 0).toBeGreaterThanOrEqual(5)
  })
})
