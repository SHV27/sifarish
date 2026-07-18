# ARCHITECTURE.md — Studio Protocol Phase 3 (target architecture, frugal constraints)

> Input: AUDIT.md (6 live error classes, 5 fragilities, 4 obsolescence risks) + PRODUCT_BAR.md
> (13 ranked product moves). Constraint set: ₹0 new spend, free tiers must last the month,
> local-first, I1-I13 inviolable, keyless-degradable, human-confirmed mutation.
> STATUS: AWAITING OWNER APPROVAL — no code until "approved".

## 0 · What the audit says we already have (don't rebuild what's past the bar)

One reasoning router (/api/dimaag: Gemini 3 Flash → Gemini Lite → Groq 120b, per-provider schema
dialects, rateLimited backoff), content-hash response cache (re-calls=0 gate), daily budget
rations (S7.2), deterministic keyless twin for every LLM feature (I4), per-model usage ledger,
~670 invariant gates. The compiler core is FINISHED (PRODUCT_BAR verdict). This phase closes the
6 error classes and builds the loops AROUND the compiler.

## 1 · Model routing layer — ONE orchestrator, rules as data

- **Gap (AUDIT #3):** /api/guru and /api/polish are Groq-only single points bypassing the router.
- **Target:** both route through the same provider chain as /api/dimaag. Routing RULES move to
  `data/config/routing.json` (versioned, shipped as a static asset): per task-type →
  lane order, model ids, maxTokens, temperature. The three API functions read the same JSON at
  build time (inlined by the bundler — D22's self-contained rule holds). Swapping a 2028 model =
  edit routing.json, redeploy. No code change.
- Classification/extraction stays on the cheap lane; reasoning-depth tasks (casting, angle,
  Nazar, critique) on the strong lane — exactly the current split, now declared in data.

## 2 · Token discipline — budgets measured, prompts versioned

- Prompt SKELETONS today live in code (forge.ts, reframe.ts, smart.ts — AUDIT #14: every craft
  fix was a code edit). **Target:** skeletons move to `data/prompts/*.json` with `version` +
  `tokenBudget` fields; `PROMPT_VERSION` feeds cache keys and FORGE_VERSION (closing AUDIT #15's
  procedural hole: a prompt edit that forgets the version bump is now a failing gate — the gate
  hashes the prompt file and compares against the recorded version).
- **Token-budget table** (measured, kept in the same config; gate asserts payloads stay inside):
  classify ~1.2k in/150 out · decide ~4k/550 · forge ~1.5k/700 · Nazar ~2k/700 · critique
  ~2.5k/400 · Guru turn ~12k/800 · polish ~2k/600.
- Caching: exact-match content-hash exists; ADD prompt-version to every key (already partial).
  No semantic cache — embedding calls would COST more than they save at one user's volume
  (frugality is the design input; decision recorded).

## 3 · Degradation ladder — typed, central, visible

- **One boundary module `src/lib/boundary.ts`:** `parse<T>(raw, guard)` — hand-rolled runtime
  guards (no zod; +0 deps, ~1.5KB) for every external shape: dimaag/guru/polish responses,
  JSearch/Adzuna/ATS feeds, GitHub, Gmail, vault. Kills CLASS A (22 casts) at one door: internal
  code NEVER receives unvalidated external data.
- **Typed error categories** `AppError = 'auth' | 'ratelimit' | 'budget' | 'network' | 'shape' |
  'provider'` — the 76 bare `catch {}` (CLASS B) collapse to `catchAs(category, context)` which
  records to a bounded `errlog` ring (100 rows, prunable) — I4 keeps degrading silently for the
  USER, but the app itself finally SEES its failures (the D73 blind spot, closed as data).
  dimaagHealth reads errlog too.
- **Ladder per feature (declared in routing.json):** down → next lane → deterministic twin;
  rate-limited → backoff+retry (never silent downgrade, D140); slow >12s → fast-packet stays with
  the S7.2 retry chip; garbage output → schema reject → next lane (already live in the router).

## 4 · Config over code — the anti-obsolescence rule

- `data/config/`: routing.json (models/lanes/thresholds) · prompts/*.json (skeletons+budgets) ·
  hunts/watchlist seeds (already data) · Ustaad library (already data, I13).
- CLASS E (guard copied into 10 functions, D22 forbids sharing): a **build-time diff gate** —
  tests hash the guard block in every api/*.ts and fail on drift. The copies stay (Vercel
  constraint), the DRIFT dies.
- CLASS D (nabzCache junk drawer): typed accessors module `src/lib/kv.ts` (one place owns
  key names + codecs); CLASS F: one `pruneAll()` in autopilot (signals/dak/pulse/usage/errlog
  bounded; sync blob stops growing monotonically).

## 5 · Self-evolving loop — measurement, not magic

- **Outcome memory (PRODUCT_BAR #2):** every packet already carries casting/angle/quality; jobs
  carry status transitions. A pure `outcomes.ts` aggregates: which angle/archetype/lineup got
  replies/interviews FOR HIM (≥5 samples before any advisory line — poker hand-history, never a
  guess). Renders in Retro + steers future casting as a PROPOSAL (Nabz pattern).
- **Eval replay:** `scripts/eval-replay.mts` re-runs logged failed/abandoned interactions
  against current prompts/routing (uses the cache-busting prompt version) and prints a
  before/after table — the honest "improves from its own usage" loop.

## 6 · Product moves (PRODUCT_BAR top-5, in the same execution wave)

1. **Campaign pace line** in the Briefing (Aug-Dec clock vs applications/replies — trivial, #1).
2. **Outcome memory** (§5).
3. **Dak date-extraction** — interview emails yield date/time/interviewer into the dossier.
4. **Gap Sprint** — Taleem gap → one-click in_forge entry → Nabz auto-promotes on ship.
5. **Interview-prep sheet** — the packet's evidence recompiled as a prep dossier (same I1 lines).

## 7 · Execution law (Phase 4, on approval)

Fix by CLASS with every sibling in the same commit · run+show output before "done" · boundary
validation before internal consumption · every failure through catchAs → errlog · gate per fix ·
Four Proofs before the final DONE · CLAUDE.md/DECISIONS updated (Phase 6).

**Sequencing:** W1 boundary+errlog (Class A+B) → W2 routing/prompt config + guru/polish through
the router (Class E-drift gate, prompt-version gate) → W3 kv.ts + pruneAll (Class C/D/F) →
W4 product moves 1-5 → W5 proofs + docs.

— STOP. Awaiting owner approval to execute. —
