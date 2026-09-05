import type { GamePlan, Identity, JDDecode, LedgerEntry, PlanFact, Reading, SectionDef, SkillRow, StrategistMode, VisionProfile } from '../../types'
import { displayTitle } from '../compile/compiler'
import { bannedSkillKeys, derivedSkills, findSkill, isBannedSkill, skillRow, type DerivedSkill } from '../dossier/skills'
import { canonTech } from '../dossier/tech'
import { chooseLens, leadsFor, lensesForPrompt } from './lens'
import { generateWithMeta } from '../dimaag/core'
import { entryRelevance } from '../match/evidence'
import { detectDrift } from '../polish/factGuard'
import { scanHonesty } from '../slop/scan'
import { buildDigest, type Digest } from './digest'
import { voiceClause } from '../darzi/summary'
import { DEFAULT_SECTIONS } from '../dossier/sections'

/**
 * v2 THE STRATEGIST · pass 2 — THE GAME PLAN.
 *
 * The plan is the artifact the compiler EXECUTES (ARCHITECTURE v2, authority 1): the three lines
 * a reader hits first, the section order, every fact PLAYED or BENCHED with a reason in the
 * company's own words, the skills rows assembled from what THIS posting asks ∩ what the evidence
 * proves, and the reveal decision. A plan is a typed object, so it is testable: the Babaclick gate
 * asserts NTSE and Braillix lead and LeetCode-class items sit benched with the posting's words.
 *
 * Two brains, one contract: `planHeuristic` is the keyless floor and the validator's fallback for
 * every piece a brain gets wrong; `makePlan` asks Gemini for the reasoned plan and runs it through
 * `validatePlan` — unknown ids, unreasoned benches, unproven skills, slop and fact-drift are
 * discarded item by item, each discard NOTED (never silent).
 */

export const PLAN_VERSION = 1

// ---------- section keys ----------

export const CORE_SECTIONS = ['education', 'experience', 'projects', 'skills', 'achievements', 'positions', 'certs'] as const

/** kind → section key (registry). Custom kinds are their own section. */
export function sectionKeyFor(kind: string): string {
  switch (kind) {
    case 'project':
      return 'projects'
    case 'achievement':
      return 'achievements'
    case 'position':
      return 'positions'
    case 'certification':
      return 'certs'
    case 'skill':
      return 'skills' // skill entries are evidence for the rows, never played facts — one key, plural
    case 'education':
    case 'experience':
      return kind
    default:
      return kind
  }
}

/** Heading text for a section key (custom kinds get a title-cased heading unless the registry names one). */
export function sectionLabel(key: string, sections?: SectionDef[]): string {
  const reg = (sections ?? DEFAULT_SECTIONS).find((s) => s.kind === key || sectionKeyFor(s.kind) === key)
  if (reg) return reg.label.toUpperCase()
  const fixed: Record<string, string> = {
    education: 'EDUCATION',
    experience: 'EXPERIENCE',
    projects: 'PROJECTS',
    skills: 'TECHNICAL SKILLS',
    achievements: 'ACHIEVEMENTS',
    positions: 'POSITIONS OF RESPONSIBILITY',
    certs: 'CERTIFICATIONS',
  }
  return fixed[key] ?? key.replace(/[-_]/g, ' ').toUpperCase()
}

// ---------- signals ----------

const MIND_RE = /reason|aptitude|logic|intellect|learn|agency|curio|independent|judg|ownership|initiative|honest|quantitative|first principles|problem|verify|attention to|detail|research|think/i
const SHIP_RE = /ship|built|build|production|deploy|impact|outcome|own|launch|revenue/i
const LEETCODE_RE = /leetcode|dsa\b|data structures|competitive programming|codeforces|coding rounds?/i
const CERT_RE = /certificat|courses?\b|coursera|udemy/i
const PEDIGREE_RE = /university|college|degree|brand|grades|gpa|cgpa|marks/i
const NTSE_RE = /ntse|national talent|scholar|olympiad|jee|rank\b/i

const short = (t: string) => displayTitle(t).split(/ — | – | \| /)[0].trim()

export function decodeFromReading(r: Reading): JDDecode {
  return { mustHave: r.skills.must, niceToHave: r.skills.nice, seniority: r.roleWindow, locationHints: [], compHints: [] }
}

function caresText(r: Reading): string {
  return `${r.cares.map((q) => q.phrase).join(' ')} ${r.summary}`.toLowerCase()
}
function noCareText(r: Reading): string {
  return r.doesNotCare.map((q) => q.phrase).join(' ').toLowerCase()
}
function noCareQuote(r: Reading, re: RegExp): string | null {
  const hit = r.doesNotCare.find((q) => re.test(q.phrase) || re.test(q.quote))
  return hit ? hit.quote : null
}
function careQuote(r: Reading, re: RegExp): string | null {
  const hit = r.cares.find((q) => re.test(q.phrase) || re.test(q.quote))
  return hit ? hit.phrase : null
}

