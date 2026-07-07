# सिफ़ारिश · SIFARISH

### A job-hunt chief of staff that refuses to lie.

> **The Design Law:** *Compile truth. Draft everything. Send nothing.*

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

## The invariants (Referee-enforced, in the test suite)

- **I1** No orphan claims — every compiled content line carries `ledgerIds`; the renderer refuses uncited prose.
- **I2** Tier honesty — `in_forge` material renders **only** in the single dated "Currently Building" line.
- **I3** No Send — a test greps the source; any submission API fails the build.
- **I4** Keyless core — every pillar works with zero keys; LLM polish and PAT limits are amplifiers.
- **I5** Round-trip fidelity — the generated PDF's extracted text equals the compiled content, in order, 100%.
- **I6** Always a legal action — every empty state teaches the next step.

The LLM polish pass (optional, behind a server-side key) is held to I1 too: a deterministic
**fact-drift guard** rejects any rephrase that introduces a new number, tool, or skill — keeping the
compiled truth as the floor.

## Gate results

All gates run in `npm run gates` (Vitest). Latest: **65/65 green.**

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
| Console errors | zero across all screens | ✅ verified headless |
| Responsive | 360 / 768 / 1280 captured | ✅ |

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
