# PLAN.md — Session 6 "The Final Form" (17-Jul-2026)

Contract: the two S6 mega briefs + the 27-point MAINE SAMJHA. Work until every defect and P-item
is closed; Four Proofs; deploy + verify served; ONE ✅ DONE. Baseline verified green at session
start: 471 passed | 2 skipped · tsc clean · warning-free build · prod 200 · no-Origin 403.

Investigation done first (4 read-only code agents + 3 web-research agents). Root causes below are
verified at file:line, not assumed.

## WS-1 · The résumé, final form (Defects 1–4 + library v1.2.0)

**D1 Quantification** — root cause: bullet scoring never weights digit-bearing bullets.
- `darzi/editor.ts` surgeryPass: add metric bonus to bullet score (digit in text or metrics).
- `compile/compiler.ts` bulletsFor fallback sort: same numbered tie-break.
- `nabz/forge.ts` SYSTEM rule 4: numbers become MANDATORY when the README states them (drift guard
  already permits them — they're in the source).

**D2 Keyword phrasing gaps** — root cause: ¶honest-keyword-mirroring lacks `forge` in its passes;
forge.ts:170 actively forbids market vocabulary; detectDrift would nuke stem variants.
- library.json: add `forge` to the pattern's passes.
- forge SYSTEM: allow the market's standard term when the README truthfully supports the concept
  (embedding search → "embeddings"); never a term with no basis.
- factGuard.detectDrift: accept morphological stems of tech vocab the source already contains
  (orchestrator→orchestration, embedding→embeddings). Invented tech still dies.

**D3 Typesetting** — compiler.ts: word-boundary truncation for the project description (was
`.slice(0,160)` mid-word); education renders ONE coherent line per entry (no orphan year meta);
positions render as separate bullets (no `;`-joined run-on); cert summary period-in-parens cleanup.
Then render a real PDF, extract it, READ it. I5 parse-back stays 100%.

**D4 Framing** — forge SYSTEM sharpened with the new library patterns (reader test already in);
broaden DEFENSIVE_LEAD modestly; new studied patterns ride via craftClauses (payload-verified).

**Library v1.2.0** — research agent is aggregating patterns from hired-résumé sources
(r/EngineeringResumes, university guides, hiring-manager teardowns). Merge as cited, dated
patterns with pass wiring.

Gates: quantification >0 whenever an eligible numbered bullet exists; screenshot scenario ≥85;
no rendered line ends mid-word; re-forge carries README numbers + market terms; parse-back green.

## WS-2 · Discovery — outperform LinkedIn, measurably

- **Board-verified-open softens staleness (his point 5):** `syncRadar` stamps `lastSeenOpenAt` on
  every job present in the board scan's openIds; `stalenessPart` softens the deduction (cap ~-8)
  when the board verified the posting open recently, with the why rendered (L4). Cache key gains
  the flag. Gate: 90-day-old board-verified posting outranks the equal aggregator ghost.
- **JSearch depth (P7):** employment_types param wired; hunt ROTATION (persistent offset, like
  Adzuna's markets) so hunt #11+ is never starved forever.
- **Adzuna depth:** `max_days_old` + `sort_by=date` params (freshest first, matching hunt windows).
- **Dream-company hunts (P7):** `dreamCompanies` on VisionProfile + Settings UI + deriveHunts emits
  per-company aggregator hunts ("{company} AI engineer") — the lawful door to Workday/custom-ATS
  companies (D122 proved their boards have no public feed).
- **Vision-first alerts (his point 3):** BriefingMatch gains `freshForVision`; briefing + Radar show
  the "naya, tumhare vision ka" flag the same session a sweep lands an on-vision role.

## WS-3 · Speed + tokens, zero IQ traded (Defect 5)

- Parallelize the 3 independent surgeryPass calls (`Promise.all`); red-team ∥ signature decision.
- Red-team fast-path: heuristicChecks run FIRST; a heuristic REVISE needs no model; cache by
  resume hash already exists (verified).
- De-duplicate castingPass payload (projectBrief serialized twice at 700+900).
- Meter smart-Baithak into dimaagUsage (currently a metering blind spot).
- Timings measured in the live tailor proof (before/after pasted in the report).

## P-items

- **P1:** capability matrix (research done) + ship the lawful top picks: follow-up DRAFT at the
  day-7/14 nudge, referral-ask outreach variant, post-rejection retro (shared-gap aggregation on
  Morcha verdicts), weekly hunt-state line in the briefing.
- **P2:** Baithak genuine-ask fixture ≥20 utterances (Hinglish/vague/compound/questions); 0 false
  refusals gate; compound multi-op verified.
- **P3:** slop audit fixes: `core.ts` filler defaults ("Reasoned against the stated criteria"),
  formulaic heuristic why, binary benched strings, gap-note cadence; conversational tells added to
  the scan where mechanically checkable.
- **P4:** hunts live ONLY on the Radar (Khabri's duplicate aside becomes a link); Settings' Dak
  note becomes a working link; Briefing matches link to the Radar.
- **P5:** ≥5 owner-grade QoL wins from a heavy-week walkthrough (batch actions, counts, sorts).
- **P6/P7:** honest coverage map + per-lane parameter tables in the report.
- **P8:** dimaagUsage per-feature table before/after from the live proofs.
- **P9:** full adversary set re-run against the FINAL deploy.

## Order of work
1. WS-1 code (editor/compiler/forge/factGuard/quality) + regression tests.
2. WS-3 (same files, same sitting).
3. WS-2 (feeds/score/client/vision) + tests.
4. P2/P3/P4/P5 + P1 ships.
5. Library v1.2.0 merge (when research lands) + payload verification.
6. Docs (CASE_STUDY S5.8→S6, CLAUDE.md D127+, PROGRESS).
7. Four Proofs → deploy → verify served hash → push → ONE ✅ DONE.

---
(Prior plans are preserved in git history; this file describes the current session only.)
