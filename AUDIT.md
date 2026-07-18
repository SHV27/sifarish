# AUDIT.md — SIFARISH Cold Audit (Studio Protocol Phase 1)

**Date:** 19-Jul-2026 · **Auditors:** founding senior engineering team, post-acquisition ·
**Scope:** full `src/` + `api/` sweep, CLAUDE.md (D1–D154), PROGRESS.md, CASE_STUDY.md (esp. Part 4).
**Stance:** read-only findings; no fixes proposed beyond naming the systemic cure per class.

This is an **acquired codebase, not greenfield**: 154 logged decisions, 669 passed / 2 skipped (671)
gates across 54 test files (`tests/`), 13 invariants (I1–I13), a written post-mortem law (§14 Sentinel
Protocol), and a case study documenting 33 root-caused incidents. Several things here already clear a
"senior studio" bar and are called out as such below. The findings are what remains.

---

## 1 · ARCHITECTURE MAP

### 1.1 Data flow (one diagram)

```
┌─ SCREENS (src/screens, top-level state in App.tsx — no router lib, D14) ─────────────────┐
│ Onboarding · Shelf(ledger) · Radar(queue) · Khabri(hunts/signals) · Morcha(pipeline)     │
│ PacketScreen(tailor) · Guru(chat) · SettingsScreen  + components/ (Briefing, NabzPanel,  │
│ Baithak, DakPanel, GateScreen, RepairBanner, DimaagPulse …)                              │
└───────────────┬──────────────────────────────────────────────────────────────────────────┘
                │ useLiveQuery (Dexie IS the store, D14) · pehchaan mode frozen at boot
┌───────────────▼─ LIB CORES (src/lib) ────────────────────────────────────────────────────┐
│ darzi/* compile pipeline: jd/decode → darzi/editor (4-pass Editor's Desk) → compiler     │
│   → nazar (page-level LLM judge) → export/pdf+docx (+parseback I5)                       │
│ nabz/* (GitHub → forge bullets) · khabri/* (sweeps) · radar/* (feeds+score) · dak/*      │
│ (Gmail read-only) · guru/* · pulse/* · dimaag/core (cache-first LLM gateway) ·           │
│ budget (I8 rations) · sync (server-blind vault) · pehchaan/darbaan (identity/lock)       │
└───────────────┬───────────────────────────────┬──────────────────────────────────────────┘
                │ Dexie (IndexedDB)             │ fetch (owner-gated client-side, D44)
┌───────────────▼──────────────┐  ┌─────────────▼─ 11 VERCEL FUNCTIONS (api/, Hobby cap 12) ┐
│ TIJORI: two physical DBs     │  │ dimaag (free-router) · guru · polish · intel · pulse    │
│ sifarish_owner/sifarish_demo │  │ khabri/{jobs,signals,aggregators} · gh · vault ·        │
│ (db.ts:131) — 20 tables,     │  │ darbaan (token mint). Each: origin allowlist + owner    │
│ DBCore write-block I12       │  │ token @ choke point (RC3), self-contained (D22)         │
│ (db.ts:145-169)              │  └─────────────┬────────────────────────────────────────────┘
└──────────────────────────────┘                │
                 PROVIDERS: Gemini (3-flash-preview, 3.1-flash-lite) · Groq (gpt-oss-120b/20b)
                 Tavily · JSearch/OpenWebNinja · Adzuna (19 mkts) · GitHub REST · Vercel Blob
                 + keyless browser-direct: Greenhouse/Lever/Ashby/SmartRecruiters (32 boards),
                 Remotive, RemoteOK, Arbeitnow, Jobicy, SimplifyJobs; proxied: WWR, WorkingNomads
```

### 1.2 Where the LLMs are called

