import canon from '../../../data/ustaad/canon.json'
import { db } from '../../db/db'

/**
 * THE CANON as data (VISION-BRIEF v2: "resume builder has studied thousands of real cse resumes …
 * main bhi sample resumes upload karunga … unhe study karre"). The six samples he supplied are
 * measured into data/ustaad/canon.json; samples he feeds later by chat ("study this résumé: …")
 * are stored in the vault (ustaad table, id 'samples') and cited to the strategist as HIS references.
 * Self-evolving on data he feeds — no code change, no session.
 */

export interface StudiedSample {
  id: string
  addedAt: string
  /** The sample's text (his paste), capped. */
  text: string
  /** One line: what it teaches (deterministic: the shape we measured). */
  shape: string
}

const SAMPLES_ID = 'samples'
const CAP = 6000

export function canonConventions(): string[] {
  return canon.conventions
}

/** Deterministic read of a pasted résumé: section order + rough density, as a one-line shape. */
export function shapeOf(text: string): string {
  const upper = text.match(/^[A-Z][A-Z &/]{4,40}$/gm) ?? []
  const bullets = (text.match(/^\s*[-•*▪]\s+/gm) ?? []).length
  const numbers = (text.match(/\d+(?:\.\d+)?%|\d{2,}\+?/g) ?? []).length
  const words = text.split(/\s+/).length
  return `${upper.length ? `sections: ${upper.slice(0, 8).join(' → ')}; ` : ''}${bullets} bullets, ${numbers} numbers, ~${words} words`
}

export async function listSamples(): Promise<StudiedSample[]> {
  try {
    const row = await db.ustaad.get(SAMPLES_ID)
    return row ? (JSON.parse(row.json) as StudiedSample[]) : []
  } catch {
    return []
  }
}

/** Store a sample he pasted (owner mode; the Darbaan refuses in demo). Returns the stored sample. */
export async function addSample(text: string): Promise<StudiedSample> {
  const clean = text.replace(/\r/g, '').trim().slice(0, CAP)
  const sample: StudiedSample = { id: `sample-${Date.now()}`, addedAt: new Date().toISOString(), text: clean, shape: shapeOf(clean) }
  const all = [...(await listSamples()), sample].slice(-12)
  await db.ustaad.put({ id: SAMPLES_ID, json: JSON.stringify(all), version: 'samples', updatedAt: new Date().toISOString() })
  return sample
}

/** The canon block the strategist reads: measured conventions + up to 3 of his own samples (capped). */
export async function canonForPrompt(): Promise<string> {
  const his = (await listSamples()).slice(-3)
  const lines = [
    'THE CANON (measured from six real selected-student CSE résumés — follow its conventions):',
    ...canon.conventions.map((c) => `- ${c}`),
  ]
  if (his.length) {
    lines.push('', "HIS OWN REFERENCE RÉSUMÉS (samples he fed; match their register and density, never their facts):")
    for (const s of his) lines.push(`--- sample (${s.shape}) ---`, s.text.slice(0, 1200))
  }
  return lines.join('\n')
}
