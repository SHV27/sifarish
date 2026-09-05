import { describe, it, expect } from 'vitest'
import { SEED_LEDGER, SEED_IDENTITY, fakeJob } from './helpers'
import { readPostingHeuristic, sentences } from '../src/lib/strategist/reading'
import { planHeuristic, validatePlan, buildSkillRows, sectionKeyFor } from '../src/lib/strategist/plan'
import { buildDigest } from '../src/lib/strategist/digest'
import { derivedSkills, findSkill } from '../src/lib/dossier/skills'
import { strategizeFast } from '../src/lib/strategist'
import { compileResume, estimatePages, paginate, USABLE_HEIGHT, PAGE, TIGHTEN_SCALE, metricsFor } from '../src/lib/compile/compiler'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { renderResumePdf } from '../src/lib/export/pdf'
import { extractPdfText, verifyLines } from '../src/lib/export/parseback'
import { renderResumeDocxBuffer } from '../src/lib/export/docx'
import { scanHonesty } from '../src/lib/slop/scan'
import type { LedgerEntry } from '../src/types'

/**
 * v2 THE STRATEGIST gates — the Babaclick scene (VISION-BRIEF v2, Appendix A) is the acceptance
 * test, plus an ordinary AI-engineer posting so the product does not overfit to vibe-coder roles.
 * Two-sided throughout: what must land AND what must never land.
 */

export const BABACLICK = `Professional Vibe Coder – Growth Internship — Babaclick · Gurugram, Haryana, India (On-site) · Full-time Internship · In person · 12 weeks · ₹40,000/month stipend

Yes, this is a real role. No coding experience required. Exceptional reasoning mandatory.

Most companies treat interns as people who need to be kept away from important decisions. We tend to do the opposite. At Babaclick, you will join a small team pursuing a major commercial opportunity with the potential to materially increase—and in some cases more than double—our revenue. Your job will not be to "support" that team. Your job will be to understand the opportunity, research what nobody knows yet, reach your own conclusions, build the systems needed to capture it and take responsibility for its impact on the bottom line.

Why this opportunity exists. Babaclick is a profitable, London-headquartered global e-commerce company with its principal technology and growth team in Gurgaon. We process more than 120,000 orders annually and sell through marketplaces including Amazon and Walmart. Our new internal platform, Atlas, coordinates purchasing, catalogue decisions, orders, receiving, marketplace operations and other parts of the business.

What is a Professional Vibecoder? AI has shifted the bottleneck in many types of software development. Remembering syntax no longer matters. Understanding the real problem, specifying behaviour precisely and recognising when the output is wrong matter much more. You can use Cursor, Claude Code, Codex and any other useful AI tool. You do not need previous professional coding experience. You do need to think precisely enough to tell an AI what the system must do, recognise when its answer is wrong and verify that the finished product works. A casual vibe coder generates code. A Professional Vibecoder is accountable for the result.

What you will actually do. You will be part of a small team pursuing a major commercial opportunity reporting directly to the CEO. Your work will involve some combination of: investigating markets, products, competitors, regulations and APIs; analysing product, order and financial data; modelling unit economics; building internal tools and automations using AI coding harnesses; working with React, Python, FastAPI, PostgreSQL and third-party APIs; testing your work against real data and inconvenient edge cases.

You might be unusually good at this if: you frequently respond to an explanation with, "But why does it have to work that way?"; you instinctively separate facts, assumptions, inferences and unknowns; you care about the economics of an idea; you have built, sold, automated, organised or investigated something without being told how.

We do not care about: your university's brand · your degree subject · whether you can write code without AI · LeetCode · certificates · corporate vocabulary · whether you have already held a prestigious internship · how confidently you can present a weak conclusion.

We care enormously about: logical reasoning · intellectual honesty · independent research · quantitative comfort · speed of learning · personal agency · commercial judgment · attention to inconvenient details · whether you verify your own work · whether useful things happen because you are present.

Full-Time Offer: Guaranteed. Successfully complete the full 12 weeks, and you are guaranteed a full-time offer.`

const ORDINARY = `AI Engineer Intern — Applied LLM Systems (Remote, India)
About the role
We are hiring an AI Engineer Intern to build production LLM features: RAG pipelines over internal documents, agent workflows with tool use, and evaluation harnesses.
Requirements
- Strong Python; experience with LangChain or LangGraph
- Hands-on with RAG (embeddings, vector search), prompt engineering, and LLM evals
- Familiarity with FastAPI and deploying services
Nice to have
- LoRA fine-tuning, MCP servers, TypeScript/React
Internship, 6 months, stipend ₹40,000/month. Remote across India.`

