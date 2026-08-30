import type { Job } from '../../types'

/**
 * HAQ FILTER (re-brief Pillar 3) — work-authorization eligibility, decided ONCE at the ingest
 * choke point and persisted on the Job. The owner is India-based with no foreign work
 * authorization: a role that provably requires authorization he doesn't hold must never
 * surface (VISION-BRIEF law), but ONLY confirmed evidence may hide — ambiguity demotes with
 * its reason rendered, and a visible "hidden as ineligible: N" list keeps nothing silent
 * (DECISIONS.md RB-1 open call 2).
 *
 * Two-sided honesty: this guard ships with false-hide AND false-show tests (eligibility.test.ts).
 */

export interface WorkAuth {
  /** Lowercase country the owner lives in. */
  home: string
  /** Lowercase countries he may legally work in. */
  authorizedIn: string[]
  remoteOk: boolean
}

export const DEFAULT_WORK_AUTH: WorkAuth = { home: 'india', authorizedIn: ['india'], remoteOk: true }

export type EligibilityVerdict = NonNullable<Job['eligibility']>

// --- sentence-scoped text signals -------------------------------------------------------------

/** Split prose into rough sentences so a negation can only kill its own sentence (D95 lesson). */
function sentences(text: string): string[] {
  return text.split(/(?<=[.!?;])\s+|\n+|[•·▪]/).filter((s) => s.trim().length > 0)
}

/** Sponsorship offered / global-friendly — the POSITIVE side; must never trip a naive scan. */
// Lookbehinds keep a NEGATED sponsorship line ("does NOT offer sponsorship", "canNOT sponsor")
// from reading as positive — the guard's own false-positive mode, caught by its first gate run.
const POSITIVE = /sponsorship\s+(?:is\s+)?(?:available|offered|provided|possible)|(?<!(?:not|n['’]t|never|no)\s{1,3})(?:can|do|will)\s+(?:provide\s+)?sponsor|(?<!(?:not|n['’]t|never)\s{1,3})offers?\s+(?:visa\s+)?sponsorship|visa\s+(?:support|assistance|sponsorship\s+available)|relocation\s+(?:support|assistance|package)|work\s+from\s+anywhere|remote[\s-]*(?:\()?\s*worldwide|globally\s+remote|hire\s+(?:in|from)\s+(?:\d+\s+)?(?:any|all)?\s*countr/i

/** Negated sponsorship — "no/unable/cannot/without … sponsor(ship)" inside one sentence. */
const NO_SPONSOR = /(?:\bno\b|\bnot\b|\bunable\b|\bcannot\b|can['’]t|won['’]t|\bwill\s+not\b|\bdo(?:es)?\s+not\b|\bwithout\b|\bnot?\s+able\s+to\b)[^.!?;\n]{0,60}\bsponsor|\bsponsor(?:ship)?\b[^.!?;\n]{0,40}\b(?:not|no|unavailable|is\s+not)\b|\(no\s+sponsorship\)|does\s+not\s+offer\s+sponsorship/i

/** Citizenship / clearance — near-absolute foreign-authorization requirements. */
const CITIZENS_ONLY = /\b(?:u\.?s\.?|us|american|british|uk|german|canadian|australian)\s+citizens?(?:hip)?\b[^.!?;\n]{0,40}\b(?:only|required|is\s+required|must)\b|\bmust\s+be\s+(?:an?\s+)?(?:u\.?s\.?|us)\s+(?:citizen|person)\b|\bcitizenship\s+(?:is\s+)?required\b/i
const CLEARANCE = /\bsecurity\s+clearance\b|\bts\/sci\b|\bitar\b|\bpolygraph\b|\bgreen\s+card\s+holders?\b/i

/** "Must be authorized to work in <foreign place>" — the classic gate line. */
const AUTH_IN = /(?:authori[sz]ed|eligib(?:le|ility)|legal(?:ly)?\s+(?:right|able))[^.!?;\n]{0,40}\bwork\s+in\s+(?:the\s+)?(us|usa|u\.s\.|united\s+states|uk|united\s+kingdom|eu|europe|canada|germany|australia|singapore|netherlands|france|switzerland)\b|\bright\s+to\s+work\s+in\s+(?:the\s+)?(us|usa|uk|united\s+kingdom|eu|europe|canada|germany|australia|singapore|netherlands|france|switzerland)\b|\bwork\s+permit\s+(?:for|in)\s+(?:the\s+)?\w+\s+(?:is\s+)?required\b/i

/** OPT/CPT negated → the posting excludes even US international students. */
const OPT_NEGATED = /\b(?:opt|cpt)\b[^.!?;\n]{0,40}\b(?:not\s+eligible|not\s+accepted|ineligible|cannot|not\s+supported)\b|\bno\s+(?:opt|cpt)\b/i
/** OPT/CPT positive → US-student-targeted; a soft signal for an India-based candidate. */
const OPT_POSITIVE = /\b(?:opt|cpt)\b/i
const US_CONTRACT = /\bw-?2\s+only\b|\bno\s+c2c\b|\bno\s+corp[\s-]?to[\s-]?corp\b/i

/** Remote-but-region-locked text: "Remote (US)", "US-based only", "remote within the EU". */
const REMOTE_LOCKED = /\bremote\b[^.!?;\n]{0,20}\(\s*(us|usa|u\.s\.|uk|eu|europe|canada|germany|emea|north\s+america)[^)]*\)|\bremote\s+(?:in|within)\s+(?:the\s+)?(us|usa|uk|eu|europe|canada|emea|north\s+america)\b|\b(us|usa|uk|eu)[\s-]based\s+(?:only|candidates?\s+only|applicants?\s+only)\b/i

