import { db, withSeedAllowance } from '../../db/db'
import type { Job, Packet } from '../../types'

/**
 * v2 THE DESK — the demo's WORKED EXAMPLE (VISION-BRIEF v2, Appendix A).
 *
 * A recruiter opening the demo cold must understand the product in seconds: a real posting goes
 * in, the READING comes out (what the company said it cares about / does not), the GAME PLAN
 * plays and benches facts with reasons, and the PAGE is executed from it. The Babaclick posting is
 * public (a LinkedIn job ad); the persona is the fictional demo user; the compile is the keyless
 * floor (demo can never spend). Seeded once per demo vault, read-only after.
 */

export const BABACLICK_POSTING = `Professional Vibe Coder – Growth Internship — Babaclick · Gurugram, Haryana, India (On-site) · Full-time Internship · In person · 12 weeks · ₹40,000/month stipend

Yes, this is a real role. No coding experience required. Exceptional reasoning mandatory.

Most companies treat interns as people who need to be kept away from important decisions. We tend to do the opposite. At Babaclick, you will join a small team pursuing a major commercial opportunity with the potential to materially increase—and in some cases more than double—our revenue. Your job will be to understand the opportunity, research what nobody knows yet, reach your own conclusions, build the systems needed to capture it and take responsibility for its impact on the bottom line.

Why this opportunity exists. Babaclick is a profitable, London-headquartered global e-commerce company with its principal technology and growth team in Gurgaon. We process more than 120,000 orders annually and sell through marketplaces including Amazon and Walmart. Our new internal platform, Atlas, coordinates purchasing, catalogue decisions, orders, receiving, marketplace operations and other parts of the business.

What is a Professional Vibecoder? AI has shifted the bottleneck in many types of software development. Remembering syntax no longer matters. Understanding the real problem, specifying behaviour precisely and recognising when the output is wrong matter much more. You can use Cursor, Claude Code, Codex and any other useful AI tool. You do not need previous professional coding experience. You do need to think precisely enough to tell an AI what the system must do, recognise when its answer is wrong and verify that the finished product works. A casual vibe coder generates code. A Professional Vibecoder is accountable for the result.

What you will actually do. You will be part of a small team pursuing a major commercial opportunity reporting directly to the CEO. Your work will involve some combination of: investigating markets, products, competitors, regulations and APIs; analysing product, order and financial data; modelling unit economics; building internal tools and automations using AI coding harnesses; working with React, Python, FastAPI, PostgreSQL and third-party APIs; testing your work against real data and inconvenient edge cases.

We do not care about: your university's brand · your degree subject · whether you can write code without AI · LeetCode · certificates · corporate vocabulary · whether you have already held a prestigious internship · how confidently you can present a weak conclusion.

We care enormously about: logical reasoning · intellectual honesty · independent research · quantitative comfort · speed of learning · personal agency · commercial judgment · attention to inconvenient details · whether you verify your own work · whether useful things happen because you are present.

Full-Time Offer: Guaranteed. Successfully complete the full 12 weeks, and you are guaranteed a full-time offer.`

export const SHOWCASE_JOB_ID = 'showcase-babaclick'

export function showcaseJob(): Job {
  return {
    id: SHOWCASE_JOB_ID,
    source: 'paste',
    company: 'Babaclick',
    title: 'Professional Vibe Coder – Growth Internship',
    location: 'Gurugram, Haryana, India (On-site)',
    url: 'https://www.linkedin.com/jobs/',
    jd: BABACLICK_POSTING,
    fetchedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'tailored',
    notes: 'The worked example from the founder brief — a posting that says what it does NOT care about.',
  }
}

/**
 * Seed the worked example into the DEMO vault: the job + a keyless-compiled packet (reading, plan,
 * page). Idempotent (flag in nabzCache). Never runs in owner mode — his vault is his.
 */
export async function seedDemoShowcase(): Promise<boolean> {
  const FLAG = 'demo:showcase-babaclick'
  if (await db.nabzCache.get(FLAG)) return false
  const identity = await db.identity.get('me')
  const ledger = await db.ledger.toArray()
  if (!identity || ledger.length === 0) return false
  const settings = await db.settings.get('app')
  const job = showcaseJob()
  const { strategizeFast } = await import('../strategist')
  const { compileResume } = await import('../compile/compiler')
  const { decodeJD } = await import('../jd/decode')
  const { matchEvidence } = await import('../match/evidence')
  const { compileCoverLetter, compileOutreach, buildGapNote } = await import('../compile/letters')
  const { estimateQuality } = await import('../ustaad/quality')
  const { editorialFromPlan } = await import('../darzi')
  const strategy = strategizeFast({ job, ledger, identity, vision: settings?.visionProfile, sections: settings?.sections })
  const decode = decodeJD(job.jd)
  const coverage = matchEvidence(decode, ledger)
  const resume = compileResume({ identity, ledger, decode, coverage, jobId: job.id, plan: strategy.plan, pagePolicy: settings?.pagePolicy ?? 'two-ok', sections: settings?.sections, summaryOn: true })
  const packet: Packet = {
    id: `packet-${job.id}-showcase`,
    jobId: job.id,
    createdAt: new Date().toISOString(),
    resume,
    coverLetter: compileCoverLetter(job, identity, ledger, decode, coverage, undefined, settings?.visionProfile),
    outreach: compileOutreach(job, identity, ledger, decode, settings?.visionProfile),
    coverage,
    gapNote: [...buildGapNote(coverage), ...strategy.plan.notes],
    decode,
    polished: false,
    editorial: editorialFromPlan(strategy.plan, strategy.reading, ledger),
    reading: strategy.reading,
    plan: strategy.plan,
    strategistMode: 'heuristic',
    compilePlan: { order: strategy.plan.projectOrder, bullets: {}, sectionOrder: undefined },
    quality: estimateQuality(resume, coverage, ledger),
    summaryOn: true,
    ready: true,
  }
  await withSeedAllowance(async () => {
    await db.jobs.put(job)
    await db.packets.put({ ...packet, typesetVersion: 3 })
    await db.nabzCache.put({ key: FLAG, json: 'true', fetchedAt: new Date().toISOString() })
  })
  return true
}
