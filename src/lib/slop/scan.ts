import { SLOP_PHRASES, GUARANTEE_PHRASES } from '../jd/lexicon'

/**
 * Slop-scan gate (§7): zero tolerance for phrases that read as generated filler.
 * Runs over every generated artifact in tests, and over every polish result at runtime.
 */
export function scanSlop(text: string): string[] {
  const hay = text.toLowerCase()
  return SLOP_PHRASES.filter((p) => hay.includes(p))
}

/**
 * I9 — guarantee-language scan. Runs over UI copy, Guru replies, and generated documents.
 * The app maximizes probability and says exactly that; it never promises outcomes.
 */
export function scanGuarantee(text: string): string[] {
  const hay = text.toLowerCase()
  return GUARANTEE_PHRASES.filter((p) => hay.includes(p))
}

/** Combined honesty scan used on any externally-surfaced generated text. */
export function scanHonesty(text: string): { slop: string[]; guarantee: string[]; clean: boolean } {
  const slop = scanSlop(text)
  const guarantee = scanGuarantee(text)
  return { slop, guarantee, clean: slop.length === 0 && guarantee.length === 0 }
}
