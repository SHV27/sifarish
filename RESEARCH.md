# RESEARCH.md — SIFARISH · Evidence Base (compiled 07-Jul-2026)

Every architectural decision below is cited. Claude Code: re-verify anything in §6 live before relying on it.

## 1 · THE INVERSION LEDGER (why tools in this category fail — Shaurya's explicit mandate)

**F1 — Fabrication is now the most-hunted pattern in hiring.**
Greenhouse 2026 AI Hiring Report (via SelectSoftwareReviews, May 2026): 91% of recruiters/hiring managers
have spotted or suspected candidate deception; 74% more worried about fake credentials than a year prior;
AI-generated resume exaggeration is the #1 observed fraud at 63%.
→ Counter: I1/I2 — resume is COMPILED from evidence-linked ledger entries; LLM can rephrase, never mint.
   In-forge skills appear only as a dated "Currently Building" line (which reads as momentum, honestly).

**F2 — Auto-apply automation risks the user's platform accounts.**
LinkedIn User Agreement §8.2 prohibits bots/automated access/scraping; restriction analyses (JobApplyAI May
2026; LinkedNav Jul 2026) show auto-apply tool detection among documented restriction causes — and ZERO
restriction cases where AI drafted and the human clicked Send. Enforcement targets behavioral patterns.
→ Counter: I3 — Send does not exist in SIFARISH. Packets end at files + official apply URL.

**F3 — Mass spray is the losing strategy in a saturated market.**
34% of recruiters spend up to half their week filtering spam/junk applications (SSR/Greenhouse 2026); when
everyone tailors with the same tools, applications become interchangeable and matching degrades (Disher
Talent, Feb 2026); experts recommend quality over quantity, with referrals/direct contact outperforming mass
applying (ProTech Staffing, May 2026); candidate-initiated outreach to hiring managers retains much higher
response rates than inbound (AutoApplyMax industry analysis, May 2026).
→ Counter: sniper quota (~10/week), ranked queue cap, outreach draft in every packet.

**F4 — Generic AI-slop phrasing is instantly recognizable.**
Recruiters report being overwhelmed by generic AI-written applications (Resume Genius 2026 via ProTech);
tested AI resume builders' top failure mode is "generic templated content — recruiters spot it immediately"
(AutoApplyMax tool review, 2026).
→ Counter: Voice Bank + slop-scan gate + The Recruiter council seat (hostile 6-second skim).

**F5 — Pretty resumes die in parsers.**
2026 parser testing: two-column layouts ≈35% of parse failures, tables ≈20%, custom headings ≈15%, graphics/
icons ≈10%, header/footer contact info ≈10%, custom fonts ≈5% (FastApply parser study, Jul 2026). 99.7% of
recruiters use an ATS (Jobscan survey). Modern ATS rank via embedding-based similarity, and ML now detects
keyword manipulation like white-text stuffing (ResumeOptimizerPro, May 2026).
→ Counter: deliberately plain single-column compiled resume; standard headers; MM/YYYY dates; visible URLs;
   no keyword without evidence; parse-back Referee test (I5).

**F6 — PDF is fine ONLY with a true text layer; DOCX is the reliability king.**
Text-selectable single-column PDFs parse cleanly on Workday/Greenhouse/Lever (ResumeAdapter May 2026;
Resumemate 2026); an 8-month cross-ATS test found .docx parsed reliably ~100% across Workday/Greenhouse/
iCIMS while print-to-PDF files can lack a text layer entirely (Skillfuel, May 2026). One 2026 test put
designed-PDF average accuracy at 72% vs 97% for DOCX (ResumeOptimizerPro).
→ Counter: export BOTH — programmatic true-text-layer PDF (never print-to-PDF) + DOCX; parse-back test on
   every export.

**F7 — Trackers get abandoned because updating them is homework.**
Category-wide pattern (job-tracker reviews + burnout reporting, ProTech May 2026: applicants exhausted by
volume). → Counter: tracking is a side effect — "Mark as Applied" on the packet IS the tracker write; nudges
bring users back with a drafted follow-up, not a form.

