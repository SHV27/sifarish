# ARC PLAN — SIFARISH re-brief (30-Aug-2026) · honest count: 5 arcs

Chassis note: the walking skeleton exists (deployed product, 709-gate suite, hooks + constitution
rebuilt 30-Aug). Arcs run sequentially in this autonomous session (Charter: owner unavailable);
each closes with studio-verify evidence before the next opens. Acceptance lists are FROZEN —
new ideas go to NOTES.md.

## Arc 1 — HAQ FILTER + KHABRI REFRESH (Pillars 3+5)
Acceptance (frozen):
- [ ] `Job.eligibility` typed verdict computed at the normalize choke point (structured fields:
      Remotive candidate_required_location, Jobicy jobGeo, Ashby workplaceType/address, Simplify
      sponsorship/title-suffix; JD-text: sentence-scoped, negation-aware phrase scan) — persisted,
      never re-derived; source+reason stored.
- [ ] `vision.workAuth` seeded ({home:'IN', authorizedIn:['IN'], remoteOk:true}), editable in
      Settings vision editor.
- [ ] Radar + Briefing: confirmed-ineligible NEVER surfaces; "hidden as ineligible: N →" opens an
      inspectable list; ambiguous demotes with reason rendered in "why this score".
- [ ] Two-sided gates: false-hide (sponsor-available role stays) + false-show ("US citizens only"
      hides) + OPT/CPT-negation nuance + "sponsorship available" positive guard.
- [ ] LinkedIn job-alert emails parsed in Dak (gmail.readonly, client-side): alert → candidate
      jobs into the paste-lane ingest (normalize+eligibility+score); unparsed alerts counted,
      never dropped; zero new scopes (grep gate still green).
- [ ] JSearch `/search-v2` cursor pagination behind JSEARCH_PATH (page-2 depth speaks cursor);
      lane failure = named skip. Jobicy count=200. SimplifyJobs `category` field consumed
      (AI/ML/Data boost + sponsorship mark → eligibility).
- [ ] Live probes re-run for changed lanes (JSearch v2 shape, Simplify field names) — logged in
      RESEARCH.md §II with dates.
- [ ] Arc close: full suite green + new gates, tsc clean, PROGRESS.md checkpoint, commit.

## Arc 2 — CANON RESUME (Pillar 4)
Acceptance (frozen):
- [ ] Segment model: CompiledLine gains styled runs (bold/roman per segment); ONE `measureLine()`
      authority over Times+Helvetica AFM tables; D158 parity gate extended (never under drawn
      width, ≤2% over, per font).
- [ ] Times register in pdf renderer: serif body, section rules, right-aligned dates (existing),
      **bold inline keywords** (tech/metrics) in bullets, project header `Name | Tech, Tech` +
      link, labeled skill categories, education/achievements/PoR per the 8-sample canon.
- [ ] Bold-keyword selection is DETERMINISTIC (lexicon + digits), never LLM-minted; I1 untouched.
- [ ] DOCX export renders the same register (bold runs, header formula).
- [ ] I5 parse-back 100% + one-page solver + matrix harness green under the new register;
      rendered PDF read by eye against the sample canon.
- [ ] Register is the DEFAULT path for every packet (fast + full + recompiles); repair banner
      offers re-render of stored packets (FORGE untouched — this is typesetting, not content).
- [ ] Arc close: gates + eyes + PROGRESS + commit.

## Arc 3 — EK BAAT (Pillar 1)
Acceptance (frozen):
- [ ] `src/lib/agent/ops.ts` opRegistry: single typed vocabulary = existing 10 EditOps + ledger
      CRUD (add/edit achievement|project|skill), vision edit, hunt add/toggle, sweep, navigate,
      mark-applied; every op self-describes (schema + validation + executor).
- [ ] Deterministic router runs FIRST every turn (refusals/I9/I1 interception pre-LLM, keyless
      full path); LLM lane emits ops via json_schema through /api/dimaag; ops re-validated
      against registry + real ledger ids; invalid op → named rejection in-chat.
- [ ] ONE chat surface replaces Guru screen + packet Baithak entry points (packet context auto-
      loads when opened from a packet); threads persist in guruThreads; citations survive.
- [ ] Ledger edits via chat land as PROPOSED diffs (Nabz pattern: human confirms in-chat) —
      zero silent mutations; demote/refuse paths keep D136 hasEvidence contract.
- [ ] Regression: the 22-utterance Baithak fixture + Guru eval convos pass through the unified
      surface; I9 mid-stream tripwire intact.
- [ ] No new serverless function; guru/dimaag payload boundary respected (16k caps).
- [ ] Arc close: gates + fresh-eyes chat walkthrough + PROGRESS + commit.

## Arc 4 — APPLY COCKPIT (Pillar 2)
Acceptance (frozen):
- [ ] `Packet.applyDossier`: deterministic field-map (name/email/phone/links/edu/work-auth
      answers/salary floor + resume+letter file refs) compiled from ledger+vision; rendered as a
      copy-per-field panel on every packet (default path).
- [ ] Bookmarklet generator: prefills Greenhouse/Lever/Ashby/SmartRecruiters application forms
      from the dossier in HIS browser; reports "N of M fields"; contains NO keys, NO API calls,
      NO submit()/click on submit controls — dedicated structural gate proves all three.
- [ ] mailto: compose lane for email applies (subject+body from packet; he attaches exports).
- [ ] PRE-FLIGHT check stamped on the packet: work-auth verdict · resume version current ·
      pay floor vs posting · deadline/posting age · export files fresh; all-green before the
      apply URL is presented big.
- [ ] Mark-as-Applied one click from the cockpit (existing single door).
- [ ] I3 grep gates extended to the bookmarklet source; demo mode: cockpit works with demo data,
      ₹0 spend.
- [ ] Arc close: gates + a REAL Greenhouse form prefill proven in a live browser screenshot +
      PROGRESS + commit.

## Arc 5 — SHIP (Four Proofs)
Acceptance (frozen):
- [ ] Machine: full suite (incl. SIFARISH_MATRIX=1 deep run) + tsc + warning-free build.
- [ ] Fresh-eyes: wiped-profile demo smoke, 3 breakpoints screenshots, ERRORS(0), ₹0.
- [ ] Adversary: no-Origin 403 on all touched functions; fabricated token → keyless; demo cannot
      spend; bookmarklet gate evidence pasted.
- [ ] Money: enumerate every metered path — zero NEW metered surface this cycle.
- [ ] Deploy via ship-verify skill: served-hash proof + session-unique string in bundle.
- [ ] README + PROGRESS.md final (one DONE, no roadmap — owner comms rule); DECISIONS.md sealed
      for the cycle.

Parked (NOTES.md): Vercel cron server sweep · The Muse (pending taxonomy probe) · Gemini
3.7-flash / qwen3.6-27b routing bump (DATA change, do inside Arc 1 only if routing.json is
already open) · own browser extension · outcome-memory items from prior NOTES.
