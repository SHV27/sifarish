# FIXLIST.md — Session 5 "The Pehchaan Repair" (root-cause, 13-Jul-2026)

Reproduced from a WIPED browser profile against the production build (Mandate 0). Each entry:
symptom → PROVEN mechanism (file:line) → cure → the regression gate that will guard it.

## THE ONE ROOT CAUSE (blast-radius insight, §14)
All four reported symptoms are ONE disease: **there is a single Dexie store (`sifarish`) shared by
owner and demo, seeded with the demo persona, and identity is a boolean flag — not a resolved
identity.** When "who is here" is ambiguous, every symptom follows.

## P0 — DATA LOSS + IDENTITY LEAK (blocking; his life's data)

- **FIX-1 · Owner greeted as "Arjun" (demo persona).** REPRODUCED: in owner mode
  `identity.get('me').name === "Arjun Mishra (Demo)"`.
  MECHANISM: `db.ts:50` opens ONE store `sifarish`; `seed.ts:5,38` seeds it from `demo.seed.json`;
  `authenticate()` (`lock.ts:149`) only flips `ownerUnlocked=true` — it never loads the owner's real
  data. Owner sees Arjun until the manual `loadOwnerSeed()` footgun.
  CURE (WS1/WS2): TIJORI splits into `sifarish_owner` / `sifarish_demo`; PEHCHAAN mounts the owner
  store in owner mode. Demo persona is physically in the demo DB → cannot appear in owner mode.
  GATE: `owner-mode identity === Shaurya` and `demo persona never renders in owner mode`.

- **FIX-2 · Owner edits vanish on reopen.** REPRODUCED: `navigator.storage.persisted() === false`.
  MECHANISM: durable storage was never requested (`persist()` absent everywhere), so IndexedDB is
  best-effort and the browser evicts it under pressure / in some privacy modes = literal loss.
  Compounded by `loadOwnerSeed()` (`ownerSeed.ts:15`) doing `ledger.clear()` — a re-click wipes edits.
  CURE (WS2): call `navigator.storage.persist()` on first owner unlock; auto-backup (encrypted) after
  edits to a separate `backups` store; restore-on-empty; seed-once (never clear owner data).
  GATE (headline): owner edit → reload → **edit still present**; persist() requested; backup written;
  restore-on-empty works.

- **FIX-3 · loadOwnerSeed is a clobber footgun.** MECHANISM: `ownerSeed.ts:14-19` unconditionally
  `clear()`s the owner ledger and reloads the pristine seed — every click destroys edits.
  CURE (WS2): seeding is import-IF-EMPTY only; neuter the manual overwrite (import merges, never wipes).
  GATE: seeding never overwrites existing owner entries.

- **FIX-4 · Demo/owner store collision (PII leak + confusion).** MECHANISM: same `sifarish` store; a
  visitor who picks Demo after an owner session (or vice versa) sees the other mode's data; the gate's
  `sessionStorage` flag (`App.tsx`) doesn't switch stores.
  CURE (WS2): two physical DBs; PEHCHAAN mounts exactly one; demo DB is reseeded/wiped without ever
  reading the owner DB. GATE: demo seed cannot write the owner store (asserted).

## P1 — recertify (were "done", must be re-proven not re-claimed, §14 RC2/RC4)

- **FIX-5 · Zero-spend demo** — re-route every metered client through `usePehchaan().mode==='owner'`
  (was `isOwner()`; same intent, must survive the rebuild). Money Proof automated.
- **FIX-6 · Server Origin/token guard on all 7 functions** — unchanged in intent; re-verify live.

## Volatile deps — re-verified live 13-Jul-2026 (Evergreen, §14)
- Groq: `openai/gpt-oss-120b` + `openai/gpt-oss-20b` are the CURRENT non-deprecated production lineup
  (verified against console.groq.com/docs/deprecations — they appear only as recommended replacements,
  never as deprecated). Our code already uses exactly these. No migration due. The deprecated llama/qwen
  models (shutdown 16-Aug/17-Jul-2026) are NOT referenced anywhere in `api/`.

## Enhancements (depth, not new pillars) — after the cure is proven
- ATELIER BAITHAK (talk to the letter, I11 extended) + the Sifarish Signature UI moment.
- KHABRI deeper sweeps + INTEL Alignment Map (requirement→evidence, honest gaps → Taleem).
