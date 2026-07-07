# PROGRESS.md — SIFARISH

**Resume line: "read PROGRESS.md and continue."**

## Current workstream: WS0 → WS1 (Sach Ledger)

## Done
- WS0: volatile facts verified live (07-Jul-2026):
  - Versions: Vite 8.1.3 · React 19.2.7 · TS pinned ~5.9 (6.0.3 too fresh) · Tailwind 4.3.2 · Dexie 4.4.4 ·
    docx 9.7.1 · pdf-lib 1.17.1 · pdfjs-dist 6.1.200 · Vitest 4.1.10 · Playwright 1.61.1.
  - CORS: Greenhouse/Lever/Ashby/SmartRecruiters ALL return `access-control-allow-origin: *` → browser-direct.
  - GitHub: SHV27 has 13 public repos; unauth 60 req/hr confirmed; API CORS `*` → Nabz browser-side.
  - Project repos (DARYA/MUNSHI/KATHA VAULT/YOJANA SETU/SUTRADHAR/Braillix) NOT public yet → seed `in_forge`.
    `gloaming-game` live with README + deployed URL → seed `shipped`.
  - All three user-supplied tokens FAILED auth (Groq invalid / GH PAT 401 / Vercel 403) → keyless build;
    user rotates + re-issues later if amplifiers wanted.
- Scaffold: package.json, tsconfigs, vite/vitest configs, index.html, tokens.css, .gitignore, git init.

## ONE next action
→ Write `src/types.ts` + Dexie schema + `seed/ledger.seed.json` (WS1).

## Gate status
| Gate | Status |
|---|---|
| Ledger integrity (I1) | not yet run |
| Parse-back fidelity (I5) | not yet run |
| JD coverage | not yet run |
| One page | not yet run |
| Slop-scan | not yet run |
| Radar rubric agreement | not yet run |
| Fresh-Eyes ≤60s | not yet run |
| UX floor (console/a11y/screenshots) | not yet run |
