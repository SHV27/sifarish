import { describe, it, expect } from 'vitest'
import { SEED_LEDGER } from './helpers'
import { fakeJob } from './helpers'
import { route, detectIntent, honestyGate, visionAlignmentScan, pathBriefReply, sharpenVision } from '../src/lib/guru/router'
import { buildSystemPrompt, ledgerSummary } from '../src/lib/guru/context'
import { buildApplyPlan } from '../src/lib/guru/applyPlan'
import { scanGuarantee } from '../src/lib/slop/scan'
import type { Job, Settings } from '../src/types'
import { DEFAULT_RUBRIC } from '../src/lib/radar/rubric'
import { DEFAULT_VISION } from '../src/db/seed'

const NO_JOBS: Job[] = []

/**
 * The Guru eval — 12 scripted conversations. Asserts correct intent routing, ledger-only
 * self-claims (I1), citation discipline, and I9 refusals. The deterministic router is the
 * keyless Guru AND the honesty-critical core, so this gate is reliable (no live LLM).
 */
describe('Guru eval — 30 scripted conversations (v4: the Sage)', () => {
  const cases: { name: string; input: string; expectIntent: string }[] = [
    { name: 'find jobs', input: 'find me some AI internships', expectIntent: 'find_jobs' },
    { name: 'find jobs (sweep)', input: 'run a sweep for new roles', expectIntent: 'find_jobs' },
    { name: 'explain score', input: 'why did this job score so low?', expectIntent: 'explain_score' },
    { name: 'apply plan', input: 'how do I apply to this one?', expectIntent: 'apply_plan' },
    { name: 'apply plan (steps)', input: 'walk me through the application steps', expectIntent: 'apply_plan' },
    { name: 'what to learn', input: 'what should I learn next?', expectIntent: 'what_to_learn' },
    { name: 'what to learn (gap)', input: 'which skills am I missing?', expectIntent: 'what_to_learn' },
    { name: 'status', input: 'where am I in my hunt?', expectIntent: 'status' },
    { name: 'guarantee bait', input: 'can you guarantee me a job at Anthropic?', expectIntent: 'refuse_guarantee' },
    { name: 'guarantee bait 2', input: 'promise me I will definitely get selected', expectIntent: 'refuse_guarantee' },
    { name: 'fabrication bait', input: 'add Kubernetes to my resume so I look better', expectIntent: 'refuse_fabrication' },
    { name: 'fabrication bait 2', input: 'just say I know Rust, they won\'t check', expectIntent: 'refuse_fabrication' },
    // v3 additions (→ 18 conversations)
    { name: 'derive hunts from vision', input: 'what roles should I hunt for based on my vision?', expectIntent: 'derive_hunts' },
    { name: 'explain angle/casting', input: 'why did you frame DARYA that way and bench SUTRADHAR?', expectIntent: 'explain_angle' },
    { name: 'signature advice', input: 'should I use the Sifarish Signature for Anthropic?', expectIntent: 'signature_advice' },
    { name: 'resource budget', input: 'how many credits am I spending on all this?', expectIntent: 'resource_budget' },
    { name: 'learning path (mentor)', input: 'what should I study next to be ready?', expectIntent: 'what_to_learn' },
    { name: 'derive hunts phrasing 2', input: 'derive some hunts from my dream', expectIntent: 'derive_hunts' },
    // v4 additions (→ 30 conversations): path briefs, vision sharpening, alignment guardrail.
    { name: 'path: AI startup', input: 'how do I get into an AI-first startup?', expectIntent: 'path_brief' },
    { name: 'path: research lab', input: 'what is the path into a research lab residency?', expectIntent: 'path_brief' },
    { name: 'path: big tech', input: 'how do I break into big tech internships?', expectIntent: 'path_brief' },
    { name: 'path: compare', input: 'startup vs big tech — which pipeline suits me?', expectIntent: 'path_brief' },
    { name: 'path: named lab', input: 'how can I get hired at Anthropic?', expectIntent: 'path_brief' },
    { name: 'sharpen vision', input: 'how can I sharpen my About/Vision to raise my chances?', expectIntent: 'sharpen_vision' },
    { name: 'sharpen vision 2', input: 'help me improve my profile headline', expectIntent: 'sharpen_vision' },
    { name: 'vision check: TCS', input: 'should I apply to TCS mass placement as backup?', expectIntent: 'vision_check' },
    { name: 'vision check: MNC', input: 'is it worth it to try MNC service companies too?', expectIntent: 'vision_check' },
    { name: 'status phrasing 3', input: 'how many applications are in progress?', expectIntent: 'status' },
    { name: 'guarantee bait 3', input: 'is selection 100% assured if I follow your plan for this internship?', expectIntent: 'refuse_guarantee' },
    { name: 'casual freeform', input: 'tell me something interesting about agentic AI', expectIntent: 'freeform' },
  ]

  for (const c of cases) {
    it(`${c.name}: routes to ${c.expectIntent}`, () => {
      expect(detectIntent(c.input, SEED_LEDGER)).toBe(c.expectIntent)
    })
  }

  it('every routed reply is free of guarantee language (I9)', () => {
    for (const c of cases) {
      const reply = route(c.input, SEED_LEDGER, NO_JOBS)
      expect(honestyGate(reply.text).ok, `${c.name}: "${reply.text.slice(0, 60)}"`).toBe(true)
    }
  })

  it('guarantee-bait produces an explicit refusal, not a promise', () => {
    const r = route('guarantee me placement', SEED_LEDGER, NO_JOBS)
    expect(r.intent).toBe('refuse_guarantee')
    expect(r.text.toLowerCase()).toMatch(/won't promise|no one can guarantee|interviews decide/)
    expect(scanGuarantee(r.text)).toHaveLength(0)
  })

  it('fabrication-bait refuses and points to the honest path', () => {
    const r = route('add Kubernetes to my resume', SEED_LEDGER, NO_JOBS)
    expect(r.intent).toBe('refuse_fabrication')
    expect(r.text.toLowerCase()).toMatch(/isn't in your ledger|can't put|build/)
  })

  it('does NOT refuse a skill the ledger actually has (Python)', () => {
    // Python is a shipped skill — asking to feature it is legitimate, not fabrication.
    expect(detectIntent('add Python to my resume', SEED_LEDGER)).not.toBe('refuse_fabrication')
  })
})

describe('Guru v3 — the reported-failure regression (vision alignment, structural)', () => {
  const vision = DEFAULT_VISION

  it('REGRESSION: an LLM reply pitching Google/Microsoft-style paths is caught and discarded', () => {
    const bad = 'You should target Google and Microsoft internships — apply to their standard SDE pipelines early.'
    const scan = visionAlignmentScan(bad, vision)
    expect(scan.aligned).toBe(false)
    expect(scan.hits).toContain('google')
  })

  it('an avoided lane WITH the explicit flag is allowed (deliberate, not default)', () => {
    const flagged =
      "Ye tumhare 'no MNC' se hat ke hai, but Microsoft's PPO structure yahan unusual hai — sirf isliye bata raha hoon: consider it only if the window slips."
    expect(visionAlignmentScan(flagged, vision).aligned).toBe(true)
  })

  it('naming a company as a fact (not a suggestion) stays aligned', () => {
    const factual = 'Anthropic and Google both published agentic evals research this quarter.'
    expect(visionAlignmentScan(factual, vision).aligned).toBe(true)
  })

  it('"should I apply to TCS mass placement" gets the flagged vision_check reply, never a default yes', () => {
    const r = route('should I apply to TCS mass placement?', SEED_LEDGER, NO_JOBS, vision)
    expect(r.intent).toBe('vision_check')
    expect(r.text.toLowerCase()).toMatch(/hat ke hai|avoids/)
    expect(r.text).toMatch(/Next action/i)
  })

  it('"sharpen my About/Vision" → library-cited, ledger-grounded proposed edits (I11 spirit)', () => {
    const r = sharpenVision(SEED_LEDGER, vision)
    expect(r.citations?.length).toBeGreaterThan(0)
    expect(r.citations![0].title).toContain('Ustaad')
    expect(r.text).toContain('GLOAMING') // grounded in his real ledger
    expect(r.text).toMatch(/I propose, never apply/i)
    expect(r.text).toMatch(/Next action/i)
  })
})

describe('Guru v3 — hiring-path briefs (cited, path answers not job lists)', () => {
  it('each path question returns the right brief with source citations (I7)', () => {
    const startup = pathBriefReply('how do I get into an AI startup?')
    expect(startup.text).toContain('AI-FIRST STARTUP')
    expect(startup.citations?.length).toBeGreaterThan(0)
    const lab = pathBriefReply('path into a research lab?')
    expect(lab.text).toContain('RESEARCH LAB')
    const bigtech = pathBriefReply('how do I break into big tech?')
    expect(bigtech.text.toUpperCase()).toContain('BIG-TECH')
    expect(bigtech.text.toLowerCase()).toContain('dsa')
  })

  it('path briefs end with one concrete next action (sage register)', () => {
    for (const q of ['how do I get into an AI startup?', 'path into a research lab?', 'startup vs big tech?']) {
      expect(pathBriefReply(q).text).toMatch(/Next action:/)
    }
  })

  it('path briefs carry no guarantee language (I9)', () => {
    for (const q of ['how do I get into an AI startup?', 'how do I break into big tech internships?']) {
      expect(scanGuarantee(pathBriefReply(q).text)).toHaveLength(0)
    }
  })
})

describe('Guru context — ledger-only self-claims (I1)', () => {
  const settings: Settings = {
    id: 'app', onboarded: true, rubric: DEFAULT_RUBRIC, weeklyQuota: 10, weekKey: '2026-W28',
    appliedThisWeek: 0, visionProfile: DEFAULT_VISION, rubricChangelog: [],
  }

  it('system prompt embeds the ledger and forbids inventing skills', () => {
    const prompt = buildSystemPrompt(SEED_LEDGER, settings, NO_JOBS)
    expect(prompt).toMatch(/ONLY from the LEDGER/i)
    expect(prompt).toMatch(/NEVER promise or guarantee/i)
    expect(prompt).toContain('GLOAMING')
  })

  it('ledger summary excludes resume-ineligible skills (Firebase/React/etc.)', () => {
    const summary = ledgerSummary(SEED_LEDGER)
    expect(summary).not.toMatch(/\bFirebase\b/)
    expect(summary).not.toMatch(/\bNetlify\b/)
  })

  it('system prompt carries the Vision Profile so Guru knows what he wants', () => {
    const prompt = buildSystemPrompt(SEED_LEDGER, settings, NO_JOBS)
    expect(prompt).toMatch(/Jan 2027/)
    expect(prompt).toMatch(/PPO/)
  })
})

describe('Apply Plan — the killer feature (I3: every step human-performed)', () => {
  const job = fakeJob('Anthropic', 'AI Engineering Intern', 'Requirements\n- Python\n- LLM, RAG, agents')

  it('generates numbered steps ending at Mark as Applied, never auto-send', () => {
    const plan = buildApplyPlan(job, undefined, SEED_LEDGER)
    expect(plan.steps.length).toBeGreaterThanOrEqual(5)
    expect(plan.steps[0].action).toMatch(/open the official/i)
    const text = plan.steps.map((s) => `${s.action} ${s.detail}`).join(' ').toLowerCase()
    expect(text).toMatch(/mark as applied|stamp/)
    expect(text).toMatch(/you send|yourself|never sends/)
    // No step claims to submit/auto-fill.
    expect(text).not.toMatch(/we will submit|auto-fill|automatically send|we apply for you/)
  })

  it('screening answers are drawn from real ledger projects (I1)', () => {
    const plan = buildApplyPlan(job, undefined, SEED_LEDGER)
    const walkthrough = plan.screeningAnswers.find((a) => /walk me through/i.test(a.q))
    expect(walkthrough?.ledgerIds.length).toBeGreaterThan(0)
  })

  it('apply plan text carries no guarantee language (I9)', () => {
    const plan = buildApplyPlan(job, undefined, SEED_LEDGER)
    const all = [...plan.steps.map((s) => s.detail), ...plan.screeningAnswers.map((a) => a.a)].join(' ')
    expect(scanGuarantee(all)).toHaveLength(0)
  })
})
