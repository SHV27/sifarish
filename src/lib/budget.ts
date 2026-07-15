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
  { id: 'jsearch', label: 'JSearch (job aggregation)', monthlyCap: 300, perRunCap: 10, unit: 'requests' },
  // Adzuna aggregates 18 country markets; one request = one country per sweep, so perRunCap 8 =
  // eight geographies covered each hunt (India→US→UK→CA→DE→SG→AU→NL). monthlyCap 300 ≈ 37 sweeps.
  { id: 'adzuna', label: 'Adzuna (global job aggregation)', monthlyCap: 300, perRunCap: 8, unit: 'requests' },
  { id: 'tavily', label: 'Tavily (signals + intel + pulse)', monthlyCap: 1000, perRunCap: 8, unit: 'credits' },
  { id: 'groq', label: 'Groq (Guru + polish)', monthlyCap: 5000, perRunCap: 40, unit: 'calls' },
  // v3 two-tier reasoning budgets — a gpt-oss-120b reason call costs more than a gpt-oss-20b classify.
  { id: 'dimaag', label: 'Dimaag reasoning (gpt-oss-120b)', monthlyCap: 2000, perRunCap: 12, unit: 'calls' },
  { id: 'chhota', label: 'Dimaag classify (gpt-oss-20b)', monthlyCap: 4000, perRunCap: 20, unit: 'calls' },
]

export async function ensureBudgets(): Promise<void> {
  const mk = monthKey()
  for (const def of BUDGET_DEFAULTS) {
    const existing = await db.budgets.get(def.id)
    if (!existing) {
      await db.budgets.put({ ...def, used: 0, monthKey: mk })
      continue
    }
    // Local-first means a raised default cap (D88 widened JSearch for discovery breadth) never
    // reaches an existing vault (D59's lesson). So adopt a HIGHER cap from the defaults — but only
    // ever upward, so a value the owner deliberately lowered in Settings is never clobbered.
    const perRunCap = Math.max(existing.perRunCap, def.perRunCap)
    const monthlyCap = Math.max(existing.monthlyCap, def.monthlyCap)
    const usedReset = existing.monthKey !== mk // new month → reset the meter
    if (perRunCap !== existing.perRunCap || monthlyCap !== existing.monthlyCap || usedReset) {
      await db.budgets.put({ ...existing, perRunCap, monthlyCap, used: usedReset ? 0 : existing.used, monthKey: mk })
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
