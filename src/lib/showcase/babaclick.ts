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
/** Bump when the packet craft changes — the demo's worked example is rebuilt on next open (never his vault). */
export const SHOWCASE_VERSION = 3

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
export async function seedDemoShowcase(opts: { force?: boolean } = {}): Promise<boolean> {
  const { getMode } = await import('../pehchaan')
  // His vault is his — never seeded with the demo's example. (`force` exists for the gate suite,
  // whose mode is frozen to owner at module load; no app path passes it.)
  if (!opts.force && getMode() === 'owner') return false
  const FLAG = `demo:showcase-babaclick:v${SHOWCASE_VERSION}`
  if (await db.nabzCache.get(FLAG)) return false
  const identity = await db.identity.get('me')
  const ledger = await db.ledger.toArray()
  if (!identity || ledger.length === 0) return false
  // R3 (05-Sep-2026, READ on the demo board): the example was assembled by its own copy of the packet
  // recipe and seeded ONCE — every later craft change (vision headline, honest letter, JD-driven
  // skills) left the demo showing the stale page. One door now: the same fast packet the owner gets.
  const job = showcaseJob()
  const { buildPacketFast } = await import('../darzi')
  const fast = await buildPacketFast(job)
  const packet: Packet = { ...fast, id: `packet-${job.id}-showcase`, enhancing: false, ready: true }
  await withSeedAllowance(async () => {
    await db.jobs.put(job)
    await db.packets.put({ ...packet, typesetVersion: 3 })
    await db.nabzCache.put({ key: FLAG, json: 'true', fetchedAt: new Date().toISOString() })
  })
  return true
}
