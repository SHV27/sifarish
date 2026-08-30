# DECISIONS.md — SIFARISH re-brief (30-Aug-2026 →)

Append-only. Autonomy Charter: calls made on the owner's behalf are logged here, vetoable in one word.
(Prior history: CLAUDE.md §12 D1–D168 remains the archival record.)

## RB-1 · Boardroom Minutes (30-Aug-2026)

### PILLARS (5)
1. **EK BAAT — one conversation.** Guru + Baithak unify into a single Claude-like agent over a
   typed op registry (all existing EditOps + ledger/vision/hunt/navigate ops). Deterministic
   honesty router stays the FRONT DOOR (I1/I9 interception before any LLM); every LLM-emitted op
   re-validated against real ledger IDs; keyless deterministic core preserved. Beat "keep two
   chats" because the brief's taste anchor IS the product; costs a careful op-layer build; survived
   the Skeptic by keeping the router load-bearing.
2. **APPLY COCKPIT — the lawful ceiling of "auto-apply".** Bookmarklet prefill of ATS application
   forms from the packet (+ per-field copy dossier fallback), mailto: compose for email applies
   (zero new scopes), pre-flight mistake-proof check (resume version · work-auth verdict · pay
   floor · deadline), one-click Mark-as-Applied. SUBMIT IS ALWAYS HUMAN. Beat unattended submit on
   research evidence (ToS bans + employer-only APIs); costs a new bookmarklet surface; survived
   because it delivers max lawful motion with zero account risk.
3. **HAQ FILTER — work-authorization gate.** Typed eligibility verdict at the ingest choke point
   (structured fields first: Remotive/Jobicy/Ashby/Simplify; negation-aware sentence-scoped JD scan
   second). CONFIRMED-ineligible roles never surface (brief's explicit law) but are counted
   ("hidden as ineligible: N", inspectable); ambiguous roles demoted with the reason rendered.
   Reconciles "never surface" (brief, newer) with "demote never hide" (standing rule) honestly.
4. **CANON RESUME — the LaTeX register.** Serif standard font (Times family), bold-inline keyword
   runs, project header `Name | Tech, Tech` + link, achievements/PoR sections per the 8-sample
   canon, dense one page — all inside the existing truth-compiler, I1/I2/I5/one-page intact;
   segment-aware width model + parse-back stay gates. DOCX parity. Single column stays (columns
   are the parse-killer; serifs/bold are not).
5. **KHABRI REFRESH — discovery that never sleeps, at ₹0.** NEW: LinkedIn job-alert emails parsed
   via existing gmail.readonly Dak lane (recon's best find: zero credits, daily, lawful; also the
   lawful LinkedIn "both directions" answer). Upgrades: JSearch /search-v2 cursor pagination,
   Jobicy count=200, SimplifyJobs category field, probes re-run; The Muse only if a live probe
   shows usable taxonomy. Wellfound: no lawful direct lane exists — covered via aggregators + ATS
   board discovery (documented so nobody "adds" a scraper later).

### CUT LIST
- Unattended submit, any platform (LinkedIn/Wellfound bots, headless ATS form-POST) — research
  verdict: ban-class risk or employer-credential-gated; killed permanently.
- Own browser extension — bookmarklet + copy dossier deliver the same prefill without a store
  presence or update channel.
- Server-side Vercel cron sweep — parked in NOTES.md; alert-email lane + 6h autopilot cover
  freshness at ₹0 and no function-slot spend.
- Wellfound GraphQL/scrape — ToS-barred; never.
- New paid/keyed sources (Jooble, Careerjet, Findwork, Teamtailor…) — reject, keyless ethos.
- Mobile app, multi-user, analytics dashboards — brief's explicit not-now list.
- Gemini 3.7-flash / qwen3.6-27b routing upgrades — DATA-level changes, queued into the arc where
  routing.json is already open, not a pillar.

### THE INNOVATION (quota met)
The **Apply Cockpit bookmarklet**: password-manager-style autofill applied to job applications,
driven by the compiled truth-packet (so the form inherits I1-clean content), with a manufacturing
poka-yoke pre-flight check. Absent from every reference found in recon (Simplify autofills a
static profile; ours fills THE tailored packet for THAT role, work-auth-checked).

### PRE-MORTEM OBITUARY (top 3, each with its preventing decision)
1. "Died because his LinkedIn got restricted" → no unattended automation exists anywhere in the
   product (Pillar 2's hard boundary; I3 grep gates stay).
2. "Died because the free tier walled mid-month and discovery silently starved" → rations +
   named skip reasons survive review; every NEW lane added this cycle is zero-credit.
3. "Died because the resume rewrite broke the truth-compiler" → typography lands as a renderer
   register with segment-aware metrics; I1/I5/one-page gates + matrix harness must stay green at
   every arc close (no gate deletions to make a look ship).

### OPEN CALLS MADE ON THE OWNER'S BEHALF (veto in one word)
1. **Auto-apply = prefill + human click, permanently.** No unattended submit exists lawfully at
   acceptable risk; we build the ceiling, not the fantasy.
2. **Work-auth "never surface" = hide only on CONFIRMED evidence** (+ visible count), demote on
   ambiguity — protects him from both wasted time and silently-lost real opportunities.
3. **Email applies use mailto: compose (his Gmail opens prefilled, he attaches + sends).** No
   send/compose OAuth scope is added; I3's read-only Gmail boundary stands.

## RB-2 · D5 narrowed (30-Aug-2026)
Old: "generated resume is deliberately plain (Arial/Calibri) because the parser is its first
reader." Research (re-brief §IV + owner's 8 samples): the parse-killers are columns/tables/
graphics — NOT serif faces or bold runs; the campus canon (Jake's-template register) is itself
the ATS-safe standard. D5 becomes: **single column, standard fonts (Times/Helvetica family),
no graphics/tables/columns.** The LaTeX register ships inside that boundary.

## RB-3 · Architecture review verdict (30-Aug-2026)
Core survives adversarial review — no teardown. Constraints locked: no new runtime deps, no new
Vercel function slots this cycle, every new Dexie field joins the sync table-list in the same
commit, bookmarklet may contain no keys/no API calls/no submit-control activation (gated).
