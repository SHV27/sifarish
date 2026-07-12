# सिफ़ारिश · SIFARISH

### A job-hunt chief of staff that refuses to lie.

**▶ Live: https://sifarish-shv-s-projects.vercel.app** · Code: https://github.com/SHV27/sifarish

> **The Design Law:** *Compile truth. Draft everything. Send nothing.*

> **v2 · The Jasoos Update** — SIFARISH now has eyes, ears, and a voice: live multi-source job
> discovery (LinkedIn/Indeed-listed roles via a lawful aggregator — never scraping), a hiring-signal
> radar ("Lloyds Bank is hunting 300 agentic-AI specialists" — surfaced before you'd have found it),
> cited company research before every compile, and a conversational **Guru** that knows your ledger,
> refuses to invent skills, and never promises outcomes. Still fully functional with zero keys.

> **v3 · The Dimaag Update (Final Form)** — the app now *thinks*, and shows its work. A reasoning
> core (the **Dimaag**) weighs every consequential choice and stores a written, inspectable rationale
> (I10): tap **Why?** on any decision and it answers. Resumes are built by a four-pass **Editor's Desk**
> — archetype → casting → angle surgery → red-team — that decides which projects lead and how each is
> framed, for the specific reviewer, with reasons you can overrule. Cover letters are **composed, not
> filled** (a letter sendable to two companies is a failed letter). Every LLM call is cached, budgeted,
> two-tier, and heuristic-fallback-safe — the **Dimaag Ledger** shows every token. Still zero-key functional.

> **v4 · The Ustaad Update (FINAL FORM — sealed)** — the tailor trained on the best craft the open
> internet holds. The **Ustaad Library** (42 cited sources: Google's XYZ formula, the Ladders eye-tracking
> study, Stanford/Berkeley/Harvard career-center guides, multi-ATS parser tests…) lives as versioned,
> dated, Pulse-refreshable **data** (I13) and teaches every Darzi pass; every compile carries an honest
> **Compile Quality** rubric (never an "ATS score") with each missing point itemized as an evidence gap or
> a deliberate choice. Talk to the tailor in the **Baithak** — Hinglish welcome — and instinct becomes
> structured EditOps behind ✓/✗ diff cards; asking it to claim what you haven't done gets a refusal and a
> Gap Note (I11: conversation cannot bypass the compiler). **Guru v3** knows the map as well as the man:
> cited hiring-path briefs, a vision-alignment guardrail (with a regression test for the one time it
> drifted), a 30-conversation eval. **Dak Khana** watches the inbox on `gmail.readonly` — a scope that
> makes sending structurally impossible. **Darbaan** locks every mutation behind Owner Mode *at the
> database level*; the public URL is a read-only showcase on a fictional demo persona, and the real ledger
> travels only as an AES-256-GCM encrypted backup. **Taleem Radar** ranks the gap between market demand
> and the ledger, with receipts. **231/231 gates. Sealed: future change = data, not code.**

SIFARISH is a personal hiring agent for one candidate — a 3rd-year CSE student hunting a
compulsory AI-engineering internship in a market where **91% of recruiters now actively hunt
fabricated resumes** and **pretty resumes die in ATS parsers**. It collapses hours of per-company
tailoring into minutes without ever inventing a claim and without ever pressing Send.

It is fully functional **with zero API keys.**

---

## The inversion: why this category dies, and the structural counter

Most AI job tools are spray-and-pray résumé fabricators. Each failure mode below has a *structural*
counter in SIFARISH — not a warning, an impossibility.

| Failure mode (observed in the market)                         | Structural counter |
|---------------------------------------------------------------|--------------------|
| AI-exaggerated resumes — the #1 fraud recruiters hunt (63%)    | **I1 + I2**: the resume is *compiled* from an evidence-linked ledger; the LLM may rephrase, never mint |
| Auto-apply bots → LinkedIn account restrictions               | **I3**: there is no Send. No SMTP, no form POSTs, no headless anything. Packets end at *files + the official URL* |
| Generic AI-slop wording recruiters spot instantly             | **Voice Bank + slop-scan gate** — banned-phrase list, zero tolerance |
| Mass spray → recruiters drowning, zero signal                 | **Sniper quota**: a ranked queue capped at ~15; the cap is a feature |
| Pretty resumes that scramble in parsers (columns/tables/icons)| **ATS-plain single column** + **I5 parse-back**: the generated PDF's text layer is extracted and asserted byte-for-line against what we compiled |
| Trackers abandoned because updating them is a chore           | Tracking is a **side effect** of generating the packet — "Mark as Applied" *is* the tracker write |
| Keyword stuffing detected by ML anti-manipulation             | Keywords appear **only where the ledger has evidence** |

## The named steal: compiler design

The resume is not written. It is **compiled**.

```
Sach Ledger (source of truth)  →  JD decode  →  evidence match  →  deterministic compile  →  ATS artifact
   evidence-linked entries         keywords       tags → bullets     one-page budget         PDF + DOCX
```

Like a compiler, the source (your provable ledger) is the only input; the target artifact (a
company-specific resume) is *derived*, never authored. A bullet without an evidence link is a
**compile error**, not a warning. Page overflow is a **compile error** with human-readable cut
suggestions ("Page overflow: drop SUTRADHAR bullet 3 or shorten X").

**The novel mechanism — the self-strengthening resume:** GitHub Nabz watches the candidate's repos.
When an `in_forge` project's repo goes public, Nabz surfaces a one-click promotion. The resume
compounds weekly *with real shipped work* — and the strength meter only moves when the truth moves.

## The five pillars

1. **Sach Ledger** (सच · truth) — the master profile as structured, two-tier data: `shipped`
   (evidence URL + date) vs `in_forge` (honestly dated "currently building"). The promotion ceremony —
   stamping a forge item SHIPPED once its evidence exists — is the emotional heart of the app.
2. **GitHub Nabz** (नब्ज़ · pulse) — keyless public REST watch of the repos; drafts suggestions;
   the human confirms every one.
3. **Shikaar Radar** (शिकार · the hunt) — live roles from keyless public ATS feeds
   (Greenhouse / Lever / Ashby / SmartRecruiters — CORS-verified, browser-direct) + a **Paste Lane**
   for LinkedIn finds (paste a URL or the JD text — *no scraping, ever*). Each role scored against a
   visible, editable rubric; every score expands to show its arithmetic.
4. **Darzi Engine** (दर्ज़ी · the tailor) — the technical crown jewel. JD → evidence-matched compile
   → ATS-plain PDF **and** DOCX + cover letter + hiring-manager outreach draft + coverage report + gap note.
5. **Morcha Board** (मोर्चा · war room) — Found → Tailored → Applied → Follow-up → Interview → Verdict,
   with day-7/14 follow-up nudges and a per-company interview dossier.

### v2 pillars — The Jasoos Update

6. **Khabri Engine** (ख़बरी · the informant) — multi-source discovery + a hiring-signal radar. Aggregator
   lane (JSearch/OpenWeb Ninja → LinkedIn/Indeed/Glassdoor listings, lawfully), a Tavily **signal** lane
   (hiring *news*, not just postings), and three **keyless** lanes (Hacker News "Who is Hiring", Remotive,
   RemoteOK). Cross-source dedupe collapses the same role to one card; every sweep reports found/new/duplicate.
7. **Guru Mode** (गुरु · the guide) — a conversational assistant that knows your ledger, your Vision Profile,
   and your live pipeline. It finds roles, explains any score, generates a step-by-step **Apply Plan** (you
   apply — it never sends), and tells you honestly what to learn. Groq-streamed when a key is present; a
   deterministic honesty-router otherwise. It refuses to claim a skill you can't prove and never promises an outcome.
8. **Darzi v2 — Company Intel** — before compiling, a Tavily **Intel Pass** researches the company (cited).
   The cover-letter hook references one specific, sourced fact — never a generic "I admire your mission".
   Intel changes *emphasis and framing, never a claim*.
- **Pulse Loop** — a weekly cited news sweep proposes human-confirmed rubric/keyword updates, so the app
  stays present-tense. The rubric keeps an append-only changelog.

### v3 — The Dimaag (the brain)

9. **Dimaag Core** (दिमाग़ · the mind) — a shared reasoning engine: `decide` / `critique` / `classify`,
   two-tier (gpt-oss-120b for reasoning, llama-3.1-8b for classification), **content-hash cached**
   (identical inputs never re-call), **budgeted** per tier, and **deterministic-fallback-safe** (keyless =
   heuristic, still honest). Every `decide` returns a stored `Rationale` — the **Why?** you can expand.
10. **The Editor's Desk** (Darzi v3) — a four-pass editorial pipeline, each pass rationaled: **Archetype**
    (what this reviewer scans for in 6s) → **Casting** (which 3 projects lead, which are benched, and why) →
    **Angle Surgery** (frame each project for the role — evidence re-ordered, never invented) → **Red-Team**
    (a hostile 6-second skim; PASS required for "ready"). The Casting Sheet shows all four; you can overrule
    any call with one click (the compiler stays the final authority for I1/I2/one-page).
11. **The Atelier** — cover letters composed from real parts: a cited company hook → a vision bridge → cast
    proof points → dated momentum → the ask, plus an optional **Sifarish Signature** (per-company Dimaag
    decision). A trigram uniqueness gate + a generic-phrase banlist enforce that no two letters are alike.
- **Vision Engine** — edit your dream; the app derives hunt queries + role archetypes (with reasons) that
  you confirm. The hunt flows from the vision.

### v4 — The Ustaad (mastery, conversation, vigilance, permanence)

12. **Ustaad Library** (उस्ताद · the master) — resume craft as *data*: 42 cited sources distilled into 18
    patterns, 6 archetype guides (section order per reviewer), and 3 hiring-path briefs. Consulted by every
    Darzi pass, cited in every rationale, staleness-flagged, Pulse-refreshable (I13). Honesty rule: no
    "selected-at-company-X database" is pretended to exist — craft patterns with receipts, nothing more.
13. **Darzi Baithak** (बैठक · the sitting) — a chat dock on the packet: "GLOAMING aage kar", "ye le link",
    "thoda technical tone". Utterances become proposed **EditOps** rendered as diff cards (before/after +
    the invariants each touches); ✓ runs them through the same compiler, red-team, and gates as any input.
    Links are liveness-probed; unevidenced claims are refused with a Gap Note. **Compile Quality** shows
    the honest craft score with every missing point itemized.
14. **Dak Khana** (डाक-ख़ाना · the post office) — read-only Gmail vigilance: replies from pipeline
    companies become "📬 ne jawab diya" cards with owner-confirmed stage suggestions; follow-up nudges
    auto-clear. `gmail.readonly` is the only scope in the codebase — a source-grep gate proves it.
15. **Darbaan** (दरबान · the doorkeeper) — Owner Mode passcode (PBKDF2, hash stored locally); without it
    the app is **Darshak Mode**: a read-only showcase on a fictional demo persona, enforced at the Dexie
    DBCore level. One-click AES-256-GCM encrypted export/import keeps the real ledger immortal.
16. **Taleem Radar** (तालीम · the education) — aggregates keyword demand across every JD seen (90 days),
    subtracts what the ledger can prove, and ranks the gaps by demand × vision-fit — each with the jobs
    that asked (cited), a first resource, and one-tap honest in-forge tracking.

## The invariants (Referee-enforced, in the test suite)

- **I1** No orphan claims — every compiled content line carries `ledgerIds`; the renderer refuses uncited prose.
- **I2** Tier honesty — `in_forge` material renders **only** in the single dated "Currently Building" line.
- **I3** No Send — a test greps the source; any submission API fails the build.
- **I4** Keyless core — every pillar works with zero keys; LLM polish and PAT limits are amplifiers.
- **I5** Round-trip fidelity — the generated PDF's extracted text equals the compiled content, in order, 100%.
- **I6** Always a legal action — every empty state teaches the next step.
- **I7** Cited intelligence — every claim about a company/role/trend carries a source URL; uncited external prose is an error.
- **I8** Budget honesty — every metered API (Tavily/JSearch/Groq) has a visible monthly + per-run cap; sweeps never overspend, they degrade to keyless lanes.
- **I9** No guarantee language — "guaranteed", "assured selection", "100% placement" are banned in UI, Guru replies, and documents. The app maximizes probability and says exactly that. I3 extends to Guru/Khabri: discovery via lawful APIs only, no auto-fill, no auto-send.
- **I10** Reasoned decisions — every consequential choice (casting, angle, letter strategy, hunt derivation, signature) stores an inspectable rationale `{options, criteria, choice, why, confidence, evidence}`. A decision without a Why is a bug. Rationales are honest about uncertainty.
- **I11** Conversation cannot bypass the compiler — Baithak/Guru chat produces *proposed structured EditOps* that pass through the same pipeline, guards, and gates as any input. Natural language is an input method, never a backdoor.
- **I12** Owner-only mutation — every mutating action requires Owner Mode; the block lives in the database middleware, not in button logic. Public visitors get a read-only showcase on demo data.
- **I13** The library is data — all craft knowledge (patterns, briefs, banned phrases, exemplars) is versioned, dated, cited JSON, refreshable at runtime by Pulse. The structural guarantee of evergreen-ness.

The LLM polish pass (optional, behind a server-side key) is held to I1 too: a deterministic
**fact-drift guard** rejects any rephrase that introduces a new number, tool, or skill — keeping the
compiled truth as the floor. The Guru's honesty-router intercepts fabrication-bait and guarantee-bait
*before* the LLM, and re-scans every streamed token for guarantee language.

## Gate results

All gates run in `npm run gates` (Vitest). Latest: **231/231 green** (65 v1 + 46 v2 + 35 v3 + 85 v4:
ustaad 15 · baithak 22 · guru-v3 20 · dak 9 · darbaan 13 · taleem 6).

| Gate | Target | Status |
|---|---|---|
| Ledger integrity (I1) | 100% of bullets evidence-linked | ✅ |
| Parse-back fidelity (I5) | 100% of compiled lines present & in order in extracted PDF | ✅ real pdf.js round-trip |
| JD coverage | ≥80% of evidence-backed must-haves on resume; 0 unbacked | ✅ |
| One page | fits A4 at ≥10.5pt or legible compile error | ✅ |
| Slop-scan | 0 banned phrases in any artifact | ✅ |
| Radar rubric | strong-fit ≥60, weak-fit <45 on labeled fixtures | ✅ |
| Fact-drift guard | rejects invented numbers/tools/skills | ✅ |
| Chaos | empty ledger · forge-only · malformed JD · huge JD · overflow · HTML sanitation | ✅ |
| Guru eval (12 conversations) | intent routing, I9 refusals, fabrication refusals, ledger-only claims | ✅ |
| Khabri dedupe | cross-source duplicates collapse; pipeline status survives re-sweep | ✅ |
| I7 citation | intel bullets + cover-letter hook always carry a source URL | ✅ |
| I8 budgets | monthly + per-run caps enforced; month rollover resets | ✅ (fake-indexeddb) |
| I9 honesty | zero guarantee language in any packet, Guru reply, or UI copy | ✅ |
| Security | no key/VITE_ leak in source or bundle; I3 no-send extends to v2 | ✅ |
| Console errors | zero across all screens (v1 + Khabri + Guru + v2 packet), verified live | ✅ |
| Responsive | 360 / 768 / 1280 captured | ✅ |

| Dimaag core | decide/critique/classify + caching (identical-input re-calls = 0), honest usage | ✅ |
| I10 rationale coverage | every editorial pass + signature + vision derivation carries a Why | ✅ |
| Red-team gate | no packet is "ready" without a PASS | ✅ |
| Angle fact-drift | angle bullets can only select/order REAL bullets (I1 by construction) | ✅ |
| Letter uniqueness | trigram similarity below ceiling on a multi-company set; banlist v3 = 0 hits | ✅ |
| Vision derivation | encoded dream → expected market role names, each with a reason | ✅ |
| Budget discipline | two-tier caps enforced; exhaustion → heuristic; month rollover resets | ✅ |
| Guru eval | 18 scripted conversations (adds angle/casting/signature/budget/derive intents) | ✅ |

**Verified live in production** with real keys: JSearch surfaced 72 roles (67 new after dedupe),
13 hiring signals, Guru refused a guarantee-bait and answered a ledger-grounded question, and the
four-pass Editor's Desk cast an "Applied AI Engineering Intern" role as **Agent/Agentic Systems
Engineer (gpt-oss-120b, 90% confidence)** with a full, inspectable rationale, a red-team PASS, a
composed cited cover letter, and the Dimaag Ledger tracking every token — zero console errors.

## Stack

Vite 8 · React 19 · TypeScript · Tailwind 4 · Dexie (IndexedDB, offline-first) · pdf-lib (true
text-layer PDF, drawn line-by-line so text order is deterministic) · docx · pdfjs-dist (parse-back) ·
Vercel edge functions (`/api/{polish,dimaag,guru,intel,pulse,khabri/*}` — Groq two-tier
[gpt-oss-120b + gpt-oss-20b, migrated ahead of Groq's Aug-2026 llama shutdown], Tavily,
JSearch/OpenWeb Ninja; every one keyless-fallback-safe) · Google Identity Services (`gmail.readonly`,
token in memory) · WebCrypto (PBKDF2 + AES-256-GCM for the owner lock and backups) · Vitest + Playwright.

## Final Form — the seal

**SIFARISH is sealed.** Four sessions built it: v1 made it *unable to lie* (evidence-compiled,
parse-back-tested), v2 gave it *eyes* (lawful discovery + signals + cited intel + the Guru), v3 gave it a
*brain* (a reasoning core that writes down its reasons where you can read, question, and overrule them),
and v4 gave it *mastery and permanence* — a tailor trained on the best craft the open internet holds, who
argues from evidence in the Baithak; a sage who knows the man and the map; a watchman on the mailbox; a
locked door with a public window.

> **Future change = data, not code.** Ledger entries, the Vision Profile, watchlists, budgets, and
> Pulse-proposed library updates are the only moving parts — all confirmed inside the app. No software is
> literally eternal; what this architecture guarantees is that staying current never again requires
> opening an editor.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173 — opens already knowing the candidate
npm run gates     # 65 invariant + gate tests
npm run build     # typecheck + production build
npm run screenshots  # headless capture at 3 breakpoints (needs: npx playwright install chromium)
```

**No keys required.** To enable the optional LLM phrasing polish, set `GROQ_API_KEY` in your Vercel
project env (server-side only — never `VITE_`-prefixed, never in the bundle). Higher GitHub rate
limits: optional server-side `GITHUB_PAT`.

## Make it yours

A fresh browser self-seeds with the fictional demo persona in
[`seed/demo.seed.json`](seed/demo.seed.json) and opens as a read-only showcase (Darbaan). To make it
yours: set an Owner Mode passcode (header 🔒), then either edit the ledger in-app or replace the demo
seed with your own profile. The owner's profile ships separately in `seed/ledger.seed.json` (loaded only
via Settings → Darbaan → *load owner seed*); real contact details belong on a resume, so that file keeps
them in plaintext by design.

## Art direction — "Ink & Appointment"

The aesthetic of the coveted Indian appointment letter and the bureau desk that produces it: warm
cream paper, ink blue, a stamp-red accent reserved for verdicts, archival green for *Shipped*. The
generated **resume** itself is deliberately plain single-column Arial — because the ATS parser is its
first reader. The *app* is where the beauty lives.

---

*Built as a five-person studio (Principal Engineer · Experience Director · Referee · Evaluator · The
Recruiter) to a single standard: make the truth so well-armed that lying would be a downgrade.*
