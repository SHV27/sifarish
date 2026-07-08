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
