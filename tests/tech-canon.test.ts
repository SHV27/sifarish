import { describe, it, expect } from 'vitest'
import { canonTech, headerStack, techOf } from '../src/lib/dossier/tech'
import { derivedSkills } from '../src/lib/dossier/skills'
import { buildSkillRows, planHeuristic } from '../src/lib/strategist/plan'
import { readPostingHeuristic } from '../src/lib/strategist/reading'
import { compileResume, trimRestatement } from '../src/lib/compile/compiler'
import { deriveBulletRuns } from '../src/lib/compile/emphasis'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { SEED_LEDGER, SEED_IDENTITY } from './helpers'
import type { LedgerEntry } from '../src/types'

/**
 * v2 R4 — THE TECH CANON. Owner-read on his own page: "Frameworks & Libraries: statistics, speech,
 * gpt, inference", "SIFARISH | agents, llm, gpt, rag", bold on "probability"/"alignment", a summary
 * that said "values individuals with strong". Every one is a class; every class has a gate.
 */
const JUNK = ['statistics', 'speech', 'inference', 'gpt', 'agents', 'probability', 'alignment', 'guardrails', 'ml math', 'fine tuning']

function vaultLike(): LedgerEntry[] {
  // His real vault: Nabz-forged tags/keywords in his own shorthand, no README stack.
  return SEED_LEDGER.map((e) =>
    e.id === 'proj-gloaming'
      ? { ...e, context: undefined, tags: ['llm', 'claude', 'rag', 'pytorch', 'agents', 'gpt', 'react', 'typescript'], bullets: e.bullets.map((b) => ({ ...b, keywords: ['statistics', 'speech', 'inference', 'alignment', 'probability'] })) }
      : e,
  ) as LedgerEntry[]
}

describe('the canon is the only page vocabulary', () => {
  it('maps surface forms to one canonical technology, and refuses competencies', () => {
    expect(canonTech('typescript')?.name).toBe('TypeScript')
    expect(canonTech('Postgres')?.name).toBe('PostgreSQL')
    expect(canonTech('langgraph-mcp')?.name).toBe('MCP')
    expect(canonTech('Groq / Whisper API Integration')?.name).toBe('Groq')
    for (const j of ['statistics', 'inference', 'alignment', 'probability', 'agents']) expect(canonTech(j), j).toBeNull()
  })
  it('derivedSkills never carries a junk word; every text is a canonical name', () => {
    const skills = derivedSkills(vaultLike())
    const texts = skills.map((s) => s.text)
    for (const j of JUNK) expect(texts.map((t) => t.toLowerCase()), j).not.toContain(j)
    for (const t of texts) expect(canonTech(t)?.name, t).toBe(t)
  })
  it('the header stack is canonical, ≤ 4, with the posting\'s asks first', () => {
    const g = vaultLike().find((e) => e.id === 'proj-gloaming')!
    const stack = headerStack(g, ['react', 'python'])
    expect(stack[0]).toBe('React')
    expect(stack.length).toBeLessThanOrEqual(4)
    for (const s of stack) expect(canonTech(s)?.name).toBe(s)
    expect(stack.join(' ')).not.toMatch(/agents|gpt/)
    expect(techOf(g).map((t) => t.name)).toContain('PyTorch')
  })
})

describe('skills rows are assembled for THIS posting (brief B.4)', () => {
  const JD = 'We work with React, Python, FastAPI, PostgreSQL and third-party APIs. Claude Code and Cursor daily.'
  it('asked-for ∩ proven first; played projects\' stacks; nothing lowercase, nothing junk, ≤ 8 per row', () => {
    const ledger = vaultLike()
    const reading = readPostingHeuristic(JD, 'Acme', 'Growth Intern')
    const plan = planHeuristic(reading, ledger, SEED_IDENTITY)
    const rows = plan.skills
    const all = rows.flatMap((r) => r.items.map((i) => i.text))
    expect(all).toContain('Python')
    expect(all.join(' ')).toMatch(/React|TypeScript/)
    for (const t of all) expect(canonTech(t)?.name, t).toBe(t) // canonical casing (scikit-learn, pdf-lib stay as the world writes them)
    for (const r of rows) expect(r.items.length).toBeLessThanOrEqual(8)
    for (const j of JUNK) expect(all.map((t) => t.toLowerCase()), j).not.toContain(j)
  })
  it('a one-off tool nobody asked for and no played project uses never pads the rows', () => {
    const ledger = vaultLike()
    const reading = readPostingHeuristic('Python only.', 'Acme', 'Intern')
    const rows = buildSkillRows(reading, derivedSkills(ledger), 8, [])
    const all = rows.flatMap((r) => r.items.map((i) => i.text))
    expect(all).not.toContain('PyTorch') // one fact, not asked for, not played
  })
})