function rolePhrase(vision?: VisionProfile, reading?: Reading): string {
  const roles = (vision?.targetRoles ?? []).join(' ').toLowerCase()
  if (reading?.archetype === 'forward-deployed') return 'AI engineer who directs AI to solve real problems'
  if (/agentic|agent/.test(roles)) return 'Agentic-AI engineer'
  if (/llm/.test(roles)) return 'LLM engineer'
  return 'AI engineer'
}

// ---------- the heuristic plan (keyless floor + validator fallback) ----------

export function planHeuristic(reading: Reading, ledger: LedgerEntry[], _identity: Identity, vision?: VisionProfile, sections?: SectionDef[]): GamePlan {
  const decode = decodeFromReading(reading)
  const facts = ledger.filter((e) => e.resumeEligible && e.tier === 'shipped' && e.kind !== 'skill')
  const skillsAll = derivedSkills(ledger)
  const cares = caresText(reading)
  const nocare = noCareText(reading)
  const mind = MIND_RE.test(cares)
  const techHeavy = reading.skills.must.length >= 4
  // MIND-FIRST: the posting is about the mind, not the stack — explicit care statements (≥3), or a
  // stated "we do not care about code/syntax/LeetCode", outrank a long tool list (Babaclick names
  // React/Python/FastAPI/PostgreSQL and says it does not care whether you can code without AI).
  const mindHits = reading.cares.filter((q) => MIND_RE.test(q.phrase)).length
  const mindFirst = mind && (mindHits >= 2 || /syntax|code without|coding experience|leetcode/i.test(nocare) || (!techHeavy && mindHits >= 1))
  const founder = reading.readerPersona === 'founder'
  // THE LENS (R5): the angle a cunning team chooses BEFORE writing — data-driven (lenses.json).
  const lensChoice = chooseLens(reading)
  const lens = lensChoice.lens
  const played: PlanFact[] = []
  const benched: GamePlan['benched'] = []
  const notes: string[] = []

  const by = (kind: string) => facts.filter((f) => f.kind === kind)
  const rel = (f: LedgerEntry) => entryRelevance(f, decode)

  // Education: always played. Under a mind-first posting the board scores ARE the proof.
  for (const e of by('education')) {
    played.push({
      factId: e.id,
      section: 'education',
      reason: mind && /\d{2}(\.\d)?%|cgpa/i.test(`${e.title} ${e.summary}`) ? `proof of aptitude — they say they care about "${careQuote(reading, MIND_RE) ?? 'reasoning'}"` : 'the degree line is the first thing every reader checks',
    })
  }
  for (const e of by('experience')) played.push({ factId: e.id, section: 'experience', reason: 'real work experience always plays' })

  // Projects: relevance, with the Sifarish reveal boost and a mind-first innovation boost.
  const projects = by('project')
  const isSifarish = (e: LedgerEntry) => /sifarish/i.test(e.title)
  const score = (e: LedgerEntry) => {
    // When they say the stack does not decide, the stack-match stops deciding the order (capped).
    let s = mindFirst ? Math.min(rel(e) * 2, 3) : rel(e) * 2
    if (isSifarish(e) && reading.revealAffinity >= 0.6) s += 6
    const t = `${e.title} ${e.summary} ${e.tags.join(' ')}`
    if (mindFirst && /braille|blind|hardware|first-of|novel|innovat|refreshable/i.test(t)) s += 5 // the innovation angle leads
    if (leadsFor(lens, t)) s += lens.id === 'ai-engineering' ? 2 : 6 // the lens's lead — an NGO ranks Braillix over an AI system
    else if (mind && /clinical|health|hospital|public|civic/i.test(t)) s += 3 // a real problem solved without being told how
    if (/shipped|live|deploy/i.test(e.tags.join(' ') + (e.evidence?.url ?? ''))) s += 1
    if (e.bullets.length >= 3) s += 1
    return s
  }
  const ranked = projects.slice().sort((a, b) => score(b) - score(a) || (b.evidence?.date ?? '').localeCompare(a.evidence?.date ?? ''))
  // The canon (six samples): THREE projects on a dense page when achievements/positions/certs also
  // play; four only when the rest of the dossier is thin. Page 2 stays the fallback, not the plan.
  const restCount = facts.filter((f) => !['project', 'education'].includes(f.kind)).length
  const maxProjects = by('experience').length >= 2 || restCount >= 4 ? 3 : 4
  ranked.forEach((p, i) => {
    if (i < maxProjects) {
      const reasons: string[] = []
      if (isSifarish(p) && reading.revealAffinity >= 0.6) reasons.push('this reader rewards AI-directed building — and it compiled this page')
      if (mind && /braille|blind|hardware|clinical|health/i.test(`${p.title} ${p.summary}`)) reasons.push(`a real problem solved without being told how — they care about "${careQuote(reading, MIND_RE) ?? 'agency'}"`)
      const hits = reading.skills.must.filter((k) => p.tags.includes(k) || p.bullets.some((b) => b.keywords.includes(k)))
      if (hits.length) reasons.push(`proves ${hits.slice(0, 3).join(', ')} they ask for`)
      if (leadsFor(lens, `${p.title} ${p.summary} ${p.tags.join(' ')}`) && lens.id !== 'ai-engineering') reasons.unshift(`carries the ${lens.label} angle they hire for`)
      if (!reasons.length) reasons.push('shipped, linked, and closest to the role')
      // The angle the wording is re-aimed toward for THIS company (drift-guarded reframe in darzi).
      const framing = mindFirst && lens.id === 'ai-engineering' ? 'lead with the problem understood and the innovation, and with how the work was verified — proof of reasoning and agency, not a tool list' : lens.framing
      played.push({ factId: p.id, section: 'projects', reason: reasons.join('; '), ...(framing ? { framing } : {}) })
    } else {
      benched.push({ factId: p.id, reason: `page budget — ranked below ${ranked.slice(0, maxProjects).map((x) => short(x.title)).join(', ')} for this posting; say "play ${short(p.title)}" to swap it in` })
    }
  })

  // Achievements: ALL played (the owner's law: suppress nothing) unless the posting says it does not care.
  for (const a of by('achievement')) {
    const t = `${a.title} ${a.summary} ${a.tags.join(' ')}`
    const lc = LEETCODE_RE.test(t) ? noCareQuote(reading, LEETCODE_RE) : null
    if (lc) {
      benched.push({ factId: a.id, reason: `they say: "${lc}"` })
      continue
    }
    const reason = mind && NTSE_RE.test(t) ? `national-level proof of the reasoning they ask for — "${careQuote(reading, MIND_RE) ?? 'logical reasoning'}"` : mind ? 'proof of agency and outcomes, which this reader weighs above credentials' : 'every true achievement plays; a reader compares the whole list'
    played.push({ factId: a.id, section: 'achievements', reason })
  }
  for (const p of by('position')) played.push({ factId: p.id, section: 'positions', reason: lens.id === 'social-impact' && /volunteer|community|parishad|ngo|social/i.test(`${p.title} ${p.summary}`) ? `community work is direct evidence for a ${lens.label} reader` : 'responsibility taken without being told how — leadership reads as agency' })

  // Certifications: played unless they say they do not care about certificates.
  const certNo = noCareQuote(reading, CERT_RE)
  for (const c of by('certification')) {
    if (certNo) benched.push({ factId: c.id, reason: `they say: "${certNo}"` })
    else played.push({ factId: c.id, section: 'certs', reason: 'true and dated; costs one line' })
  }
  // Custom kinds (sections created on demand): all played.
  for (const f of facts.filter((e) => !['education', 'experience', 'project', 'achievement', 'position', 'certification'].includes(e.kind))) {
    played.push({ factId: f.id, section: sectionKeyFor(f.kind), reason: 'a fact he asked the dossier to hold — plays unless the posting says otherwise' })
  }

  // Section order — a per-posting decision, not a template.
  const custom = [...new Set(played.map((p) => p.section).filter((s) => !(CORE_SECTIONS as readonly string[]).includes(s)))]
  let order: string[]
  if (reading.roleWindow === 'senior' || reading.roleWindow === 'mid') order = ['experience', 'projects', 'skills', 'education', 'achievements', 'positions', 'certs']
  else if (mindFirst && (lens.id === 'mind-first' || lens.id === 'ai-engineering')) order = ['education', 'achievements', 'projects', 'experience', 'skills', 'positions', 'certs']
  else if (founder && SHIP_RE.test(cares)) order = ['projects', 'experience', 'education', 'skills', 'achievements', 'positions', 'certs']
  else order = lens.sectionOrder.slice()
  const registryOrder = (sections ?? []).slice().sort((a, b) => a.order - b.order).map((s) => sectionKeyFor(s.kind))
  for (const k of registryOrder) if (!order.includes(k) && custom.includes(k)) order.push(k)
  for (const k of custom) if (!order.includes(k)) order.push(k)
  if (PEDIGREE_RE.test(nocare) && order[0] === 'education' && !mind) {
    order = order.filter((k) => k !== 'education')
    order.splice(2, 0, 'education')
  }

  // Skills rows: JD ∩ evidence, the market's vocabulary first; shorter when they say syntax does not matter.
  const skills = buildSkillRows(reading, skillsAll, lens.skills === 'after' || /syntax|code without|coding experience|leetcode/i.test(nocare) ? 6 : 8, played.map((p) => p.factId))
  // READ on the demo board: "no evidence for react" while the alignment map proved React via a project —
  // the skill was OFF by HIS call (resumeEligible:false), not unproven. Say which.
  const banned = bannedSkillKeys(ledger)
  for (const k of reading.skills.must) {
    if (findSkill(skillsAll, k)) continue
    if (isBannedSkill(k, banned)) notes.push(`"${k}" is asked for and you hold it, but you marked it not-interview-safe — kept off the page by your call (say "allow ${k} on my résumé" to change that)`)
    else notes.push(`no evidence for "${k}" — kept off the page (I1); it goes to the gap note`)
  }

  // The three lines.
  const ntse = by('achievement').find((a) => NTSE_RE.test(a.title))
  const hack = by('achievement').find((a) => /hackathon|1st|first place|winner/i.test(a.title))
  const topProjects = ranked.slice(0, maxProjects)
  // OWNER-CAUGHT (05-Sep-2026): "headline mein tumne 3 projects ka naam le liya … headline mein meri
  // vision capture honi chahiye thi". The headline is WHO HE IS and WHERE HE IS GOING — his own
  // vision sentence, third-personed — never a list of projects (those live in PROJECTS, and he will
  // build more). Mind-first postings add the one credential that proves the mind.
  const voice = voiceClause(vision?.dream)
  const headline = `${rolePhrase(vision, reading)}${voice ? ` — ${voice}` : ' — directs AI to solve real problems end to end'}${mindFirst && ntse ? ' · NTSE Scholar' : ''}`
  const proofBits: string[] = []
  if (topProjects.length >= 2) proofBits.push(`${topProjects.length} shipped systems live and linked below`)
  if (ntse && mind) proofBits.push('National NTSE Scholar (aptitude, top ~0.1% nationally)')
  if (hack) {
    const where = (hack.title.split(/ — | – /)[1] ?? hack.title).trim().replace(/^Agentic & GenAI Showcase, /, '')
    proofBits.push(/^1st|first/i.test(hack.title) ? `1st place, ${where}` : where)
  }
  // The tail names ONE value they stated — only a short, clean phrase reads as their words, not ours;
  // and the summary stays two lines (OWNER-READ: three dense lines read as a wall).
  const careLead = reading.cares.map((q) => q.phrase).find((p) => p.split(' ').length <= 4 && /^[a-z]/i.test(p))
  const lead = lens.id === 'social-impact' ? 'Final-year CSE student who builds for the people a problem actually hurts, then directs AI to ship it' : 'Final-year CSE student who finds the real problem and directs AI to ship the thing that solves it'
  let summary = `${lead} — ${proofBits.join('; ') || 'shipped work, linked below'}.`
  if (careLead && summary.length + careLead.length < 215) summary = `${summary.slice(0, -1)}; built for a place that values ${careLead.toLowerCase()}.`
  const threeIds = [...new Set([...topProjects.map((p) => p.id), ...(ntse ? [ntse.id] : []), ...(hack ? [hack.id] : [])])]

  // The reveal — a per-company call.
  const sif = projects.find(isSifarish)
  const revealOn = !!sif && played.some((p) => p.factId === sif.id) && reading.revealAffinity >= 0.6
  const reveal = {
    on: revealOn,
    reason: revealOn
      ? `${reading.company || 'this company'} rewards AI-directed building (affinity ${reading.revealAffinity}) — saying this page was compiled by his own system is proof, not decoration`
      : sif
        ? `kept quiet: reveal affinity ${reading.revealAffinity} — a conservative reader may read "AI-built" as a red flag (RESEARCH v2 verdict 2)`
        : 'no Sifarish fact in the dossier',
  }

  const rationale =
    `${reading.company || 'The company'} reads for ${reading.cares.slice(0, 3).map((q) => q.phrase.toLowerCase()).join(', ') || reading.skills.must.slice(0, 3).join(', ') || 'shipped work'}` +
    (reading.doesNotCare.length ? ` and says it does not care about ${reading.doesNotCare.slice(0, 3).map((q) => q.phrase.toLowerCase()).join(', ')}` : '') +
    `. So the page leads with ${order[0]} and ${order[1]}, plays ${played.length} facts and benches ${benched.length}, ` +
    `and assembles ${skills.reduce((n, r) => n + r.items.length, 0)} skills the posting asks for from evidence he holds.` +
    (revealOn ? ' The Sifarish reveal is on.' : '')

  return {
    threeLines: { headline, summary, factIds: threeIds },
    lens: { id: lens.id, label: lens.label, because: lensChoice.because, why: lens.why },
    sectionOrder: order,
    played,
    benched,
    skills,
    reveal,
    projectOrder: topProjects.map((p) => p.id),
    rationale,
    notes,
    by: 'heuristic',
    at: new Date().toISOString(),
  }
}

