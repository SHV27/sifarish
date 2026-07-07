# PROGRESS.md — SIFARISH

**Resume line: "read PROGRESS.md and continue."**

## Current workstream: WS7 (Certification & Ship) — deploy remaining

## Done
- **WS0** volatile facts verified live; scaffold; Ink & Appointment tokens.
- **WS1** Sach Ledger: types, Dexie schema, real SHV27 seed (30 entries), shelf UI with inline edit,
  Voice Bank, promotion ceremony.
- **WS2** Darzi Engine: JD decode → evidence match → deterministic one-page compiler → pdf-lib PDF +
  docx DOCX → pdfjs parse-back. Packet screen with paste lane.
- **WS3** Shikaar Radar: 29-board live-probed watchlist seed, 4 keyless feed adapters, paste lane
  (URL + text), rubric scoring with expandable WHY, ranked queue capped at 15.
- **WS4** GitHub Nabz: keyless REST sync, diff→suggestion engine, one-click promotion loop, strength meter.
- **WS5** Morcha Board: 6-column pipeline, day-7/14 nudges, interview dossier, persistent header strip.
- **WS6** `/api/polish` edge function + deterministic fact-drift guard (client re-check), onboarding
  (first packet <60s), keyboard nav (1–5 + skip link), teaching empty states, a11y (roles/labels/reduced-motion).
- **WS7a** 65 gate/invariant tests green — incl. I5 real pdf.js parse-back round-trip.
- **WS7b** Headless screenshots: 8 screens × 3 breakpoints (360/768/1280). **Zero console errors** verified.
- **WS7c** README case-study + LAUNCH.md (LinkedIn draft + 100-word pitch); docs updated.

## ONE next action
→ Deploy to Vercel (static + `/api/polish`), then paste the live URL into README + LAUNCH.md and print the final report.

## Gate status
| Gate | Status |
|---|---|
| Ledger integrity (I1) | ✅ green |
| Parse-back fidelity (I5) | ✅ green (real PDF round-trip) |
| JD coverage (≥80% backed, 0 unbacked) | ✅ green |
| One page | ✅ green |
| Slop-scan | ✅ green |
| Radar rubric agreement | ✅ green |
| Fact-drift guard | ✅ green |
| Chaos (empty/forge-only/malformed/overflow/HTML) | ✅ green |
| Console errors | ✅ 0 across all screens |
| 3-breakpoint screenshots | ✅ captured |
| Deploy live | ⏳ pending |

**Total: 65/65 tests · typecheck clean · build clean · 0 console errors.**