| Entry point | Chain | Evidence |
|---|---|---|
| `/api/dimaag` — **the single reasoning router** | reasoning: Gemini 3 Flash preview → Gemini 3.1 Flash-Lite → Groq gpt-oss-120b → client heuristic (loud); classify: Groq gpt-oss-20b → Gemini lite | `api/dimaag.ts:21-27`; per-provider schema dialects `toGeminiSchema` `api/dimaag.ts:52-76` |
| `/api/guru` — chat streaming | **Groq gpt-oss-120b only — NOT behind the free router** | `api/guru.ts:12` |
| `/api/polish` — phrasing polish | **Groq gpt-oss-120b only — NOT behind the free router** | `api/polish.ts:15` |
| Client gateway | `src/lib/dimaag/core.ts` (cache-first, content-hash key, budget check, 429 backoff-and-retry-LLM-path) | `core.ts:150-155` |
| Direct bypass | smart Baithak posts to `/api/dimaag` itself (metered since D130) | `src/lib/baithak/smart.ts:286,342` |

### 1.3 State, identity, error paths

- **State:** Dexie + `useLiveQuery`; no Zustand/router. Identity = **pehchaan** (`src/lib/pehchaan.ts`),
  mode resolved synchronously at boot, every transition full-reloads (D48) — kills the stale-store class.
- **Vaults:** two physical DBs (`db.ts:131`), demo story-tables write-blocked at DBCore (`db.ts:145-169`),
  owner mutations fire the auto-backup/sync listener (`db.ts:158-162`).
- **Error path (I4):** every metered client degrades to a deterministic fallback; since D115 the
  degradation is *observable* (`src/lib/dimaag/health.ts` — live/DEGRADED/keyless/quiet verdict + header
  badge), and since D152 budget skips are *named* in the SweepYield. This is the direct scar tissue of
  CASE_STUDY 3.13 (the silently-dead LLM tier).

### 1.4 What already meets the studio bar (credit where due)

- **One reasoning router** with provider dialects and pinned ids (`api/dimaag.ts`) — most shops have N ad-hoc callers.
- **Content-hash reasoning cache** (`dimaagCache`, re-calls=0 gate, D26) + **budget rations** (⌊cap/30⌋ daily pacing, `src/lib/budget.ts:68-95`, D152).
- **Deterministic keyless twin for every LLM feature** (I4) — the testable core is not the LLM.
- **Invariants enforced at choke points**: DBCore write-block (I12), server-side owner token on all 11 functions (D46), I3 proven by a source-grep gate over send-capable strings (D39/D95).
- **671-gate suite** incl. chaos runs, live-only probes, adversary/money proofs; regression-test-per-bug discipline (§14).
- **Craft knowledge as versioned data**: `data/ustaad/library.json` v1.3.0 (82 sources / 57 patterns), Pulse-refreshable (I13), injected via `craftClauses` (`src/lib/ustaad/library.ts:176`).

### 1.5 Module table

| Module | LOC | Responsibility |
|---|---|---|
| `src/screens/PacketScreen.tsx` | 864 | Packet view, Baithak host, exports, recompile authority UI |
| `src/types.ts` | 763 | All domain types (single file) |
| `src/lib/khabri/client.ts` | 673 | Sweep orchestration, rotations, budgets, dedupe, prune |
| `src/screens/Radar.tsx` / `SettingsScreen.tsx` | 664/725 | Queue+hunt panel / vision, budgets, Darbaan, Ustaad |
| `src/lib/nabz/github.ts` + `nabz/forge.ts` | 633+330 | Repo→ledger pipeline, README distill, Bullet Forge, FORGE_VERSION |
| `src/lib/darzi.ts` + `darzi/editor.ts` + `compile/compiler.ts` | 542+441+518 | buildPacket(Fast), 4-pass Editor's Desk, deterministic compiler (I1/I2/I5/one-page) |
| `src/lib/dimaag/core.ts` | 461 | LLM gateway: cache, budget, schema, fallback, health rows |
| `src/lib/radar/{feeds,score}.ts` | 317+357 | 4 ATS feed parsers + board scans; 6-dim rubric + vision lens + staleness |
| `src/lib/{guru,baithak,atelier,polish,pulse,dak,sahayak}/*` | — | Chat, conversational EditOps, letters, drift-guarded reframe, market pulse, mail match, follow-up drafts |
| `api/*` (11 fns) | ~1.6k | Guarded provider proxies; `dimaag` is the router; `vault` is blob sync; `darbaan` mints the token |

