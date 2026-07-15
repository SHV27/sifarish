# CLAUDE.md — SIFARISH (सिफ़ारिश)

## 1 · PRIME DIRECTIVE

**SIFARISH** is Shaurya Verma's personal job-hunt chief of staff: it maintains a living, evidence-backed
ledger of what he can *provably* do, hunts AI-first internships/roles that match his vision and money floor,
compiles a sniper-grade ATS-safe resume + cover letter + outreach draft per company, and runs the entire
pipeline in a war-room board — leaving Shaurya exactly one job: review and click Send himself.

**THE DESIGN LAW (binding, absolute):**
> **"Compile truth. Draft everything. Send nothing."**
> Every claim is compiled from the Sach Ledger (never free-written by the LLM). The app drafts every artifact
> of an application. The app contains NO mechanism that submits, emails, posts, or automates any platform.

**Taste bar:** a senior studio shipped this. Non-negotiables: first output = final output · zero AI slop ·
it must actually run, delight, and produce a resume a hostile recruiter respects.

## 2 · THE FIVE PILLARS

1. **Sach Ledger** — master profile as structured data. Two tiers: `shipped` (interview-safe today, with
   evidence URL + date) and `in_forge` (honestly dated "currently building"). The single source of truth.
2. **GitHub Nabz** — watches github.com/SHV27 via the public REST API; new repos become candidate ledger
   entries; `in_forge` items auto-promote to `shipped` when their repo goes live (human confirms, one click).
3. **Shikaar Radar** — pulls live roles from keyless public ATS JSON feeds (Greenhouse / Lever / Ashby /
   SmartRecruiters) for a curated, editable company watchlist + a paste-a-URL/paste-JD lane for LinkedIn
   finds. Scores each role against Shaurya's rubric. Ranked queue, ~10 sniper targets/week — never a firehose.
4. **Darzi Engine** — per-company tailoring: JD keyword extraction → evidence-matched bullet selection →
   deterministic compile → LLM phrasing polish (optional, keyless-degradable) → exports ATS-safe single-column
   PDF **and** DOCX + cover letter + hiring-manager outreach draft. One "Application Packet" per role.
5. **Morcha Board** — pipeline war room: Found → Tailored → Applied → Follow-up → Interview → Verdict.
   Follow-up nudges (day 7/14), per-company interview dossier, one-glance state of the hunt.

## 3 · INVARIANTS (sacred, Referee-enforced — Law 3: structural impossibility beats vigilance)

- **I1 — No orphan claims.** Every resume/cover-letter bullet carries a `ledgerId` evidence link. A bullet
  without one is a compile ERROR, not a warning. The LLM may rephrase a bullet; it may never mint one.
- **I2 — Tier honesty.** `in_forge` items can ONLY render inside a clearly labeled, dated
  "Currently Building (July 2026)" line. They can never appear as completed skills/projects.
- **I3 — No Send anywhere.** No SMTP, no form POSTs to application endpoints, no LinkedIn automation, no
  headless anything. Every packet ends at: files + the official apply URL + a "Mark as Applied" button.
- **I4 — Keyless core.** Every pillar is fully usable with ZERO API keys (deterministic compile, cached/manual
  data paths). LLM polish and higher GitHub rate limits are amplifiers behind env keys, never dependencies.
- **I5 — Round-trip fidelity.** Text extracted from every generated PDF must equal the compiled content,
  in order, 100% (automated parse-back test). What the ATS reads IS what we wrote.
- **I6 — There is always a legal action.** Every screen state offers a next step; empty states teach.
- **I7 — Cited intelligence.** Every claim the app makes about a company, role, or market trend carries a
  source URL. Uncited external claims render as errors, not text. (The ledger rule, extended to the world.)
- **I8 — Budget honesty.** Every metered API (Tavily, JSearch, Groq) has a tracked monthly budget visible in
  Settings; sweeps enforce per-run caps; hitting a cap degrades legibly to keyless paths. Never a silent burn.
- **I9 — No guarantee language.** "Guaranteed", "100% selection", "assured placement" and equivalents are on
  the slop-scan banned list — in UI copy, Guru replies, and generated documents. The app maximizes
  probability and says exactly that. I3 extends to Guru/Khabri: no auto-fill, no auto-send, discovery via
  lawful APIs only (never scrape LinkedIn/Naukri/Upwork).

## 4 · THE INVERSION LEDGER (why this category dies — and our structural counter; full evidence in RESEARCH.md)

| Failure mode (observed in the wild)                          | Structural counter in SIFARISH            |
|--------------------------------------------------------------|-------------------------------------------|
| AI-exaggerated resumes — #1 fraud recruiters now hunt (63%)   | I1 + I2: compile-only from evidence        |
| Auto-apply bots → LinkedIn account restrictions               | I3: Send does not exist                    |
| Generic AI-slop wording recruiters spot instantly             | Voice Bank + slop-scan gate (§6)           |
| Mass spray → recruiters filtering junk, 0 signal              | Sniper quota: ranked queue, ~10/week       |
| Pretty resumes that scramble in parsers (columns/tables/icons)| ATS-safe template only + I5 parse-back     |
| Trackers abandoned because updating them is a chore           | Tracking is a side effect of generating the packet in-app, never manual data entry |
| Stale listings / dead links                                   | Fetch-at-view, `updated_at` shown, dead-link probe |
| Keyword stuffing detected by ML anti-manipulation             | Keywords only where evidence exists; zero invisible text |

## 5 · OPERATING LOOP + RESEARCH MANDATE

RESEARCH → PLAN (plan mode, PLAN.md) → EXECUTE → REVIEW → SHIP. Keep the main thread lean: offload research
and review to read-only subagents. **Claude Code must itself verify volatile facts live before relying on
them** (library versions, Groq model names/limits, ATS endpoint shapes, GitHub rate limits — checklist in
RESEARCH.md §Volatile), study the reference repos cited there before building, and cite what it borrows.

## 6 · THE COUNCIL (parallel read-only subagents → synthesize → fix → re-review deltas)

- 🛠 **Principal Engineer** — architecture, data integrity, offline-first, zero console errors.
- 🎨 **Experience Director** — owns "Ink & Appointment" art direction (§8); portfolio-grade polish.
- ⚖️ **Referee** — automated invariant tests I1–I6 + chaos runs (empty ledger, 500-job feed, offline,
  malformed JD, huge repo list). Findings are never optional.
- 🎮 **Evaluator** — runs the numeric gates (§7) in a tune-to-target loop. "Feels good" is not evidence.
- 😈 **The Recruiter** — hostile domain lens: 6-second skim test on every generated resume; flags anything
  that smells inflated, generic, or template-y. If the Recruiter wouldn't call Shaurya, iterate.
- 🔍 **Fresh-Eyes** — a rules-blind agent must (from the screen alone): seed the ledger, add a job, and
  produce a packet — inside 60 seconds of guidance-free use.
- 🏆 **Certification** — hostile QA pass before ship; zero open defects; green is the resting state.

**Auto-Research Loop:** PROPOSE → CRITIQUE → VERIFY (against references + the running build) → REFINE, until
numeric targets AND the gut-check pass, within a sane iteration budget.

## 7 · NUMERIC QUALITY GATES (re-run after EVERY workstream — Law 8)

- **Ledger integrity:** 100% of rendered bullets evidence-linked (I1). Automated.
- **Parse-back fidelity:** 100% of compiled lines present and in order in extracted PDF text (I5).
- **JD coverage:** ≥80% of extracted must-have JD keywords *that have ledger evidence* appear in the tailored
  resume; keywords **without** evidence appearing = 0 (hard fail).
- **One page:** compiled resume fits one A4 page at ≥10.5pt. Overflow = compile error with cut suggestions.
- **Slop-scan:** 0 hits from the banned-phrase list ("results-driven", "passionate about leveraging",
  "dynamic professional", "proven track record", "spearheaded synergies"...); phrasing checked against
  Shaurya's Voice Bank samples.
- **Radar sanity:** scoring rubric ranks a hand-labeled 20-job fixture with ≥90% agreement on top-5.
- **Fresh-Eyes:** task success ≤60s, zero verbal guidance.
- **UX floor:** zero console errors · keyboard navigable · WCAG AA contrast · reduced-motion respected ·
  headless-browser screenshots verified at 3 breakpoints (Law 9 — never trust unseen visuals).

## 8 · ART DIRECTION — "INK & APPOINTMENT"

