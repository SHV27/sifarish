import { db } from '../db/db'

/**
 * THE BOUNDARY (Studio Protocol W1) — every external shape is PARSED here, never assumed.
 * AUDIT Class A: 22 `as { … }` casts let a provider's shape change rot the app silently — the
 * D73 disease (a dead lane indistinguishable from a healthy keyless app) as a structural class.
 * Internal code must never receive unvalidated external data; a shape miss is a typed,
 * LOGGED failure that degrades through the existing I4 ladder instead of lying.
 *
 * Hand-rolled guards, zero dependencies (frugality is the design input): the shapes we consume
 * are small and known; a schema library would cost more bundle than the whole module.
 */

// ---------- typed error categories (Class B: 76 bare `catch {}` made the app blind) ----------

export type ErrCategory = 'auth' | 'ratelimit' | 'budget' | 'network' | 'shape' | 'provider'

const ERRLOG_CAP = 100

/**
 * Record a categorized failure to the bounded errlog ring. NEVER throws, never blocks — I4
 * keeps the USER experience degrading gracefully; the app itself finally SEES its failures
 * (the D73/D115 blind spot, closed as data). dimaagHealth and Settings read this.
 */
export function catchAs(category: ErrCategory, context: string, err?: unknown): void {
  void (async () => {
    try {
      await db.errlog.put({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        category,
        context,
        message: err instanceof Error ? err.message.slice(0, 200) : String(err ?? '').slice(0, 200),
      })
      const n = await db.errlog.count()
      if (n > ERRLOG_CAP + 20) {
        const stale = await db.errlog.orderBy('at').limit(n - ERRLOG_CAP).primaryKeys()
        await db.errlog.bulkDelete(stale)
      }
    } catch {
      /* the error log must never become an error source */
    }
  })()
}

// ---------- shape guards ----------

export function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
export const isStr = (v: unknown): v is string => typeof v === 'string'
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
export const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
export const isArr = (v: unknown): v is unknown[] => Array.isArray(v)
export const optStr = (v: unknown): v is string | undefined => v === undefined || typeof v === 'string'

/**
 * Parse an external payload at the boundary. Returns null (and logs 'shape') instead of letting
 * a wrong shape flow inward — the caller's existing degradation ladder takes it from there.
 */
export function parse<T>(raw: unknown, context: string, validate: (v: unknown) => v is T): T | null {
  if (validate(raw)) return raw
  catchAs('shape', context, `unexpected shape: ${JSON.stringify(raw)?.slice(0, 120)}`)
  return null
}

// ---------- the shapes the app actually consumes (one place, versioned by tests) ----------

export interface DimaagResp {
  keyless?: boolean
  result?: unknown
  tokens?: number
  error?: string
  rateLimited?: boolean
  model?: string
}
export function isDimaagResp(v: unknown): v is DimaagResp {
  return (
    isObj(v) &&
    (v.keyless === undefined || isBool(v.keyless)) &&
    (v.tokens === undefined || isNum(v.tokens)) &&
    (v.rateLimited === undefined || isBool(v.rateLimited)) &&
    (v.model === undefined || isStr(v.model)) &&
    (v.error === undefined || isStr(v.error))
  )
}

export interface JobsResp {
  keyless: boolean
  jobs: unknown[]
  creditsSpent: number
  error?: string
}
export function isJobsResp(v: unknown): v is JobsResp {
  return isObj(v) && isBool(v.keyless) && isArr(v.jobs) && isNum(v.creditsSpent) && (v.error === undefined || isStr(v.error))
}

/** A discovered job row must carry the fields the radar/compiler actually rely on. */
export function isJobRow(v: unknown): v is { id: string; company: string; title: string; url: string } {
  return isObj(v) && isStr(v.id) && isStr(v.company) && isStr(v.title) && isStr(v.url)
}

export interface SignalsResp {
  keyless: boolean
  signals: unknown[]
  creditsSpent: number
}
export function isSignalsResp(v: unknown): v is SignalsResp {
  return isObj(v) && isBool(v.keyless) && isArr(v.signals) && isNum(v.creditsSpent)
}

export interface GhReposResp {
  ok: boolean
  repos?: unknown[]
  rateLimited?: boolean
  budget?: unknown
}
export function isGhReposResp(v: unknown): v is GhReposResp {
  return isObj(v) && isBool(v.ok) && (v.repos === undefined || isArr(v.repos))
}

export interface GhReadmeResp {
  ok: boolean
  readme?: string | null
  rateLimited?: boolean
}
export function isGhReadmeResp(v: unknown): v is GhReadmeResp {
  return isObj(v) && isBool(v.ok) && (v.readme === undefined || v.readme === null || isStr(v.readme))
}

export interface IntelResp {
  keyless: boolean
  bullets: unknown[]
  creditsSpent?: number
}
export function isIntelResp(v: unknown): v is IntelResp {
  return isObj(v) && isBool(v.keyless) && isArr(v.bullets)
}