---

## 2 · ERROR-CLASS INVENTORY

CASE_STUDY Part 4 names six meta-patterns (choke-point vs convention · composition holes · instance-vs-class
patching · confidence outrunning verification · **silent degradation** · auditing the machine not the input).
The classes below are what a fresh grep finds **still alive today**, mapped to those patterns.

### CLASS A — API response shapes assumed, never runtime-validated (Part-4 #5 fuel)
**Root cause:** every network boundary trusts `res.json()` with a bare TypeScript cast; there is **zero**
runtime validation in the repo (grep `zod|valibot|ajv` → 0 hits in src/api).
**Evidence (22 sites):** `src/lib/dimaag/core.ts:150,266,345,402` · `src/lib/sync.ts:107,131,162` ·
`src/lib/nabz/github.ts:106` · `src/lib/intel/client.ts:36` · `src/lib/darbaan/lock.ts:109` ·
`src/lib/baithak/{execute.ts:33,smart.ts:342}` · `api/khabri/jobs.ts:134` · `api/khabri/aggregators.ts:145` ·
`api/khabri/signals.ts:109` · `api/{intel.ts:98,polish.ts:135,pulse.ts:96,vault.ts:76,80,darbaan.ts:55}` ·
plus optional-chained JSON in `src/lib/guru/client.ts:118`.
**Bitten already?** YES, repeatedly in spirit: D73/D74 (a 400-shaped reply was indistinguishable from a dumb
model), D96 (unparseable date → NaN → max penalty), D152 (`datePosted:'all'` silently coerced). A provider
quietly changing `data`→`results` today would degrade silently to fallback (Class B catches the exception,
not the shape).
**Systemic fix (one):** a single `readJson<T>(res, guard)` boundary helper with per-endpoint runtime guards;
shape mismatch becomes a *named* health event (the D115 pattern), not a silent fallback.

### CLASS B — blanket `catch {}` swallow instead of typed degradation
**Root cause:** I4 ("never blank") implemented as 76 bare `catch {` blocks (grep count, src+api) rather than
a typed `DegradeReason` funnel. Each one is a place a failure can live forever, green.
**Evidence (dense spots):** `src/lib/sync.ts` ×8 (26,46,66,90,115,143,152,164) · `src/lib/khabri/client.ts` ×6 ·
`src/lib/darbaan/lock.ts` ×4 · `src/lib/nabz/github.ts` ×3 · `src/lib/autopilot.ts:33-58` (every chained op
`.catch(() => {})`).
**Bitten?** YES — this is the exact mechanism of CASE_STUDY 3.13/D73 (dead reasoning tier, 330 gates green),
D152 (JSearch wallet dead by day 8, silently), D153 (groq meter at 0 forever). Mitigations exist
(`dimaagHealth`, named sweep skips, `enhanceFailed` chip) but they are **per-incident patches on ~10 of the
76 sites**; the class survives everywhere else (sync failures, backup failures, autopilot failures are
still invisible).
**Systemic fix:** one `degrade(scope, reason, err)` sink that writes a health row; ban bare `catch {}` in
lint for src/lib except via that sink.

