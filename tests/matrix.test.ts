import { describe, expect, it } from 'vitest'
import { compileResume, CompileError, cleanSummaryForDisplay } from '../src/lib/compile/compiler'
import { stripMarkdownResidue } from '../src/lib/compile/typeset'
import { bulletOverlap, HARD_DUPLICATE } from '../src/lib/compile/overlap'
import { compileCoverLetter, compileOutreach } from '../src/lib/compile/letters'
import { renderResumePdf } from '../src/lib/export/pdf'
import { parsebackTest } from '../src/lib/export/parseback'
import { buildSummaryLine } from '../src/lib/darzi/summary'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { DEFAULT_VISION } from '../src/db/seed'
import { SEED_IDENTITY, fakeJob } from './helpers'
import type { Bullet, CompiledResume, LedgerEntry } from '../src/types'

/**
 * THE OWNER-MODE MATRIX (Final Jang W2 — ELEVATION.md E2, Lock 3: "zero-error is earned").
 *
 * One user, owner mode, a finite input space — so the guarantee is testable. This harness
 * ENUMERATES that space (ledger axis × JD axis × op axis) with a seeded generator and drives
 * every case through the real pipeline, asserting the full contract on each:
 *   compile → sanitize (no residue) → dedupe (no twin claims) → cast-contract (rendered or
 *   DECLARED) → I1 (every bullet evidence-linked) → and for a sampled subset, the rendered
 *   PDF's text layer round-trips 100% (I5).
 *
 * Every failure message carries its case seed — a failing seed becomes a permanent regression
 * gate, replayable forever. Deterministic by construction (mulberry32, fixed base seed).
 * Set SIFARISH_MATRIX=1 for the deep run (5× the cases).
 */

// ---------- deterministic PRNG ----------
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
type Rng = () => number
const pick = <T,>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]
const chance = (r: Rng, p: number) => r() < p
const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))

// ---------- content pools (owner-mode realistic + adversarial classes) ----------
// NOTE: no slop-lexicon words in the pools — the harness tests the pipeline, not the scanner.
const VERBS = ['Built', 'Designed', 'Implemented', 'Shipped', 'Reduced', 'Automated', 'Evaluated', 'Trained', 'Deployed', 'Integrated']
const TECH = ['RAG retrieval', 'LLM routing', 'TypeScript', 'React', 'pdf-lib', 'IndexedDB', 'embeddings', 'agent orchestration', 'Groq inference', 'serverless functions', 'Playwright checks', 'schema-guarded outputs']
const NUMBERS = ['ROC-AUC 0.957', '98.6% uptime', 'p95 latency 180ms', '18 markets', '40% fewer tokens', '11 functions', '2,400 users']
const UNICODE_BITS = ['सूत्रधार', 'résumé', '—', '…', '×', '·', 'ω-automata', '🚀', 'naïve']
const RESIDUE_BITS = ['**bold claim**', '`inline code`', '[demo](https://demo.dev)', 'https://app.vercel.app**', '▶ Live: https://x.dev', '- App: https://demo.vercel.app']
const TAILS = ['for real users', 'across three regions', 'with zero manual steps', 'under free-tier limits', 'without a server']

function genPhrase(r: Rng): string {
  const bits = [pick(r, VERBS), pick(r, TECH)]
  if (chance(r, 0.45)) bits.push(pick(r, NUMBERS))
  if (chance(r, 0.3)) bits.push(pick(r, UNICODE_BITS))
  if (chance(r, 0.25)) bits.push(pick(r, RESIDUE_BITS)) // the vault CAN hold residue — the page must not
  bits.push(pick(r, TAILS))
  return bits.join(' ')
}

function genBulletText(r: Rng): string {
  let t = genPhrase(r)
  // long-content class (bounded at the realistic owner-mode ceiling — forge/Baithak/hand edits
  // never exceed a few hundred chars; the beyond-ceiling case has its own designed-throw test)
  while (chance(r, 0.15) && t.length < 420) t += ', ' + genPhrase(r)
  return t.slice(0, 500)
}

let bulletSeq = 0
function genBullet(r: Rng): Bullet {
  return { id: `b-${bulletSeq++}`, text: genBulletText(r), keywords: chance(r, 0.7) ? [pick(r, ['python', 'typescript', 'llm', 'rag', 'react', 'agents'])] : [] }
}

