import type { CompiledLine, JDDecode } from '../../types'
import { LEXICON } from '../jd/lexicon'
import { sanitizePdfText } from './typeset'
import { timesWidth } from './times-metrics'

/**
 * INLINE EMPHASIS (re-brief Arc 2 — the campus-LaTeX-canon register). Every strong sample the
 * owner supplied bolds tech names and metrics MID-BULLET — that's what makes the 6-second skim
 * work. Selection here is DETERMINISTIC (digits + the JD lexicon's own surface forms + this
 * JD's keywords): the LLM never chooses emphasis, so I1's surface is untouched — bold is
 * styling on evidence-linked text, never new text.
 *
 * CONTRACT (gated): for any line carrying runs, concat(runs.text) === sanitizePdfText(line.text).
 * Renderers draw runs verbatim WITHOUT re-sanitizing; the estimator measures the same segments.
 */

export interface Run {
  text: string
  bold?: boolean
}

/** Metrics: 0.957 · 40% · ₹35k · 10K+ · 331KB · 99.5 — a number is always worth the reader's eye. */
const METRIC_RE = /[₹$€£]?\d[\d,.]*(?:%|\+|[kKxX×])?(?:\s?(?:LPA|lakh|crore|ms|s\b|GB|MB|KB|TB|users?|stars?|repos?|files?|pages?|models?))?/g

/** Tech/term surface forms worth bolding, from the SAME lexicon the JD decoder speaks. */
const TERM_PATTERNS: string[] = [
  ...new Set(
    LEXICON.flatMap((l) => [l.canonical, ...l.patterns])
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p.length >= 3 && !/^(ml |ai |safety|attention|serving|prompting)/.test(p)),
  ),
]

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

interface Interval {
  start: number
  end: number
}

function mergeIntervals(xs: Interval[]): Interval[] {
  const sorted = xs.slice().sort((a, b) => a.start - b.start)
  const out: Interval[] = []
  for (const iv of sorted) {
    const last = out[out.length - 1]
    if (last && iv.start <= last.end + 1) last.end = Math.max(last.end, iv.end)
    else out.push({ ...iv })
  }
  return out
}

/** Max bolded intervals per bullet — emphasis that covers everything emphasizes nothing. */
const MAX_INTERVALS = 6

/** Derive bold runs for a BULLET's final (sanitized) text. Pure + deterministic. */
export function deriveBulletRuns(sanitized: string, decode?: JDDecode): Run[] | undefined {
  const lower = sanitized.toLowerCase()
  const intervals: Interval[] = []

  // 1 · Numbers with their units — mandatory emphasis (the canon front-loads metrics).
  for (const m of sanitized.matchAll(METRIC_RE)) {
    if (m[0].replace(/\D/g, '').length === 0) continue
    // Skip bare list markers/years-in-dates handled elsewhere; a lone "- " prefix digit never matches.
    intervals.push({ start: m.index!, end: m.index! + m[0].length })
  }

  // 2 · Lexicon tech terms + this JD's own keywords (word-boundary, case preserved from the text).
  const terms = [
    ...TERM_PATTERNS,
    ...(decode ? [...decode.mustHave, ...decode.niceToHave].map((k) => k.toLowerCase()) : []),
  ]
  for (const term of terms) {
    const re = new RegExp(`(?<![a-z0-9])${escapeRe(term)}(?![a-z])`, 'gi')
    for (const m of lower.matchAll(re)) {
      intervals.push({ start: m.index!, end: m.index! + term.length })
    }
  }

  if (intervals.length === 0) return undefined
  // SNAP TO WORD BOUNDARIES (caught by READING the rendered page, the D139 discipline): a run
  // boundary inside a word ("1st" → bold "1" + roman "st", "(2021)") made the word-based layout
  // insert phantom spaces — "1 st Place", "( 2021 )". Whole words bold; boundaries only at spaces.
  const snapped = intervals.map((iv) => {
    const start = sanitized.lastIndexOf(' ', iv.start) + 1
    const nextSpace = sanitized.indexOf(' ', iv.end)
    return { start, end: nextSpace === -1 ? sanitized.length : nextSpace }
  })
  const merged = mergeIntervals(snapped).slice(0, MAX_INTERVALS)

  const runs: Run[] = []
  let pos = 0
  for (const iv of merged) {
    if (iv.start > pos) runs.push({ text: sanitized.slice(pos, iv.start) })
    runs.push({ text: sanitized.slice(iv.start, iv.end), bold: true })
    pos = iv.end
  }
  if (pos < sanitized.length) runs.push({ text: sanitized.slice(pos) })
  return runs
}

