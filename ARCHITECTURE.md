# ARCHITECTURE — SIFARISH re-brief (30-Aug-2026)

> Input: RESEARCH.md re-brief verdicts + DECISIONS.md RB-1 pillars. Supersedes the executed
> S7.3 phase plan. Verdict up front: **the core survives review — no teardown.** The five
> pillars land as extensions inside the existing system; the ruinous-to-change decisions are
> locked below.

## System sketch

```
Browser (Vite+React+TS, Dexie local-first, owner/demo split vaults)
 ├─ Discovery: ATS feeds + keyless lanes (direct) ─┐
 │  keyed lanes → /api/khabri/{jobs,aggregators}    ├─→ normalize+dedupe+ELIGIBILITY → jobs table → score → Radar/Briefing
 │  Dak (gmail.readonly): replies + NEW LinkedIn-alert parsing ┘
 ├─ Darzi: ledger → decode(JD) → editor(cast) → COMPILER (I1/I5/one-page) → SEGMENT RENDERER (pdf-lib Times register) + docx
 ├─ EK BAAT agent: deterministic router FIRST → LLM lane (/api/guru stream, /api/dimaag ops) → typed OP REGISTRY → validated apply
 ├─ Apply Cockpit: packet → dossier field-map → bookmarklet prefill / mailto / copy panel → PRE-FLIGHT → human submits → Mark-as-Applied
 └─ /api/darbaan (identity) · /api/vault (E2E sync) · /api/{polish,intel,pulse,gh,guru,dimaag,khabri×2} — 10 functions, cap 12
```

## The state authorities (named — the second copy of a rule is a fork of its bugs)

1. **`opRegistry`** (new, `src/lib/agent/ops.ts`): THE typed vocabulary of every mutation the
   agent surface can perform. Consumed by the deterministic parser, the LLM schema, and the
   executor — three readers, ONE definition. Baithak's `EditOp` union migrates in; nothing else
   may define an op.
2. **`measureLine()`** (extended `compile/helvetica-metrics.ts` → `metrics.ts`): the ONE width
   model, now segment-aware (font × weight per segment, Times + Helvetica AFM tables). Compiler
   estimate and pdf renderer both call it; the D158 parity gate (never under drawn width, ≤2%
   over) extends to segments and Times.
3. **`eligibility()`** (new, `src/lib/khabri/eligibility.ts`): computed ONCE at the normalize
   choke point, persisted on `Job.eligibility`, never re-derived downstream. Score/Radar/agent
   all read the stored verdict.
4. **`recompilePacket()`** stays the single recompile authority (S7.2 law) — cockpit dossier and
   agent ops both route through it.
5. **`pehchaan`/Darbaan** stay the identity authority — unchanged, re-verified not re-opened.

## Choke points & enforcers (money · identity · privacy)

- Metered spend: 8 keyed functions require origin allowlist + x-sifarish-token (server env) —
  UNCHANGED; new pillars add ZERO new metered surface (agent rides guru/dimaag; alert-lane is
  client-side Gmail; bookmarklet is a generated client artifact).
- Gmail: `gmail.readonly` remains the ONLY scope; token in memory; the I3 grep gate (send-scope
  strings banned across src/+api/) now ALSO walks the bookmarklet source.
- Bookmarklet: generated from packet data in-browser; may contain NO key material, NO fetch to
  our API, and NO `submit()`/`.click()` on submit controls — enforced by a dedicated gate
  (structural, not promised).
- Vault: E2E encryption unchanged; every NEW/CHANGED Dexie table (job.eligibility rides `jobs`;
  agent threads unify into `guruThreads`) must be added to the sync/backup table list in the
  same commit that creates it (gate asserts table-list parity with the schema).

## Data model deltas (≤10 lines)

```
Job        += eligibility: { verdict: 'eligible'|'ambiguous'|'ineligible',
                             reason: string, source: 'field'|'jd-text'|'none' }   // persisted at ingest
Packet     += applyDossier: { fields: {label, value, ledgerIds?}[], atsKind?, mailto? } // derived, cached
AgentThread = guruThreads (existing table): messages + proposed/applied ops (Baithak threads merge in)
VisionProfile += workAuth: { homeCountry:'IN', authorizedIn:['IN'], remoteOk:true }     // seeded, editable
```
No new tables. No schema version bump beyond Dexie's additive field pattern.

