# ARCHITECTURE — SIFARISH v2 (05-Sep-2026)

> Input: RESEARCH.md v2 verdicts + DECISIONS.md V2-1 pillars. Verdict up front: **the plumbing
> survives; the thinking layer is torn down and rebuilt as typed artifacts.** What is kept was
> re-verified, not inherited (776 gates green on 05-Sep, tsc clean, deploy path proven 30-Aug).
> The 30-Aug ARCHITECTURE section below this one remains the record of the kept plumbing.

## System sketch

```
POSTING (whole page) ──► READING (values: cares / does-not-care / reader / window / skills)
DOSSIER (facts of any kind + README claims) ──► DIGEST (curated ≤6k tokens, deterministic)
READING + DIGEST ──► GAME PLAN (three lines · section order · played/benched+reason · skills rows
                     assembled from JD ∩ evidence · framing per project · reveal decision)
GAME PLAN ──► COMPILER (executes the plan; spacing tightens before content; page 2 before any
              true fact is dropped) ──► PDF (Times, 36pt, link annotations) + DOCX + parse-back
CRITIC (hostile recruiter, own rubric) ──► one bounded revise of the plan ──► re-execute
Brains: Gemini 3.8-flash (deep) → Gemini 3.7 → Groq gpt-oss-120b (chunked) → deterministic floor
Everything else (Darbaan identity, encrypted vault, discovery lanes, Dak gmail.readonly, Ek Baat
op registry, deploy) is KEPT and extended; zero new Vercel functions.
```

## The state authorities (named; the second copy of a rule is a fork of its bugs)

1. **`GamePlan`** (new, `src/lib/strategist/plan.ts`) — THE object the page executes. Persisted on
   `Packet.plan`. The compiler renders exactly `plan.played` in `plan.sectionOrder` with
   `plan.skills`; it may tighten spacing and add a page; it may not bench. A fact benched without
   a reason fails validation (`validatePlan`). Baithak/Ek Baat overrides mutate the plan (one
   door: `recompilePacket`), never the page.
2. **`Reading`** (new, `src/lib/strategist/reading.ts`) — the posting understood once: cached by
   posting hash (dimaagCache), persisted on `Packet.reading`. The old `JDDecode` survives INSIDE
   it as `reading.skills.must/nice` (lexicon floor) — one decoder, extended, not two.
3. **`buildDigest()`** (new, `src/lib/strategist/digest.ts`) — the ONE function that turns the
   dossier into what a brain reads. Deterministic, capped, includes every fact id. Nothing else
   serializes the ledger for an LLM.
4. **`derivedSkills()`** (new, `src/lib/dossier/skills.ts`) — the ONE source of "what is true
   about him, skill-wise": union of project stacks, bullet keywords, tags, skill entries, sworn
   facts. The page's skills rows = plan.skills, each item carrying the factIds that prove it.
   The stored skill list is evidence, never a rendered list.
5. **`measureLine()` / `recompilePacket()` / `eligibility()` / `opRegistry` / `pehchaan`** — kept
   authorities (30-Aug), unchanged in role. `opRegistry` gains: `add-fact` (any kind; creates the
   section), `create-section`, `plan-play`/`plan-bench` (packet-scoped), `retailor`.

## Choke points & enforcers (money · identity · privacy) — unchanged + one addition

- Metered spend: 8 keyed functions require origin allowlist + x-sifarish-token (server env).
  The strategist rides `/api/dimaag` (tier `reasoning`) — NO new function, NO new key.
  Budget: 3 calls per posting (reading, plan, critic) + 1 revise, all content-hash cached.
- Groq lane guard (new, in `/api/dimaag`): a request whose estimated prompt tokens exceed 6,000
  skips Groq (8K TPM, RESEARCH v2 verdict 6) and goes Gemini → floor. Observable: the response
  names the lane that answered (`model`), the packet prints it (`Packet.strategistMode`).
- Darbaan: demo vault stays read-only at the DBCore layer. Ek Baat in demo PROPOSES and says
  "demo cannot write". The demo showcase (Babaclick worked example) is a pre-built packet on the
  fictional persona — no live spend.
- Vault sync/backup: every NEW field rides existing tables (`packets`, `ledger`, `settings`,
  `dak`); `USER_TABLES` unchanged → sync/backup parity holds by construction; the parity gate
  stays.

## Data model deltas (≤10 lines)