/**
 * Post-pass over the assembled page: bullets gain bold-inline runs; a project header that
 * carries a ` | stack` suffix keeps the NAME bold and the stack roman (the canon's formula).
 * Derived from the SANITIZED text so renderers/estimator consume runs verbatim.
 */
export function applyEmphasis(lines: CompiledLine[], decode?: JDDecode): CompiledLine[] {
  return lines.map((line) => {
    const sanitized = sanitizePdfText(line.text)
    if (line.kind === 'bullet') {
      // The "- " list marker never bolds; derive over the content after it.
      const marker = sanitized.startsWith('- ') ? '- ' : ''
      const content = sanitized.slice(marker.length)
      const runs = deriveBulletRuns(content, decode)
      if (!runs) return line
      return { ...line, runs: marker ? [{ text: marker }, ...runs] : runs }
    }
    if (line.kind === 'entry-title') {
      const idx = sanitized.indexOf(' | ')
      if (idx > 0) {
        return { ...line, runs: [{ text: sanitized.slice(0, idx), bold: true }, { text: sanitized.slice(idx) }] }
      }
    }
    return line
  })
}

// ---------------------------------------------------------------------------------------------
// ONE wrap algorithm for styled runs (ARCHITECTURE authority 2): the renderer and the estimator
// call THIS function with different measures (pdf-lib true widths vs AFM tables) — the algorithm
// can never fork, only the measure differs, and the parity gate pins the measures together.
// ---------------------------------------------------------------------------------------------

export interface StyledWord {
  text: string
  bold: boolean
}
export type StyledVisualLine = { text: string; bold: boolean }[]

export function wordsOfRuns(runs: Run[]): StyledWord[] {
  const words: StyledWord[] = []
  for (const run of runs) {
    for (const w of run.text.split(' ')) {
      if (w === '') continue
      words.push({ text: w, bold: !!run.bold })
    }
  }
  return words
}

/**
 * Greedy word wrap over styled words — the same algorithm as pdf.ts `wrap()` — emitting visual
 * lines of merged same-style segments. `measure(text, bold)` supplies the width model.
 */
export function layoutRuns(
  runs: Run[],
  measure: (text: string, bold: boolean) => number,
  firstWidth: number,
  fullWidth = firstWidth,
): StyledVisualLine[] {
  const words = wordsOfRuns(runs)
  const spaceW = measure(' ', false)
  const lines: StyledVisualLine[] = []
  let current: StyledWord[] = []
  let currentW = 0
  for (const w of words) {
    const wW = measure(w.text, w.bold)
    const probeW = current.length === 0 ? wW : currentW + spaceW + wW
    const budget = lines.length === 0 ? firstWidth : fullWidth
    if (probeW <= budget || current.length === 0) {
      current.push(w)
      currentW = probeW
    } else {
      lines.push(mergeSegments(current))
      current = [w]
      currentW = wW
    }
  }
  if (current.length > 0) lines.push(mergeSegments(current))
  return lines
}

function mergeSegments(words: StyledWord[]): StyledVisualLine {
  const segs: StyledVisualLine = []
  for (const w of words) {
    const last = segs[segs.length - 1]
    if (last && last.bold === w.bold) last.text += ` ${w.text}`
    else segs.push({ text: (segs.length > 0 ? ' ' : '') + w.text, bold: w.bold })
  }
  return segs
}

/** Estimator-side line count for a runs line, measured with the Times AFM tables. */
export function wrapCountRuns(runs: Run[], size: number, firstWidth: number, fullWidth = firstWidth): number {
  return Math.max(1, layoutRuns(runs, (t, b) => timesWidth(t, size, b ? 'bold' : 'reg'), firstWidth, fullWidth).length)
}