/** The campus canon's labelled rows (six real samples): Languages · AI & ML · Frameworks & Libraries · Tools & Platforms · Core CS. */
// The canon (six samples): 4–6 labelled rows — Languages / AI-ML / Frameworks / Databases / Tools / Core CS.
export const SKILL_ROWS = ['Languages', 'AI & ML', 'Frameworks & Libraries', 'Databases', 'Tools & Platforms', 'Core CS'] as const
export function rowLabel(s: DerivedSkill): (typeof SKILL_ROWS)[number] {
  return skillRow(s)
}

/** Skills rows assembled per posting: asked-for first (must → nice), then AI/ML core, then the rest. */
export function buildSkillRows(reading: Reading, skillsAll: DerivedSkill[], perRow = 8, playedIds: string[] = []): SkillRow[] {
  const picked = new Map<string, DerivedSkill>()
  const take = (term: string) => {
    const canon = canonTech(term)
    const s = canon ? skillsAll.find((x) => x.text === canon.name) : findSkill(skillsAll, term)
    if (s && !picked.has(s.key)) picked.set(s.key, s)
  }
  // 1) What THIS company asked for, that he can prove — the reason the rows exist (brief B.4).
  reading.skills.must.forEach(take)
  reading.skills.nice.forEach(take)
  // Anything the posting MENTIONS anywhere (FastAPI, PostgreSQL…) that he holds — the posting is the lexicon.
  const tokens = new Set(reading.tokens ?? [])
  if (tokens.size) for (const s of skillsAll) if (!picked.has(s.key) && canonTech(s.text)?.aliases.some((a) => tokens.has(a.replace(/[^a-z0-9+#.-]/g, '')))) picked.set(s.key, s)
  // 2) The stacks of the projects that PLAY on this page — the rows must agree with the headers.
  const played = new Set(playedIds)
  if (played.size) for (const s of skillsAll) if (!picked.has(s.key) && s.factIds.some((id) => played.has(id))) picked.set(s.key, s)
  // 3) His languages and the AI/ML core he has used across ≥2 facts — never a one-off tool nobody asked for.
  const core = (s: DerivedSkill) => s.factIds.length >= 2
  const byProof = skillsAll.slice().sort((a, b) => b.factIds.length - a.factIds.length)
  for (const s of byProof) if (s.category === 'Languages' && core(s) && !picked.has(s.key)) picked.set(s.key, s)
  for (const s of byProof) if (s.category === 'AI & ML' && core(s) && !picked.has(s.key)) picked.set(s.key, s)
  const rows = new Map<string, SkillRow>()
  for (const s of picked.values()) {
    const label = rowLabel(s)
    const row = rows.get(label) ?? { label, items: [] }
    if (row.items.length >= perRow) continue
    row.items.push({ text: s.text, factIds: s.factIds.slice(0, 6) })
    rows.set(label, row)
  }
  return SKILL_ROWS.map((k) => rows.get(k)).filter((r): r is SkillRow => !!r && r.items.length > 0)
}

// ---------- the Gemini plan + the validator ----------

const FACT_SCHEMA = {
  type: 'object',
  properties: {
    factId: { type: 'string' },
    section: { type: 'string' },
    reason: { type: 'string', description: "Why it plays for THIS company — in the posting's own words where possible (≤ 30 words)." },
    framing: { type: 'string', description: 'For a project: the angle to lead with (≤ 12 words). Empty string if none.' },
  },
  required: ['factId', 'section', 'reason', 'framing'],
  additionalProperties: false,
}

export const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'The line under the name (≤ 14 words). Names only what the facts prove.' },
    summary: { type: 'string', description: 'One sentence (≤ 45 words), specific, evidence-dense, zero clichés, aimed at this reader.' },
    threeLineFactIds: { type: 'array', items: { type: 'string' } },
    sectionOrder: { type: 'array', items: { type: 'string' }, description: 'Order of section keys: education, experience, projects, skills, achievements, positions, certs (+ any custom kind).' },
    played: { type: 'array', items: FACT_SCHEMA },
    benched: {
      type: 'array',
      items: {
        type: 'object',
        properties: { factId: { type: 'string' }, reason: { type: 'string', description: "Quote the posting: 'they say: \"…\"' or name the page budget." } },
        required: ['factId', 'reason'],
        additionalProperties: false,
      },
    },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', enum: ['Languages', 'AI & ML', 'Frameworks & Libraries', 'Tools & Platforms', 'Core CS'] },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: { text: { type: 'string' }, factIds: { type: 'array', items: { type: 'string' } } },
              required: ['text', 'factIds'],
              additionalProperties: false,
            },
          },
        },
        required: ['label', 'items'],
        additionalProperties: false,
      },
    },
    revealOn: { type: 'boolean' },
    revealReason: { type: 'string' },
    rationale: { type: 'string', description: 'One paragraph (≤ 120 words), plain words: what you did and why, as a sharp human agent would explain it.' },
  },
  required: ['headline', 'summary', 'threeLineFactIds', 'sectionOrder', 'played', 'benched', 'skills', 'revealOn', 'revealReason', 'rationale'],
  additionalProperties: false,
} as const

