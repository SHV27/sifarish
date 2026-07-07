import { SLOP_PHRASES } from '../jd/lexicon'

/**
 * Slop-scan gate (§7): zero tolerance for phrases that read as generated filler.
 * Runs over every generated artifact in tests, and over every polish result at runtime.
 */
export function scanSlop(text: string): string[] {
  const hay = text.toLowerCase()
  return SLOP_PHRASES.filter((p) => hay.includes(p))
}
