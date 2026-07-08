# सिफ़ारिश · SIFARISH

### A job-hunt chief of staff that refuses to lie.

**▶ Live: https://sifarish-shv-s-projects.vercel.app** · Code: https://github.com/SHV27

> **The Design Law:** *Compile truth. Draft everything. Send nothing.*

> **v2 · The Jasoos Update** — SIFARISH now has eyes, ears, and a voice: live multi-source job
> discovery (LinkedIn/Indeed-listed roles via a lawful aggregator — never scraping), a hiring-signal
> radar ("Lloyds Bank is hunting 300 agentic-AI specialists" — surfaced before you'd have found it),
> cited company research before every compile, and a conversational **Guru** that knows your ledger,
> refuses to invent skills, and never promises outcomes. Still fully functional with zero keys.

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

The LLM polish pass (optional, behind a server-side key) is held to I1 too: a deterministic
**fact-drift guard** rejects any rephrase that introduces a new number, tool, or skill — keeping the
compiled truth as the floor. The Guru's honesty-router intercepts fabrication-bait and guarantee-bait
*before* the LLM, and re-scans every streamed token for guarantee language.

## Gate results

All gates run in `npm run gates` (Vitest). Latest: **111/111 green** (65 v1 + 46 v2).

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

**Verified live in production** with real keys: JSearch surfaced 72 roles (67 new after dedupe),
13 hiring signals, Guru refused a guarantee-bait and answered a ledger-grounded question, the Intel
Dossier + Apply Plan + honesty note all rendered — zero console errors.

## Stack

Vite 8 · React 19 · TypeScript · Tailwind 4 · Dexie (IndexedDB, offline-first) · pdf-lib (true
text-layer PDF, drawn line-by-line so text order is deterministic) · docx · pdfjs-dist (parse-back) ·
one Vercel edge function (`/api/polish`, Groq, keyless fallback mandatory) · Vitest + Playwright.

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

The entire profile lives in [`seed/ledger.seed.json`](seed/ledger.seed.json). Replace the identity,
entries, and Voice Bank samples with your own — the app self-seeds on first open. Real contact details
belong on a resume, so they live in plaintext there by design.

## Art direction — "Ink & Appointment"

The aesthetic of the coveted Indian appointment letter and the bureau desk that produces it: warm
cream paper, ink blue, a stamp-red accent reserved for verdicts, archival green for *Shipped*. The
generated **resume** itself is deliberately plain single-column Arial — because the ATS parser is its
first reader. The *app* is where the beauty lives.

---

*Built as a five-person studio (Principal Engineer · Experience Director · Referee · Evaluator · The
Recruiter) to a single standard: make the truth so well-armed that lying would be a downgrade.*
