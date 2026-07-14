# PROGRESS.md — SIFARISH

**Resume line: "read PROGRESS.md and continue."**

## Status: Session 5.3 "The Taalmel" — CROSS-DEVICE SYNC · RESEALED ✦

Live: https://sifarish-shv-s-projects.vercel.app · **302/302 gates green** · 0 console errors ·
build warning-free · all Four Proofs (§14) executed.

### Session 5.3 — open Owner Mode anywhere, your ledger follows (D54)
The owner opened Owner Mode on his **phone** and got a fresh reset — each browser's IndexedDB is its own
island (the local-first plan; per-device by design). His real need is multi-device, so it's cured:
**server-blind encrypted sync**. A Vercel Blob store holds ONLY ciphertext (AES-256-GCM, key derived from
his passcode via PBKDF2 — the server sees only SHA-256(passcode), never the AES key). `/api/vault` is
token-gated (401) + origin-checked (403) at the choke point. **Fail-safe by construction:** any failure
(no key / decrypt-fail / offline / empty cloud / not-provisioned) leaves LOCAL DATA UNTOUCHED — restore
only when the cloud copy authentically decrypts AND (is newer OR local is empty). Last-write-wins.
Owner-gated client-side (a demo/Darshak browser can never call it). 10 new gates.

### Session 5 — the disease cured (one root cause, not four)
The owner reported: greeted as demo 'Arjun'; **owner edits vanish on reopen**; leaky modes; token-spend
fear. Reproduced from a wiped profile → ONE root cause: a single Dexie store shared by owner+demo, seeded
with the demo persona, identity as a boolean flag; durable storage never requested (evictable).

- **PEHCHAAN** (`src/lib/pehchaan.ts`) — the single identity resolver; mode resolves at boot, every
  transition full-reloads so store+identity+gates recompute from one truth. (D48)
- **TIJORI** (`src/db/db.ts` + `tijori.ts`) — two physical vaults (`sifarish_owner`/`sifarish_demo`) that
  can never clobber; owner vault seeds ONCE from the real seed (lazy → demo visitors never get his PII);
  `storage.persist()` requested; debounced encrypted auto-backup + restore-on-empty. loadOwnerSeed footgun
  removed. The Arjun-in-owner + edits-vanish classes are structurally impossible. (D49)
- **Atelier Baithak** (talk to the letter, I11) + **Alignment Map** (requirement→evidence, honest gaps→
  Taleem) + deeper Khabri hunts. (D50)

**THE FOUR PROOFS (§14) — executed:**
1. Machine: 278/278 tests · tsc clean · warning-free build.
2. Fresh-eyes: 33 screenshots ×3 breakpoints, 0 console errors, owner rendered as Shaurya, all features render.
3. Adversary (live prod): demo visitor 0 metered calls + sees Arjun + no owner vault; curl no-origin 403 on
   all 7 functions; fabricated/absent token cannot spend; wrong owner code refused; **real owner greeted as
   Shaurya + edit survives reopen**.
4. Money: every metered client owner-gated (source-scan) + server token-required (7/7) + budget-capped (I8).

Owner code: `Vers@tile1` (Vercel env `SIFARISH_OWNER_PASSCODE`; change there + redeploy anytime).

## Version history
- **v1 — honesty.** Five pillars (Sach Ledger, Nabz, Radar, Darzi, Morcha), I1–I6, evidence-compiled +
  parse-back-tested resumes. 65 gates.
- **v2 — eyes (Jasoos).** Khabri discovery, Darzi Intel, Guru chat, Pulse Loop. I7–I9. 111 gates.
- **v3 — brain (Dimaag).** Reasoning core (cached/budgeted/fallback-safe), four-pass Editor's Desk,
  Atelier letters, Vision Engine, Guru v2. I10. 145 gates (+v3.1 hardening → 146).
- **v4 — mastery (Ustaad).** The final form. I11–I13. 231 gates (+v4.1 bulletproof → 244, +v4.2 server-verified owner → 248).

## v4.1 bulletproof pass (owner-requested, 13-Jul-2026)
- **D44 — the showcase can never spend a rupee.** Every metered client checks the Darbaan lock BEFORE
  fetching (Darshak/demo = structurally keyless), and all 7 API functions refuse foreign/absent Origins
  + honor an optional `SIFARISH_OWNER_TOKEN` full-lockdown env (degrades to keyless, never breaks).
- **D45 — Nabz reads READMEs.** New-repo drafts distill the README: summary from the first prose
  paragraph, feature bullets (noise filtered), lexicon-matched keywords, live URL → richer entries mean
  more precise tailoring. Owner confirms every draft.

## v4 workstreams — all done
- **WS0** — Law-12 live audit caught the Groq deprecation (llama models shut down 16-Aug-2026) and
  migrated (D35). THE USTAAD RESEARCH: `data/ustaad/library.json` — **42 cited sources**, 18 craft
  patterns, 6 archetype guides, 3 hiring-path briefs; RESEARCH.md §7.