**F8 — Stale data kills trust.** Boards go stale/empty when companies switch ATS or stop hiring (ATSFeeds,
2026); Lever returns empty arrays for migrated companies (dev-journal ATS analysis, Jul 2026).
→ Counter: fetch-at-view + `updated_at` badges + dead-link probe + watchlist health check.

## 2 · CRAFT OF THE DOMAIN (what the winners do)

- **Skills-over-degrees screening:** 2026 matching tools evaluate demonstrated competencies and portfolios
  over pedigree (Incruiter, Jun 2026) — Shaurya's 5-project portfolio is the asset; the ledger makes it legible.
- **ATS reality:** embedding-similarity ranking means JD-mirroring language matters — mirror exact phrases
  where evidence exists (ResumeHog, Jul 2026); dedicated Skills section + contextualized bullets.
- **Entry-tier silence:** >50% of seekers rejected with zero human contact, concentrated at early-career
  (Enhancv survey, Apr 2026) — hence outreach drafts + follow-up nudges: create the human contact yourself.
- **Reference implementations to study before building:** open-source job trackers/appliers on GitHub for
  schema inspiration ONLY (their auto-send parts are explicitly rejected); Reactive Resume (open-source
  resume builder) for export pipelines; JSON Resume schema as a ledger-format prior art (extend, don't adopt
  wholesale — it lacks the tier/evidence model, which is our novelty).

## 3 · KEYLESS DATA SOURCES (verified 07-Jul-2026)

- **Greenhouse Job Board API:** public, no auth for GETs: `GET https://boards-api.greenhouse.io/v1/boards/
  {board_token}/jobs?content=true` (developers.greenhouse.io). Departments come from a separate endpoint.
- **Lever:** `GET https://api.lever.co/v0/postings/{site}?mode=json` with team/location/commitment/limit
  filter params (fantastic.jobs; Cavuno Apr 2026).
- **Ashby:** public feed, cleanest compensation support via `includeCompensation=true`; returns full HTML
  descriptions — filter `isListed` (Cavuno; dev-journal).
- **SmartRecruiters:** public postings feed exists (dev-journal Jul 2026) — verify exact shape live.
- Gotchas: no public directory of board tokens (curate + probe slug variants); companies migrate ATS
  silently; Lever empty-array ambiguity. CORS behavior from browsers UNVERIFIED → WS3 reality-check task;
  fallback = keyless Vercel passthrough with 6h cache.
- **GitHub REST:** unauthenticated 60 req/hr per IP; PAT raises to 5,000/hr (verify live at build).

## 4 · UX FRONTIER NOTES (for the Experience Director)

Category leaders (Teal, Simplify, Careerflow) read as SaaS-generic — the differentiation opening is a named,
warm, paper-native identity ("Ink & Appointment") + the promotion-ceremony emotional beat. The 6-second
recruiter skim is a real behavior — design the packet preview around it. First-60-seconds onboarding research
(GLOAMING lesson) applies unchanged: taste of success = first packet, fast.

## 5 · STRATEGY FACTS FEEDING THE RUBRIC

- Compulsory window Jan–May 2027; applications filed Jul–Sep 2026 interview through Aug–Oct — by which time
  the July syllabus (LoRA, Transformers, LangGraph/MCP, RAG/evals, deployment, Ollama, ML math) is genuinely
  done and all five projects are live. The truthful resume strengthens weekly via Nabz. No claim ever
  outruns its evidence.
- Comp floor: stipend ₹30–40k/month, or weaker stipend acceptable with explicit PPO/conversion language
  (target ≥16 LPA); remote-international acceptable — rubric must be currency-aware and detect conversion
  language ("PPO", "return offer", "full-time conversion").

## 6 · VOLATILE FACTS — VERIFY LIVE AT BUILD TIME (Law 12)

- [ ] Current stable versions: Vite, React, TypeScript, Tailwind, Dexie, docx, @react-pdf/renderer vs
      pdf-lib (pick per text-layer quality), pdf.js, Vitest, Playwright.
