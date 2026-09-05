import type { JDDecode, Reading, ReadingQuote, StrategistMode } from '../../types'
import { decodeJD } from '../jd/decode'
import { ARCHETYPES } from '../darzi/archetypes'
import { generate } from '../dimaag/core'

/**
 * v2 THE STRATEGIST · pass 1 — THE READING.
 *
 * The old pipeline decoded a posting into lexicon keywords and called 11/11 coverage "aligned"
 * while the company had written, in plain English, that it did not care about any of it
 * (VISION-BRIEF v2, Appendix A). The Reading understands the WHOLE posting once: what the company
 * says it cares about, what it says it does not, who reads the page, what the role really is.
 * Every phrase carries the posting's own words as its receipt, so every later plan decision can
 * point at the sentence that caused it.
 *
 * Two brains, one contract: the deterministic reader (sentence-scoped patterns) is the keyless
 * floor and always runs; the Gemini pass (schema-strict) replaces it when a brain is free. The
 * lexicon decode survives inside `skills` — one decoder, extended, never two.
 */

export const READING_VERSION = 1

const cap = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`)
const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s:•\-–—·*]+|[\s:•\-–—·*.]+$/g, '').trim()

/**
 * Unwrap SOFT line breaks (a posting pasted from email/PDF arrives hard-wrapped at ~80 chars): a line
 * that does not end a sentence and is followed by a line that is not a list item / header joins it.
 * Paragraph breaks (blank lines) and list items survive. Read on the page (05-Sep-2026): a wrapped
 * "We do not care about: … whether you can write" lost "code without AI · LeetCode · certificates".
 */
export function unwrap(text: string): string {
  const lines = text.replace(/\r/g, '').split('\n')
  const out: string[] = []
  const isItem = (l: string) => /^\s*([-*•·]|\d+[.)])\s+/.test(l)
  const isHeader = (l: string) => l.trim().length > 0 && l.trim().length < 70 && /[A-Za-z]/.test(l) && !/[.!?,;]$/.test(l.trim()) && l.trim().split(' ').length <= 8
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i]
    const prev = out[out.length - 1]
    const joinable =
      prev !== undefined &&
      prev.trim().length > 0 &&
      cur.trim().length > 0 &&
      !/[.!?:;]$/.test(prev.trim()) &&
      !isItem(cur) &&
      !isHeader(prev) &&
      !isHeader(cur) &&
      /^[a-z0-9(“"'·•-]/i.test(cur.trim()) &&
      !/^[A-Z][A-Za-z]+:$/.test(cur.trim())
    if (joinable && !/^[A-Z]/.test(cur.trim())) out[out.length - 1] = `${prev.trimEnd()} ${cur.trim()}`
    else if (joinable && prev.trim().split(' ').length > 6 && /^[a-z]/.test(cur.trim())) out[out.length - 1] = `${prev.trimEnd()} ${cur.trim()}`
    else out.push(cur)
  }
  return out.join('\n')
}

/** Split a posting into sentence-ish units, keeping list items as their own units. */
export function sentences(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z"“(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** Split an enumerated tail ("A · B · C", "A, B, and C", "A; B") into items. */
function items(tail: string): string[] {
  const t = clean(tail)
  if (!t) return []
  const parts = /·|•|\|/.test(t) ? t.split(/\s*[·•|]\s*/) : /;/.test(t) ? t.split(/\s*;\s*/) : t.split(/\s*,\s*|\s+\band\b\s+|\s+\bor\b\s+/)
  return parts.map(clean).filter((p) => p.length >= 3 && p.length <= 80 && p.split(' ').length <= 9)
}

const CARE_RE =
  /\b(?:we\s+(?:care\s+(?:enormously|deeply|a\s+lot|most)?\s*about|value|look\s+for|want|need|prize|reward|expect|hire\s+for)|what\s+we\s+(?:care|look\s+for|value)[^:]*|you\s+(?:must|need\s+to|should)\s+(?:be|have)|matters?\s+(?:much\s+)?more|(?:is|are)\s+(?:mandatory|essential|required|a\s+must))\b\s*:?\s*(.*)$/i
const NOCARE_RE =
  /\b(?:we\s+(?:do\s+not|don['’]t)\s+(?:care\s+about|need|require|mind|weigh|look\s+at)|(?:no|not)\s+(?:longer\s+)?(?:required|needed|necessary|matters?)|no\s+(?:need|requirement)\s+(?:for|of)|you\s+(?:do\s+not|don['’]t)\s+need|regardless\s+of|doesn['’]t\s+matter|does\s+not\s+matter|irrelevant|not\s+(?:a\s+)?(?:prerequisite|dealbreaker))\b\s*:?\s*(.*)$/i

/** "X no longer matters" / "No coding experience required." — the subject sits BEFORE the verb. */
const NOCARE_SUBJECT_RE = /^(.{3,60}?)\s+(?:no\s+longer\s+matters?|(?:is|are)\s+not\s+(?:required|needed|necessary)|(?:does|do)\s+not\s+matter|doesn['’]t\s+matter|not\s+required)\b/i
const NOCARE_LEAD_RE = /^no\s+(.{3,50}?)\s+(?:required|needed|necessary)\b/i

function collect(lines: string[], i: number): string[] {
  // A line ending with ":" enumerates on the following lines until a blank/header-ish line.
  const out: string[] = []
  for (let j = i + 1; j < lines.length && j < i + 14; j++) {
    const l = lines[j]
    if (!l.trim()) break
    if (/^[A-Z][^.]{0,60}:$/.test(l.trim())) break
    const item = clean(l.replace(/^[-*•·]\s*/, ''))
    if (item.length >= 3 && item.length <= 90) out.push(...items(item))
    if (out.length >= 14) break
  }
  return out
}

function quotesFrom(text: string, kind: 'care' | 'nocare'): ReadingQuote[] {
  const raw = text.replace(/\r/g, '').split('\n')
  const out: ReadingQuote[] = []
  const seen = new Set<string>()
  const push = (phrase: string, quote: string) => {
    const p = clean(phrase)
    const k = p.toLowerCase()
    if (p.length < 3 || seen.has(k)) return
    // Junk guard: a dangling pronoun/determiner ("exceptional people to capture them", "the") or a
    // whole clause is not a value the company named.
    if (/\b(them|it|us|you|that|this|those|these|the|a|an|to|of|and)$/i.test(k) || k.split(' ').length > 7) return
    seen.add(k)
    out.push({ phrase: cap(p, 70), quote: cap(clean(quote), 180) })
  }
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i].trim()
    if (!line) continue
    for (const s of sentences(line)) {
      if (kind === 'care') {
        const m = CARE_RE.exec(s)
        if (m) {
          const tail = m[1] ?? ''
          const list = tail.trim() ? items(tail) : collect(raw, i)
          for (const it of list.slice(0, 12)) push(it, s)
        }
      } else {
        const m = NOCARE_RE.exec(s)
        if (m) {
          const tail = m[1] ?? ''
          const list = tail.trim() ? items(tail) : collect(raw, i)
          for (const it of list.slice(0, 12)) push(it, s)
          continue
        }
        const sub = NOCARE_SUBJECT_RE.exec(s)
        if (sub) push(sub[1], s)
        const lead = NOCARE_LEAD_RE.exec(s)
        if (lead) push(lead[1], s)
      }
    }
  }
  return out.slice(0, 16)
}

function personaOf(text: string): Reading['readerPersona'] {
  const t = text.toLowerCase()
  if (/reporting (directly )?to the (ceo|founder|cto)|founder-led|founding team|small team|we are a small|early[- ]stage|seed[- ]stage|yc (w|s)\d\d|y combinator/.test(t)) return 'founder'
  if (/campus|placement (drive|cell)|college recruit|university recruit|batch of 20\d\d/.test(t)) return 'campus-panel'
  if (/workday|taleo|icims|successfactors|equal opportunity employer|eeo|our benefits|fortune 500|global leader|multinational/.test(t)) return 'recruiter-ats'
  return 'hiring-manager'
}

function windowOf(decode: JDDecode): Reading['roleWindow'] {
  if (decode.seniority === 'intern') return 'intern'
  if (decode.seniority === 'early-career') return 'new-grad'
  if (decode.seniority === 'mid') return 'mid'
  if (decode.seniority === 'senior') return 'senior'
  return 'unspecified'
}

function archetypeOf(text: string, decode: JDDecode): string {
  const t = ` ${text.toLowerCase()} `
  let best = 'applied-ai'
  let bestScore = -1
  for (const a of ARCHETYPES) {
    let score = 0
    for (const c of a.cues) if (t.includes(c.toLowerCase())) score += 1
    for (const k of decode.mustHave) if (a.cues.includes(k)) score += 2
    if (score > bestScore) {
      best = a.id
      bestScore = score
    }
  }
  // A posting that is explicitly about directing AI tools / vibe coding is forward-deployed-shaped:
  // problem understanding + shipping with AI harnesses, judged by outcomes.
  if (/vibe ?cod|claude code|cursor|codex|ai coding (tool|harness)|direct(ing)? ai/.test(t) && bestScore <= 2) best = 'forward-deployed'
  return best
}

function revealAffinityOf(text: string, archetype: string): number {
  const t = text.toLowerCase()
  let a = 0.3
  if (/vibe ?cod|claude code|cursor|codex|ai coding|ai tools|agentic|llm|language model|copilot/.test(t)) a = 0.85
  else if (/\bai\b|machine learning|automation/.test(t)) a = 0.6
  if (['applied-ai', 'agent-eng', 'forward-deployed'].includes(archetype)) a = Math.max(a, 0.6)
  if (/government|public sector|bank\b|banking|insurance|compliance|regulated/.test(t)) a = Math.min(a, 0.35)
  return Math.round(a * 100) / 100
}

function domainOf(text: string, company: string): string {
  const c = company.trim().toLowerCase()
  for (const s of sentences(text)) {
    const l = s.toLowerCase()
    if (c && l.includes(c) && /\b(is|are|builds?|makes?|runs?|operates?|provides?|helps?)\b/.test(l) && s.length < 240) return cap(clean(s), 200)
  }
  return ''
}

export function readPostingHeuristic(raw: string, company: string, roleTitle: string): Reading {
  const text = unwrap(raw)
  const decode = decodeJD(text)
  const cares = quotesFrom(text, 'care')
  const doesNotCare = quotesFrom(text, 'nocare')
  const archetype = archetypeOf(text, decode)
  const roleWindow = windowOf(decode)
  const readerPersona = personaOf(text)
  const careStr = cares.slice(0, 4).map((q) => q.phrase.toLowerCase()).join(', ')
  const noStr = doesNotCare.slice(0, 3).map((q) => q.phrase.toLowerCase()).join(', ')
  const summary =
    `${company || 'This company'} wants ${roleWindow === 'intern' ? 'an intern' : roleWindow === 'new-grad' ? 'an early-career engineer' : 'an engineer'}` +
    (careStr ? ` judged on ${careStr}` : decode.mustHave.length ? ` with ${decode.mustHave.slice(0, 4).join(', ')}` : '') +
    `.` +
    (noStr ? ` They say they do not care about ${noStr}.` : '')
  return {
    company,
    roleTitle,
    domain: domainOf(text, company),
    summary,
    cares,
    doesNotCare,
    readerPersona,
    roleWindow,
    archetype,
    skills: { must: decode.mustHave, nice: decode.niceToHave },
    tokens: tokensOf(text),
    revealAffinity: revealAffinityOf(text, archetype),
    by: 'heuristic',
    at: new Date().toISOString(),
  }
}

/** Distinct word tokens of the posting (lowercase, ≥3 chars, capped) — the skills assembler matches proven skills against them. */
export function tokensOf(text: string): string[] {
  const seen = new Set<string>()
  for (const m of text.toLowerCase().matchAll(/[a-z][a-z0-9+#.-]{2,}/g)) {
    const t = m[0].replace(/[.-]+$/, '')
    if (t.length >= 3 && !seen.has(t)) seen.add(t)
    if (seen.size >= 500) break
  }
  return [...seen]
}

// ---------------------------------------------------------------------------------------------
// The Gemini pass. Schema-strict; the result is MERGED over the heuristic (never replaces the
// lexicon floor — a brain may add plain-language skills, it cannot remove proven decode terms).

const QUOTE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: { phrase: { type: 'string' }, quote: { type: 'string' } },
    required: ['phrase', 'quote'],
    additionalProperties: false,
  },
}

export const READING_SCHEMA = {
  type: 'object',
  properties: {
    domain: { type: 'string', description: 'One line: what the company does, plain words.' },
    summary: { type: 'string', description: 'Two sentences: what this posting is REALLY asking for, and who will read the résumé.' },
    cares: { ...QUOTE_SCHEMA, description: 'What they say they value; quote = their exact words (≤ 25 words).' },
    doesNotCare: { ...QUOTE_SCHEMA, description: 'What they say they do NOT care about / is not required; quote = their exact words.' },
    readerPersona: { type: 'string', enum: ['founder', 'hiring-manager', 'recruiter-ats', 'campus-panel'] },
    roleWindow: { type: 'string', enum: ['intern', 'new-grad', 'mid', 'senior', 'unspecified'] },
    archetype: { type: 'string', enum: ARCHETYPES.map((a) => a.id) },
    mustSkills: { type: 'array', items: { type: 'string' }, description: 'Concrete skills/tools the posting requires (≤ 3 words each).' },
    niceSkills: { type: 'array', items: { type: 'string' } },
    revealAffinity: { type: 'number', description: '0..1: would THIS reader be delighted that the applicant built the AI system that compiled the résumé?' },
  },
  required: ['domain', 'summary', 'cares', 'doesNotCare', 'readerPersona', 'roleWindow', 'archetype', 'mustSkills', 'niceSkills', 'revealAffinity'],
  additionalProperties: false,
} as const

interface ReadingLLM {
  domain: string
  summary: string
  cares: ReadingQuote[]
  doesNotCare: ReadingQuote[]
  readerPersona: Reading['readerPersona']
  roleWindow: Reading['roleWindow']
  archetype: string
  mustSkills: string[]
  niceSkills: string[]
  revealAffinity: number
}

export function readingSystem(): string {
  return [
    'You are THE READER on a team of personal agents whose whole working life is getting one student an interview call.',
    'You are handed a COMPLETE job posting page (not just the requirements list). Read every sentence twice before answering.',
    'Your job is to understand the company the way a shrewd human agent would: what they SAY they value, what they SAY they do not,',
    'who will actually read the résumé (a founder reads differently from an ATS-driven recruiter), and what the role really is.',
    'Rules: quote their exact words for every phrase (≤ 25 words per quote); never invent a value they did not state;',
    "a sentence like 'we do not care about X' is a doesNotCare, NEVER a care; 'No X required' means X is not cared about;",
    'skills are concrete tools/methods only; return JSON matching the schema exactly.',
  ].join(' ')
}

/** Ensure a quote really appears in the posting (a brain may paraphrase — the receipt must be real). */
function grounded(q: ReadingQuote, text: string): ReadingQuote | null {
  const t = text.toLowerCase().replace(/\s+/g, ' ')
  const quote = clean(q.quote)
  const phrase = clean(q.phrase)
  if (!phrase) return null
  if (quote && t.includes(quote.toLowerCase().slice(0, 60))) return { phrase: cap(phrase, 70), quote: cap(quote, 180) }
  // Fall back to the sentence that contains the phrase itself.
  const hit = sentences(text).find((s) => s.toLowerCase().includes(phrase.toLowerCase()))
  if (hit) return { phrase: cap(phrase, 70), quote: cap(clean(hit), 180) }
  return null
}

export async function readPosting(raw: string, company: string, roleTitle: string): Promise<Reading> {
  const text = unwrap(raw)
  const base = readPostingHeuristic(text, company, roleTitle)
  const user = `COMPANY: ${company}\nROLE: ${roleTitle}\n\nFULL POSTING:\n${text.slice(0, 40000)}`
  const llm = await generate<ReadingLLM>({
    feature: 'strategist.reading',
    system: readingSystem(),
    user,
    maxTokens: 1400,
    schema: READING_SCHEMA as unknown as Record<string, unknown>,
  }).catch(() => null)
  if (!llm) return base
  const cares = (Array.isArray(llm.cares) ? llm.cares : []).map((q) => grounded(q, text)).filter((q): q is ReadingQuote => !!q)
  const doesNotCare = (Array.isArray(llm.doesNotCare) ? llm.doesNotCare : []).map((q) => grounded(q, text)).filter((q): q is ReadingQuote => !!q)
  const dedupe = (xs: ReadingQuote[]) => {
    const seen = new Set<string>()
    return xs.filter((q) => {
      const k = q.phrase.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  const term = (s: string) => clean(s).toLowerCase()
  const okTerm = (s: string) => s.length >= 2 && s.length <= 40 && s.split(' ').length <= 3
  const must = [...new Set([...base.skills.must, ...(llm.mustSkills ?? []).map(term).filter(okTerm)])]
  const nice = [...new Set([...base.skills.nice, ...(llm.niceSkills ?? []).map(term).filter(okTerm)])].filter((n) => !must.includes(n))
  const by: StrategistMode = 'gemini' // refined below by the router's answer when known
  return {
    ...base,
    domain: llm.domain?.trim() ? cap(clean(llm.domain), 200) : base.domain,
    summary: llm.summary?.trim() ? cap(clean(llm.summary), 400) : base.summary,
    cares: dedupe([...cares, ...base.cares]).slice(0, 16),
    doesNotCare: dedupe([...doesNotCare, ...base.doesNotCare]).slice(0, 16),
    readerPersona: llm.readerPersona ?? base.readerPersona,
    roleWindow: llm.roleWindow ?? base.roleWindow,
    archetype: ARCHETYPES.some((a) => a.id === llm.archetype) ? llm.archetype : base.archetype,
    skills: { must, nice },
    revealAffinity: typeof llm.revealAffinity === 'number' ? Math.max(0, Math.min(1, llm.revealAffinity)) : base.revealAffinity,
    by,
    at: new Date().toISOString(),
  }
}
