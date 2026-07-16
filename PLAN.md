# PLAN — Session 5.8 "The Duniya-Depth Pass" (16-Jul-2026)

Read-only investigation (4 parallel agents) confirmed most of the mega-brief's WS-2/3/5/7/9 already
ships (D64/D87/D99/D103/D104-D107). The CONFIRMED gaps — reproduced in code, not assumed:

| # | Gap (confirmed at) | Fix |
|---|---|---|
| 1 | `Job.salary` captured (Adzuna/JSearch/Remotive/RemoteOK) but rendered NOWHERE and never scored (`score.ts` compSignal reads only JD-text compHints) | Render salary on Radar + Morcha cards; compSignal uses structured `job.salary` when JD text has no comp language |
| 2 | Adzuna sweeps the same 8 of 18 markets forever (`ADZUNA_COUNTRIES` fixed, perRunCap 8) | Full 18-market list + persistent per-sweep rotation ('in' always first) — same budget, whole world over ~3 sweeps |
| 3 | No new provider since D90; watchlist missing the AI-first companies from his own LinkedIn feed | Add We Work Remotely (RSS via the existing guarded aggregator proxy — probed live 200); watchlist +Netomi (Lever, 31 jobs live), +Kantiv (Ashby), +Writer (Ashby) with an additive once-only migration |
| 4 | Radar search results render in an unbounded div — 1000 matches stretch the page (`Radar.tsx:195`) | Scroll container when searching/show-all |
| 5 | Dak Khana has no "I know this one" — dismiss is the only exit; no action-first ordering; interview vs rejection cards look identical | `acked` status + ✓ button; sort interview → rejected → generic, newest first; distinct stage badges |
| 6 | D74's blind spot still open: no global signal when the reasoning tier silently degrades | `dimaagHealth()` over `db.dimaagUsage` + a small owner-only badge in the app header (live / degraded / keyless) |
| 7 | Vision edit re-ranks immediately but new hunts wait for next app open (`syncVisionHunts` only in autopilot) | Debounced `syncVisionHunts` after vision edits in Settings (additive + idempotent, so safe) |
| 8 | Radar-sanity gate has no fixture from his real LinkedIn feed | Hand-labeled fixture (Agentic Engineer @ Netomi, GenAI @ Wingify, etc.) asserting vision ranks them top |

Law-12 re-verified live 16-Jul: gpt-oss-120b/20b have NO deprecation date (they are Groq's
recommended replacements). WWR RSS 200; Lever/netomi 200 (31 jobs); Ashby/kantiv + writer 200.
Rejected honestly: Findwork (401, needs a key we don't hold), Greenhouse netomi/teradata/wingify
(404 — not their ATS), Jooble/Careerjet (key-required, not held).

Constraint discovered: all sensitive Vercel env values pull EMPTY (stored as Sensitive — unreadable
by design), so live proofs run against PROD endpoints using the local owner-code file (never printed),
not direct Groq calls.

Process: every fix ships with its regression test → full gates + tsc + warning-free build → docs
(D110+) → commit + gh push → vercel deploy → served-hash verify → live owner smoke + adversary curl.

---
(Prior plans are preserved in git history; this file describes the current session only.)
