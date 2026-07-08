import { db } from '../db/db'
import type { Budget } from '../types'

/**
 * I8 — Budget honesty. Every metered API has a tracked monthly budget. The app never
 * silently burns credits: sweeps read the remaining budget, refuse to exceed the monthly
 * cap, and every spend is recorded and shown in Settings.
 */

export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const BUDGET_DEFAULTS: Omit<Budget, 'used' | 'monthKey'>[] = [
  { id: 'jsearch', label: 'JSearch (job aggregation)', monthlyCap: 200, perRunCap: 6, unit: 'requests' },
  { id: 'tavily', label: 'Tavily (signals + intel + pulse)', monthlyCap: 1000, perRunCap: 8, unit: 'credits' },
  { id: 'groq', label: 'Groq (Guru + polish)', monthlyCap: 5000, perRunCap: 40, unit: 'calls' },
]

export async function ensureBudgets(): Promise<void> {
  const mk = monthKey()
  for (const def of BUDGET_DEFAULTS) {
    const existing = await db.budgets.get(def.id)
    if (!existing) {
      await db.budgets.put({ ...def, used: 0, monthKey: mk })
    } else if (existing.monthKey !== mk) {
      // New month → reset the meter (keep caps).
      await db.budgets.put({ ...existing, used: 0, monthKey: mk })
    }
  }
}

export async function getBudget(id: string): Promise<Budget | undefined> {
  await ensureBudgets()
  return db.budgets.get(id)
}

/** Remaining spend allowed for one run: min(perRunCap, monthlyCap - used). 0 = blocked. */
export async function allowedThisRun(id: string): Promise<number> {
  const b = await getBudget(id)
  if (!b) return 0
  return Math.max(0, Math.min(b.perRunCap, b.monthlyCap - b.used))
}

export async function recordSpend(id: string, amount: number): Promise<void> {
  if (amount <= 0) return
  await ensureBudgets()
  const b = await db.budgets.get(id)
  if (b) await db.budgets.update(id, { used: b.used + amount })
}
