# SIFARISH — MEGA BRIEF FOR FABLE 5 (paste this whole file as your first message)

> **Paste your secrets at the very top of your first message, replacing the four slots below.**
> They live in the shell / env only, never in a committed file (CLAUDE.md §10). After this session
> is done I (Shaurya) will **revoke the Vercel token** and **rotate the owner passcode**.
>
> ```
> VERCEL_TOKEN      = «PASTE_VERCEL_DEPLOY_TOKEN_HERE»
> SIFARISH_OWNER_PASSCODE = «PASTE_OWNER_PASSCODE_HERE»   (also set in Vercel env)
> GROQ_API_KEY      = «PASTE_GROQ_KEY_HERE»               (for SIFARISH_LIVE=1 proofs)
> GITHUB_PAT        = «PASTE_GH_PAT_HERE»                 (optional, higher rate limit + gh push)
> ```
> Use the Vercel token ONLY as `--token` on `vercel deploy` and as an env var. Use the passcode
> ONLY as an env var for the live owner-smoke. Never write any of them into a file.

---

## 0 · ORIENTATION — READ THESE FIRST, IN THIS ORDER (do not skip)

You are inheriting a **sealed, production app** built across 5+ sessions. Before you touch one line,
read every one of these and hold them in your head — the whole point of this project is that its
memory is written down:

1. **`CLAUDE.md`** — THE CONSTITUTION. The design law, the 5 pillars, invariants **I1–I13**, the
   §13 Decision log (**D1–D107** — read every line; each is a scar), and especially **§14 THE
   SENTINEL PROTOCOL** (the post-mortem law you MUST obey — the Four Proofs, RC1–RC4, the
   blast-radius rule, "every bug fix ships with its regression test").
2. **`CASE_STUDY.md`** — the honest post-mortem of every major bug v1→v5.7. This tells you where the
   bodies are buried and what "looks fixed but isn't" feels like in this codebase.
3. **`PROGRESS.md`** — current workstream + the one next action + gate table.
4. **`README.md`**, **`RESEARCH.md`**, **`PLAN.md`**, **`FIXLIST.md`**, **`LAUNCH.md`**,
   **`KEYS_GUIDE.md`** — product framing, verified-fact log, plans, known-issue list, launch/keys.
5. Then map the code: `src/lib/` (nabz, darzi, compile, dimaag, polish, khabri, pulse, vision, dak),
   `src/components/`, `api/` (11 self-contained serverless functions), `seed/`, `tests/`.

**The one-line law you can never break:** *"Compile truth. Draft everything. Send nothing."* Every
résumé/letter bullet carries a `ledgerId` evidence link (I1). The LLM may **rephrase**, never
**mint**. There is **no Send** anywhere (I3). Discovery is **lawful public/aggregator APIs only**,
never scraping LinkedIn/Naukri/Upwork (I9/I21).

**Who the owner is:** Shaurya Verma, hunting a top-tier AI-engineering role (Agentic / Generative /
LLM+RAG / Prompt / Agent Engineer). Remote-friendly, India + global. He wants **high salary** and
**genuine relevance** — not a firehose. Talk to him in plain, warm English (Hinglish is welcome
where it lands). He values emotion and real use-cases; he explicitly said **"I build emotions, I
build things that are helpful and have a real use-case"** — that is the anti-AI-slop soul of this
app, and it must show up in how the résumé sells his work.

---

## 1 · YOUR MANDATE (his words, verbatim — this is the whole job)