```
LedgerEntry.kind: EntryKind | (string & {})   // schema-less kinds; known kinds keep their typing
LedgerEntry += sworn?: 'owner'|'readme'|'seed'  // provenance of the fact
Settings   += sections?: {kind,label,order}[]  // sections registry (created on demand, persisted)
Settings   += pagePolicy?: 'one'|'two-ok'      // default 'two-ok' (owner: "thode bade chalega")
Packet     += reading: Reading · plan: GamePlan · strategistMode: 'gemini'|'groq'|'heuristic'
            · pages: number · critic?: {verdict, issues[], revised: boolean}
CompiledResume += pages?: number; CompiledLine += link?: string   // annotation target
DakCard    += statusVerdict?: 'received'|'under-review'|'rejected'|'interview'|'offer'|'other'
Job.score  gains parts 'freshness' (gate) and 'window' (multiplicative cap) — same ScoreBreakdown
```

## Failure modes & their visible notices

- Gemini 429/5xx → next lane; all lanes down → deterministic Reading (values lexicon over
  sentences) + deterministic Plan (rules) → `strategistMode:'heuristic'` printed on the packet
  header + gap note "built by the template strategist — reopen when a brain is free".
- Plan validation failure (unknown factId, unreasoned bench, section not in registry) → the op is
  discarded, the reason shown in the packet's Played/Benched board; the deterministic plan is the
  fallback, never an empty page.
- Page 2 spill → `Packet.pages=2`, badge on the packet and in the PDF filename; the plan's
  "tighten" ladder ran first (visible in the board: "spacing tightened to level N").
- README fetch fails (GitHub 403/rate) → the last stored `context` is used, stamped with its
  `readAt`; the dossier shows "README last read <date>".
- Dak status parse miss → card keeps `statusVerdict:'other'`, rendered as "reply — read in Gmail".
- Critic call fails → packet marked `critic.verdict:'skipped'` and says so; never silently "ready".

## Design laws for this cycle

- **The plan is the promise.** Every visible choice on the page traces to a plan line with a
  reason; the Played/Benched board is the interface (LAW 1 of the Sutradhar constitution, adopted).
- **Invent nothing, suppress nothing.** A skill renders only with factIds; a true, relevant fact
  benched without a reason in the company's words is a defect of the same severity as a lie.
- **The wire is the deliverable.** Strategist runs on the DEFAULT tailor path (fast packet →
  reasoned packet), not behind a button.
- **Observable degradation.** Mode printed on the artifact; lane named in the usage ledger.
- **Two-sided honesty.** Reading gates: accept "we care about X" AND reject "we don't care about
  Y" being read as a care; skills gate: JD skill with evidence renders, without evidence never.
- **Zero slop is a gate**, not a wish: the slop scanner runs on the three lines, every bullet, and
  every plan reason; a hit fails the compile.

## STACK LOCK (verified 05-Sep-2026 — RESEARCH.md v2 verdicts 6, 9)

- KEEP: Vite 8.1 · React 19.2 · TypeScript 5.9 (7.0 is a compiler rewrite — not this cycle) ·
  Dexie 4.4 · pdf-lib 1.17.1 (link annotations via Annots/Link/URI — API confirmed) · docx 9.7 ·
  pdfjs 6.1 parse-back · Tailwind 4.3 · Vitest 4.1 (5.0 is days old — not this cycle) · Vercel
  Hobby static + the same 10 functions.
- ROUTING (data-level, routing.json v1.2.0): reasoning → gemini-3.8-flash, gemini-3.7-flash,
  openai/gpt-oss-120b · classify → openai/gpt-oss-20b, gemini-3.5-flash-lite · new budgets
  `reading` / `plan` / `critic`.
- ADD: zero new runtime dependencies.
- WHY: every reference in recon that ships is boring; the clock is the binding constraint; the
  renderer/discovery plumbing has 776 gates behind it and the owner's complaint is upstream of it.

## Contradictions found & resolutions

1. I1 "invent nothing" × B.4 "skills chosen per JD, not maintained" → skills are DERIVED from
   evidence (authority 4) and SELECTED per Reading; a JD skill with no evidence → gap note.
2. "Every true fact on the page" × one page → page 2 allowed (Settings.pagePolicy, default two-ok);
   the plan may bench WITH a reason in the company's words; an unreasoned bench is a gate failure.
3. "Chalaak reveal" × "AI-written résumés get rejected" (verdict 2) → the reveal is an evidence
   line about a shipped project ("built Sifarish, the evidence-compiled résumé system that produced
   this page"), decided per posting by `plan.reveal`, never a "generated by AI" stamp.
4. "Talk to it anywhere" × Darbaan demo read-only → chat proposes in demo and names the wall.
5. Deep pass on Gemini × keyless core (I4) → deterministic Reading + Plan floor, mode printed.
6. Multi-page × I5 parse-back → parse-back already concatenates pages in order; the one-page gate
   becomes "pages ≤ policy" and asserts the tighten ladder ran before the spill.
7. Schema-less kinds × typed compiler sections → the sections registry maps kind → heading;
   unknown kinds render as a titled bullet section in the plan's order; the compiler never
   switches on a closed enum again.

---
---
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
