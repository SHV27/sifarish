# ARC PLAN — SIFARISH v2 (05-Sep-2026) · honest count: 5 arcs

Chassis note: the walking skeleton exists (deployed product, 776 gates, pre-commit hook, REST deploy
path, served-hash proof). Arcs run sequentially in this autonomous session (Charter: owner in
class); each closes with studio-verify evidence (machine + eyes on the rendered page + live browser)
before the next opens. Acceptance lists are FROZEN — new ideas go to NOTES.md. The résumé path
ships FIRST (the clock is a real cost); everything else grows around it.

## Arc 1 — THE RÉSUMÉ PATH (Pillars 1 + 3: Strategist + Page)
Acceptance (frozen):
- [ ] `Reading` (strategist/reading.ts): whole posting → cares / doesNotCare (each with the quote) /
      readerPersona / roleWindow / archetype / skills.must+nice (lexicon floor kept) / revealAffinity;
      Gemini deep pass via /api/dimaag with schema; deterministic floor; cached by posting hash;
      two-sided gates (Babaclick "we do not care about LeetCode" is a doesNotCare, never a care).
- [ ] `buildDigest` (strategist/digest.ts): every eligible fact with id/kind/title/summary/evidence
      note/stack/README features, capped deterministically (≤ ~6k tokens), ids stable.
- [ ] `GamePlan` (strategist/plan.ts): threeLines (headline + summary, evidence-cited), sectionOrder,
      played[{factId, section, reason, framing?}], benched[{factId, reason}], skills rows
      [{label, items[{text, factIds}]}], reveal{on, reason}; LLM plan + deterministic plan; `validatePlan`
      rejects unknown ids / unreasoned benches / uncited skills / slop; Babaclick gate: NTSE + Braillix
      played in the first three lines, LeetCode-class items benched with the posting's words.
- [ ] Critic (strategist/critic.ts): hostile-recruiter rubric (own prompt, Groq-sized) → ≤1 revise;
      verdict + issues persisted; skipped is declared.
- [ ] Compiler executes the plan: sectionOrder (education/experience/projects/skills/achievements/
      positions/certs/custom), skills rows from plan, headline+summary lines from plan, framing
      overrides drift-guarded; TIGHTEN ladder (leading/size/before) before any content step; page 2
      per Settings.pagePolicy (default two-ok) before any true fact is dropped; margins 36pt.
- [ ] Renderer: multi-page, link annotations (contact handles + project links + name→GitHub) with
      visible text; DOCX parity (hyperlinks + pages); parse-back green across pages.
- [ ] Packet UI: the Played/Benched board (every fact, reason, evidence text on click) + mode badge
      (gemini/groq/heuristic) + pages badge; reachable on the DEFAULT tailor path.
- [ ] Routing v1.2.0 (gemini-3.8-flash head; Groq skip >6k tokens) + budgets; registry bump.
- [ ] Seed/dossier prerequisite: his real projects (Braillix, Sehat Saarthi, Sifarish, Aaina, Spark
      Core) + the Techgyan IIT Ropar win + NTSE marks land in the seed AND union-merge into his vault
      (flag-guarded, nothing deleted).
- [ ] Eyes: Babaclick packet rendered to PNG and READ; a second, ordinary AI-engineer posting
      rendered and read (no overfit). Live: deployed, served-hash proven, browser walkthrough.
- [ ] Gates green + new gates; tsc clean; warning-free build; PROGRESS.md checkpoint; commit.

## Arc 2 — THE DOSSIER (Pillar 2)
Acceptance (frozen):
- [ ] `LedgerEntry.kind` open (known kinds typed, any string allowed); Settings.sections registry;
      unknown kinds render as titled sections in the plan's order; Shelf lists them.
- [ ] Ek Baat ops: `add-fact` (kind inferred, section created if new), `create-section`,
      `plan-play` / `plan-bench` (packet-scoped), `retailor`; deterministic parser + LLM lane; demo
      names the wall.
- [ ] `derivedSkills()` authority (dossier/skills.ts): stacks + keywords + tags + skill entries +
      sworn facts; the Shelf skills form is retired from the résumé path (entries stay as evidence).
- [ ] README absorb refresh: Nabz re-reads every public repo's README into `context` (claims with
      quotes); staleness stamped; keyless floor.
- [ ] Migration preserves everything; two-sided gates (a badminton fact lands; a fabricated résumé
      claim through chat still refuses).
- [ ] Gates + eyes + deploy + PROGRESS + commit.

## Arc 3 — THE HUNT, RE-RANKED (Pillar 4)
Acceptance (frozen):
- [ ] Freshness gate (default 14 days, stamp on every card, setting) · seniority as multiplicative
      cap (senior ≤40) · window from Reading/decode (intern/new-grad boosted) · one-sentence "why".
- [ ] JSearch `employment_types=INTERN` + `date_posted`; Adzuna `max_days_old`; vanshb03 Summer2027
      mirror lane (keyless JSON); live probes logged in RESEARCH.md.
- [ ] Two-sided gates: a fresh intern role outranks a 100-point senior FDE; an old role is stamped
      and demoted, never hidden without a count.
- [ ] Gates + eyes + deploy + PROGRESS + commit.

## Arc 4 — THE DESK (Pillar 5)
Acceptance (frozen):
- [ ] Dak status verdicts (received / under-review / rejected / interview / offer) from LinkedIn/ATS
      mails (deterministic patterns + classify lane), stamped on the job; unparsed = "read in Gmail".
- [ ] Landing = the Desk: applications with status stamps, fresh ranked roles, today's one action,
      Ek Baat input on every screen.
- [ ] Demo mode = the Babaclick worked example on the fictional persona: posting → reading → plan →
      page, read cold in three scrolls; ₹0 spend; no owner data.
- [ ] Gates + eyes + deploy + PROGRESS + commit.

## Arc 5 — SHIP + CERTIFY
Acceptance (frozen):
- [ ] Hostile QA on every screen (fresh-context hunter): built-but-not-wired, stored-never-consumed,
      sibling rules, silent fallbacks — findings fixed same day.
- [ ] Live proofs: adversary curls, demo smoke ₹0, owner smoke on HIS data, Lighthouse.
- [ ] README rewritten for v2 with fresh screenshots (his instruction) · CLAUDE.md constitution
      refreshed (≤60 lines) · resume-eye project skill · PROGRESS.md final · credentials message.

Parked (NOTES.md): outcome-learning loop (starts empty by design) · The Muse lane · Vercel cron sweep ·
letter voice pass · interview-prep sheet.

> STATUS 05-Sep-2026: Arcs 1–4 built, deployed and proven live (see PROGRESS.md); Arc 5 in progress.