// --- structured location-field signals --------------------------------------------------------

const FIELD_GOOD = /worldwide|anywhere|global|international|\bapac\b|\basia\b|india/i
/** Region strings the remote boards use that EXCLUDE India when they stand alone. */
const FIELD_REGIONS = /^(?:remote\s*[-–—]?\s*)?(?:usa?(?:\s+only)?|u\.s\.(?:\s+only)?|united\s+states(?:\s+only)?|usa\/canada|north\s+america|americas?|canada(?:\s+only)?|uk|united\s+kingdom|europe|eu(?:\s+only)?|emea|latam|south\s+america|australia|new\s+zealand|oceania|germany|france|netherlands|poland|spain|italy|portugal|switzerland|austria|belgium|nordics?|scandinavia)\s*\.?$/i

/** Major foreign on-site cities/countries seen in these feeds (used only with NO remote signal). */
const FOREIGN_PLACE = /(united\s+states|\busa\b|\bu\.s\.\b|new\s+york|san\s+francisco|palo\s+alto|mountain\s+view|seattle|austin|boston|chicago|denver|los\s+angeles|london|berlin|munich|frankfurt|hamburg|paris|amsterdam|rotterdam|dublin|toronto|vancouver|montreal|sydney|melbourne|singapore|dubai|abu\s+dhabi|tel\s+aviv|zurich|geneva|stockholm|oslo|copenhagen|helsinki|warsaw|krakow|lisbon|madrid|barcelona|tokyo|seoul|hong\s+kong|taipei)/i
const INDIA_PLACE = /india|bengaluru|bangalore|mumbai|delhi|gurgaon|gurugram|hyderabad|pune|chennai|noida|kolkata|ahmedabad|jaipur|remote\s*[-–—]?\s*india/i

// --- the verdict -------------------------------------------------------------------------------

/** Sources whose `location` IS the candidate-eligibility field (Remotive/Jobicy geo strings). */
const GEO_FIELD_SOURCES = new Set(['remotive', 'jobicy'])