describe('bold-inline is tech and numbers only', () => {
  it('"probability" and "alignment" stay roman; "React" and "1,200" go bold', () => {
    const runs = deriveBulletRuns('Classified patient risk into three probability bands with React and 1,200 sessions, reaching alignment', decodeJD('React, Python, alignment, probability'))!
    const bold = runs.filter((r) => r.bold).map((r) => r.text.toLowerCase().trim())
    expect(bold.join(' ')).toMatch(/react/)
    expect(bold.join(' ')).toMatch(/1,200/)
    expect(bold.join(' ')).not.toMatch(/probability|alignment/)
  })
})

describe('the page reads clean', () => {
  it('a care phrase never ends in a torn fragment ("individuals with strong")', () => {
    const r = readPostingHeuristic('We care about individuals with strong\nlogical reasoning and intellectual honesty.', 'Acme', 'Intern')
    expect(r.cares.map((c) => c.phrase.toLowerCase())).not.toContain('individuals with strong')
  })
  it('an achievement summary that restates its title is trimmed to what it adds', () => {
    expect(trimRestatement('1st Place — Agentic & GenAI Showcase, Techgyan Hackathon, IIT Ropar', 'Won first place in the Agentic & GenAI showcase at IIT Ropar\'s Techgyan Hackathon with Sifarish, the evidence-compiled job-hunt system')).toMatch(/^Sifarish, the evidence-compiled/)
    expect(trimRestatement('National NTSE Scholar', 'National Talent Search Examination scholar, Government of India (2021) — a national-level test of aptitude and reasoning')).toMatch(/Talent Search/)
  })
  it('the compiled page carries no junk word in a skills or header line', () => {
    const ledger = vaultLike()
    const jd = 'React, Python, FastAPI, PostgreSQL. We care about logical reasoning.'
    const reading = readPostingHeuristic(jd, 'Acme', 'Intern')
    const plan = planHeuristic(reading, ledger, SEED_IDENTITY)
    const decode = decodeJD(jd)
    const r = compileResume({ identity: SEED_IDENTITY, ledger, decode, coverage: matchEvidence(decode, ledger), jobId: 'j', plan, pagePolicy: 'two-ok', summaryOn: true })
    const lines = r.lines.filter((l) => l.kind === 'skills' || l.kind === 'entry-title').map((l) => l.text.toLowerCase())
    for (const j of JUNK) for (const l of lines) expect(l, l).not.toMatch(new RegExp(`\\\\b${j}\\\\b`))
  })
})

describe('the page never repeats itself, and a header is what the project is built with', () => {
  it('two PRANA entries print once — the richer one', async () => {
    const { dedupeByTitleStem } = await import('../src/lib/compile/compiler')
    const a = { entry: { title: 'PRANA-Sustainable-AI — A green AI framework', summary: 'short', bullets: [] } }
    const b = { entry: { title: 'PRANA — A Layered Framework for Sustainable AI Compute (position paper)', summary: 'Self-published position paper reframing the energy-water crisis as exergy misplacement', bullets: [] } }
    const out = dedupeByTitleStem([a, b])
    expect(out).toHaveLength(1)
    expect(out[0].entry.title).toMatch(/^PRANA — A Layered/)
  })
  it('a bullet keyword never reaches the header stack', () => {
    const g = { ...SEED_LEDGER.find((e) => e.id === 'proj-gloaming')!, context: undefined, tags: ['typescript'], bullets: [{ id: 'x', text: 'queried a database', keywords: ['sql'], ledgerIds: [] }] } as unknown as LedgerEntry
    expect(headerStack(g)).toEqual(['TypeScript'])
  })
})