- [ ] Groq free-tier: current model list, rate limits, and endpoint shape for the polish call.
- [ ] GitHub REST rate limits (unauth + PAT) and repos/README endpoint shapes.
- [ ] Greenhouse/Lever/Ashby/SmartRecruiters endpoint shapes + CORS-from-browser behavior (empirical test).
- [ ] Watchlist seed: ~25 AI-first companies actually hiring on these ATSs right now (probe every token;
      include Indian AI startups + global labs; drop dead boards).
- [ ] Vercel serverless function config (runtime, env var handling) current docs.
- [ ] Harvest API deprecation (Aug 2026) is irrelevant to us (we use Job Board API only) — confirm no
      Job Board API changes announced.

## 7 · THE USTAAD SECTION (v4 — resume-craft evidence base, compiled 12-Jul-2026)

The full machine-readable library (patterns + archetype guides + path briefs, every entry cited and dated)
lives in `data/ustaad/library.json` (I13 — the library is data). 42 sources. Honesty rule honored: there is
no public database of "resumes selected at company X" — the library encodes craft patterns with citations;
per-company insight comes from Intel/JD analysis at tailor time.

**Source classes used (full URL list in the library's `sources` array):**
- **Bullet formulas:** Google's XYZ formula via Laszlo Bock (Inc., CNBC); CAR/STAR variants (Wonsulting).
- **Skim science:** Ladders 2018 eye-tracking study (7.4s average first skim, E/F-pattern fixation; HR Dive).
- **University career-center exemplars:** Stanford Career Education resume handout + examples PDFs, UC
  Berkeley Job & Internship Guide, Harvard FAS Mignone Center (strong-resume guide + action-verbs list).
- **ATS parsing:** 2026 multi-system parser tests (single column, no tables/text-boxes, exact-string
  keywords, Month-YYYY dates) — ResumeAdapter, CVCraft 8-ATS test, RecruitBPM.
- **Anti-manipulation:** white-fonting/keyword-stuffing detection + recruiter blacklisting (Jobscan,
  Cangrade, Prosple).
- **Quantification:** recruiter preference for quantified bullets (Resume Worded, Indeed, Forbes).
- **Tech/intern specifics:** Tech Interview Handbook, freeCodeCamp, Interview Kickstart (projects-as-
  experience for interns, live links, 8-15 defensible skills).
- **AI/ML-role craft:** production-over-notebooks signals, LLM/RAG/evals keyword families (Resume Worded ML,
  CV Compiler, MirrorCV).
- **India norms:** one-page fresher rule, CGPA expectations, no photo/DOB (Monster India, ResumeVera).
- **Cover letters:** MIT CAPD + Resume Genius (250-450 words, company-specific, strongest proof first).
- **Hiring-path briefs (Guru v3):** referral vs cold-apply rates (Zippia, Ashby), intern-conversion norms
  (NACE 63.1% 2024-25; Levels.fyi), startup-vs-big-tech interview emphasis (Simplify, Educative), research
  residency requirements (awesome-ai-residency, Google Research residency), remote-international async norms
  (CV Pro Maker, College Simplified).

**Volatile facts re-verified live 12-Jul-2026 (Law 12):**
- Groq DEPRECATED `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` on 17-Jun-2026 (shutdown
  16-Aug-2026, free/dev tiers). Migrated: classify → `openai/gpt-oss-20b`, Guru + polish →
  `openai/gpt-oss-120b` (Groq's stated migration paths; both production models, JSON mode confirmed). → D35.
- Google Identity Services token model current: `google.accounts.oauth2.initTokenClient({client_id, scope,
  callback})` → `requestAccessToken()`; access token ~1h expiry, held in memory only. `gmail.readonly`
  scope; Testing-mode OAuth consent (≤100 users) is exempt from verification. (developers.google.com GIS
  token-model + JS reference.)

## 8 · THE FINAL JANG RESEARCH (Movement 1 — compiled 19-Jul-2026, four parallel research agents)

Honest counts up front: **§8.1 — 15 sources fetched live, 4 blocked** (reddit direct, Ladders primary PDF,
redlib, tealhq). **§8.2 — 11 primary sources fetched, 6 search-verified on credible domains, ~10 SEO-stat
claims dropped as unverifiable.** **§8.3 — every endpoint probed live with curl (HTTP status + CORS header
recorded) or vendor swagger/docs fetched.** No invented numbers anywhere in this section.

### 8.1 · What makes recruiters MOVE (2026 anatomy of winners)

Fetched: r/EngineeringResumes wiki (via its official GitHub mirror, raw), live success threads (pullpush
API), Jake's `resume.tex` read raw (2.8k★), MIT CAPD, CMU SCS résumé guide PDF, Berkeley Fung PDF, Forbes
(Robert Half Mar-2026 survey), The Markup (Jan-2026 job-post experiment), HR Dive (Ladders 7.4s study),
Dice (Apr-2026), + 3 vendor blogs used for exemplars only, never statistics.

**Anatomy patterns that repeat across winners (receipts in agent transcript; the durable ones):**
1. One page · single column · ≥10.5pt · no icons/photos — stable since the 2018 skim study; every 2026
   source still enforces it. (wiki, Ladders/HR Dive, Berkeley)
2. Jake's-canon typography: small-caps ruled headings, title-left/date-right on one line, aggressive
   consistent compaction, real text layer. (resume.tex read directly)
3. New-grad section order: Education → Experience → Projects → Skills; Projects above Experience only
   when technical work experience is absent. (wiki + CMU)
4. THE bullet formula, verbatim from CMU: "Action Verb + Context (tell the what) + Result (Metrics,
   Outcome, and/or Impact)" — one phrase, ≤2 lines, past tense.
5. **Metrics front-loaded** — "move the metrics towards the start of each bullet"; order bullets
   best-first because "some hiring managers only have time to read the first." (wiki, verbatim)
6. Strong-verb whitelist AND a ban list that now doubles as the AI-tell list: aided/assisted/helped/
   utilized (weak) + spearheaded/orchestrated/pioneered/crafted/amplified/transformed (LLM carousel).
7. Skills grouped by labeled category, comma-separated, hard skills only, never soft skills. (CMU, Jake's)
8. Project block = title + one-line WHAT-IT-IS + integration bullets ("don't throw a parts list at the
   reader — how did your software interface with X to achieve Y"). (wiki, verbatim)
9. **AI/ML quantification without job metrics = your own eval numbers, eval tool named**: accuracy,
   precision@k, hallucination rate, latency, cost/call. ("achieved 97% accuracy" — CMU's own sample.)
10. Name the exact model/DB/framework tied to a shipped thing; a listed skill no bullet demonstrates is
    itself a flag. (Dice recruiter quotes)
11. New-grad canon says NO summary/objective (wiki: only for senior/career-change/gap); Berkeley allows
    an optional one. Genuine tension — recorded, not resolved by fiat (owner toggle exists).
12. Tailoring + freshness beat volume: real success threads credit per-application tailoring and
    applying within days of posting. Caveat stated honestly: those threads are engineering-wide;
    ML-specific archive posts were mostly struggle posts.
13. Working plain-text links whose public footprint MATCHES the résumé — The Markup hired from "actual
    people whose experiences matched their applications"; verification is now part of the screen.

**2024 → 2026 shift (the battleground moved):** the flood is measured — 400+ applications in 12 hours on
one real posting, most AI slop (The Markup); 84% of hiring teams report heavier workloads from
AI-optimized applications (Robert Half). Format canon did NOT change; the **authorship signal** did:
verb-carousel bullets, uniform bullet rhythm, adjective inflation, and skills-without-evidence now read
as machine authorship in a ~10-second reject. The safe register is plain, specific, varied, past-tense
engineering prose — which the wiki banned pre-flood and SIFARISH's slop-scan partially encodes already.

### 8.2 · What ATS actually do (primary sources, myths killed)

All seven majors checked (Greenhouse/Lever/Ashby/SmartRecruiters/Workday/Taleo/iCIMS): upload → text
extraction → field mapping → full-text index for recruiter search; **the original PDF is always retained
and openable**; a bad parse costs *discoverability in search/rank*, not auto-rejection. Enhancv's
25-recruiter study: **92% run NO content/format auto-reject; knockout questions are the only true
auto-reject and they read form answers, not the résumé.** The "75% auto-rejected by ATS" stat traces to
a 2012 sales pitch by a company defunct since 2013.

Enforceable rules the compiler must satisfy (it already satisfies every one — verified against
Greenhouse's parse-failure list, Textkernel file-format docs, Workday's HiredScore datasheet read in
full): single column in document order; no tables/text-boxes/graphics; contact block in body, never
header/footer; true text layer ("highlight the text" test); <2.5MB; standard section headings;
un-abbreviated titles ("Senior", never "Sr."); Month-YYYY dates, consistent, "Present" for current; no
spaced-out letters; JD's exact surface vocabulary where evidence exists (LinkedIn Recruiter Boolean is
literal — official docs do NOT document stemming; don't rely on it).

**The 2025-26 shift: AI graders are default-on at scale** — Workday HiredScore grades A–D against
per-role criteria with reasoning shown; Oracle rates 0–5 at submission; Greenhouse "Real Talent" ranks
by criteria match. These layers read semantics: what moves the grade is demonstrated role-relevant
substance stated plainly — the machine-reader and the 6-second human have converged. "Writing for the
ATS" as a separate discipline is dying; parse-safety remains as a floor. Keyword stuffing has no
documented algorithmic penalty but is self-exposing (parsed text renders on the recruiter's screen) and
76% of recruiters explicitly value natural keyword use. Prompt injection: 41% of US job seekers admit
trying it (Greenhouse 2025 via Built In); IEEE-published testing shows screeners mostly ignore it;
recruiters who find it reject. I1/I9 + plain WinAnsi rendering make the entire class structurally
impossible for us.

### 8.3 · Discovery APIs — live-probed 19-Jul-2026 (unused capabilities + verdicts)

- **JSearch (OpenWeb Ninja):** free tier confirmed 200 req/mo. **Docs now lead with `/search-v2` +
  cursor pagination**; legacy `/search` status unverifiable keylessly (JS-locked docs). num_pages=N
  bills N credits (our own D144 live measurement stands as best evidence). ACTION: verify `/search-v2`
  against prod on the next keyed run before it surprises a sweep.
- **Adzuna (swagger fetched):** UNUSED params we could exploit — `what_or` (one credit covers
  "AI OR ML OR LLM"), `what_phrase`, `title_only` (kills analyst noise pre-score), `what_exclude`
  (push not-interested upstream), `salary_include_unknown=1` + `salary_min`, `full_time`/`contract`
  flags, `company`. Free-tier numeric rate limits are not published anywhere fetchable.
- **Greenhouse:** `page`/`per_page` IGNORED (always full dump); `content=true` inflates Stripe
  311KB→3.9MB — a light title-scan first pass + per-job content fetch is a 12× bandwidth win.
  `/departments` endpoint live.
- **Lever:** `limit`+`skip` pagination and server-side `team`/`location`/`commitment` filters verified
  working. (Server-side team filters risk missing AI roles in odd teams — adopt with care or not at all.)
- **Ashby:** `includeCompensation=true` verified — structured comp on postings.
- **SmartRecruiters:** `q` full-text search, `updated_since` delta-sync, `offset/limit/totalFound`
  verified; per-posting detail endpoint 200.
- **Remotive:** `category=software-dev`+`search`+`limit` combine, but `limit` is advisory under search.
  **RemoteOK:** full dump; row 0 carries a LEGAL NOTICE — linkback required or access suspended (verify
  our attribution). **Arbeitnow:** `?page=N` verified (100/page, hourly); its `search` param does NOT
  reliably filter — keep client-side filtering. **Jobicy:** `count=100` verified honored (2× the cited
  max); `tag` must be 3–50 chars (`tag=ai` is a 400); geo uses their slugs (`geo=india` → 400).
  **WWR RSS:** 12 category feeds verified 200 — only the programming family is AI-relevant.
- **SimplifyJobs — ALERT:** `Summer2027-Internships` does NOT exist yet; current Summer2026 +
  New-Grad-Positions paths still valid and pushed. When the season rolls (~Aug–Sep) our URL goes
  quietly stale. Needs config-driven season candidates + a Pulse watch.
- **NEW SOURCE VERDICTS:** **ADOPT — HN "Who is hiring" via Algolia** (hn.algolia.com): CORS-open,
  keyless, lawful, monthly thread (July 2026 = 278 comments), founder-direct AI-heavy postings; needs a
  deterministic comment parser. **Reconsider-if-cheap:** Himalayas via our existing guarded proxy
  (97k jobs, no search param, low AI-density — marginal). **REJECT:** Wellfound (no public API, ToS),
  Remote.co (no working feed), Devjobsscanner (paid), FindWork (keyed, key not held), Jobspresso
  (proxied RSS possible, low AI volume).

### 8.4 · LLM tier status (Law 12, verified live 19-Jul-2026)

- **Groq:** `openai/gpt-oss-120b` + `openai/gpt-oss-20b` LIVE production, NOT deprecated (they are the
  recommended replacement targets). Free tier: **30 RPM · 1K RPD · 8K TPM · 200K TPD** — the 8K TPM is
  the measured reason batch re-forges must space calls (D105/D140 vindicated). Old llama models shut
  down 16-Aug-2026; we migrated 12-Jul (D35).
- **Gemini:** pinned `gemini-3-flash-preview` still valid but now two generations behind;
  **`gemini-3.1-flash-lite` is now STABLE**; **`gemini-3.5-flash` is the new stable flagship flash**.
  `-latest` aliases hot-swap on 2-week notice — pinning (D144) remains correct. Free-tier quotas are
  dashboard-only (unverifiable keylessly).

### 8.5 · Staged craft-library delta (applied in Movement 3 as versioned DATA, I13)

From §8.1/§8.2, the patterns NOT yet in library v1.3.0 (82 sources · 57 patterns — real parsed counts):
metrics-front-loaded bullet ordering; the 2026 authorship-signal register (varied bullet rhythm, no
verb-carousel, no adjective inflation — as forge/redteam patterns, extending the existing ban list);
eval-tool-named quantification for AI projects; skills-must-be-demonstrated linkage; footprint-match
(plain-text links that resolve); integration-not-parts-list project framing; un-abbreviated titles;
plus a NEW `summary` and `letter` pass so the professional summary and cover letter finally read the
studied craft (today they are deterministic and library-blind — repo audit finding). Target: roughly
+10–14 patterns and +12–15 sources, every one carrying the URL fetched this session; exact counts will
be stated when written, never rounded up.

### 8.6 · Anti-obsolescence audit (what would rot in 3 months, found in OUR repo)

1. **SimplifyJobs season URL** — hardcoded to Summer2026; goes stale ~Aug-Sep (fix: config + Pulse watch).
2. **JSearch `/search-v2` migration risk** — legacy endpoint may deprecate; verify keyed, adopt cursor.
3. **Gemini pinned ids aging** — 3-flash-preview two generations behind; routing.json refresh + live probe.
4. **Half-wired self-evolution (repo audit):** vision→hunt RETIREMENT (`proposeHuntEdits`) fires only
   from a manual Settings edit, never on autopilot; the Pulse library-freshness brief has NO accept path
   to `applyLibraryUpdate` (hand-paste textarea only). The read/propose half of each loop is on
   autopilot; the write/retire half is behind a button — the D69 disease, still alive in two places.
5. **Model-id mirror duplication** — routing.json + inlined constants are drift-GATED but the Gemini id
   in `api/polish.ts:76` is spliced into a fetch URL; keep every inlined id a named const under the gate.
6. **README gate count stale** (231/231 vs real 685) — docs honesty fix.
