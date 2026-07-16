import { describe, it, expect } from 'vitest'
import { emergingFromBrief, pulseTopicsFor, PULSE_TOPICS } from '../src/lib/pulse/client'

/**
 * Session 5.6 — the self-evolving loop must track HIS market and catch terms the field just coined,
 * not only a hardcoded list (owner: "app should evolve with time, new roles new everything").
 */
describe('pulse — dynamic emerging-term detection (evolves without a code change)', () => {
  it('catches a NEW AI-role phrase the market coins, absent from the lexicon', () => {
    // "physical AI" / "embodied AI" are 2026-era role phrases not in the JD lexicon.
    expect(emergingFromBrief('Startups are racing to hire Physical AI engineers for robotics.')).toMatch(/physical.?ai/)
  })
  it('catches a novel capitalized acronym in an AI-hiring brief', () => {
    const term = emergingFromBrief('New agent-to-agent protocol RLHF2 is trending among labs hiring engineers.')
    expect(term).toBeTruthy()
    expect(term).not.toBe('ai')
  })
  it('does NOT propose common words / stopwords as emerging', () => {
    expect(emergingFromBrief('AI and ML jobs are up; the CEO says now is the time.')).toBeUndefined()
  })
})

describe('pulse — topics track his vision, capped for budget (I8)', () => {
  it('adds his target roles to the market sweep, cleaned of "intern"', () => {
    const topics = pulseTopicsFor(['Agentic AI Engineer', 'AI Engineer Intern'])
    expect(topics.some((t) => /agentic ai engineer/i.test(t))).toBe(true)
    expect(topics.some((t) => /intern/i.test(t))).toBe(false) // "intern" stripped
    expect(topics.length).toBeLessThanOrEqual(6) // bounded Tavily spend
  })
  it('falls back to the base topics with no vision', () => {
    expect(pulseTopicsFor([])).toEqual(PULSE_TOPICS.slice(0, 6))
  })
})
