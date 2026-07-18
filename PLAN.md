# PLAN.md — Session 7.2 "The Sanad" (सनद — the credential no one can question)

> Owner's brief: "har cheez ko improvement ki zarurat hai — shuru se shuru karna pade toh kar.
> Ek ek error main nahi pakdunga; the app must be intelligent enough to prevent them."
> Method: THREE read-only forensic audits ran before one line was planned — Darzi pipeline,
> discovery pipeline, full-app sweep (Guru/Baithak/Morcha/Dak/Nabz/Settings/Pulse/Briefing).
> Every item below is a VERIFIED file:line finding, not a guess. Per the owner's standing law,
> nothing is coded until he says go.

---

## 0 · WHAT THE AUDITS PROVED (the disease, named)

Session 7's machinery (typesetter, MMR+concept dedupe, Nazar, hunt rebuild, free router) is real
and wired on the default path — the audits confirm it. What remains is ONE disease in three coats:

1. **State amnesia.** The first compile knows everything (Nazar exclusions, summary, framing
   overrides, editorial plan); every LATER recompile — Baithak op, summary toggle, overrule,
   phase-2 failure — forgets a different subset. The résumé is only as good as its last
   recompile, and most recompiles are amnesiac.
2. **Arithmetic that lies.** Autopilot 6h sweeps × 6 JSearch credits = the 200/month budget dead
   by day ~8 — after which the ONLY LinkedIn-reaching lane runs zero times for three weeks,
   silently. The Groq budget bar is the mirror image: Guru/polish spend is neither gated nor
   recorded, so the bar reads 0/5000 forever. Both violate I8's "legible" clause.
3. **Gates guarding one door of a two-door room.** push() sanitizes the résumé — the cover
   letter never passes through it. MMR dedupes the page — polish mutates lines after it. The
   derived-hunt cap is sane — and silently discards every Europe/theme/dream-company hunt the
   vision derives. D136 fixed hasEvidence — in one of its two copies.

The structural counter (this session's one big idea): **make forgetting impossible, make spend
visible, make every gate the ONLY door.** Not new features — closures.

---

## WS-A · THE RÉSUMÉ: one compile authority, zero amnesia

**A1 — CompileIntent: one persisted truth every recompile reads.** ROOT FIX.
Five call sites re-assemble compile options ad-hoc (buildPacket, buildPacketFast, Baithak
recompile, setSummary, overrulePacket), each forgetting different fields. Persist ONE
`compileIntent` on the Packet — `summaryLine`, `excludedIds`, **`excludedBulletIds` (Nazar's,
currently never persisted)**, `bulletOverrides`, editorial plan — and every recompile path reads
it, changing ONLY the field its op targets.
Kills (audit-verified): Baithak ops silently dropping the professional summary; setSummary
dropping Nazar exclusions + framing rewrites; overrule dropping summary/exclusions/overrides;
set-entry discarding the editorial bullet plan.
Gate: one test per recompile path — summary+exclusion+override survive every op except its own field.

**A2 — The letter passes the same gates as the résumé.**
`composeLetter`/atelier read raw `p.summary`/bullets — the `vercel.app**` residue class renders
verbatim in letters today. Route every letter content line through the shared
`stripMarkdownResidue` + `cleanSummaryForDisplay`. Gate: dirty-vault fixture → clean letter.

**A3 — polishPacket re-enters the gate.** Post-compile polish writes LLM text straight into
compiled lines (no sanitizer, no overlap re-check). Same sanitizer + `bulletOverlap` vs the page;
violating polish → original line stands. Gate: mock polish returning `**bold**` twin → rejected.

**A4 — Phase-2 failure is visible; the fast packet gets the deterministic floor.**
If full buildPacket throws, the fast packet ships silently, never Nazar'd. Fix: run the Nazar
heuristic floor + red-team heuristics (zero-spend) on the fast packet, stamp `enhanced:'failed'`,
show a retry chip. Gate: forced phase-2 throw → floor results + chip present.

**A5 — Re-runs carry full context.** Baithak/overrule re-run `redTeamPass(text)` bare — no
decode/archetype/inventory (weaker than first compile, D124's payload law). Thread them from A1's
stored intent. Gate: recompile red-team payload contains decode.

**A6 — The summary stops being one static line.** `professionalSummary()` ignores the JD; every
company gets an identical sentence. Deterministically pick the emphasis clause from the decode's
top must-have theme (zero LLM, same I1 guard). Gate: two JDs → two emphases, no project names.

**A7 — cleanSummaryForDisplay reaches education/achievement/cert lines + Shelf display.**
(URLs/status labels currently render raw on those kinds.)

**A8 — One identity-ban token heuristic.** Compiler and forge use two different name-token rules;
export one function, both call it. Gate: shared fixture rejects at both sites.

**A9 — Editor's surgery dedupe upgraded to the concept-aware primitive** (today lexical-only —
compiler saves the page, but the plan wastes reasoning tokens proposing twins).

## WS-B · THE HUNT: arithmetic that closes, depth that earns page 2

**B1 — Daily rationing: the budget must survive the month.** ROOT FIX.
Per-lane daily allowance = floor(monthlyCap/30) (jsearch 6/day, adzuna 10/day); a sweep spends at
most today's remaining ration; keyless lanes always run (freshness at ₹0 continues even when
keyed lanes rest). Gate: simulated 30 days × 4 sweeps/day → spend ≤ cap AND keyed lane still
alive on day 30.

