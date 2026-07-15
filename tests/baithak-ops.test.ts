import { describe, expect, it } from 'vitest'
import { SEED_IDENTITY, SEED_LEDGER, fakeJob } from './helpers'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { compileResume } from '../src/lib/compile/compiler'
import { detectDrift } from '../src/lib/polish/factGuard'

/**
 * BAITHAK CAN NOW DO THE TRUE THING HE ASKS (Session 5.4, D61/D62).
 *
 * Owner's words: "baithak sach hi bole usmein dikkat nhi, but jo sach waala kaam bolun toh tailor
 * voh karre toh sahi — ye skill hata, ye wali daal, GLOAMING ko aise explain kar."
 * The old op vocabulary was select/order only, so those requests hit a wall and read as stupidity.
 * These gates prove the two new ops do real work while staying structurally unable to lie.
 */

const job = fakeJob('TestCo', 'AI Engineer', 'We need Python, LLM agents, RAG, evals and TypeScript.')
const decode = decodeJD(job.jd)
const coverage = matchEvidence(decode, SEED_LEDGER)
const compile = (extra: Parameters<typeof compileResume>[0]) => compileResume(extra)

const base = { identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, jobId: job.id }

describe('set-entry — "ye skill hata" is honest tailoring, not a lie', () => {
  it('a suppressed entry disappears from the compiled resume', () => {
    const skill = SEED_LEDGER.find((e) => e.kind === 'skill' && e.resumeEligible && e.tier === 'shipped')
    expect(skill, 'seed must carry a shipped skill for this gate to mean anything').toBeDefined()

    const before = compile(base)
    const after = compile({ ...base, excludedIds: [skill!.id] })

    const skillsLineBefore = before.lines.find((l) => l.kind === 'skills')?.text ?? ''
    const skillsLineAfter = after.lines.find((l) => l.kind === 'skills')?.text ?? ''
    expect(skillsLineBefore).toContain(skill!.title)
    expect(skillsLineAfter).not.toContain(skill!.title)
  })

  it('suppression cannot leak back through any other section (single gate at eligibility)', () => {
    const project = SEED_LEDGER.find((e) => e.kind === 'project' && e.tier === 'shipped')!
    const after = compile({ ...base, excludedIds: [project.id] })
    // No line anywhere may still cite the dropped entry.
    expect(after.lines.some((l) => l.ledgerIds.includes(project.id))).toBe(false)
  })

  it('the ledger itself is never mutated — suppression is packet-scoped', () => {
    const skill = SEED_LEDGER.find((e) => e.kind === 'skill' && e.resumeEligible)!
    const snapshot = JSON.stringify(skill)
    compile({ ...base, excludedIds: [skill.id] })
    expect(JSON.stringify(SEED_LEDGER.find((e) => e.id === skill.id))).toBe(snapshot)
  })
})

describe('reframe-project — wording is his, facts are frozen', () => {
  it('a guarded rephrasing renders in place, under the SAME evidence link (I1)', () => {
    const project = SEED_LEDGER.find((e) => e.kind === 'project' && e.tier === 'shipped' && e.bullets.length > 0)!
    const bullet = project.bullets[0]
    // A legal rephrasing: re-aimed wording, not one new fact.
    const reworded = `Engineered ${bullet.text.charAt(0).toLowerCase()}${bullet.text.slice(1)}`
    expect(detectDrift(bullet.text, reworded).ok, 'test fixture must itself be drift-free').toBe(true)

    const after = compile({ ...base, bulletOverrides: { [bullet.id]: reworded } })
    const line = after.lines.find((l) => l.kind === 'bullet' && l.text.includes(reworded))
    expect(line, 'the rephrasing should render').toBeDefined()
    // The whole point: new wording, same evidence link.
    expect(line!.ledgerIds).toContain(project.id)
    expect(line!.ledgerIds.length).toBeGreaterThan(0)
  })

  it('the fact-drift guard rejects a rephrasing that invents a metric or a technology', () => {
    const original = 'Built a browser co-op board game with a hand-authored narrator fallback'
    expect(detectDrift(original, 'Built a browser co-op board game used by 12,000 players').ok).toBe(false)
    expect(detectDrift(original, 'Built a browser co-op board game on Kubernetes with a hand-authored narrator fallback').ok).toBe(false)
    // …but an honest re-aiming survives.
    expect(detectDrift(original, 'Engineered a browser co-op board game around a hand-authored narrator fallback').ok).toBe(true)
  })

  it('D81: the guard reads the whole ENTRY, so his own README words are not "inventions"', () => {
    // Real case: "GLOAMING ko agentic angle se explain kar" → the model says "agentic AI narrator".
    // Guarded against the single bullet, "agentic" is a new tech term and dies — technically right,
    // practically useless, because HE wrote "agentic" about this project himself.
    const bullet = 'Designed an AI narrator with a hand-authored fallback so the game runs with zero API keys'
    const reframed = 'Designed an agentic AI narrator with a hand-authored fallback so the game runs with zero API keys'

    // Bullet-only source → rejected (the old, broken behaviour).
    expect(detectDrift(bullet, reframed).ok).toBe(false)

    // Entry-wide source (bullets + summary + README context) → accepted, because he claimed it.
    const entrySource = [bullet, 'An agentic AI narrator that plays the board against you.', 'agentic ai llm'].join('\n')
    expect(detectDrift(entrySource, reframed).ok).toBe(true)

    // …and a fact that appears NOWHERE in his own writing still dies.
    expect(detectDrift(entrySource, `${bullet} on Kubernetes`).ok).toBe(false)
    expect(detectDrift(entrySource, `${bullet}, used by 12,000 players`).ok).toBe(false)
  })

  it('an override for an unknown bullet id changes nothing (no minting surface)', () => {
    const before = compile(base)
    const after = compile({ ...base, bulletOverrides: { 'ghost-bullet-id': 'Led a team of 40 engineers at Google' } })
    expect(after.lines.map((l) => l.text)).toEqual(before.lines.map((l) => l.text))
  })
})