interface PlanLLM {
  headline: string
  summary: string
  threeLineFactIds: string[]
  sectionOrder: string[]
  played: PlanFact[]
  benched: { factId: string; reason: string }[]
  skills: SkillRow[]
  revealOn: boolean
  revealReason: string
  rationale: string
}

export function planSystem(): string {
  return [
    'You are THE STRATEGIST on a small team of personal agents whose whole working life is getting one student an interview call.',
    'You have the READING (what this company says it cares about and does not) and the DOSSIER (every true fact about him, each with an id).',
    'Write the GAME PLAN for THIS company as the shrewdest human agent would after a week of thought:',
    '1) The three lines a reader hits first: a headline under his name and one summary sentence — specific, evidence-dense, in a builder\'s plain voice. No clichés, no "passionate", no "results-driven", no promises.',
    '   The HEADLINE states who he is and where he is going (his vision, in his register) — it NEVER lists project names; projects live in the PROJECTS section. The summary may name proof categories (a national scholarship, a hackathon win, N shipped systems) rather than project titles.',
    '2) Section order chosen for THIS reader (a founder who says "we do not care about your university" is not handed education first; a posting about reasoning gets achievements early). A custom kind (sports, publications, anything he fed) may LEAD when it is the strongest proof for this reader — a district-level athlete line can be the first thing a sports-tech founder sees.',
    '3) EVERY fact in the dossier is either PLAYED (with its section and a reason in the posting\'s own words) or BENCHED (with a reason: quote the posting, or name the page budget). Suppress nothing true and relevant; invent nothing. Benching a true, relevant fact without a reason is as bad as lying.',
    '4) Skills rows assembled from what the posting asks for ∩ what the facts prove — every item must carry the fact ids that prove it. Never list a skill no fact supports.',
    '5) The reveal: if this reader would be delighted that the applicant built the AI system that compiled this page (a project named Sifarish in the dossier), turn it on and say why; at a conservative reader keep it off.',
    'Use ONLY fact ids from the dossier. Sections: education, experience, projects, skills, achievements, positions, certs, plus any custom kind that appears in the dossier.',
    'Education lines are never benched (a missing degree line reads as hiding). PROJECTS: play the strongest three for this reader (four only when the dossier is thin) and bench the rest naming the page budget and what outranked them — the canon of real CSE résumés. Every OTHER kind: space is not your concern — the compiler tightens before it drops; never bench an achievement, position or experience for "page budget".',
    'Dates in the dossier are real and recent — TODAY is given at the top of the message; nothing dated before today is "future".',
    'Return JSON matching the schema exactly.',
  ].join('\n')
}