- **WS1** — Ustaad wired into all four Darzi passes (citations in rationales, archetype section order in
  the compiler, verb-ladder red-team checks) + **Compile Quality estimator** (honest rubric, gap-vs-choice
  itemization, golden packets 100/100) + Pulse library-freshness loop (I13).
- **WS2** — **Darzi Baithak**: Hinglish/English conversation → proposed EditOps → diff cards → ✓ →
  deterministic executor → gates re-check (I11). Adversarial claims refused with Gap Notes; links
  liveness-probed; Nabz deep-scans repo descriptions for live URLs.
- **WS3** — **Guru v3, the Sage**: compiled dossier every turn (vision + avoids + path briefs + pulse +
  ledger), vision-alignment guardrail (the reported Google/Microsoft failure is now a regression test),
  cited hiring-path briefs, sharpen-vision proposals. 30-conversation eval.
- **WS4** — **Dak Khana**: GIS token flow (`gmail.readonly` ONLY, token in memory), client-side reply
  matching, "{Company} ne jawab diya" cards on Morcha, owner-confirmed stage moves, nudge auto-clear.
  Zero send capability proven by source-grep gate (I3).
- **WS5** — **Darbaan**: PBKDF2 owner passcode; Darshak read-only showcase on a PII-scrubbed demo seed;
  mutations blocked at the Dexie DBCore level (I12); AES-256-GCM encrypted export/import.
- **WS6** — **Taleem Radar**: 90-day JD demand × vision-fit gap ranking, cited + rationaled, one-tap
  in-forge tracking. Settings consolidated (Darbaan, Ustaad version/staleness, Dak Khana, budgets).
- **WS7** — Warning-free build, vendor split (entry 85+91KB gzip), owner seed lazy, static splash +
  parallel boot (FCP 1.8s, CLS 0.006), 30 screenshots ×3 breakpoints with 0 console errors.
- **WS8** — Certification + seal + docs + deploy.

## Gate table — 248/248 green
| Suite | Gates | Covers |
|---|---|---|
| v1 core (invariants, parseback, radar, chaos, honesty, security, gates) | 65 | I1–I6 |
| v2 (khabri, budgets, guru) | 46 | I7–I9 |
| v3 (dimaag, editor, atelier, vision, chaos-v3) | 35 | I10 |
| v4 ustaad | 15 | I13, Compile Quality |
| v4 baithak | 22 | I11, probes, refusals |
| v4 guru v3 (in guru suite, 30-convo) | 20 | dossier, guardrail regression |
| v4 dak | 9 | I3 zero-send proof |
| v4 darbaan | 13 | I12, backup, PII scan |
| v4 taleem | 6 | cited gap ranking |
| v4.1+v4.2 bulletproof | 17 | D44 zero-spend Darshak + API origin/token guard, D45 README distiller |

Console 0 · typecheck clean · build warning-free · Lighthouse desktop 99/100/100 (mobile-sim 83 —
slow-4G SPA cold-load floor, stated honestly, D42) · screenshots ×3 breakpoints refreshed.

## Owner setup (the only human steps, ever)
1. **Gmail (~10 min):** console.cloud.google.com → project "sifarish" → enable Gmail API → OAuth consent
   (External, Testing, sole test user = shaurya.verma2705@gmail.com) → Web OAuth Client ID with the Vercel
   URL as authorized JS origin. Client ID `166073365717-…googleusercontent.com` is already wired as the
   default (public-safe); set `VITE_GOOGLE_CLIENT_ID` only if it changes. In-app: Morcha → Connect Gmail
   (proceed through the "unverified app" Testing-mode warning).
2. **Owner code:** the app opens to a Gate — Owner Mode is verified against `SIFARISH_OWNER_PASSCODE`
   (set in the Vercel env, currently `Vers@tile1`; change there + redeploy anytime). On first owner unlock
   the owner vault **auto-seeds from the real profile** (Session 5 — no manual "load owner seed" step), and
   an encrypted auto-backup runs after every edit. Optionally export one manual backup from Settings → Darbaan.
3. Rotate API keys when convenient (they touched plaintext chat in earlier sessions — KEYS_GUIDE.md).

## THE SEAL
> **SIFARISH is sealed. Future change = data, not code.**
> Ledger entries, the Vision Profile, watchlists, budgets, and Pulse-proposed Ustaad library updates are
> the only moving parts — all confirmed inside the app. No software is literally eternal; what this
> architecture guarantees is that staying current never again requires opening an editor.

## ONE next action
→ **None for the code — the seal holds (302/302, Four Proofs green, sync live).** For the owner: open the
   app on ANY device → 🔑 Owner Mode → `Vers@tile1` → your real data arrives up to date (edit on the laptop,
   open on the phone, it's there). Settings → Darbaan shows sync status + a "Sync now" button. Go get the internship.
