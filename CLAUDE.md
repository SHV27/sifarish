# CLAUDE.md — SIFARISH (सिफ़ारिश) · v2

## Commands
- Gates: `npx vitest run` (830; `SIFARISH_MATRIX=1` deep) · Types: `npx tsc -b` · Build: `npm run build`
- Eyes (mandatory at arc close): project skill `resume-eye` — render a packet to PNG and READ it; `--live` for the Gemini pass.
- Deploy + served-hash proof: project skill `ship-verify`; deploy = `VERCEL_TOKEN=… node scripts/rest-deploy.mjs` (token from the shell, never a file).
- Live proofs on HIS data: `scripts/owner-packet-proof.mjs` (SIFARISH_PASS from env) · `scripts/owner-smoke.mjs` · `scripts/demo-smoke.mjs`.

## What this is
A studio of personal agents for one student: the whole posting is READ (what the company says it
cares about / does not), a typed GAME PLAN plays or benches every true fact with a reason in the
company's words, the PAGE executes the plan at full size, the HUNT ranks fresh roles he can actually
take, and the DESK shows where every application stands. Law: **invent nothing, suppress nothing;
the plan is the interface.** Taste bar: a founder who reads 100 résumés picks up the phone.
Non-negotiables: (1) I1 — every line carries fact ids; a true relevant fact benched without a reason is
a defect of the same class as a lie; (2) no unattended submit anywhere, Gmail readonly (I3);
(3) keyless core — every feature runs with zero keys; the packet prints which brain built it (I4).

## Architecture (authorities & choke points)
- Brief: VISION-BRIEF-sifarish-v2.md (Appendix A = the acceptance scene). Plumbing kept from v1.
- Authorities: `GamePlan` (strategist/plan.ts — the compiler executes it, never re-decides) ·
  `Reading` (strategist/reading.ts — one decoder, lexicon floor inside) · `buildDigest()` (the only
  ledger→brain serialisation) · `derivedSkills()` (dossier/skills.ts — skills are evidence, never a
  list) · `recompilePacket()` (the only recompile door) · `scoreJob()` ceilings (radar/score.ts) ·
  `syncPayload()` (the cloud carries his story; local stays complete) · `pehchaan`/Darbaan.
- Brains: `/api/dimaag` (Node runtime, maxDuration 90) → gemini-3.8-flash → 3.7 → Groq (skipped
  above 24k chars: 8K TPM) → deterministic floor. routing.json + prompts/registry.json are the truth.
- The page: 36pt margins, embedded Tinos (public/fonts, pre-subsetted; width tables generated from
  them), link annotations with visible text, tighten ladder + 6 fact-neutral steps before page 2.
- 10 Vercel functions; 8 keyed ones share byte-identical guards (drift gate). New Dexie fields ride
  existing tables; USER_TABLES is the sync/backup list.

## The Verifier (definition of done — every arc close)
1. Machine: gates green + tsc clean + warning-free build; every guard ships accept-true AND reject-false tests.
2. Wire: reachable on the DEFAULT path — else NOT built.
3. Eyes: `resume-eye` PNGs read (Babaclick + an ordinary posting); 3 breakpoints; zero console errors.
4. Live: deploy → served hash → owner proof on HIS vault (no 4xx/5xx in the console) → demo ₹0.

## Iron rules
- Plan before multi-file changes; one item at a time; PROGRESS.md at every boundary.
- Code patches go through files (Write tool → run), never shell heredocs: this shell mangles
  backslashes (a `\b` became a backspace byte and a ceiling silently never fired). Byte-scan for
  U+0008 before committing.
- 2 failed attempts on one path → stop, name the bug's CLASS, fix at the choke point.
- Verify volatile facts live at each arc open; log in RESEARCH.md. Secrets: env only (D108).
- The second copy of a rule is a fork of its bugs — extend the authority.
- Demote, never hide; hide only on CONFIRMED ineligibility, with a visible count.
- Never commit shots-eye/, shots-eye-live/, shots-owner/ — they carry his data.

## Stack (verified 05-Sep-2026 — RESEARCH.md v2 verdicts)
Vite 8 · React 19 · TS 5.9 · Dexie 4 · pdf-lib 1.17 + @pdf-lib/fontkit (Tinos embed) · docx 9 ·
pdfjs 6 parse-back · Vitest 4 · Playwright · Vercel Hobby (REST deploy) · Gemini 3.8/3.7 Flash ↔ Groq
gpt-oss-120b/20b (json_schema always) · discovery: ATS feeds + JSearch/Adzuna + keyless lanes + Gmail readonly.

## Files
PROGRESS.md (state + ONE next action) · DECISIONS.md (append-only; V2-1… this cycle) · HISTORY.md ·
RESEARCH.md (verdicts first) · ARCHITECTURE.md · ARC_PLAN.md · NOTES.md (parked, never silently built).
If a rule here keeps being violated, this file is too long — flag it for pruning.