function genDate(r: Rng): string {
  return `${String(int(r, 1, 12)).padStart(2, '0')}/${int(r, 2021, 2026)}`
}

let entrySeq = 0
function genEntry(r: Rng, kind: LedgerEntry['kind']): LedgerEntry {
  const id = `e-${kind}-${entrySeq++}`
  const shipped = kind === 'project' ? chance(r, 0.8) : true
  const bullets: Bullet[] = []
  if (kind === 'project') {
    const n = int(r, 0, 6)
    for (let i = 0; i < n; i++) bullets.push(genBullet(r))
    // near-twin injection: the same claim, lightly reworded — MMR must never render both
    if (bullets.length >= 1 && chance(r, 0.35)) {
      bullets.push({ id: `b-${bulletSeq++}`, text: bullets[0].text + ' again and again', keywords: bullets[0].keywords })
    }
  }
  const title =
    kind === 'education'
      ? pick(r, ['B.Tech Computer Science', 'Class XII (CBSE)', 'Class X (CBSE)'])
      : kind === 'skill'
        ? pick(r, TECH)
        : `${pick(r, ['GLOAMING', 'SIFARISH', 'SEHAT', 'SPARK', 'DARYA', 'KATHA'])}-${entrySeq} — ${pick(r, TECH)}`
  return {
    id,
    kind,
    title: chance(r, 0.15) ? `${title} ${pick(r, UNICODE_BITS)}` : title,
    summary: chance(r, 0.7) ? genPhrase(r) : '',
    bullets,
    tier: shipped ? 'shipped' : 'in_forge',
    evidence: shipped ? { date: genDate(r), note: 'gen', ...(chance(r, 0.6) ? { repo: 'https://github.com/SHV27/x', url: 'https://x.vercel.app' } : {}) } : undefined,
    forgeEta: shipped ? undefined : 'August 2026',
    tags: chance(r, 0.6) ? [pick(r, ['llm', 'rag', 'agents', 'python', 'typescript'])] : [],
    resumeEligible: chance(r, 0.9),
    category: kind === 'skill' && chance(r, 0.3) ? pick(r, ['AI & ML', 'Languages', 'Frameworks & Tools']) : undefined,
  }
}

function genLedger(r: Rng): LedgerEntry[] {
  const out: LedgerEntry[] = []
  const nProj = int(r, 0, 8)
  for (let i = 0; i < nProj; i++) out.push(genEntry(r, 'project'))
  for (let i = 0, n = int(r, 0, 10); i < n; i++) out.push(genEntry(r, 'skill'))
  for (let i = 0, n = int(r, 0, 3); i < n; i++) out.push(genEntry(r, 'education'))
  for (let i = 0, n = int(r, 0, 4); i < n; i++) out.push(genEntry(r, 'achievement'))
  for (let i = 0, n = int(r, 0, 3); i < n; i++) out.push(genEntry(r, 'certification'))
  for (let i = 0, n = int(r, 0, 3); i < n; i++) out.push(genEntry(r, 'position'))
  return out
}

const JD_CLASSES: ((r: Rng) => string)[] = [
  () => '',
  () => 'AI intern',
  (r) => `We are hiring an AI Engineer. Must have: Python, TypeScript, LLM, RAG, agents, ${pick(r, TECH)}. Nice to have: React, evals.`,
  (r) => {
    let s = ''
    while (s.length < 4500) s += `The role involves ${pick(r, TECH)} and ${pick(r, TECH)} at scale. `
    return s
  },
  () => '!!! *** ??? ((( ))) ~~ %% @@ ##',
  () => 'हम एक AI इंजीनियर खोज रहे हैं — LLM, RAG और agents ज़रूरी हैं। Remote friendly.',
  (r) => `${pick(r, TECH)}\n\n- must: kubernetes\n- must: golang\n- must: rust`, // zero-evidence musts
]

