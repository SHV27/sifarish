# PLAN.md — Session 7 "The Taaj" (planned 18-Jul-2026, awaiting owner go-ahead)

> Owner's brief, in one line: **the résumé must look and read like the best selected-student résumés
> (classic, intense, magnificent, max honest ATS), the hunt must match LinkedIn's breadth/relevance
> on his own searches, everything fast + token-efficient with zero IQ tradeoff, zero errors, zero
> unwired features, then ONE "DONE" — no roadmap, no open list.**

This plan was written AFTER three read-only forensic audits (tailor pipeline, discovery pipeline,
case-study/progress digest). Every root cause below is verified at file:line, not guessed.
Per the owner's instruction: **nothing is coded until he says go.**

---

## 0 · THE ROOT-CAUSE LEDGER (what the audits proved)

### Résumé side — why his résumé looks like slop even after Session 6.1

| # | Symptom (his screenshot) | Verified root cause |
|---|---|---|
| R1 | `…vercel.app**` — markdown residue on the page | `compiler.ts:331-332`: `cleanSummaryForDisplay` cleans only the description half of the meta line; the evidence URL half is appended raw. Ingestion leak: `nabz/github.ts:166` URL regex doesn't exclude `*`, so `**https://…**` captures trailing `**` into the stored URL. PDF sanitizer passes ASCII `*` through. |
| R2 | "…voice read-outs, and…" — cut mid-sentence | `compiler.ts:331`: hard `truncateAtWord(…, 160)` on the description — a word-safe cut is still a mid-THOUGHT cut. |
| R3 | Two near-identical SIFARISH bullets | **No near-duplicate detection exists anywhere in the bullet-selection path.** The only Jaccard similarity in the repo (`atelier/uniqueness.ts`) is letters-only. Near-dupes share keywords, so relevance scoring actively REWARDS both. |
| R4 | Quantification 13/25 while ROC-AUC 0.957 sits in the ledger | Numbered bullets get only a +2 tie-break (`compiler.ts:272-275`, `editor.ts:254-255`) — easily outweighed by keyword overlap; no rule forces ≥1 numbered bullet per project when the entry holds one. The rubric (`quality.ts:165-206`) then honestly reports the miss. |
| R5 | Formatting "ek line mein kahin kuch kahin kuch" — nothing like Jake's résumé | `pdf.ts`: EVERYTHING is left-aligned at one x. Name not centered, dates cannot right-align, no section rules (no `drawLine` call exists), no italic font embedded, skills are one pipe-separated run with zero grouping (`compiler.ts:314`), no category field on skills at all. The renderer is structurally incapable of the classic layout. |
| R6 | Red-team advice is career-coach boilerplate | `darzi.ts:110` passes ONLY the flattened résumé text to critique — never the ledger, never the unused-numbers inventory. The model literally cannot ground its fixes. |
| R7 | Professional summary is generic | `summary.ts` is a pure template (role + domain phrase) — deliberately timeless, but evidence-blind. |
| R8 | "Trained on nothing" feeling | Library is 69 sources / 33 patterns; the craft patterns reach prompts via `craftClauses` (mechanism works, D118) — the LIBRARY is the thin part, and section-anatomy/layout patterns don't exist in it. |

### Hunt side — why LinkedIn out-performs the Radar on his own query

| # | Symptom | Verified root cause |
|---|---|---|
| H1 | LinkedIn: 200+ India / 99+ Europe; app: a trickle | JSearch `num_pages` hardcoded `'1'`, `page` hardcoded `'1'` (`api/khabri/jobs.ts:104-108`) → ~10 rows per query, page 2 never fetched, ≤10 queries/sweep. THE single biggest breadth cap. |
| H2 | Results feel off-vision ("Intern"-skewed, research-scientist noise) | `deriveHunts` emits "…Intern" title-variants FIRST; `syncVisionHunts` cap 14 fills entirely with them — plain market queries (`AI engineer`, `LLM engineer`, `agentic AI engineer`) NEVER become funded hunts. Worse: derive emits `research scientist intern` and Adzuna fallback includes `data scientist` — queries he never asked for. |
| H3 | Same 4-5 companies repeating | NO per-company cap in the top-15 (`Radar.tsx:64,75`); ATS boards return up to 40 roles each; 7 starred AI labs get +5 conviction → one board floods the queue. Dedupe key truncates titles to 14 chars, over-merging distinct roles of one company. |
| H4 | Manual hunts never run | Derived hunts (14) are processed before manual (5) and the JSearch budget is 10 → the 5 manual hunts NEVER get a JSearch request, any sweep. |
| H5 | Stale vs LinkedIn's "2 hours ago" | Sweep = once per open, ≥24h apart. And the FRESHEST source — the 32 ATS boards, keyless, board-verified — is NEVER auto-scanned: `syncRadar`'s only caller is the manual button. The freshest lane is the least-run lane. |
| H6 | One-country-per-query geography | Each JSearch request pins ONE market; a sweep touches ≤10 of 15 markets; full hunt×market coverage takes weeks at current cadence. LinkedIn's "Europe" answers the whole region at once. |