**B2 — Budget exhaustion is LEGIBLE.** SweepYield gains `skipped:{lane,reason}`; Radar's swept-line
and Hunt-now toast name skipped lanes ("JSearch: aaj ka ration spent — kal fir"). Gate: exhausted
→ yield + UI show it.

**B3 — Depth where it pays.** A hunt whose last run yielded ≥6 relevance-scored roles earns
page=2 on its next funded run (1 extra credit, ≤2 deep-hunts/sweep, inside the ration).
Deterministic + visible ("depth 2"). Gate: promotion logic + ration respected.

**B4 — The vision's whole net syncs.** Cap-14 is consumed by role-variants; Europe/theme/
dream-company hunts NEVER reach savedHunts (D69's disease one layer deeper — built, gate-tested,
unreachable). Class quotas (roles 8 · regions 2 · themes 2 · dream 2, cap 16). Hunt-panel accepts
get `derived:true` so Pulse retirement (D123) reaches them. Gate: default vision syncs ≥1 of each
class; panel-accept marked derived.

**B5 — JSearch honesty + rotation de-drift.** (i) `datePosted:'all'` currently silently becomes
'month' — honor the owner's explicit choice. (ii) Rotation offset advances by window width (not
+1 → 4/5 overlap today) and never double-funds India in slots i>0. Gate: 15 markets in 3 sweeps,
no double-India.

**B6 — The dedupe key stops eating role identity.** STOP_TITLE strips engineer/scientist/intern/
senior/junior → "Senior ML Engineer" and "ML Engineer Intern" collide and the newcomer is
DISCARDED without refreshing the survivor (stale staleness persists). Keep discipline+seniority in
the key; on duplicate, refresh survivor's updatedAt/salary from the fresher sighting. Gate: both
roles survive; re-seen role's staleness heals.

**B7 — Board scans join the dedupe.** syncRadar writes by raw id → the same role can hold TWO
cards (aggregator + board). Board version wins on collision (board-verified > ghost) and absorbs
the aggregator card's status/history. Gate: aggregator find + later board scan → one card.

**B8 — Lane-fit queries.** Remotive gets the ≤3-word derived core (full hunt phrases return ~0
today); Adzuna pairs each country with a ROTATING query index so every market meets every core
over ~n sweeps. Gates: both mappings unit-tested.

## WS-C · THE REST: honest meters, no dead ends, one copy of every rule

**C1 — The Groq meter becomes honest (I8).** streamGuru + polishPacket/polishDoc spend with NO
`allowedThisRun('groq')` gate and NO recordSpend — the Settings bar reads 0/5000 forever while
real calls burn. Gate + record both; thread the router's `model` field into recordUsage rows so
the Dimaag Ledger finally says WHICH free brain answered (Gemini flash / Groq 120b — the D144
observability gap). Gate: a Guru turn moves the meter; ledger rows carry provider.

**C2 — "Mark applied" marks applied.** Morcha's board button calls bare setJobStatus — no
appliedAt stamp → day-7/14 nudges never fire, "applied Nd ago" never renders, weekly counts
under-count. Route through markApplied. Gate: board-move → nudge math works.

