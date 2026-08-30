// Generates REAL Times width tables from pdf-lib's own AFM data (the D158/F1 discipline:
// the estimator must measure with the exact widths the renderer draws with).
// Usage: node scripts/gen-times-metrics.mjs  → prints the TS arrays to stdout.
import { PDFDocument, StandardFonts } from 'pdf-lib'

const doc = await PDFDocument.create()
const fonts = {
  REG: await doc.embedFont(StandardFonts.TimesRoman),
  BOLD: await doc.embedFont(StandardFonts.TimesRomanBold),
  ITAL: await doc.embedFont(StandardFonts.TimesRomanItalic),
}

const SPECIALS = [0x2013, 0x2014, 0xb7, 0xd7, 0x2026]

for (const [name, font] of Object.entries(fonts)) {
  const widths = []
  for (let c = 32; c <= 255; c++) {
    let w
    try {
      w = Math.round(font.widthOfTextAtSize(String.fromCharCode(c), 1000))
    } catch {
      w = 600
    }
    widths.push(w)
  }
  console.log(`export const TIMES_${name}: readonly number[] = [${widths.join(',')}]`)
}
const spec = {}
for (const c of SPECIALS) {
  try {
    spec[c] = Math.round(fonts.REG.widthOfTextAtSize(String.fromCharCode(c), 1000))
  } catch {
    spec[c] = 1000
  }
}
console.log('// SPECIAL glyphs (U+2013,U+2014,U+00B7,U+00D7,U+2026):', JSON.stringify(spec))
// Kerning check: summed vs drawn on a realistic line, all three styles.
const sample = 'Engineered a keyless AI pipeline — RAG, evals · 0.957 ROC-AUC (Ty AV To W.)'
for (const [name, font] of Object.entries(fonts)) {
  let sum = 0
  for (const ch of sample) {
    const c = ch.charCodeAt(0)
    try {
      sum += font.widthOfTextAtSize(ch, 1000)
    } catch {
      sum += 600
    }
  }
  const drawn = font.widthOfTextAtSize(sample, 1000)
  console.log(`// kerning ${name}: summed=${Math.round(sum)} drawn=${Math.round(drawn)} ratio=${(sum / drawn).toFixed(4)}`)
}
