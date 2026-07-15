import { db } from '../../db/db'
import type { Critique, DimaagTier, Rationale } from '../../types'
import { allowedThisRun, monthKey, recordSpend } from '../budget'
import { meteredCallsAllowed, meteredHeaders } from '../apiGuard'

/**
 * THE DIMAAG CORE — the app's reasoning spine (P9). Every consequential choice runs through
 * `decide`; every artifact can be `critique`d; classification uses `classify`. All three are:
 *   • CACHED — identical inputs never re-call the LLM (content-hash key). Zero wastage.
 *   • BUDGETED — a call that would exceed the tier's I8 cap degrades to the heuristic.
 *   • TWO-TIER — reasoning → gpt-oss-120b, classify → gpt-oss-20b (D35 migration).
 *   • FALLBACK-SAFE — keyless / over-budget / API-error always yields a deterministic result (I4).
 *   • RATIONALED — decide returns a stored, inspectable Rationale (I10). No decision without a why.
 *
 * The app never says "trust me" — it shows its work. `by:'dimaag'` = LLM reasoned; `by:'heuristic'`
 * = deterministic. Both are honest; only the eloquence differs.
 */

// ---- stable content hash (djb2 over canonical JSON) ----
function hash(obj: unknown): string {
  const s = JSON.stringify(obj)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return 'd' + (h >>> 0).toString(36) + ':' + s.length.toString(36)
}

type UsageMode = 'hit' | 'call' | 'fallback'

async function recordUsage(feature: string, tier: DimaagTier, mode: UsageMode, tokens = 0) {
  const mk = monthKey()
  const id = `${feature}:${mk}`
  const row = (await db.dimaagUsage.get(id)) ?? { id, feature, monthKey: mk, calls: 0, tokens: 0, cacheHits: 0, fallbacks: 0 }
  if (mode === 'hit') row.cacheHits += 1
  else if (mode === 'fallback') row.fallbacks += 1
  else {
    row.calls += 1
    row.tokens += tokens
    await recordSpend(tier === 'reasoning' ? 'dimaag' : 'chhota', 1) // only a real call spends budget
  }
  await db.dimaagUsage.put(row)
}

interface CallResult {
  result: unknown
  tokens: number
  keyless: boolean
}

/**
 * STRUCTURED OUTPUT + RETRY (D73/D74) — the bug that quietly hollowed out the reasoning tier.
 *
 * Measured live 15-Jul-2026 against Groq, spaced to exclude 429s (a fast probe rate-limits itself
 * and contaminates the result — my first two readings were both wrong because of this):
 *   json_object, temperature 0.2 → 0/3
 *   json_object, temperature 1.0 → 0/3      (temperature is NOT the variable)
 *   json_schema, temperature 0.2 → 2/3      (the mode IS the variable)
 *   max_tokens                    → NOT the variable (900 both passed and failed)
 * openai/gpt-oss-120b essentially cannot satisfy `json_object`; it returns HTTP 400
 * "Failed to generate JSON" with an empty generation. Groq's structured-output mode works.
 *
 * WHY NOBODY SAW IT: every caller treats a failed call as "degrade to the deterministic
 * heuristic", and that fallback is silent BY DESIGN (I4). A dead LLM tier looks exactly like a
 * working keyless app — the gates stayed green, the budget got spent on 400s, and the owner felt
 * it long before any test could: "dimaag hi nahi hai" is an accurate description of a reasoning
 * tier that fell back on nearly every call since the D35 migration to gpt-oss.
 *
 * THE FIX: callers pass a JSON Schema; the server then asks for `json_schema` output (D74).
 * The retry stays as a cheap belt-and-braces for the residual ~1/3 (a 400 returns no completion,
 * so a retry costs no output tokens) and for genuine transients. Both live at the choke point —
 * the one function that talks to the model — so no call site can get it wrong (RC3).
 *
 * STILL OPEN: decide/critique/classify do not pass schemas yet, so they remain on the broken
 * json_object path. See D74 — this is the next session's first job, not a solved problem.
 */
const CALL_ATTEMPTS = 3