**C3 — Guru remembers.** `db.guruThreads` is declared, backed up, cloud-synced — and never
read/written; chat evaporates on screen switch. Persist + restore the last thread. Also: LLM-path
replies drop citations (I7 exists only on the keyless path) — carry them through. Gate: thread
survives remount; streamed reply keeps citations.

**C4 — Letter-Baithak parity (the third copy of the same dumbness).** Its hasEvidence never got
D136's widening (summary/README context) and it has NO smart-LLM fallback (pre-D53 state). Share
`baithak/intent.ts`'s evidence fn; add the guarded smart fallback with letter context. Gate: the
22-utterance contract runs against the letter surface too.

**C5 — One addHunt().** Three sites (Guru derive_hunts, Settings VisionDerivation, Khabri signal)
still write `datePosted:'month'` (D66's exact bug re-introduced) and omit `derived`/`ownerSetDate`
(so D123 retirement can never reach them). One helper owns id-prefix + freshness + flags; all
four call sites use it. Stale Guru copy ("toggle in Khabri") updated to the Radar (D138 one-home).
Gate: every creation site yields week-window, retirement-eligible hunts.

**C6 — Guru's open_radar action gets legs** (defined, returned, never executed — a dead-end
reply). Wire nav; every Guru action names a door that opens. Gate: action → screen switch.

**C7 — Identity honesty on every surface.** Guru GREETING hardcodes "Namaste Shaurya" (demo sees
it); applyPlan hardcodes the 2027 window + attachment name that drifts from the real export name.
Read identity + visionProfile. Gate: demo → Arjun everywhere; vision edit changes the drafted answer.

**C8 — probeAlive uses /api/gh** (direct api.github.com fetch re-introduces the D86 console-404
class + burns the 60/hr unauth budget the proxy exists to protect).

**C9 — Dak tells the truth.** Expired token ≠ "Nothing new — the watchman keeps watching" (it
prints exactly that today). Distinguish auth-expired → "Reconnect Gmail" chip. Gate: 401 → honest
state, legal action offered (I6).

**C10 — The keyless repair loop closes.** A keyless owner can click "Re-forge N" forever
(deterministic passes never stamp forgeVersion) and each click re-tailors EVERY packet for zero
content change (token spend on the keyed path). Stamp deterministic completion distinctly; only
stamp lastReforgeAt when something actually upgraded. Gate: keyless re-forge → banner clears, no
packet churn.

**C11 — Onboarding lands on the promise.** `void onDone` — the wired first-packet handoff (L7,
60-second law) is explicitly discarded; finish() dumps the user on the Shelf. Honor the callback.

**C12 — Sweep the small lies.** forceAddRepo dead export deleted (D125's own rule); stale
provider copy fixed (Why.tsx "gpt-oss-120b", health.ts "check the Groq key", budget label,
Settings KEY_INFO missing ADZUNA/GEMINI); keyless intel gets a negative cache (every buildPacket
re-POSTs today); RepairBanner catch; Guru pulse digest filters dismissed; dimaagCache gets a
size-capped prune; QuickAdd popover anchored; Briefing scoring memoized off jobs identity;
draftFollowUp reachable any day (not only while the nudge is due); RetroPanel's Taleem line
becomes a nav link.

## WS-D · PROOFS (§14 — all four, executed, pasted)

1. **Machine:** full gates + tsc + warning-free build (592 current + ~30 new).
2. **Fresh-eyes:** wiped profile, 3 breakpoints, ERRORS(0).
3. **Adversary:** no-Origin 403 / fabricated token keyless / demo ₹0 + Arjun / owner happy path.
4. **Money:** no new fetch sites; B1 ration simulation output pasted; C1 meter movement shown.
Plus the D140 law: the live tailor proof runs on the REAL vault through prod, and DONE is
declared only after the served-hash check.

## Sequencing

1. **A1 first** (the intent object) — root under four defects; then A2-A9.
2. **B1+B2 together** (ration + legibility), then B4, B6+B7, B3, B5+B8.
3. **C1-C5** (the meters + the copies), then C6-C12.
4. WS-D, CASE_STUDY.md 3.31, PROGRESS.md, decision lines D151+, deploy, served-hash verify,
   ONE "✅ DONE" — no roadmap, no open list (owner-communication rule).

Checkpoint commit per workstream. No new metered surface anywhere in this plan.
