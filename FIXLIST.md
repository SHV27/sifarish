# FIXLIST.md — v3 WS0 Audit (08-Jul-2026)

Baseline: 111/111 gates green · typecheck clean · build clean · main bundle 134KB gzip (pdf/docx
lazy-loaded, no chunk-size warning) · v2 live smoke passed with 0 console errors last session.

## P0 (blocking) — none found
The app is in good shape entering v3. No broken states, no console errors, no dead code, no debt markers
(`grep` for TODO/FIXME/@ts-ignore/console.log → clean), no `any` leaks, all invariant gates green.

## P1 (fix this session) — folded into v3 work
- **[WS0] Two-tier model strategy** — pin `openai/gpt-oss-120b` (reasoning: decide/critique/casting/angle)
  + `llama-3.1-8b-instant` (classification: archetype/extraction). Both verified live in JSON mode.
  I8 budgets split per tier (a reasoning call costs more than a classify call).
- **[WS0] Resource discipline** — every LLM call gets a content-hash cache key, a token cap, and a
  deterministic fallback. Built into the Dimaag Core (WS1) by construction, surfaced in the Dimaag Ledger.

## P2 (optimization sweep — WS5)
- **Radar score caching** — `scoreJob` (decodeJD + matchEvidence) runs for every `found` job inside a
  `useMemo` keyed on `jobs`; tailoring flips `isNew` → full re-score. Cache score by
  `job.id + rubric-hash` so only new/changed jobs recompute. (Perf, not correctness.)
- **Jobs table growth** — each sweep adds up to ~100 `found` rows with no pruning; over many sweeps the
  table grows unbounded. Add a "clear old untouched finds" action + auto-prune `found` jobs older than
  N days that were never tailored. (Housekeeping.)
- **Dexie `.toArray()` then in-memory filter** — fine at current scale; the score cache above removes the
  only hot path. No index changes needed.

## Verified live (Law 12)
- Groq lineup (17 models); two-tier picks confirmed with JSON-mode + reasoning-token support on gpt-oss-120b.
- Tavily / JSearch / GitHub PAT still valid (v2 live smoke last session).