async function callDimaag(tier: DimaagTier, system: string, user: string, maxTokens: number, schema?: Record<string, unknown>): Promise<CallResult | null> {
  // Darshak/demo mode is structurally keyless (D44): a locked browser never spends a token.
  if (!meteredCallsAllowed()) return { result: null, tokens: 0, keyless: true }
  for (let attempt = 1; attempt <= CALL_ATTEMPTS; attempt++) {
    const r = await callOnce(tier, system, user, maxTokens, schema)
    // `keyless` is a settled answer (no key / demo browser) — retrying it would be a lie to
    // ourselves and a waste. Only a genuine failure (null) is worth asking again.
    if (r !== null) return r
    if (attempt < CALL_ATTEMPTS) await new Promise((res) => setTimeout(res, 250 * attempt))
  }
  return null
}

async function callOnce(tier: DimaagTier, system: string, user: string, maxTokens: number, schema?: Record<string, unknown>): Promise<CallResult | null> {
  try {
    const res = await fetch('/api/dimaag', {
      method: 'POST',
      headers: meteredHeaders(),
      body: JSON.stringify({ tier, system, user, maxTokens, schema }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { keyless?: boolean; result?: unknown; tokens?: number; error?: string }
    if (data.keyless) return { result: null, tokens: 0, keyless: true }
    if (data.error || data.result == null) return null
    return { result: data.result, tokens: data.tokens ?? 0, keyless: false }
  } catch {
    return null
  }
}

// ================= decide =================

export interface DecideOption {
  id: string
  label: string
  detail?: string
}
export interface DecideInput {
  feature: string
  question: string
  options: DecideOption[]
  criteria: string[]
  context?: string
  evidence?: { ref: string; text: string }[]
  citations?: { title: string; url: string }[]
  /** Optional domain heuristic for the fallback; if absent, a generic keyword scorer is used. */
  heuristic?: (input: DecideInput) => { choice: string; ranking: string[]; why: string; confidence: number }
}

function genericHeuristic(input: DecideInput): { choice: string; ranking: string[]; why: string; confidence: number } {
  const terms = [...input.criteria, ...(input.context ?? '').split(/\s+/)]
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length > 3)
  const termSet = new Set(terms)
  const scored = input.options
    .map((o) => {
      const hay = `${o.label} ${o.detail ?? ''}`.toLowerCase()
      let score = 0
      for (const t of termSet) if (hay.includes(t)) score += 1
      return { o, score }
    })
    .sort((a, b) => b.score - a.score)
  const top = scored[0]
  const spread = scored.length > 1 ? top.score - scored[scored.length - 1].score : top.score
  return {
    choice: top.o.id,
    ranking: scored.map((s) => s.o.id),
    why: `Heuristic match: "${top.o.label}" shares the most signal with the criteria (${input.criteria.slice(0, 3).join(', ')}). Keyless mode — deterministic keyword scoring, not LLM reasoning.`,
    confidence: Math.max(0.4, Math.min(0.75, 0.4 + spread * 0.08)),
  }
}

export async function decide(input: DecideInput): Promise<Rationale> {
  const cacheKey = hash({ k: 'decide', q: input.question, o: input.options, c: input.criteria, ctx: input.context, e: input.evidence })
  const cached = await db.dimaagCache.get(cacheKey)
  if (cached) {
    await recordUsage(input.feature, 'reasoning', 'hit')
    return JSON.parse(cached.json) as Rationale
  }

  const fallback = (): Rationale => {
    const h = (input.heuristic ?? genericHeuristic)(input)
    return {
      question: input.question,
      optionsConsidered: input.options.map((o) => o.label),
      criteria: input.criteria,
      choice: labelOf(input, h.choice),
      ranking: h.ranking.map((id) => labelOf(input, id)),
      why: h.why,
      confidence: h.confidence,
      citations: input.citations,
      evidenceRefs: input.evidence?.map((e) => e.ref),
      by: 'heuristic',
      at: new Date().toISOString(),
    }
  }

  if ((await allowedThisRun('dimaag')) < 1) return persistFallback(cacheKey, fallback())

  const system = [
    'You are a 40-year veteran career strategist reasoning about a single decision.',
    'Weigh the options strictly against the given criteria and evidence. Be honest about uncertainty.',
    'Never invent facts about the candidate; reason only from the evidence provided.',
    'Return JSON: {"choiceId":string,"ranking":string[] (option ids best-first),"why":string (2-3 sentences, concrete, names the criteria that decided it),"confidence":number (0..1)}',
  ].join('\n')
  const user = JSON.stringify({
    question: input.question,
    options: input.options,
    criteria: input.criteria,
    context: input.context,
    evidence: input.evidence,
  })

  const call = await callDimaag('reasoning', system, user, 900)
  if (!call || call.keyless || !call.result) return persistFallback(cacheKey, fallback())

  const r = call.result as { choiceId?: string; ranking?: string[]; why?: string; confidence?: number }
  if (!r.choiceId || !input.options.some((o) => o.id === r.choiceId)) return persistFallback(cacheKey, fallback())

  const rationale: Rationale = {
    question: input.question,
    optionsConsidered: input.options.map((o) => o.label),
    criteria: input.criteria,
    choice: labelOf(input, r.choiceId),
    ranking: (r.ranking ?? input.options.map((o) => o.id)).map((id) => labelOf(input, id)),
    why: r.why ?? 'Reasoned against the stated criteria.',
    confidence: clamp01(r.confidence ?? 0.7),
    citations: input.citations,
    evidenceRefs: input.evidence?.map((e) => e.ref),
    by: 'dimaag',
    at: new Date().toISOString(),
  }
  await recordUsage(input.feature, 'reasoning', 'call', call.tokens)
  await db.dimaagCache.put({ hash: cacheKey, json: JSON.stringify(rationale), at: rationale.at })
  return rationale

  async function persistFallback(key: string, rat: Rationale): Promise<Rationale> {
    await recordUsage(input.feature, 'reasoning', 'fallback')
    await db.dimaagCache.put({ hash: key, json: JSON.stringify(rat), at: rat.at })
    return rat
  }
}

// ================= critique =================

export interface CritiqueInput {
  feature: string
  artifact: string
  persona: string
  standard: string
  /** Deterministic checks for the fallback: each returns a fix string when it fails. */
  heuristicChecks?: (artifact: string) => string[]
}

export async function critique(input: CritiqueInput): Promise<Critique> {
  const cacheKey = hash({ k: 'critique', a: input.artifact, p: input.persona, s: input.standard })
  const cached = await db.dimaagCache.get(cacheKey)
  if (cached) {
    await recordUsage(input.feature, 'reasoning', 'hit')
    return JSON.parse(cached.json) as Critique
  }

  const fallback = (): Critique => {
    const fixes = input.heuristicChecks?.(input.artifact) ?? []
    return { verdict: fixes.length === 0 ? 'PASS' : 'REVISE', fixes: fixes.slice(0, 3), by: 'heuristic', at: new Date().toISOString() }
  }

  if ((await allowedThisRun('dimaag')) < 1) return persistFallback(fallback())

  const system = [
    `You are ${input.persona}. Judge the artifact against this standard: ${input.standard}.`,
    'Do a hostile 6-second skim. Flag anything inflated, generic, template-y, or misordered.',
    'Return JSON: {"verdict":"PASS"|"REVISE","fixes":string[] (0-3, most important first),"smell":string (one phrase, or empty)}',
  ].join('\n')
  const call = await callDimaag('reasoning', system, input.artifact.slice(0, 8000), 500)
  if (!call || call.keyless || !call.result) return persistFallback(fallback())
  const r = call.result as { verdict?: string; fixes?: string[]; smell?: string }
  const critiqueResult: Critique = {
    verdict: r.verdict === 'REVISE' ? 'REVISE' : 'PASS',
    fixes: (r.fixes ?? []).slice(0, 3),
    smell: r.smell || undefined,
    by: 'dimaag',
    at: new Date().toISOString(),
  }
  await recordUsage(input.feature, 'reasoning', 'call', call.tokens)
  await db.dimaagCache.put({ hash: cacheKey, json: JSON.stringify(critiqueResult), at: critiqueResult.at })
  return critiqueResult

  async function persistFallback(c: Critique): Promise<Critique> {
    await recordUsage(input.feature, 'reasoning', 'fallback')
    await db.dimaagCache.put({ hash: cacheKey, json: JSON.stringify(c), at: c.at })
    return c
  }
}

// ================= classify =================

export interface ClassifyInput {
  feature: string
  text: string
  labels: { id: string; label: string; cues: string[] }[]
  instruction: string
}

export async function classify(input: ClassifyInput): Promise<{ label: string; confidence: number; by: 'dimaag' | 'heuristic' }> {
  const cacheKey = hash({ k: 'classify', t: input.text, l: input.labels.map((l) => l.id), i: input.instruction })
  const cached = await db.dimaagCache.get(cacheKey)
  if (cached) {
    await recordUsage(input.feature, 'classify', 'hit')
    return JSON.parse(cached.json)
  }

  const heuristic = () => {
    const hay = input.text.toLowerCase()
    const scored = input.labels
      .map((l) => ({ l, score: l.cues.reduce((n, c) => n + (hay.includes(c.toLowerCase()) ? 1 : 0), 0) }))
      .sort((a, b) => b.score - a.score)
    const top = scored[0]
    return { label: top.l.id, confidence: top.score === 0 ? 0.4 : Math.min(0.8, 0.45 + top.score * 0.12), by: 'heuristic' as const }
  }

  const persistFallback = async (v: { label: string; confidence: number; by: 'dimaag' | 'heuristic' }) => {
    await recordUsage(input.feature, 'classify', 'fallback')
    await db.dimaagCache.put({ hash: cacheKey, json: JSON.stringify(v), at: new Date().toISOString() })
    return v
  }

  if ((await allowedThisRun('chhota')) < 1) return persistFallback(heuristic())

  const system = `${input.instruction}\nReturn JSON: {"labelId":string,"confidence":number}. Valid ids: ${input.labels.map((l) => l.id).join(', ')}.`
  const call = await callDimaag('classify', system, input.text.slice(0, 6000), 200)
  if (!call || call.keyless || !call.result) return persistFallback(heuristic())
  const r = call.result as { labelId?: string; confidence?: number }
  if (!r.labelId || !input.labels.some((l) => l.id === r.labelId)) return persistFallback(heuristic())
  await recordUsage(input.feature, 'classify', 'call', call.tokens)
  const v = { label: r.labelId, confidence: clamp01(r.confidence ?? 0.7), by: 'dimaag' as const }
  await db.dimaagCache.put({ hash: cacheKey, json: JSON.stringify(v), at: new Date().toISOString() })
  return v
}

// ================= generate =================

export interface GenerateInput {
  feature: string
  system: string
  user: string
  maxTokens?: number
  tier?: DimaagTier
  /**
   * JSON Schema of the expected result (D74). Strongly recommended: without it the call uses
   * Groq's `json_object` mode, which openai/gpt-oss-120b fails on ~every attempt (measured live).
   */
  schema?: Record<string, unknown>
}

/**
 * Generic structured-JSON generation on the Dimaag contract: cached by content hash (identical
 * inputs never re-call), budgeted (over-cap → null), keyless-safe (null, never a throw).
 *
 * It returns `null` rather than a fabricated result on EVERY failure path, because the callers
 * that use it (the Bullet Forge) must fall back to deterministic truth, never to invented text.
 * Nothing this returns is trusted on its own — the caller guards it against the source (I1).
 */
export async function generate<T>(input: GenerateInput): Promise<T | null> {
  const tier: DimaagTier = input.tier ?? 'reasoning'
  const cacheKey = hash({ k: 'generate', f: input.feature, s: input.system, u: input.user })
  const cached = await db.dimaagCache.get(cacheKey)
  if (cached) {
    await recordUsage(input.feature, tier, 'hit')
    return JSON.parse(cached.json) as T
  }
  if ((await allowedThisRun(tier === 'reasoning' ? 'dimaag' : 'chhota')) < 1) {
    await recordUsage(input.feature, tier, 'fallback')
    return null
  }
  const call = await callDimaag(tier, input.system, input.user, input.maxTokens ?? 2000, input.schema)
  if (!call || call.keyless || call.result == null) {
    await recordUsage(input.feature, tier, 'fallback')
    return null
  }
  await recordUsage(input.feature, tier, 'call', call.tokens)
  await db.dimaagCache.put({ hash: cacheKey, json: JSON.stringify(call.result), at: new Date().toISOString() })
  return call.result as T
}

// ---- helpers ----
function labelOf(input: DecideInput, id: string): string {
  return input.options.find((o) => o.id === id)?.label ?? id
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
