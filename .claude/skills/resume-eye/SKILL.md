---
name: resume-eye
description: Render a Sifarish packet for a job posting to PNG and READ it as a recruiter would — the v2 verification standard ("watch it work, not tests pass"). Use before closing any arc that touches the strategist, the compiler, the renderer, fonts, or the seed; use `--live` to prove the Gemini pass on production.
---

# Resume eye — read the page, not the test log

1. Put the whole posting (not just the JD) in a text file. The brief's ground-truth case is
   Appendix A of VISION-BRIEF-sifarish-v2.md (Babaclick); an ordinary AI-engineer posting must
   be rendered too, so nothing overfits.
2. Keyless floor (deterministic reading + plan):
   `npx tsx scripts/resume-eye.mts <posting.txt> "<Company>" "<Role>" shots-eye`
   Live Gemini pass on production (owner token from gitignored owner-code.local.txt, never printed):
   `npx tsx scripts/resume-eye.mts <posting.txt> "<Company>" "<Role>" shots-eye-live --live`
3. READ every PNG with the Read tool. Check, in this order: the three lines carry the proof this
   company asked for · section order fits the reader · every true achievement/position present ·
   nothing they said they do not care about takes prime space · links visible · no eaten spaces
   or lost accents at bold boundaries · one page unless the dossier honestly needs two · the mode
   badge (gemini/groq/heuristic) · the critic's issues.
4. Every defect found by eye becomes a rule + a gate the same day (tests/strategist.test.ts,
   tests/session7-typeset.test.ts), then re-render. A green suite proves nothing about how it looks.
5. `scripts/pdf-to-png.mts <file.pdf> <prefix>` rasterises any PDF (pdf.js in headless Chromium).
6. Never commit shots-eye/ or shots-eye-live/ (gitignored — they carry his data).
