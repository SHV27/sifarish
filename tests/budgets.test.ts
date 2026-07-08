import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/db/db'
import { ensureBudgets, allowedThisRun, recordSpend, getBudget, monthKey, BUDGET_DEFAULTS } from '../src/lib/budget'

/**
 * I8 — Budget honesty. Metered APIs have monthly + per-run caps; the app never overspends.
 * Uses fake-indexeddb (tests/setup.ts) so budgets persist through Dexie exactly as in-app.
 */
describe('I8 — budgets', () => {
  beforeEach(async () => {
    await db.budgets.clear()
  })

  it('seeds a budget row per metered API', async () => {
    await ensureBudgets()
    const all = await db.budgets.toArray()
    expect(all.map((b) => b.id).sort()).toEqual(BUDGET_DEFAULTS.map((b) => b.id).sort())
  })

  it('allowedThisRun never exceeds the per-run cap', async () => {
    await ensureBudgets()
    const jsearch = await getBudget('jsearch')
    const allowed = await allowedThisRun('jsearch')
    expect(allowed).toBeLessThanOrEqual(jsearch!.perRunCap)
  })

  it('recordSpend increments used (the monthly meter)', async () => {
    await ensureBudgets()
    const before = (await getBudget('tavily'))!.used
    await recordSpend('tavily', 3)
    const after = (await getBudget('tavily'))!.used
    expect(after - before).toBe(3)
  })

  it('allowedThisRun tracks the monthly remainder once it drops below the per-run cap', async () => {
    await ensureBudgets()
    const b = (await getBudget('jsearch'))! // perRunCap 6, monthlyCap 200
    await recordSpend('jsearch', b.monthlyCap - 4) // 4 left this month
    expect(await allowedThisRun('jsearch')).toBe(4) // min(perRunCap 6, remaining 4) = 4
  })

  it('blocks (returns 0) once the monthly cap is exhausted', async () => {
    await ensureBudgets()
    const b = await getBudget('jsearch')
    await recordSpend('jsearch', b!.monthlyCap)
    expect(await allowedThisRun('jsearch')).toBe(0)
  })

  it('resets the meter on a new month', async () => {
    await ensureBudgets()
    await recordSpend('groq', 100)
    // Simulate a stale month by rewriting the row's monthKey.
    const b = await db.budgets.get('groq')
    await db.budgets.put({ ...b!, monthKey: '2000-01' })
    await ensureBudgets() // should detect the month rollover and reset used → 0
    const fresh = await getBudget('groq')
    expect(fresh!.used).toBe(0)
    expect(fresh!.monthKey).toBe(monthKey())
  })
})