export interface PlanInputs {
  reading: Reading
  ledger: LedgerEntry[]
  identity: Identity
  vision?: VisionProfile
  sections?: SectionDef[]
}

/** Validate a brain's plan against the dossier; every discard is a note; the heuristic fills holes. */
export function validatePlan(raw: PlanLLM, inputs: PlanInputs, digest: Digest, mode: StrategistMode): GamePlan {
  const fallback = planHeuristic(inputs.reading, inputs.ledger, inputs.identity, inputs.vision, inputs.sections)
  const notes: string[] = []
  const facts = inputs.ledger.filter((e) => e.resumeEligible && e.tier === 'shipped' && e.kind !== 'skill')
  const factById = new Map(facts.map((f) => [f.id, f]))
  const allowedSections = new Set<string>([...CORE_SECTIONS, ...facts.map((f) => sectionKeyFor(f.kind))])
  const skillsAll = derivedSkills(inputs.ledger)

  // Played / benched — ids must exist; sections must be legal; benches need a real reason.
  const played: PlanFact[] = []
  const benched: GamePlan['benched'] = []
  const seen = new Set<string>()
  for (const p of Array.isArray(raw.played) ? raw.played : []) {
    const f = factById.get(String(p.factId))
    if (!f || seen.has(f.id)) {
      if (!f) notes.push(`discarded a played id the dossier does not hold: ${String(p.factId).slice(0, 40)}`)
      continue
    }
    seen.add(f.id)
    const section = allowedSections.has(String(p.section)) ? String(p.section) : sectionKeyFor(f.kind)
    if (section !== String(p.section)) notes.push(`${short(f.title)}: section "${String(p.section)}" is not a section — filed under ${section}`)
    const reason = clean(String(p.reason ?? ''))
    played.push({ factId: f.id, section, reason: reason.length >= 8 ? cap(reason, 220) : 'plays for this posting', ...(p.framing && String(p.framing).trim() ? { framing: cap(clean(String(p.framing)), 90) } : {}) })
  }
  for (const b of Array.isArray(raw.benched) ? raw.benched : []) {
    const f = factById.get(String(b.factId))
    if (!f || seen.has(f.id)) continue
    seen.add(f.id)
    const reason = clean(String(b.reason ?? ''))
    // LIVE-CAUGHT (05-Sep-2026, Gemini on Babaclick): the brain benched every education line on "we do
    // not care about your university's brand" and three positions on "page budget". Education is never
    // benched (a degree line missing reads as hiding; the posting's "brand" is not the fact) and the
    // page budget belongs to the COMPILER, which tightens before it ever drops and declares it.
    if (f.kind === 'education') {
      notes.push(`${short(f.title)}: the brain benched an education line — played (education is never benched; the reader checks the degree line)`)
      played.push(fallback.played.find((p) => p.factId === f.id) ?? { factId: f.id, section: 'education', reason: 'the degree line is the first thing every reader checks' })
      continue
    }
    if (f.kind !== 'project' && /page budget|space|room|fit/i.test(reason) && !/they say|said|posting/i.test(reason)) {
      notes.push(`${short(f.title)}: benched for "page budget" — played instead; the page-solver owns space and tightens before it drops`)
      played.push(fallback.played.find((p) => p.factId === f.id) ?? { factId: f.id, section: sectionKeyFor(f.kind), reason: 'played — space is the compiler\'s call, not the plan\'s' })
      continue
    }
    if (reason.length < 12) {
      notes.push(`${short(f.title)} was benched without a reason — played instead (suppress nothing unreasoned)`)
      played.push(fallback.played.find((p) => p.factId === f.id) ?? { factId: f.id, section: sectionKeyFor(f.kind), reason: 'played — the brain gave no reason to bench it' })
      continue
    }
    benched.push({ factId: f.id, reason: cap(reason, 220) })
  }
  // Every fact must be accounted for.
  for (const f of facts) {
    if (seen.has(f.id)) continue
    const fb = fallback.played.find((p) => p.factId === f.id)
    if (fb) {
      played.push(fb)
      notes.push(`${short(f.title)} was forgotten by the brain — played by default`)
    } else {
      const fbb = fallback.benched.find((b) => b.factId === f.id)
      if (fbb) benched.push(fbb)
    }
  }

  // Skills — each item must be PROVEN by the dossier (I1); the fact ids are corrected from evidence.
  const skills: SkillRow[] = []
  for (const row of Array.isArray(raw.skills) ? raw.skills : []) {
    const label = (SKILL_ROWS as readonly string[]).includes(String(row.label)) ? String(row.label) : 'Frameworks & Libraries'
    const items: SkillRow['items'] = []
    for (const it of Array.isArray(row.items) ? row.items : []) {
      const text = clean(String(it.text ?? ''))
      const proof = findSkill(skillsAll, text)
      if (!text || !proof) {
        if (text) notes.push(`skill "${text}" has no evidence in the dossier — kept off the page (I1)`)
        continue
      }
      if (items.some((x) => x.text.toLowerCase() === proof.text.toLowerCase())) continue
      items.push({ text: proof.text, factIds: proof.factIds.slice(0, 6) })
    }
    if (items.length) {
      const existing = skills.find((r) => r.label === label)
      if (existing) existing.items.push(...items.filter((i) => !existing.items.some((x) => x.text === i.text)))
      else skills.push({ label, items })
    }
  }
  // LIVE-CAUGHT (05-Sep-2026): the brain's rows were thin ("Tesseract.js, Gemini, Evals") and dropped
  // RAG/FastAPI the posting named. Asked-for, PROVEN skills the brain forgot are merged back in.
  const asked = new Set([...inputs.reading.skills.must, ...inputs.reading.skills.nice].map((t) => t.toLowerCase()))
  const tokens = new Set(inputs.reading.tokens ?? [])
  const present = new Set(skills.flatMap((r) => r.items.map((i) => i.text.toLowerCase())))
  for (const row of fallback.skills) {
    for (const it of row.items) {
      const low = it.text.toLowerCase()
      if (present.has(low)) continue
      const proof = findSkill(skillsAll, it.text)
      const askedFor = [...asked].some((t) => findSkill(skillsAll, t)?.key === proof?.key) || tokens.has(low.replace(/[^a-z0-9+#.-]/g, ''))
      if (!askedFor) continue
      const target = skills.find((r) => r.label === row.label)
      if (target) target.items.push(it)
      else skills.push({ label: row.label, items: [it] })
      present.add(low)
      notes.push(`skill "${it.text}" is asked for and proven — added to the rows the brain forgot it from`)
    }
  }
  const finalSkills = skills.length ? skills : fallback.skills
  if (!skills.length) notes.push('the brain returned no proven skills — assembled deterministically')

  // Section order — legal keys only; every played section present; nothing duplicated.
  const order: string[] = []
  for (const k of Array.isArray(raw.sectionOrder) ? raw.sectionOrder.map(String) : []) if (allowedSections.has(k) && !order.includes(k)) order.push(k)
  for (const k of fallback.sectionOrder) if (!order.includes(k)) order.push(k)
  for (const p of played) if (!order.includes(p.section)) order.push(p.section)

  // The three lines — honesty scans + fact-drift against the digest, else the heuristic lines.
  let headline = clean(String(raw.headline ?? ''))
  let summary = clean(String(raw.summary ?? ''))
  // Drift source = the dossier + the reading (the company's name and its own phrases are legitimate words).
  const digestText = `${digest.text}
${inputs.reading.company} ${inputs.reading.roleTitle} ${inputs.reading.summary} ${inputs.reading.cares.map((q) => q.phrase).join(' ')}`
  const drift = (s: string) => detectDrift(digestText, s)
  const bad = (s: string, what: string): boolean => {
    if (!s) return true
    const h = scanHonesty(s)
    if (!h.clean) {
      notes.push(`${what} discarded — reads as slop/guarantee (${[...h.slop, ...h.guarantee].join(', ')})`)
      return true
    }
    const d = drift(s)
    if (!d.ok) {
      notes.push(`${what} discarded — it claims something the dossier does not hold (${[...d.addedFacts, ...d.addedNumbers].slice(0, 3).join(', ')})`)
      return true
    }
    return false
  }
  const namesProject = (h: string) => facts.filter((f) => f.kind === 'project').some((f) => h.toLowerCase().includes(short(f.title).toLowerCase()))
  if (bad(headline, 'headline') || headline.length > 120 || namesProject(headline)) {
    if (headline && namesProject(headline)) notes.push('headline named a project — replaced with the vision headline (projects live in PROJECTS)')
    headline = fallback.threeLines.headline
  }
  if (bad(summary, 'summary') || summary.length > 320) summary = fallback.threeLines.summary
  const threeIds = (Array.isArray(raw.threeLineFactIds) ? raw.threeLineFactIds.map(String) : []).filter((id) => factById.has(id))
  const factIds = threeIds.length ? threeIds : fallback.threeLines.factIds

  // The reveal — only with a Sifarish fact on the page.
  const sif = facts.find((f) => /sifarish/i.test(f.title))
  const sifPlayed = !!sif && played.some((p) => p.factId === sif.id)
  const revealOn = !!raw.revealOn && sifPlayed
  if (raw.revealOn && !sifPlayed) notes.push('reveal requested but no Sifarish fact is on the page — kept off')
  const reveal = { on: revealOn, reason: cap(clean(String(raw.revealReason ?? '')) || fallback.reveal.reason, 220) }

  const rationaleRaw = clean(String(raw.rationale ?? ''))
  const rationale = rationaleRaw && scanHonesty(rationaleRaw).clean ? cap(rationaleRaw, 900) : fallback.rationale

  const projectOrder = played.filter((p) => factById.get(p.factId)?.kind === 'project').map((p) => p.factId)
  return {
    threeLines: { headline, summary, factIds },
    sectionOrder: order,
    played,
    benched,
    skills: finalSkills,
    reveal,
    projectOrder,
    rationale,
    notes: [...notes, ...fallback.notes.filter((n) => n.startsWith('no evidence for'))],
    by: mode,
    at: new Date().toISOString(),
  }
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const cap = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`)

function readingForPrompt(r: Reading): string {
  return [
    `COMPANY: ${r.company} — ${r.domain || 'domain not stated'}`,
    `ROLE: ${r.roleTitle} (${r.roleWindow}; reviewer archetype ${r.archetype}; reader: ${r.readerPersona})`,
    `WHAT THE POSTING IS REALLY ASKING: ${r.summary}`,
    `THEY CARE ABOUT: ${r.cares.map((q) => `${q.phrase} ["${q.quote}"]`).join(' · ') || '(nothing stated explicitly)'}`,
    `THEY SAY THEY DO NOT CARE ABOUT: ${r.doesNotCare.map((q) => `${q.phrase} ["${q.quote}"]`).join(' · ') || '(nothing stated)'}`,
    `SKILLS ASKED FOR: must = ${r.skills.must.join(', ') || '—'}; nice = ${r.skills.nice.join(', ') || '—'}`,
    `REVEAL AFFINITY (would they like that his own AI system compiled this page): ${r.revealAffinity}`,
    r.research?.length ? `WHAT THE TEAM FOUND ABOUT THE COMPANY (cited): ${r.research.slice(0, 8).map((x) => `${x.text} [${x.url}]`).join(' · ')}` : 'COMPANY RESEARCH: none available (keyless or no source found).',
  ].join('\n')
}

/** The date, month precision (the cache key changes monthly, not daily). Brains do not know today. */
export function today(): string {
  return new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export async function makePlan(inputs: PlanInputs): Promise<GamePlan> {
  const digest = buildDigest(inputs.ledger, inputs.identity, inputs.vision)
  const { canonForPrompt } = await import('../ustaad/canon')
  const { loadMemory, memoryForPrompt } = await import('./memory')
  const memory = await loadMemory(inputs.reading)
  const lensChoice = chooseLens(inputs.reading)
  const user = `TODAY: ${today()}\n\nTHE READING\n${readingForPrompt(inputs.reading)}\n\n${lensesForPrompt(lensChoice)}\n\nTHE DOSSIER\n${digest.text}\n\n${await canonForPrompt()}\n\n${memoryForPrompt(memory)}`
  const meta = await generateWithMeta<PlanLLM>({
    feature: 'strategist.plan',
    system: planSystem(),
    user,
    maxTokens: 2600,
    schema: PLAN_SCHEMA as unknown as Record<string, unknown>,
  }).catch(() => null)
  if (!meta || !meta.result) return { ...planHeuristic(inputs.reading, inputs.ledger, inputs.identity, inputs.vision, inputs.sections), memory }
  const validated = validatePlan(meta.result, inputs, digest, meta.mode)
  return { ...validated, memory, lens: validated.lens ?? { id: lensChoice.lens.id, label: lensChoice.lens.label, because: lensChoice.because, why: lensChoice.lens.why } }
}
