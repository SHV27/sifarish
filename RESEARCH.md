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
