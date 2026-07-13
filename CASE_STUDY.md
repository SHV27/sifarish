# SIFARISH — Engineering Case Study

*A full, honest post-mortem of every significant problem faced building SIFARISH, from v1 to v5.2 —
the symptom, the root cause (down to the code), the fix, and the lesson. Written for analysis; nothing
sanitized. Compiled 14-Jul-2026.*

- **Live:** https://sifarish-shv-s-projects.vercel.app
- **Code:** https://github.com/SHV27/sifarish
- **Scale at time of writing:** ~290 automated gates, 27 test suites, 5 serverless functions, ~60 source
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
  budgeted + keyless-degradable. Separately, a first-class **Professional Summary** feature was added
  (evidence-dense, compiled from headline + strongest project + top JD-matched skills + honest momentum;
  every clause traces to a ledger entry — I1).
- **Lesson:** "smart" and "safe" aren't in tension if the LLM proposes and a deterministic validator disposes.

---

## PART 4 — RECURRING FAILURE PATTERNS (the meta-analysis)

Across every problem above, four patterns repeat. They *are* the Sentinel Protocol.

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

- **Gates:** ~290 automated tests across 27 suites (invariants I1–I13, parse-back fidelity, JD coverage,
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