describe('The Reading — the posting understood, with receipts (two-sided)', () => {
  const r = readPostingHeuristic(BABACLICK, 'Babaclick', 'Professional Vibe Coder – Growth Internship')

  it('splits a posting into sentence units', () => {
    expect(sentences('A. B! C?').length).toBe(3)
  })
  it('reads "we care enormously about" as cares, each with the posting\'s words', () => {
    const phrases = r.cares.map((q) => q.phrase.toLowerCase())
    expect(phrases.some((p) => p.includes('logical reasoning'))).toBe(true)
    expect(phrases.some((p) => p.includes('personal agency'))).toBe(true)
    for (const q of r.cares) expect(q.quote.length).toBeGreaterThan(10)
  })
  it('reads "we do not care about" as doesNotCare — NEVER as a care (the 11/11 disease)', () => {
    const no = r.doesNotCare.map((q) => q.phrase.toLowerCase())
    expect(no.some((p) => p.includes('leetcode'))).toBe(true)
    expect(no.some((p) => p.includes('certificates'))).toBe(true)
    const cares = r.cares.map((q) => q.phrase.toLowerCase())
    expect(cares.some((p) => p.includes('leetcode'))).toBe(false)
    expect(cares.some((p) => p.includes('certificates'))).toBe(false)
  })
  it('reads "No coding experience required" / "syntax no longer matters" as not-cared-about', () => {
    const no = r.doesNotCare.map((q) => q.phrase.toLowerCase()).join(' | ')
    expect(no).toMatch(/coding experience|syntax/)
  })
  it('identifies the reader (founder — reporting to the CEO, small team), the window (intern) and reveal affinity', () => {
    expect(r.readerPersona).toBe('founder')
    expect(r.roleWindow).toBe('intern')
    expect(r.revealAffinity).toBeGreaterThanOrEqual(0.6)
  })
  it('an ordinary AI-engineer posting reads as tech-heavy with lexicon skills, hiring-manager reader, no false doesNotCare', () => {
    const o = readPostingHeuristic(ORDINARY, 'Acme', 'AI Engineer Intern')
    expect(o.skills.must).toContain('rag')
    expect(o.skills.must).toContain('python')
    expect(o.roleWindow).toBe('intern')
    expect(o.doesNotCare.length).toBe(0)
  })
})

