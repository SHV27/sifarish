import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/db/db'
import { acceptPulse } from '../src/lib/pulse/client'
import type { PulseBrief } from '../src/types'

/**
 * D89 — THE SELF-EVOLVING DISCOVERY LOOP. The Pulse detects a trending skill/role in the market
 * (Khabri) and proposes a radar hunt for it; accepting the brief adds the hunt (human-confirmed),
 * so the Radar starts finding those roles. This closes D68's stated-open hypothesis: the Pulse
 * proposes hunt edits the way it proposes rubric edits.
 */
describe('Pulse proposes hunts that the owner confirms into the radar', () => {
  beforeEach(async () => {
    await db.savedHunts.clear()
    await db.pulse.clear()
    await db.settings.put({ id: 'app', onboarded: true, rubric: {} as never, weeklyQuota: 10, weekKey: 'x', appliedThisWeek: 0 } as never)
  })

  const brief = (proposedHunt?: { query: string; why: string }): PulseBrief => ({
    id: 'pulse-test-1',
    at: new Date().toISOString(),
    topic: 'AI hiring',
    headline: 'Model Context Protocol is exploding across AI job posts',
    url: 'https://example.com/mcp',
    insight: 'MCP is the new integration standard.',
    proposedHunt,
    status: 'pending',
  })

  it('accepting a brief with a proposed hunt adds it to the live radar hunts', async () => {
    await db.pulse.put(brief({ query: 'MCP engineer', why: 'trending' }))
    await acceptPulse(brief({ query: 'MCP engineer', why: 'trending' }))
    const hunts = await db.savedHunts.toArray()
    expect(hunts.some((h) => h.query === 'MCP engineer' && h.enabled)).toBe(true)
    // Marked owner-set so the freshness migration never rewrites his accepted window.
    expect(hunts.find((h) => h.query === 'MCP engineer')?.ownerSetDate).toBe(true)
  })

  it('a brief with no proposed hunt adds no hunt (backward compatible)', async () => {
    await db.pulse.put(brief())
    await acceptPulse(brief())
    expect(await db.savedHunts.count()).toBe(0)
  })

  it('the same hunt is never added twice (dedupe by query)', async () => {
    await db.savedHunts.put({ id: 'h1', query: 'MCP engineer', remoteOnly: false, datePosted: 'week', enabled: true })
    await acceptPulse(brief({ query: 'mcp engineer', why: 'trending' })) // case-insensitive
    expect((await db.savedHunts.toArray()).filter((h) => h.query.toLowerCase() === 'mcp engineer').length).toBe(1)
  })
})
