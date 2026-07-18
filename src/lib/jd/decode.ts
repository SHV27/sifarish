import type { JDDecode } from '../../types'
import { LEXICON } from './lexicon'

/**
 * Stage 1 of the Darzi pipeline: deterministic JD decode.
 * Splits the JD into requirement-ish vs nice-to-have-ish regions by section headers,
 * then matches the lexicon inside each region. Pure function — same JD, same decode, forever.
 */

const NICE_HEADERS = /nice[\s-]*to[\s-]*have|bonus|preferred|plus(?:es)?\b|great if|even better|good to have/i
const MUST_HEADERS = /requirements?|qualifications?|must[\s-]*have|what you(?:'|’)?ll need|what you bring|who you are|about you|skills/i

interface Region {
  text: string
  nice: boolean
}

function splitRegions(jd: string): Region[] {
  const lines = jd.split(/\r?\n/)
  const regions: Region[] = []
  let current: Region = { text: '', nice: false }
  for (const line of lines) {
    const isHeader = line.trim().length > 0 && line.trim().length < 80 && /[a-z]/i.test(line)
    if (isHeader && NICE_HEADERS.test(line)) {
      regions.push(current)
      current = { text: line + '\n', nice: true }
      continue
    }
    if (isHeader && MUST_HEADERS.test(line)) {
      regions.push(current)
      current = { text: line + '\n', nice: false }
      continue
    }
    current.text += line + '\n'
  }
  regions.push(current)
  return regions.filter((r) => r.text.trim().length > 0)
}

function findKeywords(text: string): string[] {
  const hay = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' '
  const found: string[] = []
  for (const entry of LEXICON) {
    if (entry.patterns.some((p) => hay.includes(p))) found.push(entry.canonical)
  }
  return found
}

export function decodeJD(jd: string): JDDecode {
  const regions = splitRegions(jd)
  const must = new Set<string>()
  const nice = new Set<string>()
  for (const region of regions) {
    for (const kw of findKeywords(region.text)) {
      if (region.nice) nice.add(kw)
      else must.add(kw)
    }
  }
  // A keyword seen in a must region wins over a nice mention.
  for (const kw of must) nice.delete(kw)

  const lower = jd.toLowerCase()

  let seniority = 'unspecified'
  if (/intern(ship)?\b/.test(lower)) seniority = 'intern'
  else if (/\b(new grad|entry[\s-]level|early[\s-]career|junior|0-2 years|fresh)/.test(lower)) seniority = 'early-career'
  else if (/\b(senior|staff|principal|lead|manager|head of|director|vice president|vp|[5-9]\+ years|1[0-9]\+ years)\b/.test(lower)) seniority = 'senior'
  else if (/\b(engineer|scientist|researcher)\b/.test(lower)) seniority = 'mid'

  const locationHints: string[] = []
  if (/\bremote\b/.test(lower)) locationHints.push('remote')
  if (/\bhybrid\b/.test(lower)) locationHints.push('hybrid')
  if (/india|bengaluru|bangalore|mumbai|delhi|gurgaon|gurugram|hyderabad|pune|chennai|noida/.test(lower)) locationHints.push('india')
  if (/visa|work authorization|us citizen|eligible to work in the (us|uk|eu)/.test(lower)) locationHints.push('authorization-constrained')

  const compHints: string[] = []
  const rupee = lower.match(/(?:₹|inr|rs\.?)\s?[\d,]+(?:k| ?lpa|,000)?(?:\s?[-–]\s?(?:₹|inr|rs\.?)?\s?[\d,]+(?:k| ?lpa|,000)?)?(?:\s?(?:per month|\/month|monthly|per annum|lpa))?/g)
  if (rupee) compHints.push(...rupee.map((s) => s.trim()))
  const dollar = lower.match(/\$\s?[\d,]+(?:k)?(?:\s?[-–]\s?\$?\s?[\d,]+(?:k)?)?(?:\s?(?:per month|\/month|monthly|per year|\/yr|annually|\/hour|\/hr|per hour))?/g)
  if (dollar) compHints.push(...dollar.map((s) => s.trim()))
  if (/\b(ppo|pre[\s-]placement offer|return offer|full[\s-]time conversion|conversion to full[\s-]time)\b/.test(lower)) {
    compHints.push('conversion-language')
  }
  if (/\b(stipend|paid internship|compensation|salary)\b/.test(lower)) compHints.push('paid-signal')

  // PROMINENCE (Session 5.5): weight each must-have by how many times its surface patterns actually
  // appear in the JD — a requirement repeated across the posting outranks one mentioned once. Range
  // 2–4 (2 = one mention, the historic flat weight, so nothing regresses; 4 = named ≥4 times).
  const lexByCanonical = new Map(LEXICON.map((e) => [e.canonical, e.patterns]))
  const hayFull = ' ' + lower.replace(/\s+/g, ' ') + ' '
  const mustHaveWeights: Record<string, number> = {}
  for (const kw of must) {
    let occ = 0
    for (const p of lexByCanonical.get(kw) ?? []) {
      let i = hayFull.indexOf(p)
      while (i !== -1) {
        occ++
        i = hayFull.indexOf(p, i + p.length)
      }
    }
    mustHaveWeights[kw] = occ >= 4 ? 4 : occ >= 2 ? 3 : 2
  }

  return {
    mustHave: [...must].sort(),
    niceToHave: [...nice].sort(),
    seniority,
    locationHints,
    compHints,
    mustHaveWeights,
  }
}