## Failure modes & their visible notices (observable degradation)

- Eligibility classifier uncertain → verdict `ambiguous` + demote-with-reason; NEVER `ineligible`
  without named evidence (source+phrase stored). Radar shows "hidden as ineligible: N →" opening
  the hidden list. Two-sided honesty gates ship WITH the guard: a false-hide test (eligible role
  with "visa sponsorship available") and a false-show test ("US citizens only" role).
- LinkedIn-alert parse miss → card renders as "unparsed alert (open in Gmail)" — counted, never
  silently dropped; Dak's expired-token notice pattern reused.
- Bookmarklet on an unknown/changed ATS form → fills what it matched, reports "N of M fields —
  finish by hand", dossier copy panel always present as the floor. An ATS DOM change is a rot
  event: the cockpit shows per-ATS last-verified dates.
- Segment metrics drift → the extended parity gate fails red at build, not on his PDF.
- JSearch /search-v2 cursor failure → lane skip named in SweepYield (existing ration pattern).
- LLM op emission invalid (bad ledgerId/unknown op) → op discarded + agent says which validation
  failed; deterministic router remains the keyless full path (I4).

## Design laws (adapted set for this cycle)

- The wire is the deliverable: every pillar lands on the DEFAULT path (agent replaces both chats;
  eligibility runs in every lane's ingest; cockpit lives on the packet screen) — a capability
  reachable only from Settings is NOT BUILT (the D69 disease, pre-outlawed).
- Structural impossibility: submit-is-human is enforced by gates on the artifact, not by policy.
- Two-sided honesty: eligibility, op validation, and drift guards each get accept-true AND
  reject-false tests the day they ship.
- Storage is not integration: a verdict/dossier/op not in the payload or on screen doesn't exist.
- Observable degradation: every fallback names its mode (badge + errlog), per S7.3 law.

## STACK LOCK (verified 30-Aug-2026 — RESEARCH.md verdicts 5-7)

- KEEP (survives adversarial review): Vite+React+TS · Dexie · pdf-lib + docx + pdfjs parse-back ·
  Vercel Hobby static + 10 self-contained functions (cap 12: **budget = spend NO new slot this
  cycle**) · Groq gpt-oss-120b/20b + Gemini chain via routing.json · Tailwind tokens · Vitest.
- ADD: **zero new runtime dependencies.** Times register = pdf-lib StandardFonts (no embedding);
  bookmarklet = generated string; alert-lane = existing Gmail client; agent = existing endpoints.
- DATA-level upgrades queued (not code): routing.json head → gemini-3.7-flash; qwen/qwen3.6-27b
  as fourth free brain; JSEARCH_PATH → /search-v2 (+ cursor handling IS code, small); Jobicy
  count 200.
- Version pins: unchanged from package.json (all healthy per audit); Law-12 re-verify at each
  arc open.

## Contradictions found & resolutions (attack 1)

1. Brief "auto-apply" × Charter "account loss is irreversible" → resolved by evidence: prefill
   ceiling, human submit (DECISIONS RB-1 open call 1).
2. Brief "never surface ineligible" × standing "demote never hide" → hide only on CONFIRMED
   evidence + visible count; ambiguity demotes with reason (open call 2).
3. "One Claude-like conversation" × "deterministic router owns honesty" → router runs FIRST on
   every turn (refusals/I9 pre-LLM); LLM freedom lives in phrasing + op PROPOSAL; ops validate
   against the registry + real ledger ids before apply. Freedom in words, determinism in writes.
4. LaTeX register × D5 "deliberately plain because the parser reads first" → research shows the
   parse-killers are columns/tables/graphics, not serif/bold; D5 narrows to "single column,
   standard fonts, no graphics" — logged as RB-2 in DECISIONS.md.
5. Bold-inline runs × I5 byte-parity parse-back → segments concatenate in draw order; parse-back
   compares text content (unchanged); width model becomes per-segment (authority 2). No conflict
   left standing.