### CLASS C — UI/state desync after a failed or forgotten async write
**Root cause:** multi-field derived state persisted piecemeal; a later writer forgets a sibling field.
**Bitten?** YES — this was Session 7.2's headline (CASE_STUDY 3.31, D151: five recompile paths each dropped
a different persisted field; Nazar exclusions were never persisted at all). D151's cure (ONE
`recompilePacket` authority, plan persisted on the packet) kills it **for packets only**.
**Still alive (theoretical):** the autopilot chain (`src/lib/autopilot.ts:37-58`) fire-and-forgets
sweep/scan/pulse with swallowed errors — `lastSweepAt`/`radar:lastBoardScan` stamps are written in `.then()`
so a failure retries next window (good), but the user-facing "swept Xh ago" can show a *successful* stamp
from a sweep whose lanes all skipped (skips named only inside SweepYield); `src/screens/Radar.tsx:143`
(`update({isNew:false}).catch(()=>{})`) can desync the NEW badge from the DB on a locked/demo store —
cosmetic by design (I12 rejects), but the pattern is the same one that bit as 3.31.
**Systemic fix:** the D151 pattern generalized — any multi-step persisted state gets one write authority.

### CLASS D — `nabzCache` as an untyped string-keyed junk drawer
**Root cause:** one `{key, json, fetchedAt}` table (`src/db/db.ts:72,100`) hosts ≥8 unrelated concerns with
ad-hoc string keys and hand-rolled codecs: rotation counters `'jsearch:rotation'`
(`src/lib/khabri/client.ts:205-211`), `'jsearch:markets'` (:241), `'jsearch:yields'` (:252-289),
`'adzuna:rotation'`/`'adzuna:queries'` (:302-310), sweep flags (:652), seed flags (`src/db/seed.ts:178-188`),
GitHub rate-limit tombstones + README caches (`src/lib/nabz/github.ts:46-115,373,463`), board-scan stamp
(`src/lib/autopilot.ts:45-50`). Values are `String(n)` / `JSON.stringify` parsed back with no guard or
version tag.
**Bitten?** YES, adjacent: D152's rotation de-drift ("double-India, window-width advance") was exactly a
hand-rolled counter codec going subtly wrong; the D72 negative-cache lived here too.
**Systemic fix:** a typed KV module (`kv.get('jsearch:rotation'): number`) with per-key codec + default —
one file, every call site mechanical.

### CLASS E — duplicated rule, N copies (Part-4 #3, "one rule three copies")
**Root cause:** D22 forces every serverless function to be self-contained, so the origin/token guard +
`sha256Hex` is **hand-copied into 10 of 11 functions** (`api/darbaan.ts:22`, `api/dimaag.ts:78`,
`api/guru.ts:37`, `api/intel.ts:36`, `api/polish.ts:35`, `api/pulse.ts:36`, `api/vault.ts:27`,
`api/khabri/aggregators.ts:32`, `api/khabri/jobs.ts`, `api/khabri/signals.ts`; `api/gh.ts` is
deliberately ungated — documented at `api/gh.ts:14`).
**Bitten?** YES — D55 is precisely a drifted copy: `vault.ts` re-implemented the guard and gated GET on
Origin when `darbaan.ts` already knew not to. D153 found the *third* copy of `hasEvidence`; D151 unified the
identity-ban heuristic (compiler+forge). Client-side the concept-theme/dedupe rules now live once
(`src/lib/compile/overlap.ts`), `stemOf` once (`src/lib/polish/factGuard.ts:41`), slop list once
(`src/lib/jd/lexicon.ts:67`) — the client side is largely cured; **the api/ guard block is the surviving
N-copy rule**, held together only by the security test suite.
**Systemic fix within the D22 constraint:** a generated/templated guard block (build-time include) or a
conformance gate that diffs the guard bytes across functions so a drifted copy fails CI.

