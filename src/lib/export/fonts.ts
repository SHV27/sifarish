/**
 * v2 THE PAGE — the embedded serif (05-Sep-2026).
 *
 * READ on the rendered page: with the non-embedded standard Times, every viewer substitutes its
 * own serif and re-spaces the line ("the LLM" drew as "theLLM" in pdf.js). Every strong sample the
 * owner supplied is a LaTeX PDF with EMBEDDED fonts, which is why they look identical everywhere.
 * So the résumé embeds Tinos — Apache-2.0, metric-compatible with Times New Roman — subset per
 * document (pre-subsetted to Latin-1 + the page's specials with fontTools — ~31 KB each; pdf-lib's own
 * runtime subsetter drops glyphs in pdf.js, so the files embed whole), regular / bold / italic.
 * Source: fonts.gstatic.com/s/tinos/v26 (Google Fonts), 05-Sep-2026. The width tables the compiler measures with
 * (times-metrics.ts) are generated from these exact files by scripts/gen-times-metrics.mjs.
 *
 * Keyless, offline, no service: the files ship in public/fonts. If they cannot be loaded (a very
 * old cache, a blocked path) the renderer falls back to the standard Times and SAYS so.
 */

export interface SerifFaces {
  regular: Uint8Array
  bold: Uint8Array
  italic: Uint8Array
}

const FILES = { regular: 'Tinos-Regular.ttf', bold: 'Tinos-Bold.ttf', italic: 'Tinos-Italic.ttf' } as const

let cache: Promise<SerifFaces | null> | null = null

async function readOne(name: string): Promise<Uint8Array> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Node (tests, proof scripts): read from the repo.
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    return new Uint8Array(readFileSync(join(process.cwd(), 'public', 'fonts', name)))
  }
  const res = await fetch(`/fonts/${name}`)
  if (!res.ok) throw new Error(`font ${name}: HTTP ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

/** The three faces, loaded once per session; null when unavailable (the caller falls back loudly). */
export function loadSerifFaces(): Promise<SerifFaces | null> {
  if (!cache) {
    cache = Promise.all([readOne(FILES.regular), readOne(FILES.bold), readOne(FILES.italic)])
      .then(([regular, bold, italic]) => ({ regular, bold, italic }))
      .catch(() => null)
  }
  return cache
}