The aesthetic of the coveted Indian appointment letter and the bureau desk that produces it: warm cream paper
(#F7F2E7 family), ink blue (#1B2A4A), stamp red accent (#B3372F) used ONLY for verdicts/urgency, archival
green for "Shipped". Display serif (e.g., Fraunces) for headings, humanist sans for UI, tabular mono for
ledger data. Motion: paper-and-stamp language — dossiers slide, verdicts stamp down (150–250ms, meaningful
only). One design-token source. The generated RESUME itself uses none of this — it is deliberately plain
(Arial/Calibri single column) because the parser is its first reader; the *app* is where beauty lives.
The bar: a designer asks who we hired.

## 9 · PROJECT LAWS (Book of Laws, in this project's language)

- **L1 Form is the promise:** the interaction IS "my assistant handed me a ready dossier" — packets appear as
  stamped dossiers, the Haq of the hunt is visible; no dashboards-about-the-thing, no hidden math (score
  breakdowns always inspectable — Law 4 causal legibility: every ranking shows WHY).
- **L2 Complexity budget:** one screen = one decision. Onboarding = confirm seeded ledger, pick watchlist,
  see first ranked queue. Any feature needing a paragraph to explain doesn't ship.
- **L4 Causal legibility:** every score, every bullet choice, every promotion shows its reason inline.
- **L5 Cut what nobody consumes:** no analytics vanity charts v1; no gamification; no multi-user.
- **L7 The artifact teaches itself:** empty states are the manual; first packet within 60 seconds.
- **L13 Restart is legitimate:** if the compile pipeline fights the invariants, tear it down, say so.
- **L14 Cross-domain steal (named):** *compiler design* — source-of-truth → deterministic compilation →
  target-specific artifact. The resume is compiled, never written. **Novel mechanism (named):** the
  *self-strengthening resume* — Nabz + tier-promotion loop makes the resume compound weekly with real work.

## 10 · SECURITY (Law 11)

Secrets live in the shell / platform env ONLY. `GROQ_API_KEY` (and any key) is server-side (Vercel function
env) — **never `VITE_`-prefixed, never in client bundle, never in any committed file.** `.gitignore`: `.env*`,
`node_modules`, `dist`, `.vercel`. Any secret that touches plaintext is rotated. All personal seed data lives
in `seed/ledger.seed.json` — real contact details are fine (they belong on a resume) but the repo README must
note how another user replaces the seed.

## 11 · STACK (verify versions live at session start — Law 12)

Vite + React + TypeScript · Tailwind · Dexie (IndexedDB, offline-first) · docx (DOCX export) +
@react-pdf/renderer or pdf-lib (true text-layer PDF) + pdf.js for parse-back tests · Vercel (static + one
serverless proxy `/api/polish` for Groq; keyless fallback path mandatory) · GitHub public REST (unauth 60
req/hr — cache aggressively; optional server-side PAT amplifier) · ATS feeds: `boards-api.greenhouse.io/v1/
boards/{token}/jobs?content=true`, `api.lever.co/v0/postings/{site}?mode=json`, Ashby + SmartRecruiters
equivalents (shapes verified in RESEARCH.md; re-verify live). Vitest + Playwright (headless screenshots).

## 12 · RESUME PROTOCOL (Law 10)

PROGRESS.md at root: current workstream, exactly ONE next action, gate status table. Commit + checkpoint per
workstream. Resume line: **"read PROGRESS.md and continue."** A limit hit costs zero work.

## 13 · DECISIONS / GOTCHAS (append-only; seeded from the vision)

- D1: Truth-compiled resume over aspirational claims — interviews land mid-learning; 91% of recruiters now
  hunt fabrication; Shaurya's real portfolio is sufficient. (Vision call, 07-Jul-2026)
- D2: Human-in-the-loop Send — zero documented LinkedIn restrictions when the user clicks Send; autopilot is
  both a ban risk and the losing strategy in a spam-saturated market. (Vision call)
- D3: Keyless public ATS JSON feeds + paste-lane over any LinkedIn scraping. (Vision call)
- D4: Export BOTH text-layer PDF and DOCX — DOCX parses ~100% reliably; some pipelines still prefer it. (Research)
- D5: Generated resume is deliberately plain/single-column; app carries the visual identity. (Research: columns/
  tables/icons cause ~65% of parse failures.)
- D6: Sniper quota ~10/week; ranked queue caps visible items to prevent spray behavior. (Research)
- D7: The Recruiter council seat added — this domain's Playtester is a hostile skim. (Vision call)
- D8: Session is non-interactive/autonomous → PLAN.md written directly instead of interactive plan-mode approval. (WS0, 07-Jul-2026)
- D9: pdf-lib over @react-pdf/renderer — manual line-by-line drawing gives deterministic text order, so I5 parse-back 100% holds by construction; Helvetica standard font = guaranteed text layer, zero font-embedding risk. (WS0)
- D10: All four ATS feeds verified `Access-Control-Allow-Origin: *` live 07-Jul-2026 → browser-direct fetch; /api/feed passthrough NOT built (documented fallback if a feed regresses). (WS0)
- D11: All three user-supplied tokens failed auth (Groq invalid key / GitHub PAT 401 / Vercel 403) → the mandatory keyless path is the build path; keys touched plaintext chat so rotation is required regardless (§10). (WS0)
- D12: TypeScript pinned ~5.9 — 6.0.3 is days old; ecosystem stability is the senior call. (WS0)
- D13: GitHub API CORS is `*` → Nabz runs fully browser-side unauth with Dexie cache + honest rate-budget UI; PAT amplifier deferred until a valid key exists. (WS0)
- D14: No router lib, no state lib — 6 screens on top-level state; Dexie + useLiveQuery IS the store. (WS0)
- D15: Fact-drift guard rewritten from blunt token-diff to a precise 3-category detector (new numbers / known tech-skill vocab / proper-nouns+acronyms) — a token-diff false-rejected honest rephrasing ("co-op"→"cooperative"). The invariant forbids new FACTS, not new words. (WS7a)
- D16: Export libs (pdf-lib, docx) + pdfjs dynamic-imported at call sites → initial bundle drops from 1.15MB to ~383KB gzip 120KB; pdf/docx chunks load only on export click. Web-vitals gate. (WS7b)
- D17: Watchlist seed = 29 boards, each PROBED LIVE 07-Jul-2026 and confirmed returning jobs; dead tokens (Groq, W&B, Pinecone, HuggingFace, Krutrim, Fractal, etc.) dropped at probe time. (WS3)
--- v2 "The Jasoos Update" (08-Jul-2026) ---
- D18: The "JSearch" aggregator is OpenWeb Ninja (`api.openwebninja.com/jsearch/search`, `X-API-Key: ak_…`) — verified live, surfaces LinkedIn/Indeed/Glassdoor listings legally via Google-for-Jobs. Not RapidAPI. (WS0-v2)
- D19: Guru uses Groq `llama-3.3-70b-versatile` (function-calling + streaming both verified live). Keyless fallback = deterministic Apply Plan template. (WS0-v2)
- D20: All four keys re-verified working 08-Jul (Groq+PAT failed transiently in session 1, fine now). Keys are server-side only: Vercel env + gitignored `.env`; live-integration tests gated behind `SIFARISH_LIVE=1` so the default gate suite stays keyless-deterministic. (WS0-v2)
- D21: Discovery is API-only, never scraping (I3/I9). JSearch/Tavily/HN/Remotive/RemoteOK are all lawful public/aggregator APIs; the app holds NO LinkedIn/Naukri credentials and performs no platform actions. (WS0-v2)
- D22: Serverless functions MUST be self-contained — a shared `api/_shared.ts` import failed at runtime (ERR_MODULE_NOT_FOUND; Vercel treats `_`-prefixed files specially and the edge bundler didn't resolve the cross-file import). Each function inlines its helpers + a literal `export const config = { runtime: 'edge' }`. (WS7-v2)
- D23: Guru architecture = deterministic honesty-router FIRST (owns refusals + actions, is the keyless mode AND the testable core), LLM only for freeform phrasing with full read-context injected in the system prompt (no fragile tool round-trip); client re-scans every streamed token for I9. Reliable eval gate without a live LLM. (WS3-v2)
- D24: v2 keys verified working live 08-Jul (all four); full production smoke passed — JSearch 72/67-new, 13 signals, Guru I9 refusal + ledger-grounded answer, Intel dossier, 0 console errors. Keys still require rotation (plaintext chat). (WS7-v2)
--- v3 "The Dimaag Update" (Final Form, 09-Jul-2026) ---
- D25: Two-tier Groq strategy — gpt-oss-120b for reasoning (decide/critique/casting/angle; emits reasoning tokens, ~400-550 tok/call), llama-3.1-8b-instant for classification (archetype/extraction). Both JSON-mode verified live. Split I8 budgets: dimaag (reasoning) + chhota (classify). (WS0-v3)
- D26: Dimaag Core is cache-first — content-hash key over inputs; identical inputs never re-call (gate: re-calls=0). Honest usage tracking distinguishes call/hit/fallback; only a real call spends budget. Keyless/over-budget/JSON-fail all degrade to a deterministic heuristic that still returns a full Rationale (I10 holds even without an LLM). (WS1-v3)
- D27: Angles change EMPHASIS via evidence-true bullet selection/ordering + which projects lead — NOT free-text rewriting. This keeps I1 airtight by construction (no new fact-drift surface); the existing guarded polish pass still handles phrasing. Differentiation is real (different bullets/order per role) without risk. (WS2-v3)
- D28: v1 compiler remains the FINAL authority — the Editor's Desk proposes an `editorial` override (project order + bullet plan); the compiler still enforces I1/I2/one-page/parse-back. Dimaag proposes, compiler disposes. (WS2-v3)
- D29: Letter uniqueness measured on the SUBSTANTIVE body — greeting, the standard ask, the dated-momentum line, and the signature block are stripped (his consistent voice, not company-specific risk), same rationale as excluding the contact block. Trigram Jaccard ceiling 0.5. The gate is only meaningful with ≥2 shipped projects (seed ships 1: GLOAMING) so the test uses a realistic multi-shipped ledger. (WS3-v3)
- D30: Archetype classify (8b) mis-cast an agentic-AI role as ml-generalist; fixed with a decisive instruction rule (LLM/agents/RAG/guardrails → applied-ai/agent-eng, never ml-generalist even if Python present). Classify cache key now includes the instruction so prompt fixes bust stale cache. Live re-verified: 90% Agent/Agentic Systems Engineer. (WS6-v3)
- D31: v3 shipped 09-Jul — 145/145 gates, live four-pass editor smoke passed (0 console errors), deployed. THE APP IS FEATURE-COMPLETE. Future work is content (ledger/vision/keys), never code. (WS7-v3)
--- v3.1 robustness pass (real user hit a page-overflow error as the ledger grew) ---
- D32: One-page is a CONSTRAINT THE COMPILER SOLVES, not an error it throws. As Nabz grows the ledger (self-strengthening loop), the old fixed-render + timid trim overflowed and surfaced a CompileError AT THE USER. Compiler now assembles at progressive trim levels (fewer bullets → prune honors/certs → fewer projects) until it fits; benched-means-benched (editorial cast = only that lineup renders). CompileError reserved for the practically-impossible single-entry-too-long case. Overflow gate tests rewritten to assert the always-fits contract. (v3.1)
- D33: Two-phase tailoring restores v2 instant-feel. buildPacketFast = deterministic packet (cached-intel only, no LLM) renders in ~300-700ms; buildPacket (full Dimaag Editor's Desk) then refines casting+letter in the background and swaps in live. 'Ready to use now' badge while enhancing. Live: 6-shipped-project ledger → resume in 708ms, 0 compile errors, enhancement at ~14s (non-blocking). (v3.1)
- D34: Autopilot (src/lib/autopilot.ts) — on open, stale discovery sweep (>24h) + due market pulse (>7d) auto-run in the background, budget-capped, once per session. 'Self-evolving, never outdated.' Human still confirms every change (Nabz pattern) — new roles just appear in the Radar, pulse only PROPOSES rubric tweaks. Zero silent mutations. (v3.1)
--- v4 "The Ustaad Update" (Final Form, 12-Jul-2026) ---
- D35: Groq deprecated llama-3.1-8b-instant + llama-3.3-70b-versatile 17-Jun-2026 (shutdown 16-Aug-2026).
  Migrated per Groq's stated paths: classify → openai/gpt-oss-20b; Guru + polish → openai/gpt-oss-120b.
  Caught by the Law-12 live re-verify at WS0 — the app would have silently lost its LLM tier in August. (WS0-v4)
- D36: Ustaad library = data/ustaad/library.json — 42 cited sources, 18 craft patterns, 6 archetype guides,
  3 hiring-path briefs; versioned + dated + Pulse-refreshable (I13). No "selected-at-company-X" database is
  pretended to exist; the library is craft patterns with receipts. (WS0-v4)
- D37: Baithak parser is deterministic-first (Hinglish+English cue grammar over ledger names) — the keyless
  mode IS the testable core (D23 pattern applied to the tailor). EditOps can only select/order/link/re-polish;
  the refusal path (unevidenced claim → Gap Note) is a feature, not an error. (WS2-v4)
- D38: Guru's reported failure (Google/Microsoft-style suggestions against stated vision) diagnosed as
  context starvation + path blindness. Fixed structurally: compiled dossier every turn, hard-avoids guardrail
  in the prompt, visionAlignmentScan discards unflagged avoided-lane LLM output, cited path briefs answer
  "how do I get into X" with a path, not a job list. Regression test in the 30-convo eval. (WS3-v4)
- D39: Dak Khana scope is gmail.readonly ONLY, token in memory only, client-side matching; a source-level
  grep gate bans every send-capable scope/endpoint string from src/ and api/ (I3 proven, not promised). (WS4-v4)
- D40: Darbaan enforces I12 at the Dexie DBCore level — locked mode rejects story-table mutations no matter
  the code path; infra caches stay writable. Fresh browsers seed the FICTIONAL demo persona (real PII out of
  the public seed; owner seed is a lazy chunk restored under Owner Mode); backups are AES-256-GCM with the
  GCM tag as the integrity check. (WS5-v4)
- D41: Compile Quality is a rubric over CRAFT EXECUTION, never an "ATS score" (I9). Gap-vs-choice itemization
  is the core: points dock only for what the compile could have done better; what the ledger cannot prove is
  a Gap Note item. Golden packets 100/100 with honest remainders. (WS1-v4)
- D42: Lighthouse desktop 99/100/100; mobile-sim 83 (slow-4G LCP = SPA cold-load floor; FCP 1.8s, CLS 0.006,
  TBT 140ms after static-splash + parallel boot). Stated plainly, not gamed — SSR is out of scope for a
  local-first app. (WS7-v4)
- D43: v4 "The Ustaad Update" sealed 12-Jul-2026 — 231/231 gates, I1–I13 enforced, THE APP IS FINAL FORM.
  Future change arrives as runtime DATA (library versions, prompts-as-config, budgets, watchlists), never code.
--- v4.1 bulletproof pass (owner-requested, 13-Jul-2026) ---
- D44: DARSHAK MODE IS STRUCTURALLY KEYLESS. Every metered client (dimaag, guru, polish, intel, khabri
  keyed lanes, pulse) checks the Darbaan lock BEFORE fetching — a locked/demo browser takes the
  deterministic path and can never spend a token, by construction (the I12 write-block alone didn't stop
  the spend that happened before the write). Server side: all 7 API functions refuse foreign/absent
  Origins (403 before any key is touched) + optional SIFARISH_OWNER_TOKEN env for full lockdown (missing/
  wrong header degrades to keyless, never breaks the app). Zero mandatory setup.
- D45: Nabz deep-reads the README of every new repo (cached 7d, unauth budget respected): first prose
  paragraph → summary, feature list items → bullets (install/license noise filtered), lexicon-matched
  keywords (same vocabulary the JD decoder speaks, so evidence matching just works), live URL from the
  README body → evidence. The richer the entry, the more precisely the Darzi tailors. Owner still
  confirms every draft (Nabz pattern; the README is his own written truth — I1 intact). (v4.1)
- D46: OWNERSHIP IS SERVER-VERIFIED (v4.2, owner-caught hole). The old local-passcode lock let any
  visitor "set a new lock" in their own browser — harmless for data (local-first) until D44 keyed metered
  spend off isOwner(): two individually-sound decisions composed into a spend hole. Fix at the root:
  /api/darbaan verifies the owner code against SIFARISH_OWNER_PASSCODE (Vercel env — the lock lives on
  the server, in no browser), issues x-sifarish-token = SHA-256(code), and all 7 metered functions REQUIRE
  it. The Gate screen (Owner vs Demo) is the only door; local-passcode flow survives solely for
  self-hosted clones without the env. Lesson encoded in §14. (13-Jul-2026)

--- Session 5.4 "The Bullet Forge" (owner-reported: "the resume is weak / AI slop") ---
- D56: THE RESUME WASN'T BADLY FRAMED — IT WAS BADLY FED. Owner reported the tailor as "dumb, AI
  slop, not Shaurya-specific". Root cause was NOT the compiler/editor/Ustaad rubric (all correct):
  `distillReadme` treated ANY README list item ≥25 chars as a resume bullet, so `- App: https://…`
  and `- Docs: /docs` RENDERED ON HIS RESUME as project accomplishments. Selection cannot fix
  supply — the tailor picks which bullets run, it cannot invent good ones — so the fix belongs at
  the source. THE BULLET FORGE (src/lib/nabz/forge.ts): (1) `isResumeBullet` deterministically
  rejects link-dumps/labels/fragments (the keyless core — slop dies with zero API keys); (2) the
  reasoning tier reshapes surviving material into proper bullets (verb → what → how → why); (3)
  every forged bullet is guarded against the README via `detectDrift` — a number/tech/proper-noun
  the README never claimed is DISCARDED. Keyless/over-budget/drift → sanitized deterministic
  bullets. I1 holds by construction: the LLM may only re-express what he wrote about his own work
  (D45's trust boundary), and the compiler still renders only evidence-linked ledger bullets.
- D57: SECOND BUG, SAME FUNCTION — markdown list items that WRAP across physical lines were sliced
  at the newline, which is why a real bullet ended mid-clause on his resume ("…updates, so the
  app"). The distiller only ever read the matched line. Now a match consumes its continuation
  lines. Both defects have regression tests built from the EXACT strings off his broken resume.
- D58: PROJECT CONTEXT (types.ts `ProjectContext`) — the deep-read README is now stored on the
  ledger entry as SOURCE MATERIAL (problem / features / stack / cleaned prose), and the Editor's
  Desk reads a `projectBrief` instead of the one-line `p.summary` it used to cast and angle from.
  That thinness was why framing felt generic — the reasoner had nothing specific to reach for.
  Read-only by construction: the brief informs FRAMING (which project leads, which bullets, what
  order); it can never become resume text (D28 — Dimaag proposes, compiler disposes), so widening
  the reasoner's context adds ZERO fact-drift surface.
- D59: LOCAL-FIRST MEANS NO MIGRATION CAN REACH HIS DATA. The forge fixes what Nabz drafts from
  now on, but the entries already in his vault carry the old scraps. So the repair is an explicit,
  owner-confirmed re-read: `refreshEntryFromRepo` + "⟳ Re-forge all" in Nabz. It replaces ONLY the
  fields Nabz owns (summary/bullets/context/live-URL) and never touches what he curated by hand
  (title, tier, resumeEligible, tags, dates). Nabz pattern intact: it drafts, he confirms.
- D60: Cover letter exports as PDF + DOCX (`renderLetterPdf`/`renderLetterDocxBlob`). Portals
  require an uploaded file; a copy-only letter was a packet that stopped one step short of the
  actual application. Unlike the resume it PAGINATES rather than throwing on overflow — a letter
  is prose, the one-page law is the resume's. Its own I5 parse-back gate proves the text layer.

- D61: BAITHAK WASN'T STUPID, IT WAS BLIND — the same disease as D56. Its system prompt carried a
  ledger digest and NOTHING ELSE: not the company, not the JD, not the archetype, not the casting
  rationale, not the vision, not the current resume — and it sliced every bullet to 50 chars, so it
  reasoned about evidence it could not read. Asked to "aim this at the role" it had no role. Fixed:
  full role brief (job + JD must-haves + missing/in_forge keywords + archetype + why the lineup was
  cast) + the resume as it stands + whole bullets + deep-read context (D58) + last-6-turn memory.
  It may also now ANSWER a question with zero ops — forcing an edit on "ye kyun chuna?" was itself
  a source of the dumbness.
- D62: BAITHAK CAN NOW DO THE TRUE THING HE ASKS. Owner: "sach hi bole usmein dikkat nhi, but jo
  sach waala kaam bolun toh tailor voh karre toh sahi." The op vocabulary was select/order/link
  only, so "ye skill hata" and "GLOAMING ko aise explain kar" hit a wall — read as stupidity, not
  safety. Two new ops, both structurally unable to lie: (1) `set-entry` — drop/restore ANY ledger
  entry for THIS packet (packet-scoped `excludedIds`, applied at the compiler's single eligibility
  gate so it cannot leak through a section; his ledger is never edited — a resume is a selection of
  the truth aimed at one reader, and hiding a true thing is honest tailoring); (2) `reframe-project`
  (src/lib/polish/reframe.ts) — re-express a project's bullets toward his stated direction, where
  every rephrasing must survive `detectDrift` against ITS OWN original or be DISCARDED. Wording is
  his, facts are frozen; the override renders under the SAME evidence link, so I1 holds. The
  guardrail he wanted removed is what makes saying yes to him safe — so the fix was widening the
  vocabulary, never loosening the guard.
- D63: The Baithak's live reflection already worked — PacketScreen's packets is a `useLiveQuery`,
  so `db.packets.put` re-renders the resume on apply. The perceived failure was the op vocabulary
  (D62), not the plumbing. Verified before touching it; no change made.

- D64: THE DEPTH WAS ALREADY THERE — IT WAS LOCKED. Owner: "linkedin itne saare AI engineer role
  dikha raha hai, sifarish kyun nahi." His radar already held 1002 scored roles; VISIBLE_CAP=15
  showed fifteen, with no way to ask a question of the rest. D6's cap stays (an unasked-for
  firehose IS spray) but SEARCH IS NOT SPRAY — it is the opposite: a deliberate, specific hunt.
  So a query shows EVERY match and the cap now rules only the unfiltered default queue; plus an
  explicit "show all N". Word-PREFIX matching, not substring — his own example ("ai" → all the AI
  roles) is exactly what a naive .includes() breaks on ("Chain", "said"). Same search added to
  Morcha across all columns, "+8, +8" replaced with show-24 / show-all / collapse, and each column
  scrolls in its own box so a 996-card column can't stretch the board.
- D65: DEAD ROLES WERE EATING THE TOP 15 (owner-caught in his own screenshot: LangChain "updated
  511d ago" ranked #3 at 85/100 — the literal cause of "top 15 mein se kayi mere liye hote hi
  nhi"). The rubric scored WHAT a role is and never WHEN it was posted. Fixed as a DEDUCTION
  (`stalenessPart`), not a 7th rubric dimension: his tuned weights keep their meaning, no settings
  migration, and the penalty renders in "why this score" like every other part (L4 — never hidden
  math). Bands to -30 past 240d; a board that publishes NO date is never punished (we penalise
  evidence of staleness, never its absence). 511d LangChain: 85 → 55, out of the queue.
  NOTE (Law 12 / §14): the radar's SOURCE breadth is still 29 ATS boards + the keyed lanes — this
  session unlocked and cleaned the existing catch; it did NOT add new discovery sources.

- D66: THE MARKET MOVED DAILY, THE APP ASKED MONTHLY. Owner: "LinkedIn pe roz naye roles aate
  hain, idhar bhi vaise hi hone chahiye." Root cause was one word repeated 11 times: EVERY seeded
  hunt requested `datePosted: 'month'`, so each sweep re-pulled a month-wide window — the same
  month-old listings returning day after day — while LinkedIn showed "1 hour ago" (his screenshot).
  The aggregator supports today/3days/week and we never used them. Seed default → 'week', plus
  `migrateHuntFreshness` (D59's lesson again: a seed change reaches NOBODY with an existing vault),
  flag-guarded and skipping any hunt whose window HE set (`ownerSetDate`) — his choice outranks our
  default, always. Combined with D65's staleness deduction, old postings now neither arrive as
  often nor hold a top slot when they do.
- D67: THE HUNT PANEL MOVED TO THE RADAR. The hunts ARE the lane that reaches LinkedIn/Indeed/
  Glassdoor (JSearch aggregator, D18/D21) — they were just steered from the Khabri screen, so the
  Radar looked shallow while the machine that fills it sat elsewhere. Hunts now live on the Radar:
  what's being hunted, a per-hunt freshness window, add/remove, and "Hunt now". Discovery stays
  API-only + human-triggered (I3/I21): no scraping, no auto-apply.
- D68 (SCOPE HONESTY, unresolved): his "top 15 mein se sirf 5 kaam ki" is a RELEVANCE complaint
  that D64-D67 only partially answer. Fresher input + staleness penalty + search + the hunt panel
  raise the ceiling, but the queue is still ranked by a 6-dimension rubric over hunts written at
  seed time, NOT by his vision. The untested hypothesis for a future session: derive the hunt
  queries from `visionProfile` (the Vision Engine already exists) and let the Pulse propose hunt
  edits the way it proposes rubric edits. NOT attempted here — weekly budget. Do not claim the
  relevance problem is solved.

- D69: THE VISION NEVER REACHED THE HUNT. `deriveHunts(vision)` has existed since the Vision
  Engine shipped — but it lived behind a manual button in SettingsScreen and NEVER wrote to the
  live `savedHunts`. So his queue was hunted with the GENERIC seed queries written before his
  vision existed ("AI engineer intern India remote"), which is exactly why the top 15 read as
  someone else's list. Same failure shape as D64/D67: the capability was BUILT, then not WIRED.
  Now one click in the Radar's Hunt panel proposes every hunt his vision implies, each with its
  reason, and he adds the ones he means (Nabz pattern; deterministic, zero budget, zero key).
  STILL OPEN (do not claim otherwise): nothing auto-derives on a vision EDIT, and the Pulse does
  not yet propose hunt edits the way it proposes rubric edits. D68's relevance problem is
  narrowed, not closed.
- D70: SECURITY EVENT — the owner passcode was pasted into plaintext chat (15-Jul-2026).
  Per §10 and the D11/D20/D24 precedent, SIFARISH_OWNER_PASSCODE MUST BE ROTATED in Vercel env.
  It is the server-side gate for all 7 metered functions (D46), so a leaked value is a spend hole,
  not just an access one. It was never written to any file and never used by the session.
- D71: SESSION 5.4 SCOPE HONESTY. Shipped across four commits: the Bullet Forge (D56-D60), the
  Baithak's sight + vocabulary (D61-D63), Radar search/staleness (D64-D65), hunt freshness + the
  hunt panel (D66-D67), vision-derived hunts (D69). 330/330 gates, warning-free build. BUT: only
  Proof 1 of §14's Four Proofs was executed. NO live run, NO fresh-eyes walkthrough, NO adversary
  pass, NO LLM path driven (forge, reframe, smart Baithak all unexercised against a real key), and
  the GitHub README screenshots were NOT produced (they need a live Owner-Mode browser session).
  This session is NOT sealed and must not be described as such.

--- Session 5.4 LIVE PROOF PASS (§14 Proofs 2-4 executed against the real deployment) ---
- D72: NABZ LOGGED A CONSOLE 404 ON EVERY MOUNT. SHV27/demo is a real repo with NO README, so
  fetchReadme 404'd — and misses were never cached, so it re-fired on every panel mount. Negative
  cache (tombstone for the normal TTL) → one request per week per README-less repo instead of one
  per mount. Found by the live owner smoke, not by any gate. Gates test what we built; only a
  browser tests what a user meets.
- D73/D74: THE REASONING TIER WAS SILENTLY DEAD, AND I GOT IT WRONG TWICE BEFORE GETTING IT RIGHT.
  Measured live 15-Jul-2026 (spacing calls to exclude 429s — a fast probe rate-limits itself and
  poisons the reading, which is exactly how hypothesis #1 fooled me):
    * WRONG #1 "max_tokens too low": one sample showed 900 fail / 2500 pass. False. Spaced retest:
      900 both passed AND failed; 2500 failed twice. max_tokens is not the variable.
    * WRONG #2 "flaky → retry it": 3 attempts x 4 calls = 12 consecutive failures. The failure is
      DETERMINISTIC, not transient. A retry alone fixes nothing.
    * RIGHT: the response_format MODE is the variable, and the prompt fights it.
        json_object  temp 0.2 → 0/3      json_object temp 1.0 → 0/3   (temperature irrelevant)
        json_schema  temp 0.2 → 2/3      (short prompt)
        json_schema + prompt WITHOUT its own "Return JSON: {…}" lines → 3/3
      openai/gpt-oss-120b essentially cannot satisfy json_object; and prose "return this JSON shape"
      instructions CONFLICT with a supplied schema and reintroduce the failure.
  WHY IT SURVIVED CERTIFICATION: every caller treats a failed call as "degrade to the deterministic
  heuristic", and that fallback is SILENT BY DESIGN (I4). A dead LLM tier is indistinguishable from
  a healthy keyless app — 330 gates stayed green while the budget was spent on 400s. The owner
  diagnosed it from feel ("dimaag hi nahi hai") long before any test could. I4's virtue is also its
  blind spot: a fallback that never complains hides the thing it is falling back FROM.
  FIX: /api/dimaag accepts an optional JSON Schema → asks for json_schema output; forge + reframe
  pass theirs and dropped their Return-JSON prose. Retry kept as belt-and-braces at both choke
  points (client core + the server function holding the key, RC3).
  PROVEN: tests/live-forge.test.ts (SIFARISH_LIVE=1) drives the REAL prompt over his REAL README
  against the REAL model and asserts forged bullets survive isResumeBullet + detectDrift. Passes.
- D75 (OPEN, NOT SOLVED — next session's first job): decide / critique / classify still pass NO
  schema, so they remain on the json_object path that measured 0/3. The entire Editor's Desk
  (archetype → casting → angle → red-team) is therefore still running on heuristics in production.
  This is the single highest-value fix left in the app. Do not describe the reasoning tier as
  working until each of those call sites passes a schema and a live probe proves it.
- D76: PROD WAS TWO SESSIONS STALE. Vercel's last production deploy was commit a0fa212 (D54) —
  D55's owner-caught vault fix NEVER SHIPPED, nor did any of Session 5.4. `git push` does not
  deploy this project (past deploys carry actor=claude-code_agent). A deploy needs the owner's
  credentials; none are present locally (no VERCEL_TOKEN, no ~/.vercel). ALWAYS verify the prod
  asset hash after a push — a green local build proves nothing about what users are running.
- D77: OWNER SMOKE (scripts/owner-smoke.mjs) — the §14 Proof-2/3 harness. Drives the live
  deployment through the Gate with SIFARISH_PASS from env (never a repo file), walks every screen,
  and reports console/HTTP errors. Live run confirmed: server-verified owner (not local fallback),
  greets Shaurya, zero demo-persona leak, all 7 screens render.
- D78: SECURITY — the owner passcode reached plaintext chat (15-Jul). SIFARISH_OWNER_PASSCODE MUST
  BE ROTATED (§10, D46): it gates all 7 metered functions, so a leak is a spend hole. It was used
  ONLY as an env var for the live proof and written to no file.

- D75 CLOSED (was the open wound): decide / critique / classify now pass schemas and dropped their
  shape prose. Live-verified 15-Jul: decide 3/3 ("choiceId":"proj-sifarish", real reasoning),
  classify 3/3 (agent-eng @0.95). The Editor's Desk (archetype → casting → angle → red-team) is
  reasoning in production for the first time since the D35 migration.
- D79: TWO BUGS THE GATE CAUGHT THAT I HAD ALREADY "FIXED". (1) My prompt edits silently no-op'd —
  schemas were added while the conflicting "Return JSON:{…}" prose stayed, which measures as STILL
  BROKEN. (2) The smart Baithak posts to /api/dimaag directly, bypassing the core, so it had no
  schema at all. Both were invisible in the diff and would have shipped as a confident "fixed".
  tests/dimaag-schema.test.ts now asserts both rules deterministically, in the keyless suite.
- D80: STRICT MODE HAS A RULE THAT LOOKS LIKE MODEL STUPIDITY. Groq/OpenAI `strict: true` requires
  EVERY key in `properties` to appear in `required`; an optional field must be a nullable union
  (`type: ['string','null']`). Break it → the request is rejected outright (0/2 live, empty output),
  which is indistinguishable from "the LLM is dumb". decide/classify/forge passed only because all
  their properties happened to be required; the Baithak's optional `refuse` + 7-field op made its
  schema invalid. Fixed + gated (the strict-validity checker is executable, not folklore).
  Live-verified: "ye Python skill hata do" → set-entry{skill-python,on:false} 2/2; "add Kubernetes"
  → refuse{term,reason} 2/2 (I11 holds under real structured output).

- D81: THE GUARD WAS TECHNICALLY RIGHT AND PRACTICALLY USELESS. reframeProject guarded a
  rephrasing against ONLY its own bullet, so "GLOAMING ko agentic angle se explain kar" → "agentic
  AI narrator" was rejected ("agentic" isn't in that one sentence) — correct by the letter, wrong
  by the intent: GLOAMING IS agentic and he wrote so in his own README. Permitted source is now the
  whole ENTRY (bullets + summary + tags + deep-read README context) — the same trust boundary the
  forge already uses (D45/D56). A fact from anywhere in his own writing about his own project is
  not an invention; a fact from nowhere still dies. I1 holds; the feature now works.
  LESSON: an invariant scoped too narrowly reads as stupidity. The honest question is not "can I
  prove this sentence?" but "has he already claimed this, anywhere I can verify?"
- D82: LIVE-VERIFIED PER PATH (15-Jul, each probed separately — a passing sibling proves nothing):
  decide 3/3 · classify 3/3 (agent-eng @0.95) · critique 2/2 (REVISE on the link-dump resume) ·
  Baithak 2/2 (set-entry emitted; "add Kubernetes" refused) · forge 2/2 · reframe 2/2.
- D83: THE SCREENSHOTS WERE NEVER COMMITTED — .gitignore's unanchored `screenshots/` matches that
  dir name at ANY depth and swallowed docs/screenshots/; `git add -A` reports success while adding
  nothing, and I reported "added" without checking `git ls-files`. All nine README images 404'd.
  This was ONE HOUR after writing D76's lesson ("a green build proves nothing about what users are
  served") — the same mistake in the very next commit. Anchored to /screenshots/; verified by live
  raw.githubusercontent.com fetches (200 + byte counts), not by the command's exit code.

- D84: "LEDGER DEPTH" WAS INVISIBLE, NOT MISSING. Owner: "SUTRADHAR itni si detail? GLOAMING ki
  README bhi toh badi thi." Root cause was two-fold: (1) distillReadme's own caps were tighter
  than needed for SOURCE MATERIAL — problem statement 400 chars/2 sentences, features capped at 5,
  raw README at 6k — deepened to 1200 chars/5 sentences, 8 features, 12k raw (D28 protects the
  one-page law regardless of ledger depth, so widening the SOURCE costs nothing at compile time).
  (2) The real gap: `entry.context` (D58's deep-read README, problem, stack, features) was stored
  and used by the Editor's Desk but NEVER rendered anywhere — Shelf showed only entry.bullets
  (2-3 lines), so the depth that existed was invisible and felt absent. Shelf now has a "▸ deep
  context" disclosure per project: problem statement, stack, every captured feature, char count
  and read-date of the source README. Read-only — editing still targets entry.bullets.
  Separately confirmed: SUTRADHAR/DARYA/MUNSHI/KATHA/YOJANA/BRAILLIX are thin because they carry
  NO linked GitHub repo in the seed (Nabz has nothing to forge from) — not a code defect; his
  action item is linking a repo or writing bullets by hand for those entries.

--- Session 5.4 continued: the Vision Lens + the last console error (16-Jul-2026) ---
- D85: THE VISION LENS closes D68. His top 15 read as "someone else's list" because the rubric
  scored what a role IS (AI-ness, ledger fit, remote, window) but never whether it is the role HE
  wants. LinkedIn ranks on stated preferences; SIFARISH did not. Fix: `visionPart` (score.ts) — a
  role whose TITLE matches a named target role is the strongest signal (exactly what a board ranks
  on), dream themes are secondary, a not-interested hit is a real penalty. Bounded +24/-20, total
  clamped to 100, rendered in "why this score" (L4). No vision → neutral (backward compatible).
  Threaded through scoreJobCached with a vision signature in the cache key. Also: deriveHunts
  expanded 7→15 PHRASE_RULES + remote/India variants — live it now proposes 27 vision-derived hunts
  (was 4), so the net catches far more corners. Gated: on-vision title outranks generic; penalty
  renders; no-vision neutral; total<=100; >=8 distinct hunts. STILL OPEN: the Pulse does not yet
  PROPOSE hunt edits automatically (D68's last sub-hypothesis) — left for a future session.
- D86: THE LAST CONSOLE ERROR, KILLED STRUCTURALLY. A DIRECT browser fetch to api.github.com that
  404s (SHV27/demo has no README) or 403s (60/hr unauth) logs a red "Failed to load resource" the
  JS cannot suppress. D72's negative cache reduced it to once-per-fresh-browser; it could not
  remove it. Cure: /api/gh proxy — Nabz fetches GitHub SERVER-side (PAT, 5000/hr) and gets a clean
  200 ({readme:null} / {rateLimited:true}); the browser never touches api.github.com, so it can
  never log a GitHub 4xx. Keyless-safe (no PAT → anonymous fallback), fixed-allowlist path (not an
  open proxy). Live owner-smoke after deploy: ERRORS (0), all 7 screens, search + 27 vision hunts.

- D87: MORCHA WAS FORWARD-ONLY — a misclick was permanent. Owner: "galti se interview button dab
  gaya toh company promote ho gayi, demote-promote dono chahiye." Every card advanced but could
  never walk back; a verdict (offer/rejected/ghosted) was a dead end. Added a PREV map: every card,
  verdicts included, moves back one stage. Promote AND demote, always reversible.
- D88: DISCOVERY BREADTH (partial — honest scope). The keyless lanes (Remotive/RemoteOK) searched
  only hunts[0], so the wider vision-derived hunt set (D85) never reached them — now Remotive runs
  the top 6 distinct hunts and RemoteOK matches all their keywords (free, zero budget). JSearch
  perRunCap 6→10 + monthlyCap 200→300 so more of the LinkedIn/Indeed-class hunts run per sweep;
  ensureBudgets now raises an existing vault's caps to a higher default (never lowers a manual one
  — the D59 local-first lesson). NOT DONE: no NEW discovery source/provider was added; this widens
  the existing lanes. "Every corner of the world / one-stop / beat LinkedIn outright" remains a
  larger, unfinished ambition — do not claim it closed.

- D89: THE SELF-EVOLVING DISCOVERY LOOP (closes D68's last hypothesis). The Pulse detected trending
  market skills but only logged them to the changelog. Now a trending skill/role becomes a PROPOSED
  radar hunt on the brief; accepting it (human-confirmed, Nabz pattern) adds the hunt to savedHunts,
  so the Radar starts finding those roles. Khabri sees the trend -> the Radar hunts it. Deduped by
  query, marked ownerSetDate. Gated (add/dedupe/no-hunt-backward-compat).
- D90: TWO GENUINELY NEW DISCOVERY CORNERS (owner-requested: "duniya ke har corner se"). Added
  Arbeitnow (Europe + remote) and Jobicy (global remote) as keyless lanes — both verified live
  16-Jul-2026 (200 + CORS `*`), both self-filter to AI-relevant roles, zero budget. Live proof:
  Arbeitnow surfaced "GenAI/Agentic AI Solutions Architect @ Accenture Frankfurt", Jobicy surfaced
  LATAM/global-remote AI roles — corners the 29 ATS + US-remote lanes never reached. Himalayas was
  evaluated and REJECTED (no CORS header — would need a proxy). This is the first NEW provider added
  since v2; the honest "no new source" caveat from D88 is now partially closed on the keyless side.

- D91: TIDY REPO-LESS PROJECTS (owner-requested). DARYA/MUNSHI/etc. carry no GitHub repo, so Nabz
  can't forge them and they render thin — he wants only real repo-backed shipped work for now.
  Local-first → only he can trigger it, so a confirmed one-click in Nabz removes ONLY kind:'project'
  entries with no evidence.repo (skills/education and any repo-backed project are never touched).
  Reversible by construction: add the repo + re-forge and they return. Gated.
--- Session 5.4 SEALED status (16-Jul-2026): D56-D91 shipped across ~14 commits; 358/360 gates
  (2 live-only skips); every change deployed AND verified by prod asset-hash + a live owner-smoke
  showing ERRORS(0) across all 7 screens; README screenshots refreshed (Vision Lens visibly ranks
  his roles 95-100). The Vision Lens (D85), self-evolving Pulse->hunt loop (D89), two new global
  discovery corners (D90, Arbeitnow+Jobicy), reversible Morcha (D87), the working reasoning tier
  (D74/D75), the Bullet Forge (D56) and the zero-error GitHub proxy (D86) are all live. OPEN, stated
  honestly: infra-scale discovery breadth ("literally every corner") remains larger than any one
  session; owner passcode + Vercel token still need rotation (both reached chat).

--- Session 5.5 "The Duniya Update" (owner-requested OPEN items, 16-Jul-2026) ---
- D92: INFRA-SCALE DISCOVERY (owner's #1 want, "duniya ka har corner, beat LinkedIn"). Two genuinely
  new global sources behind ONE self-contained edge proxy (api/khabri/aggregators.ts; Vercel Hobby
  caps functions at 12, so 10→11): Adzuna (KEYED, 18 country markets with real salaries — live US 129k
  / CA 21k / IN 9.3k / DE / SG / AU / FR / PL / BR / MX / ES / IT / NL / ZA / BE / AT / NZ) + Working
  Nomads (KEYLESS, no-CORS→proxied, global remote). Keys server-side only (ADZUNA_APP_ID/KEY, §10).
  Guard at the choke point (D46): origin allowlist + owner token — foreign origin 403, no token →
  keyless, PROVEN LIVE on the deploy. One request = one country (perRunCap 8 = 8 geographies/sweep),
  budget-capped (I8); mergeDiscovered dedupes by construction. Himalayas (max 20/page, 2/20 AI,
  no-CORS) + The Muse (no free-text search) evaluated and REJECTED — padding the count would be the
  opposite of the app's ethos. +11 tests. Live sweep proof: Adzuna 20 IN jobs, WN 6 AI jobs.
- D93: DEEPER PER-JD TAILORING. The Editor's Desk reasoned thinner than it looked: company intel
  reached casting only as a citation URL (never read), the angle saw NO JD/intel (archetype-only),
  the deep-read README (D58) never reached the reasoner, must-haves were flat-weighted, the red-team
  judged blind to the role. Five I1-SAFE levers (emphasis/order/rationale only — the compiler still
  renders only evidence-linked bullets, D28, so ZERO fact-drift surface): (1) intel TEXT → casting +
  keyless heuristic, so which project LEADS is company-specific; (2) a JD-driven angle option + JD/
  intel in the angle prompt, and the chosen angle now actually shifts bullet emphasis (D27); (3)
  projectBrief feeds the deep README + 8 features; (4) decodeJD emits mustHaveWeights (2-4 by JD
  prominence), entry/bulletRelevance weight by it (additive → flat +2 when absent, nothing regresses);
  (5) redTeamPass(decode, arch) — JD-aware standard + keyless must-have-coverage check. +8 tests.
- D94: GURU DEEP AUDIT (one of 3 parallel read-only audits; found real bugs the 358 gates never
  caught). #1 `position` ledger entries were SILENTLY DROPPED from the dossier — Guru was blind to his
  exec/leadership roles (the prompt lets him claim only what's summarized). #2/#4 the vision guardrail
  was bypassable by ANY flag word anywhere ("you should deliberately target Google" passed) and ignored
  his ACTUAL notInterested list; rewritten SENTENCE-AWARE (a flag must sit in the same/prior sentence)
  + driven by his real avoids ('ai' guarded so on-vision advice is never flagged). #5 the vision scan
  ran only at [DONE] (a misaligned pitch streamed in full first) → mid-stream tripwire, like I9. #3 the
  ledger sat last so the server cap clipped it first → moved above briefs/pulse, cap 8000→12000. +6 tests.
- D95: DAK MATCHER FIXES. A rejection that MENTIONS "interview" was classified as an interview
  (STRONG_REJECT now tested BEFORE interview; a bare "unfortunately" still doesn't outrank a real
  interview cue). Domain matching was a raw substring ('lever'⊂clever.com, 'scale'⊂scaleway.com,
  'meta'⊂metamask.io) → label-boundary match; ATS relay list widened. The I3 send-ban grep gate gained
  draft/insert strings (drafts.create, gmail.insert, /drafts/send…) and now walks api/, not just src/.
  +4 tests.
- D96: SETTINGS/SCORING FIXES. A present-but-UNPARSEABLE posting date yielded NaN → every `NaN<=n` is
  false, so it fell through to the max -30 penalty + "Last touched NaNd ago"; an unrecognised date is
  now treated like a missing one (penalise evidence of staleness, never a parse failure). The Vision
  Lens's STRONGEST levers — target roles (title match, +16/+24) + not-interested lanes (−18/−20) — were
  frozen at the seed with NO Settings UI ("built but not wired", and exactly D68/D85's relevance
  complaint); added editable controls, so he now tunes what LinkedIn ranks on. Budget-bar %-guard on a
  0 cap. +4 tests. (`adzuna` budget renders automatically — Settings iterates db.budgets, no hardcoded list.)
- D97: HARNESS — vitest's default `threads` pool fails to init its worker runner under Vite 8
  (Rolldown) + Node 24 on Windows (every file errored at describe() while each PASSED in isolation — an
  environmental toolchain bug, not app breakage). `pool:'forks'` in vitest.config restores it and is
  faster (8s vs 38s). Caught because `npx vitest run` showed all-red at session start; the app was fine.
- D98: SECURITY — the owner passcode (`Vers@tile1`) and a fresh Vercel deploy token both reached
  plaintext chat this session. Per §10 / D46 / D70: SIFARISH_OWNER_PASSCODE MUST BE ROTATED in Vercel
  env (it gates all metered functions — a leaked value is a spend hole), and the Vercel token revoked
  (Vercel auto-revokes). Neither was written to any file; the passcode was used only as an env var for
  the live proofs, the token only for `vercel deploy`.

## 14 · THE SENTINEL PROTOCOL (post-mortem law — read BEFORE any change, follow to the letter)

Written after the v4/v4.1/v4.2 sequence, where "final" had to be declared three times because two holes
survived certification and THE OWNER had to find them. Root-cause analysis of that failure, made law:

**Why it happened (never repeat these):**
- **RC1 — Client state was treated as identity.** The owner lock lived in localStorage; "owner" meant
  "whoever set a passcode on this device." Fine for local data — until another change made isOwner()
  unlock metered spend. LAW: anything that gates MONEY, IDENTITY, or PRIVACY is verified SERVER-SIDE.
  Client state is a convenience, never a credential.
- **RC2 — Certification tested features, not adversaries.** Gates asserted what we built; nobody played
  the stranger. The owner found both holes in minutes by opening the app from a second Gmail. LAW: no
  "done/sealed/final" without the RED-TEAM PASS below, executed and pasted as evidence.
- **RC3 — Enforcement sat downstream of the side effect.** Token spend happened before the database
  write-block that was supposed to stop the visitor. LAW: the guard lives at the choke point of the
  resource itself (the serverless function holding the key; the DB layer holding the data) — never only
  in UI, never only after the cost is paid.
- **RC4 — "Sealed" was declared while the last diff was minutes old.** Confidence language outran
  verification. LAW: the word "done" is EARNED by the Four Proofs below, in order, with output shown.

**THE FOUR PROOFS (all mandatory before claiming any change is complete):**
1. **Machine proof** — full gate suite + typecheck + warning-free production build, zero skips.
2. **Fresh-eyes proof** — scripted walkthrough from a WIPED browser profile (screenshots ×3 breakpoints,
   zero console errors), because the owner's warmed-up browser hides first-run bugs.
3. **Adversary proof (the red-team pass)** — act out each persona against the LIVE deployment and paste
   the results: (a) fresh visitor — must reach demo, spend ₹0, mutate nothing; (b) curl scripter with no
   Origin — 403 on every function; (c) self-appointed owner — fabricated client state/token must not
   spend; (d) second-device stranger — must find NO way to set, reset, or bypass any lock; (e) the real
   owner — full happy path works end-to-end with real keys.
4. **Money proof** — enumerate EVERY code path that can spend a metered resource (grep the fetch sites),
   and show each is (i) owner-gated client-side, (ii) token-required server-side, (iii) budget-capped (I8).

**Cross-feature blast radius rule:** changing what a definition MEANS (owner, shipped, ready, keyless)
re-opens every consumer of that definition — grep them all and re-reason each before shipping.

**Every bug fix ships with the regression test that would have caught it.** No exceptions — the test IS
the apology.

**Evergreen rule (Law 12 sharpened):** at session start, live-verify every volatile dependency (model
IDs + deprecation pages, API shapes, quotas). Anything dated gets a shutdown-date check; anything
expiring gets migrated NOW with its migration noted in §12. Prefer boring, stable, pinned tech; new
knowledge enters as versioned DATA (I13), not code.

**The seal (restated):** SIFARISH changes through data — ledger, vision, watchlists, budgets, Ustaad
library versions, env values (owner code, keys). If code must ever change again, it is an exceptional
event that requires this entire protocol, the Four Proofs, and an appended decision line explaining why
the seal was broken.
- D47: NABZ VISIBILITY IS PERMANENT (owner-caught: his own SIFARISH repo — the app itself — wasn't
  showing in Sync). Root cause: `computeSuggestions` treats any past 'dismissed' status as a forever
  block (`if (isDismissed(...)) continue`), so one "Not now" click (or any stale suggestion record)
  hides a repo from the pending list permanently with no way back. Fix: NabzPanel gains "show every
  public repo, unfiltered" — `overviewRepos()` lists ALL non-fork repos with true status (shipped/
  in_forge/pending/dismissed/untracked), and `forceAddRepo()` is an upsert (not put-if-absent) that
  resurfaces ANY repo as a fresh pending suggestion regardless of dismiss/accept history. "GitHub ka
  sab dikhna chahiye" is now structurally true — nothing hides forever. (v4.3, 13-Jul-2026)
--- Session 5 "The Pehchaan Repair" (root-cause, 13-Jul-2026) ---
- D47: THE DISEASE WAS ONE ROOT CAUSE, NOT FOUR (owner-reported: greeted as demo 'Arjun'; edits vanish on
  reopen; leaky modes; token-spend fear). Reproduced from a wiped profile: a SINGLE Dexie store 'sifarish'
  shared by owner+demo, seeded with the demo persona, with identity as a boolean flag; and durable storage
  never requested (navigator.storage.persisted()=false → eviction). Cured by rebuild, not patch (Law 13).
- D48: PEHCHAAN (src/lib/pehchaan.ts) — THE single identity resolver. Mode resolves synchronously at boot;
  every transition (unlock/lock/demo) persists + FULL-RELOADS so store+identity+gates recompute from one
  truth. No component infers mode any other way. The senior call: reload-on-transition eliminates the
  entire "stale store / wrong identity flash" class (simpler + safer than a live-swapping proxy).
- D49: TIJORI (src/db/db.ts + tijori.ts) — TWO physical Dexie DBs (sifarish_owner / sifarish_demo) that can
  never clobber. Owner vault seeds ONCE from the real seed (dynamically imported → demo visitors never
  download his PII) with a safe migration from the pre-S5 single store; demo vault seeds the fictional
  persona. navigator.storage.persist() requested at boot; debounced AES-256-GCM auto-backup after every
  owner edit (bounded to 5); restore-on-empty at boot. loadOwnerSeed clobber footgun removed; seed is
  import-if-empty only. The 'Arjun-in-owner' + 'edits vanish' classes are now structurally impossible.
- D50: Atelier Baithak (talk to the letter, I11 extended) — signature/tone/tighten/swap-proof ops as diff
  cards; adversarial 'add X (no evidence)' → refusal + Gap Note. Alignment Map — every JD requirement →
  exact ledger evidence or honest gap → Taleem; honest score, no invented coverage (I1), cited (I7).
- D51: Session 5 sealed 13-Jul-2026 — all Four Proofs (§14) EXECUTED and pasted, incl. live adversary
  (demo visitor: 0 spend + sees Arjun + no owner vault; real owner: greeted Shaurya + edit persists on
  reopen; 7/7 functions 403 no-origin; fabricated token can't spend). 278/278 gates. THE CURE HOLDS.
- D52: NABZ REGRESSION KILLED FOR GOOD + vision-aligned. The 'SIFARISH not showing in Nabz' bug recurred
  because Session 5's store-split migrated a DISMISSED suggestion record, and the D47 'show all' was a
  buried toggle. Root fix: Nabz reframed from a suggestions-feed into "YOUR GITHUB, DEEPLY READ" — EVERY
  public repo is ALWAYS shown (auto-loads on mount), richly: README deep-distilled into a real 1-2 sentence
  summary (prefers the repo's tagline), up to 5 feature bullets, tech stack, keywords, best live URL — each
  with an inline one-click add that works regardless of dismiss history (addRepoToLedger). Nothing is ever
  hidden by a past dismiss — structurally. Deepened distillReadme; overviewRepos now carries the distilled
  detail (cached 7d, capped to the 60/hr unauth budget). Verified live: all 17 repos incl. SIFARISH shown
  with its real tagline, 0 console errors. Regression test uses SIFARISH's actual README. (D52, 14-Jul-2026)
--- Session 5.2 "The Smart Polish" (owner-requested, 14-Jul-2026) ---
- D53: SMART BAITHAK + TIMELESS PROFESSIONAL SUMMARY + declutter. (1) Baithak was a rigid cue-grammar
  parser with no intelligence ("add a professional summary" hit the fallback menu). Fix: deterministic
  parser still runs first (owns the clear intents + refusals = the safe keyless core); when it doesn't
  match (handled=false), a SMART LLM layer with full ledger context proposes structured EditOps — but
  every op is re-validated against real ledger IDs before it can apply (the LLM returns IDs, never free
  text; unevidenced → refusal). I11 holds by construction; owner-only + budgeted + keyless-degradable.
  (2) PROFESSIONAL SUMMARY (src/lib/darzi/summary.ts): a timeless, VISION-framed AI-architect positioning
  line — role from vision.targetRoles, NO project names, NO geography (remote-friendly), NO "currently
  building X" (decays as he ships), AI/ML skills leading, a recompiled shipped-project count as proof.
  Evidence-linked (I1), parse-back-safe (I5). New compiler line-kind 'summary'; default-on; Baithak-
  toggleable via set-summary. (3) Nabz: in-ledger repos collapse to one compact line (no congestion).
  (4) Morcha: columns cap at 8 (score-sorted) with show-more + a clear-found bulk action. (5) CASE_STUDY.md
  written — full engineering post-mortem, every problem v1→v5.2. 291/291 gates, Four Proofs green. (D53)
--- Session 5.3 "The Taalmel" — cross-device sync (owner-requested; seal broken deliberately, §14) ---
- D54: THE LOCAL-FIRST GAP MADE VISIBLE. Owner opened Owner Mode on his PHONE and got a fresh reset —
  because each browser's IndexedDB is its own island (D49's two-vault design is per-device). Not a bug,
  the local-first plan — but his real need is multi-device. CURE: SERVER-BLIND ENCRYPTED SYNC. A new
  Vercel Blob store (`sifarish-vault`, public, unguessable passcode-derived path) holds ONLY ciphertext:
  the vault is AES-256-GCM encrypted with a PBKDF2 key derived from the owner passcode that the server
  NEVER sees (the server holds only SHA-256(passcode) as the gate token — one-way, cannot derive the AES
  key). `/api/vault` (src) is token-gated (401) + origin-checked (403) at the choke point (RC3), same
  guard as the 7 metered functions. FAIL-SAFE BY CONSTRUCTION: no key / decrypt-fail / network-down /
  empty-cloud / not-provisioned → returns quietly, LOCAL DATA STANDS; restore happens ONLY when the cloud
  copy authentically decrypts (GCM auth) AND (is strictly newer OR local is empty). Last-write-wins on a
  local edit-version clock. Client `pushVault/pullVault` are owner-gated (getMode()==='owner') so a demo/
  Darshak browser can never call it (D44 pattern preserved). GOTCHA CAUGHT (Law 12): @vercel/blob needs
  the NODE runtime (fails in Edge, vercel/storage#440), and on Node a bare `export default function` is
  read as the (req,res) Express handler — so the Web Request/Response handler MUST be exported as
  `export default { fetch }` (Vercel Node docs). 302/302 gates (10 new sync gates incl. server-blind,
  fail-safe-no-wipe, last-write-wins, wrong-key-adversary, and the runtime-shape regression). (D54, 14-Jul-2026)
- D55: SESSION 5.3 BUG — origin-check on GET 403'd the owner's OWN reads (RC2 recurrence: my adversary
  proof used curl with an explicit `-H "Origin: ..."` on every call, so it never reproduced what a real
  browser sends). Root cause: browsers omit the `Origin` header on same-origin GET (only non-GET/HEAD
  carries it) — `api/darbaan.ts` already knew this (its origin-check is POST-only); `api/vault.ts` copied
  the check onto every method, including GET, so the owner's own "is sync on?" status check always 403'd
  even though the deployment WAS configured correctly. Owner caught it live from two real browsers
  (normal open showed 74% real data / correct-looking; the Vercel prod tab showed a fresh 40% ledger with
  "Not provisioned" — the tell). Fixed to match the proven pattern: origin-gate on POST only, bearer
  token required on every method (the real boundary). Added a LIVE regression test that imports and
  drives the actual handler with a crafted `Request` carrying no Origin header — not a source grep —
  so a future edit can't silently reintroduce the gate on GET. 305/305 gates; re-verified live against
  prod with curl omitting Origin (the previously-broken scenario), which now returns 200 instead of 403.
  Lesson for future sessions: adversary/live-proof curl calls must mirror what the REAL client sends,
  not the maximally-authenticated request — an over-privileged test can hide a broken default. (14-Jul-2026)
