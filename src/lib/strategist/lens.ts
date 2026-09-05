import lensesJson from '../../../data/config/lenses.json'
import type { Reading } from '../../types'

/**
 * THE LENS (v2 R5) — the cunning before the writing. A team that has read a company decides the
 * ANGLE first: an NGO gets Braillix's human story with the AI named once; a growth team gets
 * shipped results with numbers; a research lab gets method and verification; an AI shop gets the
 * stack and the systems. The catalogue is DATA (data/config/lenses.json) — a new kind of company
 * is a new object there, never a code change (brief: "app should stand the test of time").
 */
export interface Lens {
  id: string
  label: string
  cues: string[]
  leadRe: string
  framing: string
  sectionOrder: string[]
  skills: 'lead' | 'normal' | 'after'
  why: string
}
interface LensFile {
  version: number
  lenses: Lens[]
}
export const LENSES: Lens[] = (lensesJson as LensFile).lenses

export interface LensChoice {
  lens: Lens
  /** The cue that fired, quoted — the board shows it. */
  because: string
  score: number
}

/** Everything the reading knows, as one haystack: domain, summary, the company's own quotes, posting tokens, research. */
export function readingText(r: Reading): string {
  return [
    r.domain ?? '',
    r.summary ?? '',
    ...r.cares.map((q) => `${q.phrase} ${q.quote}`),
    ...r.doesNotCare.map((q) => `${q.phrase} ${q.quote}`),
    (r.tokens ?? []).join(' '),
    ...(r.research ?? []).map((x) => x.text),
  ]
    .join('\n')
    .toLowerCase()
}

/** Choose the lens the posting asks for; the last lens in the catalogue is the default. */
export function chooseLens(r: Reading): LensChoice {
  const hay = readingText(r)
  const scored = LENSES.map((lens) => {
    let score = 0
    let because = ''
    for (const cue of lens.cues) {
      const re = new RegExp(cue, 'i')
      const m = re.exec(hay)
      if (m) {
        score += 1
        if (!because) because = m[0]
      }
    }
    // A "we do not care about the stack" posting is mind-first even when it lists tools.
    if (lens.id === 'mind-first' && r.doesNotCare.some((q) => /leetcode|syntax|code without|coding experience|certificat/i.test(`${q.phrase} ${q.quote}`))) score += 2
    // A founder reader leans founder-ship; a campus panel leans research/mind.
    if (lens.id === 'founder-ship' && r.readerPersona === 'founder') score += 1
    return { lens, because, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const top = scored[0]
  if (top.score === 0) {
    const fallback = LENSES[LENSES.length - 1]
    return { lens: fallback, because: 'no stated angle — the technical proof leads', score: 0 }
  }
  return top
}

/** Does a fact's own words carry this lens's lead — the thing the reader is looking for? */
export function leadsFor(lens: Lens, text: string): boolean {
  return new RegExp(lens.leadRe, 'i').test(text)
}

/** The catalogue as the brain reads it. */
export function lensesForPrompt(chosen: LensChoice): string {
  const lines = LENSES.map((l) => `- ${l.id} (${l.label}): leads with ${l.leadRe.split('|').slice(0, 5).join('/')}…; framing: ${l.framing}; skills rows ${l.skills}`)
  return `THE LENS CATALOGUE (angles a cunning team chooses between; pick one, or a better one you can name)\n${lines.join('\n')}\nTHE TEAM'S FIRST READ: ${chosen.lens.id} — because the posting says "${chosen.because}". ${chosen.lens.why}. Keep it or change it, and say which in the rationale.`
}