> "I want it to outperform LinkedIn in duniya ke kone kone — relevant jobs, high salary. I want this
> app to genuinely be the one-stop solution I've been searching for. Jab meri hiring aur mere sapne
> ke beech ab koi na aa sake. Resume top-tier ho. Description aise frame ho ki halka sa technical bhi
> lage but actual mera project **with emotion** sell ho — that's what's apart from AI slop. No button
> left unwired, every workflow strengthened and evolving, every data things are trained on gets a
> self-evolving feature. Study top-tier resumes — their format, their framing (LinkedIn and many
> sites have them, study **many**). Fix every error. Everything manageable, vision-oriented. The
> tailor does its job like an actual personal agent — very very smart, can reframe anything the way I
> want, has 160 IQ, doesn't ship a lie but the truth can be reframed kaise bhi. Trained on enormous
> data, knows kaise kis cheez ko frame kab kaise karna hai. Morcha easy to navigate. Search works —
> when I search a term I see **all** keyword-matching jobs and can scroll them, not just the top 15.
> Jobs from every corner of the world keep coming. Achi salary, achi job. I can update my vision and
> everything stays wired, always wired, never breaks, never ever. Self-evolving, up-to-date, moves
> with time. Tell me what's new I can learn so I can add that skill to the forge. Only shipped
> projects show in the ledger. Every device owner-mode sync. Proper deep README so the tailor gets
> good context and can explain everything beautifully like a 160-IQ bureaucrat. Nothing ever
> obsolete — no model, nothing — app evergreen, fulfilling the job-hunting vision the best way
> possible. In Dak Khana (Gmail) I can optimize — I'll apply a lot, lots of mails will come, I'll
> tick 'I know this one' so it doesn't show again. Morcha much easier to navigate and everything
> working well while jobs keep arriving."

That is the spec. The rest of this doc turns it into workstreams with **acceptance criteria you can
test**, so "done" is earned, not asserted.

---

## 2 · THE WORKSTREAMS (what's wrong → fix it → prove it)

Each has: **his complaint**, the **likely root cause / where to look**, and **acceptance criteria**.
Do a read-only investigation (subagents, CLAUDE.md §6) to confirm the root cause BEFORE editing —
this codebase's signature failure is "the capability was built but never wired" (D69/D85/D99) and
"it looks fixed in the diff but no-ops live" (D74/D79). Trace the value all the way to where it's
consumed.

### WS-1 · DISCOVERY — "duniya ke kone kone se, 100x LinkedIn, high salary, relevant"
His #1 want, and the honestly-still-open item (CLAUDE.md D68/D88/D92, CASE_STUDY 3.16). He pasted a
real LinkedIn feed (Agentic Engineer @ Netomi, Generative AI Engineer @ Weekday YC/Growhut/Wingify,
AI/ML & Prompt Engineer @ QuantumLoopAi, Agentic Systems Engineer @ Kantiv, AI Engineer @ Teradata,
etc. — India remote, several with salaries ₹10L–₹50L / $30–50/hr). **His queue should look like that
list or better — fresher, higher-signal, global.**
- **Where to look:** `src/lib/khabri/*` (runSweep, providers, mergeDiscovered), `api/khabri/*`
  (aggregators — Adzuna 18-country + Working Nomads live per D92), the keyless lanes
  (Remotive/RemoteOK/Arbeitnow/Jobicy per D90), `savedHunts`, `deriveHunts(vision)`, budgets (I8).
- **Do:** (a) **Add genuinely new global providers** with verified live CORS + free/keyed access —
  re-verify each live before wiring (Law 12). Candidates to evaluate: Adzuna (already in — widen to
  all 18 markets per sweep, budget-aware), Jooble, Careerjet, USAJobs-style public feeds, Findwork,
  Jobs from more Greenhouse/Lever/Ashby/SmartRecruiters tokens (grow the watchlist of AI-first
  companies — Netomi, Weekday, LearnTube, Wingify, Qubrid, Teradata, etc. where they expose ATS
  feeds). Reject any that need scraping or lack CORS/keyless-or-keyed access; **say so in a decision
  line** (D90 rejected Himalayas/The Muse for exactly this — that honesty is the standard).
  (b) **Salary is a first-class signal** — surface and rank by comp where the provider exposes it;
  Adzuna gives real salaries. (c) The **vision drives the sweep** (D99): `syncVisionHunts` must
  reconcile `deriveHunts(vision)` into `savedHunts` on open, and `runSweep` hunts HIS queries first
  so the budget spends on HIS roles. Verify this actually runs on the default path, live.