// ---------- the per-case contract ----------
const RESIDUE_RX = /\*\*|\]\(|```|(?:^|\s)▶/
function assertContract(resume: CompiledResume, castEligible: string[], seedTag: string): string[] {
  const errs: string[] = []
  const projectIds = new Set<string>()
  for (const l of resume.lines) if (l.kind === 'entry-title') for (const id of l.ledgerIds) projectIds.add(id)

  for (const l of resume.lines) {
    if (RESIDUE_RX.test(l.text) || stripMarkdownResidue(l.text) !== l.text) errs.push(`${seedTag} residue survived on ${l.kind}: "${l.text.slice(0, 90)}"`)
    if (l.right && stripMarkdownResidue(l.right) !== l.right) errs.push(`${seedTag} residue on right meta: "${l.right}"`)
    if (l.kind === 'bullet' && l.ledgerIds.length === 0) errs.push(`${seedTag} I1 broken: orphan bullet "${l.text.slice(0, 60)}"`)
  }

  // No twin claims among rendered project bullets (page-wide MMR guarantee, D142/S7.1).
  const projBullets = resume.lines.filter((l) => l.kind === 'bullet' && l.ledgerIds.some((id) => id.startsWith('e-project')))
  for (let i = 0; i < projBullets.length; i++) {
    for (let j = i + 1; j < projBullets.length; j++) {
      if (bulletOverlap(projBullets[i].text, projBullets[j].text) >= HARD_DUPLICATE) {
        errs.push(`${seedTag} twin claims rendered: "${projBullets[i].text.slice(0, 60)}" ≈ "${projBullets[j].text.slice(0, 60)}"`)
      }
    }
  }

  // Cast contract (S7.2/S7.3): every eligible cast project renders, or the page DECLARES it.
  const rendered = castEligible.filter((id) => resume.lines.some((l) => l.kind === 'entry-title' && l.ledgerIds.includes(id)))
  const missing = castEligible.length - rendered.length
  if (missing > 0 && (resume.benchedByPage?.length ?? 0) < missing) {
    errs.push(`${seedTag} cast broken SILENTLY: ${missing} cast project(s) neither rendered nor declared`)
  }
  return errs
}

interface GenCase {
  seed: number
  ledger: LedgerEntry[]
  jd: string
  resume: CompiledResume
}

function runCase(seed: number): { errs: string[]; c: GenCase } {
  const r = mulberry32(seed)
  const ledger = genLedger(r)
  const jd = JD_CLASSES[int(r, 0, JD_CLASSES.length - 1)](r)
  const decode = decodeJD(jd)
  const coverage = matchEvidence(decode, ledger)

  // op axis
  const ids = ledger.map((e) => e.id)
  const excludedIds = chance(r, 0.3) ? ids.filter(() => chance(r, 0.15)).slice(0, 3) : undefined
  const allBulletIds = ledger.flatMap((e) => e.bullets.map((b) => b.id))
  const excludedBulletIds = chance(r, 0.3) ? allBulletIds.filter(() => chance(r, 0.1)).slice(0, 4) : undefined
  const bulletOverrides: Record<string, string> = {}
  if (chance(r, 0.35)) for (const bid of allBulletIds.filter(() => chance(r, 0.08)).slice(0, 3)) bulletOverrides[bid] = genBulletText(r)

  const excluded = new Set(excludedIds ?? [])
  const eligibleProjects = ledger.filter((e) => e.kind === 'project' && e.tier === 'shipped' && e.resumeEligible && !excluded.has(e.id))
  let editorial: { order: string[]; bullets: Record<string, string[]> } | undefined
  if (chance(r, 0.5) && eligibleProjects.length > 0) {
    const order = eligibleProjects
      .map((e) => e.id)
      .sort(() => r() - 0.5)
      .slice(0, int(r, 1, 4))
    editorial = { order, bullets: {} }
  }
  const summaryLine = chance(r, 0.6) ? (buildSummaryLine({ identity: SEED_IDENTITY, vision: DEFAULT_VISION, ledger, decode, coverage }) ?? undefined) : undefined

  const resume = compileResume({
    identity: SEED_IDENTITY,
    ledger,
    decode,
    coverage,
    jobId: `matrix-${seed}`,
    editorial,
    summaryLine,
    excludedIds,
    excludedBulletIds,
    bulletOverrides: Object.keys(bulletOverrides).length ? bulletOverrides : undefined,
  })
  const castEligible = (editorial?.order ?? []).filter((id) => eligibleProjects.some((e) => e.id === id))
  return { errs: assertContract(resume, castEligible, `[seed ${seed}]`), c: { seed, ledger, jd, resume } }
}

const DEEP = process.env.SIFARISH_MATRIX === '1'
const N = DEEP ? 5000 : 1000
const BASE = 0xc0ffee
const PDF_SAMPLES = DEEP ? 100 : 24

describe(`W2 — the owner-mode matrix: ${N} generated vaults × JDs × ops, full contract`, () => {
  const kept: GenCase[] = []

  it(`${N} cases compile clean: no throw, no residue, no twins, no orphan bullets, cast declared`, () => {
    const failures: string[] = []
    for (let i = 0; i < N; i++) {
      const seed = BASE + i
      try {
        const { errs, c } = runCase(seed)
        failures.push(...errs)
        if (i % Math.floor(N / PDF_SAMPLES) === 0) kept.push(c)
      } catch (e) {
        failures.push(`[seed ${seed}] THREW: ${String(e).slice(0, 200)}`)
      }
      if (failures.length > 25) break // enough evidence; keep the report readable
    }
    expect(failures, failures.slice(0, 25).join('\n')).toEqual([])
  }, 120000)

  it(`sampled cases (${PDF_SAMPLES}) round-trip the rendered PDF text layer 100% (I5 on generated input)`, async () => {
    expect(kept.length).toBeGreaterThan(0)
    for (const c of kept) {
      const bytes = await renderResumePdf(c.resume)
      const result = await parsebackTest(c.resume, bytes)
      expect(result.missing, `[seed ${c.seed}] missing: ${result.missing.join(' | ')}`).toHaveLength(0)
      expect(result.outOfOrder, `[seed ${c.seed}] out of order: ${result.outOfOrder.join(' | ')}`).toHaveLength(0)
      expect(result.ok, `[seed ${c.seed}]`).toBe(true)
    }
  }, 240000)

  it('letters stay hygienic across generated vaults (residue never reaches a paragraph)', () => {
    for (let i = 0; i < 150; i++) {
      const r = mulberry32(BASE + 90000 + i)
      const ledger = genLedger(r)
      const jd = JD_CLASSES[int(r, 0, JD_CLASSES.length - 1)](r)
      const decode = decodeJD(jd)
      const coverage = matchEvidence(decode, ledger)
      const job = fakeJob(`GenCo${i}`, 'AI Engineer', jd)
      for (const doc of [compileCoverLetter(job, SEED_IDENTITY, ledger, decode, coverage), compileOutreach(job, SEED_IDENTITY, ledger, decode)]) {
        for (const p of doc.paragraphs) {
          expect(stripMarkdownResidue(p.text), `[letter seed ${BASE + 90000 + i}] "${p.text.slice(0, 80)}"`).toBe(p.text)
          expect(RESIDUE_RX.test(p.text), `[letter seed ${BASE + 90000 + i}] residue: "${p.text.slice(0, 80)}"`).toBe(false)
        }
      }
    }
  }, 60000)

  it('the empty ledger never blanks the app (Invariant 3 shape: contact still renders, no throw)', () => {
    const decode = decodeJD('AI Engineer role')
    const resume = compileResume({ identity: SEED_IDENTITY, ledger: [], decode, coverage: matchEvidence(decode, []), jobId: 'empty' })
    expect(resume.lines.length).toBeGreaterThanOrEqual(2)
    expect(resume.lines[0].text).toBe(SEED_IDENTITY.name)
  })

  it('the sole documented CompileError fires ONLY on its designed trigger (a single absurdly long entry)', () => {
    const r = mulberry32(7)
    const monster = genEntry(r, 'project')
    monster.tier = 'shipped'
    monster.resumeEligible = true
    monster.evidence = { date: '01/2026', note: 'gen' }
    monster.bullets = [{ id: 'monster-b', text: ('Immense detail about retrieval systems and evaluation pipelines. '.repeat(220)).trim(), keywords: [] }]
    const decode = decodeJD('AI role')
    expect(() =>
      compileResume({ identity: SEED_IDENTITY, ledger: [monster], decode, coverage: matchEvidence(decode, [monster]), jobId: 'monster' }),
    ).toThrow(CompileError)
  })

  it('display sanitizer is idempotent over generated content (the gate the residue classes hang on)', () => {
    const r = mulberry32(99)
    for (let i = 0; i < 300; i++) {
      const once = cleanSummaryForDisplay(genPhrase(r))
      expect(cleanSummaryForDisplay(once)).toBe(once)
      const stripped = stripMarkdownResidue(once)
      expect(stripMarkdownResidue(stripped)).toBe(stripped)
    }
  })
})