describe('The Dossier digest + derived skills (authority 3, 4)', () => {
  it('the digest names every eligible fact by id and never a skill entry as a fact line', () => {
    const d = buildDigest(SEED_LEDGER, SEED_IDENTITY)
    for (const e of SEED_LEDGER.filter((x) => x.resumeEligible && x.tier === 'shipped' && x.kind !== 'skill')) {
      expect(d.text).toContain(`[${e.id}]`)
    }
    expect(d.text).not.toMatch(/\[skill-[a-z-]+\] \(skill/)
  })
  it('derived skills prove every item with fact ids; a JD term resolves by any surface form', () => {
    const skills = derivedSkills(SEED_LEDGER)
    expect(skills.length).toBeGreaterThan(10)
    for (const s of skills) expect(s.factIds.length).toBeGreaterThan(0)
    expect(findSkill(skills, 'rag')).toBeTruthy()
    expect(findSkill(skills, 'FastAPI')).toBeTruthy()
    expect(findSkill(skills, 'kubernetes')).toBeUndefined() // never claimed → never proven
  })
})

describe('The Game Plan — the Babaclick scene (Appendix A) and the ordinary posting', () => {
  const reading = readPostingHeuristic(BABACLICK, 'Babaclick', 'Professional Vibe Coder – Growth Internship')
  const plan = planHeuristic(reading, SEED_LEDGER, SEED_IDENTITY)
  const byId = (id: string) => SEED_LEDGER.find((e) => e.id === id)!

  it('every eligible non-skill fact is accounted for — played or benched — nothing vanishes', () => {
    const ids = new Set([...plan.played.map((p) => p.factId), ...plan.benched.map((b) => b.factId)])
    for (const e of SEED_LEDGER.filter((x) => x.resumeEligible && x.tier === 'shipped' && x.kind !== 'skill')) {
      expect(ids.has(e.id), `${e.id} missing from the plan`).toBe(true)
    }
  })
  it('NTSE plays, and the three lines carry it — proof of mind for a posting about reasoning', () => {
    expect(plan.played.some((p) => p.factId === 'ach-ntse')).toBe(true)
    expect(`${plan.threeLines.headline} ${plan.threeLines.summary}`).toMatch(/NTSE/)
    expect(plan.threeLines.factIds).toContain('ach-ntse')
  })
  it('Braillix leads the projects (innovation angle) and Sifarish plays with the reveal ON at this reader', () => {
    expect(plan.projectOrder.slice(0, 2)).toContain('proj-braillix')
    expect(plan.played.some((p) => p.factId === 'proj-sifarish')).toBe(true)
    expect(plan.reveal.on).toBe(true)
  })
  it('achievements sit before projects when the posting is about the mind, not the stack', () => {
    expect(plan.sectionOrder.indexOf('achievements')).toBeLessThan(plan.sectionOrder.indexOf('projects'))
  })
  it('certificates are BENCHED with the posting\'s own words ("we do not care about … certificates")', () => {
    const certs = SEED_LEDGER.filter((e) => e.kind === 'certification')
    expect(certs.length).toBeGreaterThan(0)
    for (const c of certs) {
      const b = plan.benched.find((x) => x.factId === c.id)
      expect(b, `${c.id} should be benched`).toBeTruthy()
      expect(b!.reason.toLowerCase()).toContain('certificates')
    }
  })
  it('every bench carries a reason; every played fact carries a reason; skills are short when syntax does not matter', () => {
    for (const b of plan.benched) expect(b.reason.length).toBeGreaterThan(12)
    for (const p of plan.played) expect(p.reason.length).toBeGreaterThan(8)
    for (const r of plan.skills) expect(r.items.length).toBeLessThanOrEqual(6)
  })
  it('the three lines and the rationale are slop-free and promise nothing', () => {
    for (const t of [plan.threeLines.headline, plan.threeLines.summary, plan.rationale]) expect(scanHonesty(t).clean, t).toBe(true)
  })
  it('an ordinary AI posting: education leads, all achievements play, certs play, skills rows are asked-for-first', () => {
    const o = readPostingHeuristic(ORDINARY, 'Acme', 'AI Engineer Intern')
    const p = planHeuristic(o, SEED_LEDGER, SEED_IDENTITY)
    expect(p.sectionOrder[0]).toBe('education')
    for (const a of SEED_LEDGER.filter((e) => e.kind === 'achievement')) expect(p.played.some((x) => x.factId === a.id)).toBe(true)
    for (const c of SEED_LEDGER.filter((e) => e.kind === 'certification')) expect(p.played.some((x) => x.factId === c.id)).toBe(true)
    const ai = p.skills.find((r) => r.label === 'AI & ML')!
    expect(ai.items.slice(0, 4).map((i) => i.text.toLowerCase()).join(' ')).toMatch(/rag|langgraph|llm/)
    expect(p.reveal.on).toBe(true) // an applied-AI reader also rewards it
  })
  it('a custom kind (publication) gets its own section, after the core ones', () => {
    expect(sectionKeyFor('publication')).toBe('publication')
    expect(plan.played.some((p) => p.factId === 'pub-prana' && p.section === 'publication')).toBe(true)
    expect(plan.sectionOrder).toContain('publication')
  })
  it('skills rows: asked-for terms come first and every item is proven', () => {
    const rows = buildSkillRows(readPostingHeuristic(ORDINARY, 'Acme', 'x'), derivedSkills(SEED_LEDGER))
    for (const r of rows) for (const i of r.items) expect(i.factIds.length).toBeGreaterThan(0)
    expect(rows.flatMap((r) => r.items).map((i) => i.text.toLowerCase())).toContain('rag')
  })
  it('validatePlan (the brain\'s output gate): unknown ids die, unreasoned benches play, unproven skills die, drifted three-lines fall back — all NOTED', () => {
    const digest = buildDigest(SEED_LEDGER, SEED_IDENTITY)
    const raw = {
      headline: 'Kubernetes wizard with 12 years at Google',
      summary: 'A fine summary that is results-driven and guaranteed to impress.',
      threeLineFactIds: ['ach-ntse'],
      sectionOrder: ['projects', 'nonsense', 'education'],
      played: [{ factId: 'proj-braillix', section: 'projects', reason: 'they value solving real problems', framing: '' }, { factId: 'ghost-1', section: 'projects', reason: 'x', framing: '' }],
      benched: [{ factId: 'ach-ntse', reason: 'no' }],
      skills: [{ label: 'AI & ML', items: [{ text: 'Kubernetes', factIds: ['proj-braillix'] }, { text: 'RAG', factIds: [] }] }],
      revealOn: true,
      revealReason: 'they love AI tools',
      rationale: 'Lead with the innovation.',
    }
    const v = validatePlan(raw, { reading, ledger: SEED_LEDGER, identity: SEED_IDENTITY }, digest, 'gemini')
    expect(v.played.some((p) => p.factId === 'ghost-1')).toBe(false)
    expect(v.played.some((p) => p.factId === 'ach-ntse')).toBe(true) // unreasoned bench → played
    expect(v.benched.some((b) => b.factId === 'ach-ntse')).toBe(false)
    expect(v.skills.flatMap((r) => r.items).some((i) => i.text === 'Kubernetes')).toBe(false)
    expect(v.skills.flatMap((r) => r.items).some((i) => i.text.toLowerCase() === 'rag' && i.factIds.length > 0)).toBe(true)
    expect(v.threeLines.headline).not.toMatch(/Kubernetes|Google/)
    expect(v.threeLines.summary).not.toMatch(/results-driven|guaranteed/)
    expect(v.sectionOrder).not.toContain('nonsense')
    expect(v.sectionOrder[0]).toBe('projects')
    expect(v.notes.join('\n')).toMatch(/ghost-1/)
    expect(v.notes.join('\n')).toMatch(/Kubernetes/)
    expect(v.notes.join('\n')).toMatch(/headline discarded/)
    expect(v.by).toBe('gemini')
    // every fact still accounted for
    const ids = new Set([...v.played.map((p) => p.factId), ...v.benched.map((b) => b.factId)])
    for (const e of SEED_LEDGER.filter((x) => x.resumeEligible && x.tier === 'shipped' && x.kind !== 'skill')) expect(ids.has(e.id)).toBe(true)
    expect(byId('proj-braillix').kind).toBe('project')
  })
})

describe('The Page — the plan executed at full size (36pt, links, tighten before content, page 2 before drops)', () => {
  const job = fakeJob('Babaclick', 'Professional Vibe Coder – Growth Internship', BABACLICK)
  const strategy = strategizeFast({ job, ledger: SEED_LEDGER, identity: SEED_IDENTITY })
  const decode = decodeJD(job.jd)
  const coverage = matchEvidence(decode, SEED_LEDGER)
  const resume = compileResume({ identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, jobId: job.id, plan: strategy.plan, pagePolicy: 'two-ok' })

  it('the frame is the canon: 36pt margins, pages ≤ 2, tighten level recorded', () => {
    expect(PAGE.margin).toBe(36)
    expect(USABLE_HEIGHT).toBeCloseTo(769.89, 1)
    expect(resume.pages).toBeGreaterThanOrEqual(1)
    expect(resume.pages).toBeLessThanOrEqual(2)
    expect(resume.tighten).toBeGreaterThanOrEqual(0)
    expect(estimatePages(resume.lines, resume.tighten)).toBe(resume.pages)
  })
  it('the page follows the plan: headline under the name, sections in plan order, every played fact on the page', () => {
    expect(resume.lines[2].kind).toBe('headline')
    expect(resume.lines[2].text).toBe(strategy.plan.threeLines.headline)
    const headings = resume.lines.filter((l) => l.kind === 'heading').map((l) => l.text)
    expect(headings[0]).toBe('EDUCATION')
    expect(headings.indexOf('ACHIEVEMENTS')).toBeLessThan(headings.indexOf('PROJECTS'))
    for (const p of strategy.plan.played) {
      expect(resume.lines.some((l) => l.ledgerIds.includes(p.factId)), `${p.factId} planned but not on the page`).toBe(true)
    }
    expect(resume.benchedByPage).toBeUndefined()
  })
  it('benched facts are NOT on the page (certificates, per the posting)', () => {
    for (const b of strategy.plan.benched) {
      expect(resume.lines.some((l) => l.kind === 'bullet' && l.ledgerIds.includes(b.factId)), `${b.factId} benched but rendered`).toBe(false)
    }
    expect(resume.lines.some((l) => l.text === 'CERTIFICATIONS')).toBe(false)
  })
  it('hyperlinks: name → GitHub, contact handles, project titles and live URLs carry link targets with VISIBLE text', () => {
    expect(resume.lines[0].link).toMatch(/github\.com/)
    expect(resume.lines[1].links?.length).toBeGreaterThanOrEqual(2)
    for (const l of resume.lines[1].links ?? []) expect(resume.lines[1].text).toContain(l.text)
    const titled = resume.lines.filter((l) => l.kind === 'entry-title' && l.link)
    expect(titled.length).toBeGreaterThanOrEqual(3)
    const metas = resume.lines.filter((l) => l.kind === 'meta' && l.links?.length)
    for (const m of metas) for (const l of m.links ?? []) expect(m.text).toContain(l.text)
  })
  it('the reveal lands as an evidence line on the Sifarish project, never as an "AI-generated" stamp', () => {
    const sif = resume.lines.find((l) => l.kind === 'meta' && l.ledgerIds.includes('proj-sifarish'))
    expect(sif?.text).toMatch(/compiled by it/)
    expect(resume.lines.map((l) => l.text).join('\n')).not.toMatch(/generated by ai|ai-generated/i)
  })
  it('skills rows come from the plan (no maintained list): every rendered skill carries proving ledger ids', () => {
    const rows = resume.lines.filter((l) => l.kind === 'skills')
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(r.ledgerIds.length).toBeGreaterThan(0)
    expect(resume.lines.some((l) => l.kind === 'skills' && /whisper/i.test(l.text))).toBe(false)
  })
  it('tighten ladder + pagination are one rule: metrics scale down, headings never end a page', () => {
    expect(metricsFor('bullet', 3).leading).toBeLessThan(metricsFor('bullet', 0).leading)
    expect(TIGHTEN_SCALE[0]).toBe(1)
    const pages = paginate(resume.lines, resume.tighten)
    for (let i = 0; i < resume.lines.length - 1; i++) {
      if (resume.lines[i].kind === 'heading') expect(pages[i]).toBe(pages[i + 1])
    }
  })
  it('a one-page policy still compiles (tighten first, then content) and declares any drop', () => {
    const one = compileResume({ identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, jobId: job.id, plan: strategy.plan, pagePolicy: 'one' })
    expect(one.pages).toBe(1)
    if (one.benchedByPage) expect(one.benchedByPage.length).toBeGreaterThan(0)
  })
  it('I5 parse-back holds across pages with link annotations present; DOCX renders', async () => {
    const bytes = await renderResumePdf(resume)
    const text = await extractPdfText(new Uint8Array(bytes))
    const r = verifyLines(resume, text)
    expect(r.missing, r.missing.join('\n')).toEqual([])
    expect(r.outOfOrder).toEqual([])
    // Link annotations are real PDF objects pdfjs can read back (and they carry no text).
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise // a fresh copy — pdfjs transfers the buffer
    const annots = (await (await doc.getPage(1)).getAnnotations()) as { subtype: string; url?: string }[]
    const links = annots.filter((a) => a.subtype === 'Link')
    expect(links.length).toBeGreaterThanOrEqual(4)
    expect(links.some((a) => /github\.com\/SHV27/.test(a.url ?? ''))).toBe(true)
    expect(links.some((a) => /^mailto:/.test(a.url ?? ''))).toBe(true)
    const docx = await renderResumeDocxBuffer(resume)
    expect(docx.length).toBeGreaterThan(1000)
  })
  it('a fabricated fact through a plan cannot render (I1 at the plan): an unknown factId is simply absent', () => {
    const forged = { ...strategy.plan, played: [...strategy.plan.played, { factId: 'proj-fake-google', section: 'projects', reason: 'made up' }] }
    const r = compileResume({ identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, jobId: job.id, plan: forged })
    expect(r.lines.some((l) => l.ledgerIds.includes('proj-fake-google'))).toBe(false)
  })
  it('a custom-kind fact renders as its own titled section', () => {
    expect(resume.lines.some((l) => l.kind === 'heading' && l.text === 'PUBLICATIONS')).toBe(true)
    expect(resume.lines.some((l) => l.ledgerIds.includes('pub-prana'))).toBe(true)
  })
  it('the old (no-plan) compile path is untouched for fixtures: one page, no headline line', () => {
    const legacy = compileResume({ identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, jobId: job.id })
    expect(legacy.lines.some((l) => l.kind === 'headline')).toBe(false)
    expect(estimatePages(legacy.lines)).toBe(1)
  })
  it('extra facts of an unknown kind never crash the compiler (open kinds)', () => {
    const extra: LedgerEntry = { id: 'sport-badminton', kind: 'sports', title: 'District-level badminton player', summary: 'Ropar district, 2019', bullets: [], tier: 'shipped', evidence: { date: '2019', note: 'sworn by owner' }, tags: ['sports'], resumeEligible: true, sworn: 'owner' }
    const ledger = [...SEED_LEDGER, extra]
    const s2 = strategizeFast({ job, ledger, identity: SEED_IDENTITY })
    expect(s2.plan.played.some((p) => p.factId === 'sport-badminton' && p.section === 'sports')).toBe(true)
    const r = compileResume({ identity: SEED_IDENTITY, ledger, decode, coverage: matchEvidence(decode, ledger), jobId: job.id, plan: s2.plan })
    expect(r.lines.some((l) => l.kind === 'heading' && l.text === 'SPORTS')).toBe(true)
  })
})