### The meta-lesson (case-study digest)
- Proofs on the SEED are not proofs on HIS VAULT (D140 / §3.26) — every craft fix ships with its repair path.
- "Built but not wired" is this codebase's recurring disease (D69/D99/D118/D125) — every fix below names its wire.
- 533 green gates missed 3 defects only a rendered PDF caught (D139) — visual proof is mandatory, not optional.

---

## 1 · WORKSTREAMS

### WS-R1 — THE TYPESETTER (the résumé must LOOK like the references)
Rebuild the PDF/DOCX layout to the classic selected-student standard (Jake's-résumé class):
- **Centered name** (16-17pt bold) + one centered contact line (`email | phone | github | linkedin | location`).
- **Section headings with a horizontal rule** (`drawLine`) — EDUCATION · SKILLS · PROJECTS · ACHIEVEMENTS.
- **Right-aligned dates** on title lines: `CompiledLine` gains an optional `rightText` segment; renderer draws
  left segment then right segment at computed x; parse-back contract updated so `line.text` = left + right in
  draw order (I5 stays 100% by construction, test updated to assert the new contract).
- **Bold title + regular subtitle** structure per project/education entry; Helvetica-Oblique embedded for the
  one place italic earns its keep (project tagline).
- **Skills grouped into labeled lines** — `Languages:` / `AI & ML:` / `Frameworks & Tools:` / `Cloud & Infra:`.
  Ledger skill entries gain an optional `category`; a deterministic lexicon categorizer fills the gap for
  uncategorized skills (his hand-set category always wins). Rendered as 3-5 grouped lines, not one pipe-run.
- **Description line fixed**: full project description wraps (≤2 lines), trimmed at SENTENCE boundary only —
  the 160-char mid-thought cut dies. Trim ladder still governs page pressure.
- **DOCX mirrors all of it** (right tab stops, rule borders, grouped skills).
- **Proof**: render → screenshot → LOOK (D139 law), plus parse-back green, plus the one-page law intact.

### WS-R2 — THE SELECTION BRAIN (dedupe + numbers, structurally)
At `bulletsFor` (`compiler.ts:263-277`) — the single gate both selection paths pass through:
- **Near-duplicate gate**: lift `similarity()` out of `atelier/uniqueness.ts` into a shared lib; any bullet
  pair (within a project, and across the whole résumé) above a content-word Jaccard threshold → keep the
  stronger (numbers beat no-numbers, then relevance), drop the twin, promote the next distinct bullet.
  Regression test built from the EXACT two SIFARISH bullets off his broken résumé.
- **Quantification guarantee**: if an entry holds ≥1 digit-bearing bullet, the selected set MUST include ≥1
  (swap the weakest pick if needed). Mirrored in `surgeryPass` scoring so the LLM plan and the compiler agree.
- **Sanitizer at the choke point**: markdown/URL cleaning moves to the compiler's single `push()` gate so EVERY
  line (title, meta, URL, bullet) is clean by construction; fix the ingestion regex (`github.ts:166` excludes
  `*` etc.); vault-repair sweep cleans already-stored polluted URLs (D140 pattern — his data, not just the code).
- **Red-team grounded**: critique receives the ledger inventory (unused numbered bullets, unused strong
  evidence) alongside the résumé text — its fixes must cite what the ledger actually holds; heuristics-first
  fast path stays.

### WS-R3 — THE EXEMPLAR LIBRARY (the "training" he keeps asking for)
- Grow `data/ustaad/library.json` with a dedicated **résumé-anatomy corpus** distilled from real
  selected-student résumés (r/EngineeringResumes success threads, hired-AI-engineer writeups, the classic
  LaTeX-template ecosystem): section order per archetype, bullet formulas, summary formulas, skills taxonomy,
  date/format conventions, per-section density norms. Target: **100+ cited sources, 50+ patterns** — honest
  counts, stated as counts (the "500 résumés" ambition lands as distilled patterns-with-receipts, and the
  library remains Pulse-refreshable versioned DATA, I13 — it keeps growing without code).
- Patterns reach every prompt via the already-wired `craftClauses` (D118) — including the NEW layout/anatomy
  patterns reaching the typesetter's choices where deterministic (section order per archetype).
- **Summary upgraded**: evidence-fed variant — role positioning + strongest proof phrase (shipped-count,
  flagship metric) — still template-compiled (I1), never LLM-minted.

### WS-R4 — THE FAST BRAIN (fewer calls, same IQ)
- Consolidate the Editor's Desk: **casting + all per-project angles in ONE structured reasoning call**
  (schema returns order + per-project angle + why). Reframe stays top-2 parallel. Red-team stays
  heuristics-first. Signature decision folds into the letter path.
  Net: worst case ~9 reasoning calls → **≤4**, serial spine shortened by one full hop, free-tier TPM safer.
- **FREE PREMIUM REASONING ROUTER (owner has zero API budget — by design, not compromise)**: the reasoning
  tier becomes a provider CHAIN of free tiers — best free lane first (candidates, live-verified at execution
  start per Law 12: Google AI Studio/Gemini free tier [no card required], Cerebras free tier, GitHub Models
  via the existing PAT), falling to the Groq gpt-oss-120b lane, falling to the deterministic keyless path.
  Every lane's usage tracked in the Dimaag Ledger (I8); the app runs fully with zero keys (I4). Three free
  brains chained beat one paid brain for THIS app: quota exhaustion degrades one step, never to silence.
  NOTE (root-cause honesty): most of the observed quality loss was selection/wiring, not model IQ — the
  structural fixes in WS-R1/R2 carry the bulk of the résumé upgrade regardless of which lane answers.
- Cache, budgets, keyless fallbacks untouched (I4/I8). Live probe re-verifies each consolidated path (D82 law).

### WS-R5 — VAULT REPAIR v2 (DONE = his data, not the seed)
- Bump forge/compile version; the existing repair banner (D140) triggers the spaced re-forge; stored packets
  re-tailor on open; polluted evidence URLs cleaned in the same sweep. Live proof runs on a REAL-vault-shaped
  ledger, and the rendered PDF is READ, not just parsed.

### WS-D1 — BREADTH UNLOCK (the LinkedIn-parity lever)
- **JSearch pages**: stop hardcoding `num_pages:'1'` — request 2-3 pages per funded query within budget
  (pricing semantics live-verified first, Law 12; budget math re-stated in Settings, I8). ~10 rows/query
  becomes ~30-60 rows/query. This single change is most of the breadth gap.
- **Query mix fixed**: `deriveHunts` interleaves BROAD market queries (`AI engineer`, `agentic AI engineer`,
  `LLM engineer`, +remote/+India variants) FIRST-CLASS alongside intern variants; `syncVisionHunts` cap raised
  so both classes get slots; **manual hunts interleave with derived** in the sweep order so they actually run
  (H4 dies). `research scientist` / `data scientist` queries removed from derive + Adzuna fallback unless his
  vision names them.
- **Region queries**: add region-phrased hunts ("AI engineer Europe remote") alongside country rotation —
  Google-for-Jobs resolves region phrasing; his LinkedIn-Europe comparison gets a direct counterpart.
- **Adzuna**: page-2 fetch where budget allows; `max_days_old` 60→30 (D65 discards older anyway).
- Budgets: perRunCap raised within existing monthly honesty (I8; monthly caps re-checked against provider
  plans live before any raise).

### WS-D2 — RELEVANCE + VARIETY (the queue must read like HIS list)
- **Per-company diversity cap** in the default top-15 (max 2 per company; overflow reachable via search /
  show-all — search stays uncapped, D64). The mechanical cause of "same 4-5 companies" dies.
- **Role-family lens — DEMOTE, NEVER HIDE**: role families not in his targets (research scientist, data
  scientist, pure-frontend…) take a real visible penalty unless his vision names them (rendered in "why this
  score", L4; editable in Settings like the Vision Lens, D96). Nothing is silently discarded, ever — the
  owner's emotion is "a flood of relevant roles worldwide", so supply explodes and ranking sorts; filters
  only re-order what he can always still see.
- **Dedupe key widened** (title 14-char truncation over-merges distinct roles of one company).
- **LinkedIn-parity chips** (from his screenshots, re-read): one-tap Radar filters — date window / Remote /
  India / Intern / Full-time / Gen-AI / LLM; a "Be an early applicant" chip on <48h postings (we hold the
  timestamps already); board-verified-open (D131) promoted to LinkedIn's "Actively reviewing" prominence on
  the card. Honest boundary: "Under 10 applicants" has no lawful data source outside LinkedIn — not built.

### WS-D3 — FRESHNESS (the freshest lane must be the most-run lane)
- **Autopilot gains the board scan**: `syncRadar` (keyless, board-verified, currently manual-only) runs on
  open with a 6h cache — the H5 wiring fix. Aggregator sweep staleness window 24h → 6h (still budget-capped,
  still once per session, still owner-gated).
- Radar shows "last swept Xh ago · N boards scanned" so freshness is visible, never assumed.

### WS-G — GURU = THE IN-APP GUIDE THAT CAN ALSO STEER
- Guru answers "meri vision ab aisi hai — radar/hunts mein kya change karun?" with the ACTUAL current config
  injected (vision, hunts, budgets, watchlist) and proposes the edits as confirm-cards through the existing
  human-confirm op pattern (vision edit → re-derive, hunt add/retire, budget tweak, watchlist add). Widen the
  vocabulary, never loosen the guard (D62 law). No auto-apply, ever (I3).

### WS-C — DECLUTTER (his explicit asks)
- Skills he adds by hand need NO repo evidence — a skills line is his own attestation (I1 governs bullets and
  prose claims; the skill list is a claim he signs). Quick-add stays one field.
- The loud "excluded from resume" card badge goes; `resumeEligible` survives as a quiet toggle in edit.
- Redundant space-eating entries: multi-select delete in Shelf (owner-only, confirmed, reversible via re-add).

### WS-Z — CERTIFICATION (the Sentinel Protocol, in full)
- Wiring audit (D125 pattern) across every feature this session touches — an unwired invention is a lie.
- Full gate suite + new regression gates (every defect above ships its test, built from his exact strings).
- **The Four Proofs**, executed and pasted: machine · fresh-eyes (wiped profile, 3 breakpoints, 0 console
  errors) · adversary (all personas vs live deploy) · money (every metered path enumerated + gated).
- Live tailor proof on a real-vault-shaped ledger; the rendered PDF read by eye (D139).
- Deploy → verify prod asset hash → owner smoke on the live URL (D76 law).
- CASE_STUDY.md + README updated. PROGRESS.md gate table un-staled.
- Then: **ONE message. "✅ DONE." No roadmap, no open-items list** — self-evolving things (library, pulse,
  hunts) evolve inside the app, and that is the app working, not a gap.

---

## 2 · HONEST BOUNDARIES (stated now so DONE means done)

1. **Third-party "ATS score" numbers are marketing, not physics.** What is controllable — and gated — is:
   single column, standard headings, clean parse order (I5 100%), keyword coverage where evidence exists,
   grouped skills, quantified bullets, zero markdown residue, classic typography. That is what those checkers
   actually measure; we max every controllable factor and never print a fake score (I9).
2. **"Beat LinkedIn" means**: on HIS searches and HIS vision, the queue matches LinkedIn's relevance and
   useful breadth, and beats it on vision-ranking + evidence-tailored packets + board-verified-open truth.
   It does NOT mean replicating the world's largest proprietary jobs graph — enterprise employers on
   Workday-class ATSes keep arriving via the lawful aggregator door (D122).
3. **Reasoning = free-tier router (WS-R4), Groq + keyless as structural fallbacks** — the app never
   depends on any key (I4); every lane is ₹0. No paid API exists anywhere in this plan.

## 3 · WHAT THE OWNER PROVIDES WITH THE GO-AHEAD

1. **A fresh Vercel token** (for deploys + live proofs).
2. *(Optional, free, no card)* **A Google AI Studio API key** — aistudio.google.com → "Get API key",
   ~2 minutes — unlocks the top lane of the free reasoning router. Without it the router still runs
   (GitHub-PAT lane + Groq + keyless).
   Keys arrive however the owner chooses to send them; they live server-side only (Vercel env /
   gitignored `.env.local`), never in any committed file. The owner manages his own secret rotation and
   revocation — standing instruction: no further reminders from the session.

## 4 · EXECUTION ORDER

R1 typesetter → R2 selection brain → R3 library → R4 fast brain → R5 vault repair →
D1 breadth → D2 relevance → D3 freshness → G guru → C declutter → Z certification.
Checkpoint commit per workstream (Law 10). Volatile facts (JSearch pricing/num_pages semantics, Adzuna
pagination, Groq model status, board CORS) live-verified at execution start (Law 12).

**STATUS: PLANNED. Nothing coded. Awaiting the owner's go-ahead.**