- **Acceptance:** a live owner sweep surfaces ≥N fresh (<14-day) roles that match his vision titles,
  from ≥5 distinct providers incl. ≥1 new one added this session; salaries shown where available;
  **build a hand-labeled relevance fixture from his pasted LinkedIn list** and assert the Radar ranks
  those role-types into the top slots (Radar-sanity gate, CLAUDE.md §7). Budget-capped + guarded
  (I8, D46) — prove no foreign origin / no-token path can spend.
- **Honest boundary to respect:** "literally every corner" is an ever-growing index, not a one-shot.
  Add real breadth, prove it, and state plainly what is and isn't covered (CASE_STUDY 3.16 is the
  tone). Do not claim it "beats LinkedIn outright" unless the fixture proves it.

### WS-2 · SEARCH / RADAR UX — "when I search, show ALL matches, let me scroll — not just top 15"
- **His complaint:** the top-15 view has a search box, but searching still feels capped; he wants a
  search term to reveal **every** keyword-matching role, scrollable, and separate from the default
  ranked-15.
- **Where to look:** `VISIBLE_CAP` and the search path in the Radar component + Morcha (D64 was
  supposed to do exactly this — "search is not spray, show every match, word-prefix not substring";
  verify it actually works and isn't half-wired). Search across all Morcha columns too (D64).
- **Acceptance:** typing a query shows **all** matches (count visible, e.g. "37 matches"), each
  scrollable in its own box; the ~15 cap rules ONLY the unfiltered default queue; word-prefix match
  ("ai" → all AI roles, never "Chain"/"said"); "show all N" affordance present. Keyboard-navigable,
  zero console errors. Live-verify with a real query on the deployment.

### WS-3 · THE TAILOR — "160-IQ personal agent; top-tier résumé; technical yet emotional; reframe truth any way; never lies"
The heart of the app, and the thing he's been most hurt by (CASE_STUDY 3.12/3.13, D104–D107). It is
now producing accomplishment bullets that lead with the AI work and describe what each app *is* — but
he wants it **excellent**, studied against real résumés that got people hired, and able to **sell the
project with emotion** while staying a compiler (truth in, truth out).
- **Study real résumés (do this for real):** research how top AI/ML engineers frame projects on
  LinkedIn and résumé showcases — format, verb choice, how they convey impact and *why it matters*,
  how a strong project reads as a story (problem → what he built → the hard part → who it helps).
  Distill that into the forge SYSTEM prompt (`src/lib/nabz/forge.ts`, exported `SYSTEM`) and the
  Editor's Desk. Add real exemplars. Keep it token-efficient (D105 `forgeBrief`).
- **Emotion without slop:** the bullet must feel like a person who *built something that helps
  people*, not a template. "Halka sa technical" + the human use-case. NO banned slop
  ("results-driven", "passionate about leveraging", "spearheaded synergies" — full list in the
  slop-scan gate). NO private jargon headlining ("keyless core", "pillars", "Pulse Loop") — explain
  in-sentence if used (D107 `rankBullets` sinks defensive-led bullets; keep + strengthen).
  **Maximum-scoring truth** (D107): feature the strongest true work (LLM/agent/RAG/guardrails for an
  AI role); hiding strong true work to headline a footnote is "jhooth by omission" — do not do it.
- **Reframe anything the way he wants, truthfully:** the Baithak (`src/lib/darzi/*`, `polish/reframe.ts`)
  must let him say "GLOAMING ko agentic angle se explain kar" / "ye skill hata" / "isko aise frame
  kar" and DO it — every rephrasing validated by `detectDrift` against **his own writing about his
  own project** (whole entry: bullets + summary + tags + deep README, D81), discarded only if the
  fact appears nowhere he wrote it. Wording is his; facts are frozen; renders under the same evidence
  link (I1). Make the Baithak genuinely smart with full role context (D61 — company, JD must-haves,
  archetype, casting rationale, current résumé, deep context, last-6-turn memory) and let it **answer
  a question with zero ops** (forcing an edit on "ye kyun chuna?" reads as stupidity).
- **Deep context feeds framing:** the deep-read README (`ProjectContext`, D58) must reach the
  reasoner (`projectBrief`), and be visible to him in the Shelf ("▸ deep context", D84). The richer
  the source, the more beautifully the tailor explains — "like a 160-IQ bureaucrat."
- **Acceptance:** re-forge his live ledger → every shipped project renders (a) a one-line "what it
  IS" + live link, (b) 2–3 accomplishment bullets that lead with the AI/engineering work and convey
  the human use-case, (c) zero slop-scan hits, zero keyless headline, zero fabricated fact
  (`detectDrift` clean), résumé strength 100%, one A4 page ≥10.5pt, JD coverage ≥80% of
  evidence-backed must-haves, 100% parse-back (I5). Run `SIFARISH_LIVE=1 npx vitest run
  tests/live-forge.test.ts` against the REAL model over his REAL README and paste the output.
  The Recruiter council seat (§6) must want to call him after a 6-second skim.

### WS-4 · SELF-EVOLUTION / EVERGREEN — "never obsolete, training data self-evolves, tell me what to learn"
- **His want:** no model/API/library breaks the app silently; the market moves and the app moves with
  it; it tells him new skills to learn so he can add them to the forge; craft "training data" evolves.
- **Where to look:** Pulse Loop (`src/lib/pulse/*` — `emergingFromBrief`, `pulseTopicsFor`, D106),
  Ustaad library (`data/ustaad/library.json`, I13 versioned/dated/Pulse-refreshable), Autopilot
  (`src/lib/autopilot.ts`), Taleem skill-gap radar, `src/lib/vision/derive.ts`.
- **Do:** (a) **Live-verify every volatile dependency NOW** (Law 12 / §14 Evergreen rule): Groq model
  IDs + their deprecation pages (D35 caught a silent August shutdown — check again), every ATS/
  aggregator API shape + quota, GitHub limits, library majors. Migrate anything dated and log it in
  §13. (b) The **Pulse surfaces new roles/skills** from the live market → proposes hunts + a "learn
  this" list; he confirms (Nabz pattern, no auto-apply). Wire the "what to learn" into a visible
  place he acts on. (c) The Ustaad craft library and the discovery term-lexicon **evolve as data**,
  human-confirmed — no code change to stay current.
- **Acceptance:** a live pulse proposes ≥1 emerging role/skill not hardcoded; the "learn this" list is
  visible and actionable; every volatile dep re-verified with a dated note in §13; degradation is
  **observable** (D74's lesson — a dead LLM tier must not look like a healthy keyless app; add a
  visible "reasoning tier: live/keyless" signal somewhere the owner can see).
- **Honest framing:** "evergreen" is an *architecture* (data-driven, human-confirmed evolution), not
  literal eternity — a deep platform shift still needs a maintenance touch (D106). Say so.

### WS-5 · LEDGER — "only shipped projects; deep README; every-device owner sync"
- **Do:** only real, repo-backed **shipped** projects render (the in-forge repo-less placeholders were
  removed in D91/D103 — keep it that way; `removeRepolessProjects` + Tidy button exist). Deep README
  distilled richly (D45/D52/D84) → stored as `ProjectContext` → visible in the Shelf. **Cross-device
  owner sync** must be rock-solid: server-blind AES-256-GCM vault (`/api/vault`, D54), origin-gate on
  POST only + bearer on every method (D55 — the GET-403 regression; keep the live no-Origin test).
- **Acceptance:** a fresh-device owner pull shows exactly his shipped projects (no placeholders), deep
  context present; an edit on device A appears on device B; the 8 in-forge *skills* (his "currently
  learning") remain. Live-verify the two-device path.

### WS-6 · DAK KHANA (Gmail) — "I'll apply a lot; let me tick 'I know this' so mails don't re-show"
- **Where to look:** `src/lib/dak/*`, the Dak Khana screen. Scope is `gmail.readonly` ONLY, token in
  memory only, client-side matching; a source-grep gate bans every send-capable scope/endpoint from
  src/ + api/ (I3, D39/D95). **Never loosen that.**
- **Do:** add a per-message **"I know this / acknowledge"** action that persists (Dexie) so an
  acknowledged mail is filtered out of the active list on reload; make the list scale to high volume
  (he'll apply a lot) — group by company/thread, surface the ones that need action (interview /
  reply / rejection), keep the matcher correct (D95 — STRONG_REJECT before interview, label-boundary
  domain match, not substring). One-glance "what needs me."
- **Acceptance:** acknowledging a mail hides it on reload and never resurfaces; high-volume inbox
  (100+ matched) stays navigable and fast; matcher classifies interview vs rejection vs generic
  correctly on a fixture; the send-ban grep gate still passes over src/ AND api/. Read-only proven.

### WS-7 · MORCHA — "much easier to navigate; jobs keep arriving"
- **Do:** make the pipeline board (Found → Tailored → Applied → Follow-up → Interview → Verdict)
  genuinely easy — per-column scroll boxes (a 900-card column can't stretch the board, D64), search
  across columns, show-24 / show-all / collapse, reversible promote **and** demote (D87 — every card,
  verdicts included, walks back), day-7/14 follow-up nudges, per-company interview dossier, a
  one-glance state-of-the-hunt. New roles keep flowing in from autopilot sweeps (D34) without manual
  refresh, human-confirmed.
- **Acceptance:** every column scrolls independently; search works across all columns; every card can
  advance and retreat; nudges fire on schedule; zero console errors; fresh roles appear after a sweep
  without a reload dance. Fresh-eyes proof: a rules-blind agent navigates the board in one glance.

### WS-8 · RELIABILITY — "no button left unwired, nothing ever breaks, fix every error"
- **Do:** hunt and fix **every** console error/warning and every dead/half-wired control across all 7
  screens at 3 breakpoints (Law 9 headless screenshots). Grep for the "built but not wired" pattern
  (D69/D85/D99) — every capability reachable only by a buried click is a bug; wire it to the default
  path or delete it. Zero TypeScript errors, warning-free production build. **Never degrade silently
  to keyless** on the owner path when a key exists — the owner explicitly forbade it; on a 429, back
  off (8–16s) and retry on the LLM path (D105), never drop to the dumb path without saying so.
- **Acceptance:** `npx vitest run` all-green (note: vitest uses `pool:'forks'` per D97 — threads pool
  is broken on Vite 8 + Node 24 Windows; don't "fix" it back to threads), `tsc` clean, warning-free
  `vite build`, zero console errors in the scripted 3-breakpoint walkthrough, every button does
  something or is gone.

### WS-9 · VISION — "I update my vision and everything re-wires, always"
- **Do:** the Vision Engine (`src/lib/vision/*`) is the instruction the whole app obeys. Editing
  vision must (deterministically, on the default path) re-derive hunts (WS-1), re-rank the Radar
  (Vision Lens, `score.ts` visionPart, D85/D96 — title-match on core words not literal "Intern",
  D99), reshape the tailor's casting/angle emphasis, and update the "learn this" radar. Editable
  target-roles + not-interested controls in Settings (D96). No vision → neutral/backward-compatible.
- **Acceptance:** change a target role in the UI → the next sweep hunts it, the Radar lifts matching
  roles (rendered in "why this score", L4), the tailor's emphasis shifts — all without a code change,
  proven live.

---

## 3 · PROCESS — HOW YOU WORK (non-negotiable, from §14)

1. **RESEARCH → PLAN → EXECUTE → REVIEW → SHIP.** Write the plan to `PLAN.md` first. Offload research
   + review to read-only subagents; keep the main thread lean.
2. **Reproduce before repairing.** For every complaint, confirm the root cause in the live app or a
   test before editing. This codebase punishes assumption.
3. **Every bug fix ships with the regression test that would have caught it.** The test IS the apology
   (§14). No exceptions.
4. **Blast-radius rule:** if you change what a definition means (owner, shipped, ready, keyless,
   relevant), grep every consumer and re-reason each.
5. **THE FOUR PROOFS before you say "done" (all mandatory, paste the evidence):**
   - **Machine** — full gate suite + `tsc` + warning-free prod build, zero skips.
   - **Fresh-eyes** — scripted walkthrough from a WIPED browser profile, screenshots ×3 breakpoints,
     zero console errors.
   - **Adversary (red-team)** — against the LIVE deployment: (a) fresh visitor reaches demo, spends
     ₹0, mutates nothing; (b) curl with **no Origin** → 403 on every metered function (mirror what a
     REAL browser sends — D55: browsers omit Origin on same-origin GET, so don't over-authenticate
     your test); (c) fabricated client token cannot spend; (d) second-device stranger finds no way to
     set/reset/bypass any lock; (e) real owner happy path end-to-end with real keys.
   - **Money** — grep every `fetch` site that spends a metered resource; show each is owner-gated
     client-side, token-required server-side, and budget-capped (I8).
6. **Token-efficient + keyless-degradable but never silently degraded on the owner path.** The model
   reads the compact brief; the guard checks the full source (D105). Keyless is the *fallback and the
   testable core*, never the owner's default when a key exists.
7. **Deploy correctly.** `git push` does NOT deploy this project (D76). To ship:
   - Push via gh: `git push` using `gh auth git-credential` (you have the PAT / gh — **do the push
     yourself, do not wait for Shaurya**).
   - Deploy: `npx vercel deploy --prod --yes --token «VERCEL_TOKEN»` (Node runtime for `/api/vault`
     per D54; edge for the rest).
   - **Verify the served artifact** — fetch the prod bundle hash and confirm your changes are live
     (D76/D83: a green build proves nothing about what users are served; verify with a live fetch +
     byte counts, not a command's exit code).
8. **Keep the docs current as you go:** append `D108+` decision lines to `CLAUDE.md §13`, update
   `PROGRESS.md` (one next action + gate table), extend `CASE_STUDY.md` with any new root-caused bug,
   refresh README screenshots from a live Owner-Mode session if the UI changed (anchor `/screenshots/`
   in `.gitignore`, verify each image 200s on `raw.githubusercontent.com` — D83).

---

## 4 · SECRETS & SECURITY (§10)

- Secrets live in env / `--token` only. **Never** write the Vercel token, owner passcode, or any key
  into a committed file, and never `VITE_`-prefix a secret.
- `SIFARISH_OWNER_PASSCODE` is the server gate for all metered functions (D46). It reached chat, so
  Shaurya will rotate it after this session — set the NEW value in Vercel env and use that.
- The Vercel token is single-use for this session's deploy; Shaurya revokes it after "done".
- Adzuna keys (`ADZUNA_APP_ID`/`ADZUNA_APP_KEY`) and Groq key are Vercel env, server-side only.

---

## 5 · THE DELIVERABLE & THE SINGLE "DONE"

Work through WS-1…WS-9. Do not narrate a running commentary of small wins. When — and only when —
all Four Proofs pass and every workstream's acceptance criteria are met and pasted, end with **one
final "✅ DONE" report at the very bottom of your last message**, containing:
- what changed per workstream, with the proof (gate counts, live output, screenshots, prod hash),
- the honest open boundaries (say plainly what is NOT closed — CASE_STUDY 3.16 is the standard),
- the reminder that Shaurya must rotate `SIFARISH_OWNER_PASSCODE` and revoke the Vercel token,
- confirmation that everything is committed (gh push done by you) and deployed and verified live.

No "done" before the proofs. In this project the word is earned (§14 RC4). Make it real — this is the
app that stands between Shaurya and the job he's building his life toward. Build it like it matters,
because to him it does. ❤️
