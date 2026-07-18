import { db } from '../db/db'

/**
 * TYPED CACHE ACCESSORS (Studio W3 — AUDIT Class D). nabzCache had become a string-keyed junk
 * drawer: ≥8 concerns, every call site hand-rolling its own `Number(row?.json ?? 0) || 0` codec —
 * D152's rotation drift was this class biting. Key names + codecs now live HERE, once.
 * (README/repos blobs keep their existing accessors in nabz/github.ts — they are that module's
 * own domain; this module owns the cross-cutting counters and timestamps.)
 */

export type CounterKey = 'jsearch:rotation' | 'jsearch:markets' | 'adzuna:rotation' | 'adzuna:queries'

export async function getCounter(key: CounterKey): Promise<number> {
  const row = await db.nabzCache.get(key)
  return Number(row?.json ?? 0) || 0
}

export async function setCounter(key: CounterKey, value: number): Promise<void> {
  await db.nabzCache.put({ key, json: String(value), fetchedAt: new Date().toISOString() })
}

export async function getJsonMap(key: 'jsearch:yields'): Promise<Record<string, number>> {
  const row = await db.nabzCache.get(key)
  try {
    return row ? (JSON.parse(row.json) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

export async function setJsonMap(key: 'jsearch:yields', value: Record<string, number>): Promise<void> {
  await db.nabzCache.put({ key, json: JSON.stringify(value), fetchedAt: new Date().toISOString() })
}

export async function touchStamp(key: 'radar:lastBoardScan'): Promise<void> {
  await db.nabzCache.put({ key, json: '1', fetchedAt: new Date().toISOString() })
}

/**
 * PRUNE ALL (AUDIT Class F): six tables grew monotonically and every byte rode inside the
 * encrypted sync blob forever. Bounded now; the newest N of each survive. Runs from autopilot
 * (session-once), never blocks anything, prunes only infra/derived rows — his STORY data
 * (ledger, packets, jobs he touched) is never pruned by machinery.
 */
export async function pruneAll(): Promise<void> {
  const prune = async (table: { count(): Promise<number>; orderBy(i: string): { limit(n: number): { primaryKeys(): Promise<unknown[]> } } ; bulkDelete(k: never[]): Promise<void> }, index: string, cap: number) => {
    try {
      const n = await table.count()
      if (n > cap + 20) {
        const stale = await table.orderBy(index).limit(n - cap).primaryKeys()
        await table.bulkDelete(stale as never[])
      }
    } catch {
      /* housekeeping must never throw */
    }
  }
  await prune(db.signals as never, 'fetchedAt', 200)
  await prune(db.dak as never, 'fetchedAt', 200)
  await prune(db.pulse as never, 'at', 150)
  await prune(db.dimaagUsage as never, 'monthKey', 120)
  await prune(db.errlog as never, 'at', 100)
  await prune(db.dimaagCache as never, 'at', 500)
}