### CLASS F — unbounded tables (grow-forever storage)
**Root cause:** append-heavy tables with no pruning path.
**Evidence:** pruned: `dimaagCache` (cap 600→500, `src/lib/autopilot.ts:64-72`, added D153) · `backups`
(bounded 5, D49) · `jobs` (only via a **manual** button `src/screens/Radar.tsx:282` → `pruneStaleFinds`,
`src/lib/khabri/client.ts:666`, and Morcha clear-found `src/lib/morcha.ts:40`). **Never pruned** (grep for
`.delete/.clear` → 0 sites): `signals`, `dak`, `dimaagUsage` (a row per call, forever), `guruThreads`,
`pulse`, and `nabzCache` itself (tombstones + per-repo README caches accrete keys indefinitely).
**Bitten?** Not yet (single owner, ~weeks of data) — THEORETICAL, but it is the D64 shape (1,002 jobs
arrived faster than anyone predicted) applied to storage, and every one of these rides inside the encrypted
sync/backup payload (`src/lib/sync.ts`), so vault blobs grow monotonically too.
**Systemic fix:** one autopilot housekeeping pass with per-table retention (the dimaagCache pattern, applied
to all six).

### CLASS G — prompts and lexicons that are code when the architecture says data (see §4)
Partially alive; detailed in §4 because it is rot, not breakage.

---

## 3 · FRAGILITY RANKING — first breakages at 10,000 real users tomorrow

The app is local-first and single-owner by design (D46: ONE `SIFARISH_OWNER_PASSCODE` per deployment), so
"10,000 users" means 10,000 *self-hosted or demo* browsers plus per-user deployments. Ranked:

1. **The single-owner deployment model itself.** One env passcode = one owner; 10k users need 10k Vercel
   projects with 8 env secrets each (KEYS_GUIDE.md). The demo path scales; the *product* path does not.
   All 11 functions share one `SIFARISH_OWNER_PASSCODE` gate (`api/*/…:sha256Hex` sites) — there is no
   multi-tenant story, by explicit design (L5 "no multi-user"). First support ticket, day one.
2. **Shared anonymous GitHub pool through `/api/gh`.** The proxy is deliberately ungated (`api/gh.ts:14`)
   and keyless-safe → without a PAT, **every** demo visitor's Nabz traffic shares one 60 req/hr per-IP
   anon budget from Vercel's egress IPs; with a PAT, 5,000/hr shared across all visitors. Negative caches
   (`src/lib/nabz/github.ts:46-52`) soften per-browser, not per-fleet. Breaks within the first hundred
   concurrent demo sessions.
3. **One Gemini/Groq free-tier key behind `/api/dimaag` for every owner-mode user.** The router's quotas
   (Gemini lite 30 RPM; Groq 8K TPM — `api/dimaag.ts:12-14`) are per-deployment keys. Ten simultaneous
   re-forges = permanent `rateLimited` → the whole fleet lives on deterministic fallbacks (visible via
   D115, but degraded). Also `gemini-3-flash-preview` is a **preview** id pinned in prod (`api/dimaag.ts:26`).
4. **Gmail OAuth in Testing mode.** Sole-test-user consent screen (`src/lib/dak/gis.ts:10-12`,
   PROGRESS.md "Owner setup"): a 100-test-user hard cap, 7-day refresh-token expiry semantics, and the
   scary interstitial. Dak Khana is unusable for anyone but Shaurya without Google verification.
5. **IndexedDB eviction + browser diversity.** `storage.persist()` is *requested*, not granted (D49);
   Safari/iOS grant rarely and evict aggressively; recovery depends on the encrypted auto-backup and the
   owner-only blob sync — demo/keyless users have no restore path at all. The D97/D139 Windows-toolchain
   flakes hint at how much platform variance 10k browsers will surface.

(Honorable mention: Vercel Hobby is at 11 of 12 functions — one slot of headroom — and one Blob store
whose path derives from the single passcode, D54.)

---

## 4 · OBSOLESCENCE RISKS