export function assessEligibility(job: Job, auth: WorkAuth = DEFAULT_WORK_AUTH): EligibilityVerdict {
  const loc = (job.location ?? '').trim()
  const text = `${job.title}\n${job.jd ?? ''}`
  const hasPositiveAnywhere = POSITIVE.test(text)
  const authorized = (place: string) => auth.authorizedIn.some((c) => place.toLowerCase().includes(c))

  // 1 · Structured geo field from the remote boards — the cleanest evidence there is.
  if (GEO_FIELD_SOURCES.has(job.source) && loc) {
    if (FIELD_GOOD.test(loc) || authorized(loc)) {
      return { verdict: 'eligible', reason: `board says candidate location "${loc}" — includes you`, source: 'field' }
    }
    if (FIELD_REGIONS.test(loc)) {
      return { verdict: 'ineligible', reason: `board restricts candidates to "${loc}" — outside your work authorization`, source: 'field' }
    }
  }

  // 2 · Sentence-scoped hard evidence in the text (positive sponsorship in the SAME sentence wins).
  for (const s of sentences(text)) {
    const positive = POSITIVE.test(s)
    if (CITIZENS_ONLY.test(s) && !positive) {
      return { verdict: 'ineligible', reason: `posting says "${clip(s)}" — citizenship you don't hold`, source: 'jd-text' }
    }
    if (CLEARANCE.test(s)) {
      return { verdict: 'ineligible', reason: `posting requires ${clip(s.match(CLEARANCE)?.[0] ?? 'a security clearance')} — a citizenship-tied requirement`, source: 'jd-text' }
    }
    if (OPT_NEGATED.test(s)) {
      return { verdict: 'ineligible', reason: `posting excludes OPT/CPT ("${clip(s)}") — US-authorized candidates only`, source: 'jd-text' }
    }
    if (NO_SPONSOR.test(s) && !positive) {
      // No sponsorship + a location/authorization anchor = confirmed; bare "no sponsorship" on a
      // worldwide-remote role would be irrelevant, so require the role NOT be provably global.
      if (!hasPositiveAnywhere && !INDIA_PLACE.test(`${loc} ${text}`)) {
        return { verdict: 'ineligible', reason: `posting says "${clip(s)}" — no sponsorship, and no India/worldwide path`, source: 'jd-text' }
      }
    }
    if (AUTH_IN.test(s) && !positive && !hasPositiveAnywhere) {
      const place = s.match(AUTH_IN)?.[1] ?? s.match(AUTH_IN)?.[2] ?? 'that country'
      if (!authorized(place)) {
        return { verdict: 'ineligible', reason: `posting requires the right to work in ${place.toUpperCase()} ("${clip(s)}")`, source: 'jd-text' }
      }
    }
    if (REMOTE_LOCKED.test(s)) {
      const region = s.match(REMOTE_LOCKED)?.[1] ?? s.match(REMOTE_LOCKED)?.[2] ?? s.match(REMOTE_LOCKED)?.[3] ?? 'a region'
      if (!authorized(region)) {
        return { verdict: 'ineligible', reason: `remote but locked to ${String(region).toUpperCase()} ("${clip(s)}")`, source: 'jd-text' }
      }
    }
  }

  // 3 · India / authorized geography → clean.
  if (INDIA_PLACE.test(loc) || (loc === '' && INDIA_PLACE.test(text))) {
    return { verdict: 'eligible', reason: 'India location named — inside your authorization', source: loc ? 'field' : 'jd-text' }
  }
  if (hasPositiveAnywhere) {
    return { verdict: 'eligible', reason: 'work-from-anywhere / sponsorship-positive language present', source: 'jd-text' }
  }

  // 4 · Foreign on-site/hybrid with NO remote path and NO sponsorship word — demote, don't hide:
  //     location fields lie often enough (HQ city on a remote role) that this stays AMBIGUOUS.
  const mentionsRemote = /\bremote\b/i.test(`${loc} ${text}`)
  if (FOREIGN_PLACE.test(loc) && !mentionsRemote) {
    return { verdict: 'ambiguous', reason: `on-site in ${loc} with no remote or sponsorship signal — likely needs authorization you don't hold`, source: 'jd-text' }
  }

  // 5 · Soft US-market tells → demote with the reason.
  if (US_CONTRACT.test(text)) {
    return { verdict: 'ambiguous', reason: 'W2-only / no-C2C language — US-authorized contract market', source: 'jd-text' }
  }
  if (OPT_POSITIVE.test(text)) {
    return { verdict: 'ambiguous', reason: 'OPT/CPT language — the posting targets US-based students', source: 'jd-text' }
  }

  // 6 · Nothing known — neutral, never punished on a guess.
  return { verdict: 'eligible', reason: 'no authorization restrictions found', source: 'none' }
}

function clip(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ')
  return t.length > 90 ? `${t.slice(0, 87)}…` : t
}

/** The ONE question the queue/briefing ask. Owner override always wins. */
export function isIneligible(job: Job): boolean {
  if (job.eligibilityOverride) return false
  return job.eligibility?.verdict === 'ineligible'
}

/** Stamp a job at ingest; an owner-overridden or already-stamped job with unchanged JD keeps its verdict. */
export function withEligibility(job: Job, auth: WorkAuth = DEFAULT_WORK_AUTH): Job {
  if (job.eligibilityOverride && job.eligibility) return job
  return { ...job, eligibility: assessEligibility(job, auth) }
}
