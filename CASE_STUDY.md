# SIFARISH — Engineering Case Study

*A full, honest post-mortem of every significant problem faced building SIFARISH, from v1 to v5.2 —
the symptom, the root cause (down to the code), the fix, and the lesson. Written for analysis; nothing
sanitized. Compiled 14-Jul-2026.*

- **Live:** https://sifarish-shv-s-projects.vercel.app
- **Code:** https://github.com/SHV27/sifarish
- **Scale at time of writing (Session 5.5):** 408 automated gates, 37 test suites, 11 serverless functions, ~60 source
  modules, 6 product screens, single-developer build across 5 build sessions.

---

## PART 1 — THE PROBLEM SPACE

SIFARISH is a personal, local-first hiring agent for one candidate hunting an AI-engineering internship.
The design law is one line: **"Compile truth. Draft everything. Send nothing."** The entire architecture
is downstream of a single thesis — that the AI-job-tooling category *fails* in predictable ways, and each
failure has a *structural* counter (an impossibility), not a warning.

| Category failure mode (observed in the market)            | Structural counter built into SIFARISH |
|-----------------------------------------------------------|----------------------------------------|
| AI-exaggerated resumes (the #1 fraud recruiters now hunt) | The resume is *compiled* from an evidence-linked ledger; the LLM may rephrase, never mint (I1) |
| Auto-apply bots → platform bans                           | There is no Send. No SMTP, no form POSTs, no headless anything (I3) |
| Generic AI-slop wording                                   | Voice Bank + slop-scan gate + hostile "Recruiter" review |
| Mass-spray → recruiter fatigue                            | Sniper quota, ranked queue |
| Pretty resumes that die in ATS parsers                   | Single-column plain compile + a parse-back test (I5) that asserts the PDF's text layer equals what we compiled |
| Trackers abandoned as a chore                             | Tracking is a *side effect* of generating the packet |

The invariants (I1–I13) are the spine. Most of the hard problems in this project were **not** feature work
— they were discovering, the hard way, that an invariant I *believed* was structural was actually only
*conventional*, and then making it truly structural.

---

## PART 2 — ARCHITECTURE & THE FIVE PILLARS

**Stack:** Vite + React + TypeScript · Tailwind · Dexie (IndexedDB, offline-first) · pdf-lib (true
text-layer PDF drawn line-by-line for deterministic order) · docx · pdfjs-dist (parse-back) · Vercel edge
functions (Groq two-tier `gpt-oss-120b` + `gpt-oss-20b`, Tavily, JSearch — every one keyless-fallback-safe)
· WebCrypto (PBKDF2 + AES-256-GCM) · Google Identity Services (`gmail.readonly`) · Vitest + Playwright.

**The pillars:** Sach Ledger (evidence source-of-truth, two tiers: `shipped` / `in_forge`) → GitHub Nabz
(watches the repos, self-strengthens the ledger) → Shikaar/Khabri Radar (lawful multi-source discovery) →
Darzi Engine (JD → evidence-matched deterministic compile → ATS-safe PDF+DOCX+letter) → Morcha Board
(pipeline war room). Later: Dimaag (reasoning core), Ustaad (craft library as data), Baithak (talk to the
tailor), Dak Khana (read-only mail watch), Darbaan/Tijori (owner lock + persistence vault).

**The named steal:** *compiler design.* The resume is not written; it is **compiled**. Source of truth
(ledger) → JD decode → evidence match → deterministic compile under a one-page budget → target artifact. A
bullet with no evidence link is a *compile error*, not a warning.

---

## PART 3 — THE CHRONOLOGICAL PROBLEM LOG

This is the meat: every significant problem, root-caused.

### 3.1 · Volatile-dependency decay (caught twice; would have silently broken the app)

- **Symptom (latent):** the app depended on Groq models `llama-3.1-8b-instant` and `llama-3.3-70b-versatile`.
- **Root cause:** Groq **deprecated both** on 17-Jun-2026 with a hard shutdown of 16-Aug-2026. Nothing in the
  code would fail until August, at which point the entire LLM tier (Guru, polish, Dimaag reasoning) would
  silently 404 and fall back to keyless — degrading the product with no error surfaced.
- **How it was caught:** a "Law-12" mandate to live-verify every volatile dependency at session start —
  reading the provider's deprecation page, not trusting memory.
- **Fix (D35):** migrated per Groq's stated paths — classify → `gpt-oss-20b`, reasoning/Guru/polish →
  `gpt-oss-120b`. Re-verified again in a later session that these remain the current, non-deprecated lineup.
- **Lesson:** *dated dependencies rot silently.* Volatile facts (model IDs, API shapes, quotas) get
  re-verified live every session; anything with a shutdown date gets migrated immediately, not "later."

### 3.2 · Serverless module resolution (`ERR_MODULE_NOT_FOUND`)

- **Symptom:** a serverless function crashed at runtime with `ERR_MODULE_NOT_FOUND` after refactoring shared
  helpers into `api/_shared.ts`.
- **Root cause:** Vercel treats `_`-prefixed files specially and the edge bundler didn't resolve the
  cross-file import at runtime (it built fine locally).
- **Fix (D22):** each serverless function is **fully self-contained** — it inlines its own helpers and a
  literal `export const config = { runtime: 'edge' }`. No cross-file imports between API functions.
- **Lesson:** the platform's bundling model is part of the contract; "it compiles" proves nothing about how
  the edge runtime resolves modules.

### 3.3 · The fact-drift guard false-rejecting honest rephrasings

- **Symptom:** the LLM polish pass (which may only rephrase, never add facts) was rejecting *legitimate*
  rephrasings — e.g. "co-op" → "cooperative" was flagged as fact-drift.
- **Root cause (D15):** the guard was a blunt token-diff — any new token counted as a new "fact."
- **Fix:** rewrote the guard as a precise 3-category detector — new *numbers*, new *known tech-skill vocab*,
  new *proper-nouns/acronyms*. The invariant forbids new **facts**, not new **words**.
- **Lesson:** an over-strict guard is its own bug; the invariant's precise semantics matter.

### 3.4 · One-page overflow surfaced as an error *at the user* (the self-strengthening loop's own success bit it)

- **Symptom:** as Nabz kept adding real shipped work to the ledger (the intended "self-strengthening"
  behaviour), the resume compile eventually threw a `CompileError: page overflow` **at the user**.
- **Root cause (D32):** the compiler used a fixed render + a timid trim, then threw if it still overflowed.
  Growth in the source (a *good* thing) broke the output.
- **Fix:** one-page became **a constraint the compiler solves, not an error it throws.** The compiler now
  assembles at progressively tighter trim levels (fewer bullets → prune honors/certs → fewer projects) until
  it fits. `CompileError` is reserved for the practically-impossible single-entry-too-long case. Overflow
  gate tests were rewritten to assert an *always-fits* contract.
- **Lesson:** a feature that grows the input must not break the output; solve the constraint, don't assert it.

### 3.5 · Cold-start latency / dead-button feel

- **Symptom:** clicking "Tailor" showed a blank/slow screen while the Dimaag reasoning ran (up to ~15s).
- **Root cause:** the packet build blocked the UI on LLM reasoning.
- **Fix (D33):** two-phase build — `buildPacketFast` renders a fully-usable deterministic packet in
  ~300–700ms (cached intel only, no LLM), then `buildPacket` refines casting + letter in the background and
  swaps in. A "Ready to use now" badge shows while enhancing.
- **Lesson:** never block the first paint on the slow, optional path; optimistic UI + background refine.

### 3.6 · Guru context-starvation (the "Google/Microsoft" failure)

- **Symptom:** the conversational Guru suggested generic big-tech/SDE paths that directly contradicted the
  user's stated vision ("no MNC / mass-placement").
- **Root cause (D38):** the LLM had no compiled context each turn — it was *context-starved and path-blind.*
- **Fix:** a **compiled dossier every turn** (vision + hard avoids + ledger digest + pipeline + recent
  pulse), a **vision-alignment guardrail** in the prompt, a client-side `visionAlignmentScan` that *discards*
  unflagged avoided-lane suggestions, and cited **hiring-path briefs** so "how do I get into X" returns a
  *path*, not a job list. The exact failure became a regression test in a 30-conversation eval.
- **Lesson:** LLM misbehaviour is usually a context/architecture bug, not a prompt-wording bug. Fix it
  structurally (retrieve, don't hope) and add the regression.

### 3.7 · The Compile Quality "ATS score" honesty trap

- **Symptom (design risk):** a numeric "score" invites the reading "guaranteed to pass the ATS," which is a
  lie (I9 bans guarantee language).
- **Fix (D41):** Compile Quality is a rubric over **craft execution**, never an "ATS score." The core is
  **gap-vs-choice itemization** — points dock only for what the compile could have done better; what the
  ledger cannot prove is a *Gap Note* item (→ learn it), not a deduction. Golden packets score 100/100 with
  honest remainders. The UI explicitly says real ATS ranking varies by system.
- **Lesson:** a metric that can be misread as a promise must be reframed until it can't.

### 3.8 · THE SPEND HOLE — two individually-correct decisions composing into a money leak (v4 → v4.1 → v4.2)

This is the most instructive failure in the project — "final" had to be declared **three times.**

- **v4.1 symptom:** a demo/showcase visitor could trigger the owner's metered API endpoints (Guru chat,
  sweeps), spending the owner's Groq/Tavily budget. If the app went viral, the owner pays.
- **Root cause (D44):** two individually-sound decisions **composed** into a hole. (1) The owner lock was a
  local convenience (`localStorage`). (2) A later change keyed *metered spend* off `isOwner()`. The database
  write-block (I12) that was supposed to stop a visitor sat **downstream of the spend** — the token was spent
  *before* the blocked write. Enforcement was in the wrong place.
- **v4.1 fix:** every metered client checks the lock **before** fetching (demo = structurally keyless), and
  all serverless functions refuse foreign/absent Origins (403 before any key is touched).
- **v4.2 symptom (owner-caught, from a second Gmail):** any visitor could "set a new lock" in *their own*
  browser and become "owner" — and post-v4.1 that unlocked metered spend. A stranger could spend the keys.
- **Root cause (D46):** *client state was treated as identity.* "Owner" meant "whoever set a passcode on this
  device."
- **v4.2 fix:** ownership is **server-verified.** `/api/darbaan` checks the owner code against a Vercel env
  secret (`SIFARISH_OWNER_PASSCODE`) — the lock lives on the server, in no browser — and issues an
  `x-sifarish-token = SHA-256(code)` that all 7 metered functions **require**. A fabricated client token
  cannot spend.
- **The meta-lesson → THE SENTINEL PROTOCOL (CLAUDE.md §14):** this sequence produced the project's most
  important artifact — a written post-mortem law:
  - **RC1:** anything gating money, identity, or privacy is verified **server-side.** Client state is a
    convenience, never a credential.
  - **RC2:** certification tested *features*, not *adversaries.* Nobody played the stranger; the owner found
    both holes in minutes from a second account. → the mandatory **Red-Team Pass** (act out each persona).
  - **RC3:** enforcement must live at the **choke point of the resource** (the function holding the key; the
    DB layer holding the data), never only in UI, never after the cost is paid.
  - **RC4:** "done" is *earned* by the **Four Proofs** (machine · fresh-eyes · adversary · money), executed
    and pasted, in order — not declared while the last diff is minutes old.
  - **Blast-radius rule:** changing what a *definition* means (owner, shipped, ready, keyless) re-opens every
    consumer of that definition. Grep them all; re-reason each.
  - **Every bug fix ships with the regression test that would have caught it. The test IS the apology.**

### 3.9 · THE PEHCHAAN DISEASE — one root cause wearing four masks (Session 5)

- **Symptoms (owner-reported):** (a) Owner Mode greeted him as the demo persona "Arjun"; (b) **owner edits
  vanished on reopen** ("dubara kholun sab gayab"); (c) demo/owner modes were leaky; (d) fear of token spend
  in demo.
- **Reproduction (Mandate 0 — reproduce before assuming):** from a wiped profile, in owner mode
  `identity.get('me').name === "Arjun Mishra (Demo)"`, and `navigator.storage.persisted() === false`.
- **Root cause:** **all four symptoms were ONE disease.** There was a *single* Dexie store (`sifarish`) shared
  by owner and demo, seeded with the demo persona, with identity reduced to a **boolean flag**; and durable
  storage was **never requested**, so the browser could evict IndexedDB (best-effort) → literal data loss.
- **Fix (rebuild, not patch — Law 13):**
  - **PEHCHAAN** (`src/lib/pehchaan.ts`) — the single identity resolver. Mode resolves *synchronously at
    boot*; every transition (unlock/lock/demo) persists + **full-reloads** so the store, identity, and gates
    all recompute from one truth. The senior call: reload-on-transition eliminates the entire "stale store /
    wrong identity flash" class, simpler and safer than a live-swapping proxy.
  - **TIJORI** (`src/db/db.ts` + `tijori.ts`) — **two physically separate Dexie databases**
    (`sifarish_owner` / `sifarish_demo`) that can never clobber. The owner vault seeds **once** from the real
    seed (lazy-imported → demo visitors never download his PII), with a safe migration from the pre-S5 single
    store. `navigator.storage.persist()` is requested at boot; a debounced **AES-256-GCM auto-backup** runs
    after every owner edit; **restore-on-empty** brings data back if the store was evicted. The
    `loadOwnerSeed` clobber footgun (it `clear()`ed the ledger on every click) was removed — seeding is
    import-if-empty only.
- **Verified live:** owner greeted as "Shaurya Verma"; a Settings edit **survives reopen** on production;
  demo vault is a separate DB showing "Arjun."
- **Lesson:** when several bugs cluster, look for the **one** wrong abstraction underneath. "Who is here?"
  deserved a real answer, not a boolean.

### 3.10 · THE NABZ REGRESSION — the same bug twice, and why (v4.3, then S5.1)

- **Symptom (recurring):** the owner's most ambitious repo (SIFARISH itself) did not appear in the GitHub
  Nabz feed.
- **First occurrence (D47):** `computeSuggestions` treated any past `dismissed` status as a *forever* block
  (`if (isDismissed(...)) continue`) — one "Not now" click hid a repo permanently, with no way back. First
  fix added an "unfiltered list" + a `forceAddRepo` upsert.
- **Recurrence (D52) — and the real lesson:** the bug came back after Session 5's store-split **migrated a
  dismissed suggestion record** into the new owner vault, *and* the D47 "show all" was a **buried toggle** the
  owner never saw. So the first fix was a patch on the symptom, not the class.
- **Root fix (D52):** Nabz was **reframed** from a suggestions-feed into *"Your GitHub, deeply read."* EVERY
  public repo is ALWAYS shown (auto-loads on mount), richly — README deep-distilled into a real summary +
  feature bullets + tech stack + best live URL — each with a one-click add that ignores dismiss history.
  Nothing can be hidden by a past dismiss, *structurally.*
- **Hardening (D52.1):** the deep-read added GitHub API calls, which could hit the unauth **60/hr rate limit**
  and surface a `403` console error. Added a **structural backoff** — once GitHub reports 403/0-remaining,
  Nabz makes **zero** further network calls until reset (serves cache); README fetches are budget-gated so a
  request destined to 403 is never even sent. Nabz was also found rendering in *demo* mode (showing the
  owner's real GitHub under the demo persona) → made owner-only.
- **Lesson:** if a bug recurs, your first fix addressed the *instance*, not the *class.* Reframe the feature
  so the bug is impossible, and don't hide the fix behind a toggle.

### 3.11 · The "dumb Baithak" — rigid grammar with no intelligence (Session 5.2)

- **Symptom (owner-reported):** asked the Darzi Baithak "add a professional summary of me based on my vision
  and truth," and it returned the generic fallback menu ("I can do: GLOAMING aage kar…"). No context, no
  intelligence.
- **Root cause:** the Baithak was a purely deterministic cue-grammar parser (the safe keyless core) with no
  fallback intelligence — anything outside its patterns hit the teach-menu.
- **Fix (D53):** a two-layer design. (1) The deterministic parser still runs first — it owns the clear intents
  *and the refusals* (the safety layer). (2) When it doesn't match, a **SMART LLM layer** with full ledger
  context takes over, mapping the freeform request to proposed EditOps — **but every op is re-validated
  against real ledger IDs** before it can become a diff card (the LLM returns IDs, never free text; anything
  unevidenced → a refusal). I11 (conversation can't bypass the compiler) holds by construction. Owner-only +
  budgeted + keyless-degradable. Separately, a first-class **Professional Summary** feature was added — a
  **timeless, vision-framed** AI-engineer positioning line: no project names (the projects speak for
  themselves below), no geography (he targets remote/international), no "currently building X" (that decays
  as he ships — the app is ever-evolving), and — after owner feedback that named skills and counts still *decay* — refined to a TRULY timeless identity
  line: no tool names, no numbers, no project names, no geography ("Agentic-AI engineer who architects and
  ships production LLM and agent systems end to end — from first principles to live deployment"). It states
  only who he is and how he works ("I architect, I build"), backed by ledgerIds it never names (I1).
- **Lesson:** "smart" and "safe" aren't in tension if the LLM proposes and a deterministic validator disposes.

---

### 3.12 · THE RESUME WAS BADLY FED, NOT BADLY FRAMED (Session 5.4)

- **Symptom (owner-reported):** "the tailor is insanely dumb… my skills and projects were AI slop… it breaks
  my heart, I spent weeks on them." The compiled resume carried, as *project bullets*:
  `App: https://sehat-saarthi-punjab.vercel.app` · `API: …/health · Docs: /docs` · and a sentence sliced
  mid-clause: *"…proposes human-confirmed rubric/keyword updates, so the app"*.
- **The wrong instinct:** treat it as a *framing* problem — better prompts, a smarter Editor's Desk, more
  Ustaad craft patterns. That would have been weeks of work on a component that was already correct.
- **Root cause:** `distillReadme` accepted **any README list item ≥25 chars** as a resume bullet. The
  compiler, the Editor's Desk and the Ustaad rubric were all working *perfectly* — faithfully rendering junk.
  A second, quieter bug compounded it: a markdown list item that **wraps across physical lines** was read
  only up to the newline, which is why a real bullet died at "so the app". It was never truncated by the
  resume; **it was born truncated.**
- **Fix (D56–D59):** the **Bullet Forge**. (1) `isResumeBullet` deterministically rejects what can never be a
  bullet — link dumps, labels, fragments (the keyless core: the slop dies with zero API keys). (2) The
  reasoning tier reshapes the surviving material into real bullets. (3) Every forged bullet is **guarded
  against the README itself** via `detectDrift` — a number, technology or proper noun the README never
  claimed is *discarded*. Plus `ProjectContext`: the deep-read README now rides on the ledger entry as
  **source material the tailor reasons over**, and the Editor's Desk reads a real brief instead of the
  one-line `p.summary` it used to cast from. And because local-first means **no migration can reach the
  owner's vault**, the repair had to be an explicit, owner-confirmed "⟳ Re-forge all".
- **Lesson:** **selection cannot fix supply.** The tailor chooses *which* bullets run; it cannot invent good
  ones. When the output is slop, audit the input before you rewrite the machine.

---

### 3.13 · THE SILENT LLM — a dead reasoning tier that looked exactly like a healthy app (Session 5.4)

The most instructive bug in the project's history. The owner found it **by feel**; no test could.

- **Symptom (owner-reported):** *"dimaag hi nahi, kaise bilkul thoda sa bhi, like itna sa bhi nhi hai"* —
  there's no brain in this, not even a little. Vague, unfalsifiable, easy to dismiss as frustration.
- **What the gates said:** 330/330 green. Warning-free build. Every invariant enforced. Keys valid, budget
  spending normally.
- **Root cause:** `openai/gpt-oss-120b` **essentially cannot satisfy Groq's `json_object` response mode.**
  Measured live, with calls spaced to exclude 429s (a fast probe rate-limits itself and poisons the reading):

  | configuration | success |
  |---|---|
  | `json_object`, temperature 0.2 | **0/3** |
  | `json_object`, temperature 1.0 | **0/3** (temperature is not the variable) |
  | `json_schema`, temperature 0.2 | 2/3 |
  | `json_schema` + prompt with **no** `Return JSON:{…}` prose | **3/3** |

  Two findings hide in that table: the *mode* is the variable, and prose "return this shape" instructions
  **conflict** with a supplied schema and reintroduce the failure.
- **Why it survived certification — the real lesson:** every caller treats a failed LLM call as *"degrade to
  the deterministic heuristic"*, and that fallback is **silent by design (I4)**. A dead LLM tier is therefore
  **behaviourally indistinguishable from a healthy keyless app.** The gates asserted "the app always returns
  a result" — and it did. It just returned the *dumb* one, every time, since the D35 model migration.
  **I4's virtue is its blind spot: a fallback that never complains hides the thing it is falling back from.**
- **The debugging is the story.** Two confident hypotheses died first:
  1. *"max_tokens is too low"* — from a **single sample** (900 failed, 2500 passed). A spaced retest killed
     it: 900 both passed *and* failed; 2500 failed twice.
  2. *"it's flaky — add a retry"* — 3 attempts × 4 calls = **12 consecutive failures.** The failure is
     deterministic; retrying a deterministic failure is just a slower failure.

  Both would have shipped as confident fixes with plausible commit messages. Only re-probing caught them.
- **Fix (D73/D74):** `/api/dimaag` accepts an optional JSON Schema and asks for `json_schema` output; the
  forge and reframer pass theirs and dropped their Return-JSON prose. Retry kept as belt-and-braces at *both*
  choke points (the client core **and** the server function holding the key). Proven by
  `tests/live-forge.test.ts` (`SIFARISH_LIVE=1`), which drives the **real prompt over the real README against
  the real model** and asserts forged bullets survive `isResumeBullet` + `detectDrift`.
- **Closing it (D75/D79/D80):** every reasoning call site now passes a schema. Live-verified per path:
  `decide` 3/3, `classify` 3/3 (agent-eng @0.95), `critique` 2/2 (it correctly returned **REVISE** on the
  link-dump resume from 3.12), the Baithak 2/2, `forge` and `reframe` 2/2. The four-pass Editor's Desk is
  reasoning in production for the first time since the June model migration.
- **Two more bugs, found by the gate written for the first one:** (1) the prompt edits had silently
  **no-op'd** — schemas added while the conflicting prose stayed, which measures as *still broken*; (2) the
  smart Baithak posts to `/api/dimaag` **directly**, bypassing the core, so it had no schema at all — which
  is why "baithak is bullshit" was a correct bug report. Both were invisible in the diff and would have
  shipped as a confident "fixed".
- **D80 — the rule that looks like model stupidity:** Groq/OpenAI `strict: true` requires **every** key in
  `properties` to also be in `required`; an optional field must be a nullable union (`type:['string','null']`).
  Break it and the request is rejected outright — empty output, **indistinguishable from "the LLM is dumb."**
  `decide`/`classify`/`forge` passed *by luck* (all their properties happened to be required); the Baithak's
  optional `refuse` made its schema invalid. Now asserted by an executable strict-validity checker, because a
  rule this invisible cannot survive as folklore.
- **D81 — the guard that was technically right and practically useless:** asked to *"GLOAMING ko agentic
  angle se explain kar"*, the reframer returned "agentic AI narrator" — and the guard killed it, because
  "agentic" wasn't in *that one bullet*. Correct by the letter, wrong by the intent: **GLOAMING is agentic,
  and he wrote so himself in the README.** The permitted source is now the whole *entry* — its bullets,
  summary and deep-read README context (his own words; the same boundary the forge uses). A fact from
  anywhere in his own writing about his own project is not an invention; a fact from nowhere still dies.
- **Lessons:** (1) **A silent fallback is a lie you tell yourself** — degradation must be *observable*; that
  is now a design requirement, not a nicety. (2) **A single sample is not a measurement.** (3) When the user
  describes a *feeling* the metrics contradict, the metrics are measuring the wrong thing. (4) **An
  invariant scoped too narrowly reads as stupidity** (D81) — the honest question is not "can I prove this
  sentence?" but "has he already claimed this, anywhere I can verify?"

---

### 3.15 · THE SCREENSHOTS THAT WERE NEVER COMMITTED (Session 5.4)

Small, embarrassing, and the cleanest illustration of the pattern in this whole document.

- **Symptom (owner-reported, with a screenshot of a broken GitHub page):** "images mein koi dikkat hai."
- **Root cause:** `.gitignore` contained an unanchored `screenshots/`, which matches a directory of that
  name at **any depth** — so `docs/screenshots/` was silently swallowed along with the intended root
  build-output directory. `git add -A` reports success while adding nothing.
- **The actual failure:** not the ignore rule — **the report.** The commit was clean, so it was announced as
  "screenshots added" without checking they were *tracked*. Every one of the nine images the README
  referenced 404'd. This happened **one hour after** diagnosing 3.14 (prod was stale) and writing down the
  lesson *"a green build proves nothing about what your users are served."* The same mistake, immediately, in
  the next commit.
- **Fix:** anchor the patterns to the root (`/screenshots/`); verify with `git ls-files` **and** a live fetch
  of each `raw.githubusercontent.com` URL (200 + real byte counts).
- **Lesson:** knowing a lesson is not the same as applying it. **Verify the artifact, not the command's exit
  code.** Every claim in a status report should name the evidence that backs it — and if there isn't one, the
  claim isn't ready to be made.

---

### 3.14 · TWO SESSIONS OF FIXES THAT NOBODY WAS RUNNING (Session 5.4)

- **Symptom:** none. Everything was green, committed and pushed.
- **Root cause:** Vercel's last **production deploy was commit `a0fa212` (D54)**. `git push` does not deploy
  this project. So D55 — a fix for a bug *the owner personally caught in his own browser* — had never reached
  production, and neither had any of Session 5.4. He was using a July-14 app while reading July-15 changelogs.
- **Caught by:** comparing the prod bundle hash against the local build. Not by a gate, not by a review.
- **Lesson:** **a green build proves nothing about what your users are running.** Merged ≠ pushed ≠ deployed.
  Verify the artifact actually being served.

---

### 3.16 · THE REFORGE THAT WORKED, AND THE ASKS THAT REMAIN HONEST (Session 5.4, final pass)

The turning point most worth recording: after the Bullet Forge (3.12) shipped, the owner clicked
**⟳ Re-forge all** and it *worked* — `sehat-saarthi` went from one tagline-as-bullet to five real
ones (bilingual UX, printable referral slip, honest ML with a stated ROC-AUC 0.957, the limitation
in the Model Card) with 5,476 chars of deep context; `sifarish` picked up 12,000 chars. The disease
of 3.12 was cured in production, by the owner, in one click. That is the self-strengthening resume
doing exactly what it promised.

Two concrete follow-ups shipped with it:
- **Morcha is reversible (D87).** It was forward-only: a misclick to "Interview" or "Rejected" was
  permanent. Now every card — verdicts included — walks back a stage. A pipeline board you cannot
  correct is a board you stop trusting.
- **Discovery breadth widened (D88).** The keyless lanes searched only the first hunt, so the wider
  vision-derived hunt set never reached them; now they run the top hunts, and the paid aggregator
  lane runs more hunts per sweep (budget still capped and visible, I8).

And the honest boundary, stated plainly because §14 demands it: **"find jobs from every corner of
the world, one-stop, beat LinkedIn outright" is not closed.** No new discovery *provider* was added
this pass — the existing lanes were widened and the ranking was made vision-aware (D85). That moved
the needle (his own screenshots show Sony/Siemens via LinkedIn topping the queue, fresh), but a true
every-corner index is a larger workstream. Naming what is *not* done is the difference between a
status report and a sales pitch.

---

### 3.17 · THE REASONER WAS THINNER THAN IT LOOKED (Session 5.5)

- **Symptom (owner ask):** make the tailoring "reason harder… a recruiter should say wow." Not a bug
  report — a quality ceiling.
- **Root cause (found by a read-only mapping agent, not by reading the diff):** the four-pass Editor's
  Desk *looked* context-rich but the context mostly wasn't reaching the prompts. Company intel reached
  the casting decision only as a **citation URL** — the model never read the text. The angle pass saw
  **no JD and no intel at all** (archetype-driven only). The deep-read README (the `ProjectContext`
  added in 3.12) was stored on the ledger entry but **`projectBrief` never included it** — the reasoner
  cast from a one-line summary. Must-haves were **flat-weighted** regardless of how central they were
  to the JD. And the red-team judged the resume **blind to the role** it was for.
- **Fix (D93):** five levers, every one *emphasis/ordering/rationale only* — the v1 compiler still
  renders only evidence-linked ledger bullets (D28), so widening what the reasoner *reads* adds **zero**
  fact-drift surface. Intel text now flows into casting (which project leads becomes company-specific);
  the angle gets a JD-driven option and actually shifts bullet emphasis; `projectBrief` feeds the deep
  README; `decodeJD` emits prominence weights; the red-team knows the archetype + must-haves.
- **Lesson:** "context-rich" is a claim to verify at the prompt boundary, not at the call site. A value
  that is *fetched, stored, and passed to a function* can still never reach the model — trace the string
  all the way into the payload.

### 3.18 · THREE PARALLEL AUDITS FOUND WHAT 358 GATES COULDN'T (Session 5.5)

The Council pattern (CLAUDE.md §6), run for real: three read-only agents audited Guru, Dak, and
Settings/scoring in parallel while the main thread stayed lean. Between them they surfaced eight
concrete correctness bugs a fully-green suite had never noticed — each now fixed with the regression
test that would have caught it. The instructive cluster:

- **Guru was blind to his own leadership.** `ledgerSummary` grouped every entry kind *except*
  `position`, so his real executive/leadership roles were silently dropped from the dossier — and the
  prompt tells Guru he may claim *only* what the dossier lists. A whole category of his truth was
  invisible, and no test asserted its *presence* (only that skills were excluded). This is 3.13's family
  again: a silent omission that reads as normal behaviour.
- **The vision guardrail was a keyword filter dressed as vision-awareness.** It could be bypassed by the
  word "deliberately" appearing *anywhere* in the reply, and it matched a hardcoded big-tech regex
  rather than his actual `notInterested` list. "You should deliberately target Google" sailed through.
  Rewritten sentence-aware and driven by his real avoids — with `ai` explicitly guarded, because his
  entire vision *is* AI and treating it as an avoided lane would have flagged every good suggestion.
- **The Vision Lens's strongest lever was un-editable.** The Radar's biggest ranking signal — a role
  whose *title* matches a target role — reads `vision.targetRoles`, but **no Settings control ever
  wrote it.** It was frozen at the seed. This was the mechanical root of a complaint the owner had been
  raising for sessions ("the top 15 aren't mine"): the app ranked on preferences he had no way to set.

The through-line, again: the suite tests what was *built*; only an adversarial reader (here, an agent
told to *hunt for* the "built but not wired" pattern) tests what a user *meets*.

---

---

### 3.19 · THE CAPABILITY WAS BUILT, THE WIRE WAS NEVER RUN (Session 5.6)

The owner's most persistent complaint — across three sessions (D68, D85) — was that the Radar's top
roles "aren't mine." Each session moved the needle (the Vision Lens, tunable target roles) but never
closed it. A read-only mapping agent finally found the mechanical root cause, and it was the project's
signature failure shape one more time.

- **Symptom:** the ranked queue reads like a generic AI-jobs list, not his.
- **Root cause (two independent bugs):**
  1. **The queue was hunted with the wrong queries.** `runSweep` reads `db.savedHunts` — seeded from
     `SEED_HUNTS`, *static generic queries written before his Vision Profile existed*. `deriveHunts(vision)`
     had existed since the Vision Engine shipped and produced exactly the right queries — but nothing
     ever wrote its output to `savedHunts` except a **buried manual click**. The capability was built
     and never wired to the default path (the same D69 shape, still live).
  2. **Even when the right role was found, the Vision Lens couldn't lift it.** The strongest signal — a
     title matching a named target role — required *every* word of the target, including "Intern". Real
     postings are titled "AI Engineer", not "AI Engineer Intern", so his #1 lever scored **zero** on the
     actual roles. And because the six-dimension rubric already saturates the 100 ceiling for strong AI
     roles, an on-vision role and a generic one *tied at the top*.
- **Fix (D99):** `syncVisionHunts` reconciles his vision into the live hunts on every open (additive,
  idempotent, reversible — his hand-set hunts are never touched); the sweep hunts his queries first; the
  title match drops the ubiquitous "Intern" token; and a tiebreaker lets vision break ceiling ties. All
  deterministic and keyless — his vision is his instruction, executed.
- **Lesson (again):** "we built X" is not "X runs." A feature that is coded, tested in isolation, and
  reachable by one manual click can still be, for every practical purpose, *off*. The wire from the
  capability to the default path is itself a deliverable — and the only proof it exists is watching the
  default path do the thing.

Shipped alongside it — the **Chief-of-Staff briefing**: the owner asked for "an actual personal
assistant," and the app had all the assistant's *data* (ranked roles, due follow-ups, interviews, a
next-action heuristic) scattered across five screens but never *synthesised*. The briefing is a
read-only aggregator on the landing screen that says, in one glance, the one thing to do next and the
roles worth his time — composed entirely from functions that already existed. The assistant's value was
never a missing feature; it was the missing *summary*.

## PART 4 — RECURRING FAILURE PATTERNS (the meta-analysis)

Across every problem above, six patterns repeat. They *are* the Sentinel Protocol.

1. **A conventional guarantee mistaken for a structural one.** I1 (no orphan claims), I3 (no send), I12
   (owner-only) were all "true" in code review and *false* under an adversary until enforcement moved to the
   resource's choke point. → *Put the guard where the resource lives.*
2. **Composition holes.** The worst bugs (the spend hole, the vanish) came from two individually-correct
   decisions interacting. No single diff was wrong. → *Changing what a definition means re-opens every
   consumer; grep and re-reason all of them.*
3. **Patching the instance, not the class.** The Nabz bug recurred because the first fix was a toggle, not a
   reframing. → *If it can recur, you fixed the symptom.*
4. **Confidence outrunning verification.** "Sealed" was said three times too early. → *"Done" is earned by
   the Four Proofs, adversary pass included, pasted as evidence.*
5. **Silent degradation — the pattern that hid the worst bug (3.13).** A fallback that never complains makes
   a dead dependency indistinguishable from a healthy one. Every "graceful degradation" path is somewhere a
   failure can live forever, green the whole time. → *Degradation must be observable. If the app can run in
   two modes, it must always say which one it is in.*
6. **Auditing the machine instead of the input (3.12).** The resume read as a framing failure and was a
   supply failure; every component was innocent. → *When the output is slop, audit what you fed it first.*

**The uncomfortable through-line:** in 3.8, 3.12 and 3.13 — the three worst bugs in this project — **the
owner found it and the test suite did not.** The suite tests what was *built*; he tests what he *meets*. That
gap is the entire reason §14 demands an adversary pass and a live run before the word "done" is allowed, and
why "it feels dumb" is now triaged as a bug report with a root cause rather than dismissed as vibes.

---

## PART 5 — THE SELF-EVOLVING ARCHITECTURE

The app is designed to stay current without code changes (I13 — knowledge is versioned data, not code):

- **Autopilot** (owner-only, budget-capped): on open, a stale discovery sweep (>24h) and a due market pulse
  (>7d) run in the background. Nothing mutates without confirmation — new roles just *appear* in the Radar.
- **Pulse Loop:** a weekly cited news sweep proposes rubric/keyword updates *and* flags the Ustaad craft
  library when its sources age past 12 months — owner confirms each (the Nabz pattern).
- **Taleem Radar:** recomputes skill-gaps from the rolling 90-day window of every JD seen — so as autopilot
  discovers new roles, the "what to learn" radar updates itself.
- **Nabz:** turns shipped repos into ledger entries → the resume compounds weekly with real work.

The honest clause: no software is literally eternal. What this guarantees is that staying current requires
*confirming data updates inside the app*, never editing code or prompts.

---

## PART 6 — METRICS & OUTCOMES

- **Gates:** 393 automated tests across 36 suites (invariants I1–I13, parse-back fidelity, JD coverage,
  slop/guarantee scans, chaos runs, 30-conversation Guru eval, adversary/money proofs, persistence contract).
- **Quality bars held:** zero console errors across a scripted 3-breakpoint walkthrough; warning-free
  production build; Lighthouse desktop 99/100/100 (mobile-sim 83 = honest slow-4G SPA cold-load floor, not
  gamed); typecheck clean; 100% parse-back fidelity (the PDF text layer equals the compiled content, in
  order).
- **Security proven live:** all 7 metered functions 403 origin-less scripts; a fabricated owner token cannot
  spend; a demo visitor spends ₹0 and mutates nothing; the real owner is greeted correctly and edits persist
  across reopen.

---

## PART 7 — WHAT A HIRING ENGINEER SHOULD TAKE FROM THIS

- **Invariant-driven design under real adversarial pressure.** The owner *was* the red team, and the
  post-mortems became a written protocol that changed how every subsequent change shipped.
- **Security & correctness at the choke point.** Server-verified identity, DBCore-level write-blocks,
  token-gated serverless spend, structural rate-limit backoff — enforcement lives with the resource.
- **Honest degradation everywhere.** Every metered path is keyless-fallback-safe; the app is fully usable
  with zero API keys.
- **LLM safety as architecture, not vibes.** Deterministic router owns refusals; the LLM proposes structured
  ops that a validator re-checks against ground truth. Fact-drift guard, uniqueness gate, slop/guarantee
  scans, vision-alignment scan — all automated.
- **The discipline to reproduce before repairing, and to earn the word "done."**

*— End of case study.*