1. **Pinned model ids (deliberate, D144 — note the tradeoff).** `api/dimaag.ts:21-27`
   (`gemini-3-flash-preview`, `gemini-3.1-flash-lite`, `openai/gpt-oss-120b/20b`), `api/guru.ts:12`,
   `api/polish.ts:15`. Pinning prevents silent model jumps under a schema (the stated reason) at the cost
   of guaranteed manual migration events — D35 proved deprecations arrive (llama shutdown 16-Aug-2026),
   and a *preview* id is pinned in the primary reasoning slot. The Law-12 session-start re-verify is the
   only defense, and it is a **process**, not a mechanism.
2. **Guru and polish bypass the free router.** Both are Groq-only single points (`api/guru.ts:12`,
   `api/polish.ts:15`); a Groq gpt-oss deprecation kills chat and polish to fallback while `/api/dimaag`
   would have survived on Gemini. The router exists; two of the three LLM entry points don't use it.
3. **Provider API shapes held only by casts + live probes on dated sessions.** JSearch/OpenWebNinja
   (`api/khabri/jobs.ts:134`, verified D18/D144), Adzuna (`api/khabri/aggregators.ts:145`, 19 markets
   D133), Tavily ×3 (`api/{intel,pulse}.ts`, `api/khabri/signals.ts`), 4 ATS feed shapes + WWR RSS parser
   (`src/lib/radar/feeds.ts`), SimplifyJobs JSON (D133). Zero runtime validation (Class A) means shape
   rot manifests as silent keyless degradation, caught only by the health badge or the owner's feel.
4. **Prompts: hybrid data/code — the split is real but incomplete.** DATA (rot-resistant, I13):
   craft patterns/exemplars ride `craftClauses` from `data/ustaad/library.json` into casting/surgery
   (`src/lib/darzi/editor.ts:127,243`), nazar (`darzi/nazar.ts:75`), forge (`nabz/forge.ts:217`),
   reframe (`polish/reframe.ts:45`) — a Pulse library update upgrades live craft with zero code. CODE
   (rots with the repo): the skeleton `SYSTEM` constants `src/lib/nabz/forge.ts:162` (~50 lines of rules,
   register bans, numbers-mandatory) and `src/lib/polish/reframe.ts:31`; the smart-Baithak
   `systemPrompt()` `src/lib/baithak/smart.ts:101`; Guru's dossier/system assembly (`src/lib/guru/*`,
   `api/guru.ts`); decide/critique/classify instruction blocks in `src/lib/dimaag/core.ts`. Every
   D104/D107/D117/D128-class craft improvement was a **code** edit to these constants — the "change
   arrives as data" seal (D43) is true for patterns, false for prompt skeletons.
5. **FORGE_VERSION as the vault-repair contract.** `src/lib/nabz/forge.ts:126` (`= 4`), stamped at
   `src/lib/nabz/github.ts:581`, consumed by `needsReforge`/RepairBanner (D140). Sound mechanism; the rot
   risk is procedural — a prompt/library improvement that forgets the integer bump silently never reaches
   any existing vault (exactly the D140 lesson), and nothing gates "forge inputs changed ⇒ version bumped".
6. **Seeds and hardcoded config.** Watchlist seed tokens (`src/lib/radar/watchlist.seed.ts`, probed live
   07/16-Jul — companies migrate ATS vendors and tokens 404 quietly into DORMANT); the hardcoded Google
   Client ID default (`src/lib/dak/gis.ts:15-17`); Gemini quotas knowable only from a dashboard
   (`api/dimaag.ts:12-14` comment) so ration math can drift from reality; `KEY_INFO` in Settings needing
   manual additions per provider (D153 fixed the last drift).
7. **Migration-flag accretion.** Every seed change ships a one-shot flag-guarded migration
   (`migrateHuntFreshness` D66, `migrateWatchlistV58` D112, ration migration D144, `backfillV2` at boot) —
   correct per D59, but the boot path now carries an ever-growing ordered chain that only ever grows and
   is tested only forward.

---

*End of audit. Findings only; no fixes were made. — Phase 1 complete.*
