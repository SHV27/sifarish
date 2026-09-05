// Generates the serif width tables the COMPILER measures with, from the EXACT font files the
// renderer embeds (v2, 05-Sep-2026: Tinos regular/bold/italic in public/fonts — the D158/F1
// discipline: estimation is dead, the estimator measures with the renderer's own widths).
// Usage: node scripts/gen-times-metrics.mjs > src/lib/compile/times-metrics.ts
import { readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

const doc = await PDFDocument.create()
doc.registerFontkit(fontkit)
const bytes = (n) => readFileSync(new URL(`../public/fonts/${n}`, import.meta.url))
const fonts = {
  REG: await doc.embedFont(bytes('Tinos-Regular.ttf'), { subset: false }),
  BOLD: await doc.embedFont(bytes('Tinos-Bold.ttf'), { subset: false }),
  ITAL: await doc.embedFont(bytes('Tinos-Italic.ttf'), { subset: false }),
}

const SPECIALS = [0x2013, 0x2014, 0xb7, 0xd7, 0x2026]
const out = []
out.push('/**')
out.push(' * REAL serif metrics (v2 THE PAGE, 05-Sep-2026) — generated from the EXACT Tinos files the renderer')
out.push(' * embeds (public/fonts, Apache-2.0, metric-compatible with Times New Roman) by')
out.push(' * scripts/gen-times-metrics.mjs. Same discipline as helvetica-metrics.ts (D158/F1: the estimator')
out.push(' * measures with the widths the renderer draws with). Per-1000-units for charcodes 32..255; unknown → 600.')
out.push(' * The parity gate (tests/closure.test.ts) pins timesWidth() against the embedded faces: never under, ≤3% over.')
out.push(' */')
for (const [name, font] of Object.entries(fonts)) {
  const widths = []
  for (let c = 32; c <= 255; c++) {
    let w
    try {
      w = Math.ceil(font.widthOfTextAtSize(String.fromCharCode(c), 1000)) // ceil: never under-measure
    } catch {
      w = 600
    }
    if (!Number.isFinite(w) || w <= 0) w = 600
    widths.push(w)
  }
  out.push(`export const TIMES_${name}: readonly number[] = [${widths.join(',')}]`)
}
const spec = {}
for (const c of SPECIALS) {
  try {
    spec[c] = Math.round(fonts.REG.widthOfTextAtSize(String.fromCharCode(c), 1000))
  } catch {
    spec[c] = 1000
  }
}
out.push(`/** Glyphs outside 32..255 the page keeps (U+2013, U+2014, U+00B7, U+00D7, U+2026). */`)
out.push(`const SPECIAL: Record<number, number> = ${JSON.stringify(spec)}`)
out.push('')
out.push(`export function timesWidth(text: string, size: number, style: 'reg' | 'bold' | 'obl' = 'reg'): number {`)
out.push(`  const t = style === 'bold' ? TIMES_BOLD : style === 'obl' ? TIMES_ITAL : TIMES_REG`)
out.push(`  let u = 0`)
out.push(`  for (let i = 0; i < text.length; i++) {`)
out.push(`    const c = text.charCodeAt(i)`)
out.push(`    u += SPECIAL[c] ?? (c >= 32 && c <= 255 ? t[c - 32] : 600)`)
out.push(`  }`)
out.push(`  return (u / 1000) * size`)
out.push(`}`)
console.log(out.join('\n'))

// Kerning check (stderr): summed vs drawn on a realistic line, all three styles.
const sample = 'Engineered a keyless AI pipeline — RAG, evals · 0.957 ROC-AUC (Ty AV To W.)'
for (const [name, font] of Object.entries(fonts)) {
  let sum = 0
  for (const ch of sample) {
    try {
      sum += font.widthOfTextAtSize(ch, 1000)
    } catch {
      sum += 600
    }
  }
  const drawn = font.widthOfTextAtSize(sample, 1000)
  console.error(`// kerning ${name}: summed=${Math.round(sum)} drawn=${Math.round(drawn)} ratio=${(sum / drawn).toFixed(4)}`)
}
