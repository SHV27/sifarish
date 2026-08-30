# CLAUDE.md — SIFARISH (सिफ़ारिश)

## Commands
- Gates: `npx vitest run` (709; `SIFARISH_MATRIX=1` deep) · Types: `npx tsc -b` · Build: `npm run build`
- Deploy + verify served hash: load project skill `ship-verify` (never trust a green build — D76/D83).
- Live proofs: `scripts/owner-smoke.mjs` · `scripts/demo-smoke.mjs` · `scripts/live-brain-probe.mts` (spaced calls; a 429 is not a dead brain).

## What this is
Shaurya's personal job-hunt chief of staff: evidence-ledger → truth-compiled resume/letter per JD →
lawful worldwide discovery → apply cockpit → pipeline board. Design law: **"Compile truth. Draft
everything. Send nothing unattended."** Taste bar: a hostile recruiter respects the output.
Non-negotiables: (1) no orphan claims — every bullet carries ledgerIds, LLM may rephrase never mint
(I1); (2) no unattended submit anywhere, gmail stays readonly, grep-gated (I3); (3) keyless core —
every feature works with zero API keys, fallbacks declare their mode visibly (I4).

## Architecture (authorities & choke points)
- Local-first Dexie (owner/demo split vaults) + Vercel static + 10 self-contained edge functions
  (Hobby cap 12 — spend no slot without an ARCHITECTURE.md revision).
- State authorities: `opRegistry` (every agent mutation) · `measureLine()` (one width model,
  compiler + renderer) · `eligibility()` at ingest (persisted on Job, never re-derived) ·
  `recompilePacket()` (only recompile door) · `pehchaan`/Darbaan (identity, server-verified).
- Money/identity/privacy: 8 keyed functions require origin allowlist + x-sifarish-token; demo mode
  can never spend; vault syncs ciphertext only (server never sees the key). New Dexie tables/fields
  join the sync table-list in the same commit.

## The Verifier (definition of done — every arc close)
1. Machine: `npx vitest run` all green + `tsc -b` clean + warning-free build; new guards ship with
   accept-true AND reject-false tests; every bug fix ships its regression test.
2. Wire: the feature is reachable on the DEFAULT path (not a buried button) — else it is NOT built.
3. Eyes: rendered PDF read, screenshots at 3 breakpoints, zero console errors.
4. Live: deploy → served-hash verified → adversary curls (no-Origin 403, fake token → keyless) →
   demo smoke ₹0 spend. "Done" for vault-affecting changes = proven on HIS DATA, not the seed.

## Iron rules
- Plan before multi-file changes; one item at a time; PROGRESS.md updated at every boundary.
- 2 failed attempts on one path → stop, restate the bug's CLASS, fix at the choke point.
- Verify volatile facts live (models, quotas, API shapes) at each arc open; log in RESEARCH.md.
- Secrets: pulled via `vercel env pull`, never pasted; a decision log records THAT a secret rotates,
  never its value (D108). Any key touching plaintext chat → owner rotates it.
- The second copy of a rule is a fork of its future bugs — extend the authority, don't copy.
- Demote, never hide (ranking); hide only on CONFIRMED ineligibility evidence, with a visible count.

## Stack (verified 30-Aug-2026 — full lock in ARCHITECTURE.md)
Vite + React + TS · Dexie · Tailwind tokens · pdf-lib (Times/Helvetica standard fonts) + docx +
pdfjs parse-back · Vitest (pool: forks) · Vercel Hobby · LLM: routing.json chain — Gemini Flash ↔
Groq gpt-oss-120b/20b (json_schema always; json_object is a dead lane, D73/D74) · Discovery:
4 ATS feeds + JSearch/Adzuna (keyed, rationed) + 8 keyless lanes + Gmail readonly (Dak).

## Files
PROGRESS.md (state + ONE next action) · DECISIONS.md (append-only, RB-era) · HISTORY.md (D1–D168
archive, verbatim) · RESEARCH.md (verdicts first) · ARC_PLAN.md · NOTES.md (parked, never silently
built). If a rule in this file keeps being violated, the file is too long — flag it for pruning.
