# PRODUCT_BAR.md — THE ₹1 CRORE REFRAME

*Studio Protocol Phase 2 · 19-Jul-2026 · read-only audit against the live codebase (S7.2 "The Sanad",
669/671 gates). Constitution honored throughout: "Compile truth. Draft everything. Send nothing."
Every spec below respects I1–I13, ₹0 new spend, keyless degradation, human-confirmed mutation.*

**The question asked of every feature:** if a company paid ₹1 crore for exactly this, what would they
expect on day one that the feature doesn't do? Where the honest answer is "nothing — it's past the bar,"
we say so. The user is ONE person: a final-year student sniping ~10 AI-engineering applications/week,
Aug–Dec 2026, for a Jan–May 2027 internship. Every spec is sized for him, not for a market.

---

## 1 · SACH LEDGER + NABZ (the evidence vault + the GitHub pulse)

**₹1-crore expectation.** Mostly met — this is the app's genuinely novel mechanism (the
self-strengthening résumé: repo ships → Nabz reads the README → forge writes accomplishment bullets →
owner confirms → résumé compounds). The forge pipeline (D56→D104→D140→D149, FORGE_VERSION 4) with
drift-guarded LLM reshaping is beyond anything commercial. What ₹1 crore would still expect:

- **Non-repo evidence lanes are thin.** His life is not only GitHub: coursework projects, Kaggle
  finishes, hackathon placements, papers, certs with verifiable URLs. QuickAdd exists but is a bare
  form; there's no "paste a certificate/leaderboard/announcement URL → distilled draft entry" lane
  (the D45 README pattern, applied to any URL he owns). Tavily lane already exists and is budgeted.
- **Evidence rots silently.** `evidence.url` is probed at packet time for letters, but a ledger-wide
  dead-link sweep doesn't exist. A recruiter clicking a 404 live-demo link is worse than no link.
- **No interview-story layer.** The ledger holds claims; interviews need STAR narratives. The deep-read
  context (D58/D84) is 80% of a story — nothing renders it AS one.

**Best-in-class analog: Teal's Career History bank.** Why theirs works: one reusable achievements
library, friction-free capture of *any* work (not just code), drag-into-résumé reuse. Why ours already
beats it where it matters: theirs is free-text (fabrication-friendly); ours is evidence-linked by
construction (I1). **Better-for-him spec:** (a) a "paste any URL you own" QuickAdd lane — distill →
draft entry → confirm (Nabz pattern, cached, keyless-degradable to manual fields); (b) a weekly
dead-link probe over `evidence.url` (HEAD requests, free, budget-irrelevant) surfacing a repair chip on
the Shelf; (c) a read-only "Story view" per project — problem → built → hard part → numbers, compiled
from context + bullets, rehearsable before interviews. All three are data-plumbing over existing pipes.

**Cross-domain steal: aviation currency requirements.** Pilots aren't "qualified forever" — ratings
lapse without recent hours. A skill entry whose last supporting evidence (repo push, new bullet) is
>12 months old gets a quiet "currency" chip: still true, but expect a probe in interviews. Justified
concretely: his RAG/agents claims are fresh; older skills (e.g., early-project stacks) are exactly what
a hostile interviewer digs at. Deterministic (dates already on entries), zero spend, no mutation.

---

## 2 · SHIKAAR RADAR + HUNTS (discovery + ranked queue)

**₹1-crore expectation.** After S7/S7.2 (D144–D146, D152: daily rations, class quotas, dedupe identity,
board-scan autopilot) the *relevance loop* is honestly commercial-grade: vision drives hunts, staleness
and role-family lenses demote visibly, every score decomposes (L4), closures reconcile. What a ₹1-crore
buyer would still expect:

- **Deadline capture.** Internship postings (esp. India/campus cycles) carry apply-by dates. Nothing
  extracts or ranks on them; a role can silently expire while ranked #4. This matters MORE for him than
  for a general user — the Aug–Dec window is a deadline machine.
- **Yield-aware budget allocation.** Rations (D152) keep lanes alive all month, but credits are spread
  by fiat, not by what each lane actually *produces for him*. JSearch's 200/mo is his scarcest resource.
- **Salary normalization.** 💰 renders raw (D110); $85k vs €60k vs ₹12 LPA aren't comparable at a
  glance against his stipend floor. A static conversion table (versioned data, I13) suffices.
- **No undo on "✕ not for me"** — the one instant-destructive action left in an otherwise reversible
  app (Morcha learned this in D87).

**Best-in-class analog: LinkedIn Jobs + Simplify's curated index.** Why LinkedIn works: breadth nobody
can match lawfully, daily alert digests, "early applicant" urgency, actively-reviewing signals. SIFARISH
already cloned the *signals* (chips, early-applicant, board-verified-open — D131) and beats LinkedIn on
ranking transparency and per-user vision fit; it will never match raw breadth (D122's honest probe:
most companies expose no lawful feed) — and shouldn't chase it; the aggregator lanes are the lawful
door. **Better-for-him spec:** (a) `applyBy` extraction in normalize (regex over JD for deadline
phrases + Adzuna/JSearch structured fields where present) → a "closes in Nd" chip + a briefing line;
(b) INR-normalized salary badge from a committed rates table; (c) 7-day undo bin for dismissals.

**Cross-domain steal: fisheries CPUE (catch-per-unit-effort).** Trawlers allocate fuel to grounds by
realized catch per liter, not by where fish *should* be. Track per-lane, per-hunt realized yield —
not "jobs found" but "jobs that survived HIS filter" (tailored/applied/interview, which Morcha already
records) per credit spent. Render it in the Hunt panel ("this hunt: 41 credits → 0 you kept"); let the
Pulse PROPOSE ration shifts (human-confirmed, D89 pattern). Justified: at 200 JSearch credits/mo, a
dead hunt is a real tax; the data already exists in `jobs` + budget rows. Deterministic, zero spend.

---

## 3 · DARZI (packet compile + Editor's Desk + Baithak)

**₹1-crore expectation: MET — and the honest answer is that ₹1 crore buys worse than this elsewhere.**
Deterministic compile from evidence (I1), 100% parse-back (I5), always-fits one page (D32), MMR
near-duplicate repulsion + concept-theme dedupe (D142/D149), quantification guarantee (D127), the
four-pass Editor's Desk reasoning over JD+intel+README through a free three-brain router (D144), the
Nazar page-level judge (D150), a conversational Baithak that can drop/reframe/rewrite-angle without
ever minting a fact (D62/D120), zero amnesia across ops (D151). Jobscan/Teal/Rezi have nothing like the
invariant structure; their "AI rewrite" is precisely the fabrication lane this app made impossible.
What's genuinely still missing at the ₹1-crore bar:

- **No outcome feedback.** The Editor's Desk casts and angles brilliantly — then never learns whether
  that casting got a reply. Fifty applications by November is a real (if small) sample the app throws
  away. This is the single largest untapped asset in the codebase.
- **The packet stops at "apply."** The same evidence + JD decode could compile the interview-prep
  artifact (likely questions per must-have → his ledger's answer per question) and doesn't.

**Best-in-class analog: Jobscan's match report.** Why theirs works: one number + a keyword table =
instant comprehension; recruiters-trust-me framing. Ours already exceeds it (Compile Quality rubric,
alignment map, gap notes, and no keyword-stuffing incentive — I1 forbids the fraud Jobscan quietly
rewards). **Better-for-him spec:** don't touch the compile core (sealed, correct); add the two loops
around it — outcome memory (below) and the interview-prep sheet (§5).

**Cross-domain steal: poker hand-history review.** Serious players don't judge decisions by feelings —
they re-read hands in aggregate: "when I 3-bet from this position, how did it run?" Every
rejected/ghosted/interview packet is a hand history the app already stores (archetype, angle, casting,
must-have coverage, appliedAt, outcome from Morcha/Dak). A deterministic aggregation — "projects-first
casting: 2 replies / 11 apps; skills-first: 4 / 9" — surfaced in the Retro panel, ADVISORY ONLY with
the honest small-n caveat printed on it (n<15 → "too few hands to read"). Never auto-tunes (I3-spirit:
the Pulse may PROPOSE an emphasis change; he confirms). Extends D135's retro from gap-counting to
decision-quality review. Pure DB, zero spend, ~1 lib file + a panel.

---

## 4 · COVER LETTER / ATELIER

**₹1-crore expectation.** Strong: evidence-compiled letters, trigram-Jaccard uniqueness vs the last 5
(D29/D125), letter-Baithak with the same evidence rule (D153), PDF+DOCX with parse-back (D60), slop/I9
scans. Gaps at the bar:

- **No opening-line discipline.** The first sentence decides whether a letter is read; nothing measures
  whether his opener is company-specific or template-shaped (the uniqueness gate catches body reuse,
  not first-line genericness).
- **No length/skim calibration.** Recruiter-side research says <200 words wins; the letter has no
  visible word-count budget or "skim view" showing what a 6-second reader sees.

**Best-in-class analog: Lavender (sales-email coach).** Why it works: it scores an email as the
*recipient* experiences it — length, reading level, "about them vs about you" ratio, mobile preview —
and coaches inline rather than rewriting. That reader-centric scoring transposes perfectly and cheaply.
**Better-for-him spec:** a deterministic letter lens beside the draft: word count vs a 180-word target,
you-vs-I sentence ratio, company-noun density in the first two sentences, must-have echoes. Pure
functions over text already in hand; renders as chips, never blocks (the letter is his voice — advise,
don't gate). LLM not needed; keyless by construction.

**Cross-domain steal: film-industry script coverage.** Readers reduce a screenplay to a one-page
verdict: logline, strengths, weaknesses, PASS/CONSIDER/RECOMMEND. The Nazar (D150) already does this
for the résumé page; extend the same judge (same budget, same exclusion-gate-only authority) to render
a coverage card on the letter: "RECOMMEND — specific to Netomi's agent stack; weakness: opener is
transplantable." Justified: it reuses an existing, wired, budgeted mechanism — marginal cost near zero.

---

## 5 · MORCHA BOARD + DAK KHANA + SAHAYAK (pipeline + mail + assistant drafts)

**₹1-crore expectation.** The board is honest and reversible (D87), nudges hand him the message (D135),
Dak is provably read-only (D39's grep gate) with interviews-first triage (D114), retro aggregates real
gaps. Gaps at the bar:

- **Stage-dwell blindness.** "Applied 9d ago" renders, but nothing *escalates*. A card rotting 12 days
  in Follow-up looks identical to a healthy one at a glance across 40 cards.
- **Dak stops at classification.** An interview email contains the two facts that matter — when, and
  with whom — and the app extracts neither. He re-reads the mail, re-types the date nowhere, and prep
  has no countdown.
- **No per-application timeline.** The packet, the apply date, the reply, the follow-ups are all stored
  but never composed into one vertical history ("what happened with Netomi?").
- Kanban ergonomics: no drag-and-drop, no bulk moves. Minor for ~10/week; note it, don't chase Linear.

**Best-in-class analog: Superhuman triage (for Dak) + Huntr (for the board).** Superhuman works because
triage is a *ritual*: split inbox, one decision per item, keyboard cadence, snooze-don't-linger. Dak
already has the split (interview/rejection/generic) and ack; it lacks snooze ("resurface this Friday").
Huntr's boards work because every card carries its documents and dates in one place — which SIFARISH
actually already exceeds via packets; the timeline view is the one Huntr trick worth taking.
**Better-for-him spec:** (a) dwell-time escalation tint per column with per-stage targets (Found 7d,
Tailored 3d, Applied→Follow-up per the existing day-7 nudge); (b) Dak date-extraction (deterministic
datetime regex over the matched mail — no LLM needed for "Tuesday, July 28 at 3:00 PM IST") → an
`interviewAt` field → briefing countdown + a prep block; (c) a read-only timeline tab on the packet
composing rows that already exist. All Dexie-local, zero spend.

**Cross-domain steal: ER door-to-doc SLAs.** Emergency departments run on stage-dwell clocks with
color-coded breach escalation — not because doctors are lazy, but because *silent* queue rot kills.
Same mechanism as (a) above: targets per stage, visible breach state, breaches feed the briefing's
"one next action." Justified concretely: ghosting is the default outcome of this domain; the counter
is disciplined follow-up timing, which is exactly what dwell clocks enforce. Deterministic, tiny.

---

## 6 · GURU (the sage chat)

**₹1-crore expectation.** Cited answers (I7), deterministic honesty-router owning refusals (D23),
vision guardrail sentence-aware (D94), live config in the dossier with named human-confirmed doors
(D147), cross-screen memory (D153). That's already more disciplined than any commercial "career AI."
Gaps at the bar:

- **No longitudinal memory of decisions.** He tells Guru "I'll focus on agent-eng roles in Europe" —
  next week Guru has no record it was ever said. A chief of staff's core skill is remembering what the
  principal decided and noticing drift.
- **Reactive only.** Guru never opens its mouth first; all proactivity lives in the Briefing. Right
  boundary (chat that nags is noise), but the *weekly review* — "here's what changed, here's what you
  said last week, still true?" — belongs to Guru and doesn't exist as a ritual anywhere.
- No thread reset/new-conversation control in the UI (skim-confirmed); an error mid-stream leaves the
  user's message unanswered with no error bubble.

**Best-in-class analog: Perplexity (citation discipline — already matched) + a good human EA.** The EA
behavior worth cloning is the read-back: repeat the decision, log it, follow up on it.
**Better-for-him spec:** a `commitments` table — when a Guru exchange contains a decision (deterministic
cue grammar first, D37 pattern; LLM assist optional), Guru proposes a one-line commitment card he
confirms (Nabz pattern). The dossier carries open commitments every turn; a weekly review chip in the
Briefing opens Guru pre-seeded with "since last review: X applied, Y replies; you committed to Z —
keep/drop?" Plus the two UI fixes (reset thread, error bubble) — trivial.

**Cross-domain steal: crew resource management read-back.** In aviation, an instruction isn't real
until read back and logged; ambiguity dies at the handoff. That IS the commitments mechanism above —
one steal, fully absorbed, not decoration. (Considered and dropped: therapy session-notes framing —
same data, weaker confirmation ritual.)

---

## 7 · PULSE / TALEEM (market intelligence + gap learning)

**₹1-crore expectation.** The Pulse is honestly good: weekly market sweep, emerging-term mining (D106),
proposals for hunts/retirements/boards/library updates — all human-confirmed, all cited (I7). Taleem is
the thin one: it *ranks* gaps (90-day JD demand × vision fit, cited) and offers one-tap in-forge
tracking — then stops. At the ₹1-crore bar, a gap ranking without a closing loop is a report, not a
product. The retro says "kubernetes was a gap in 3 of 5 rejections"; Taleem says "kubernetes ranks #2";
nobody says *"do this two-week thing, and when the repo lands, Nabz will promote it and every future
résumé carries it."* The self-strengthening loop — the app's own named novel mechanism (L14) — is wired
for projects but not for deliberately-closed gaps.

**Best-in-class analog: strength-training periodization (Renaissance Periodization-style programs) —
the honest analog is a training block, not an ed-tech product.** Why programs work where "learn X
someday" fails: one focus per block, fixed duration, a rep log, a test at the end. Duolingo-style
streaks were considered and dropped — gamification is explicitly banned (L5) and daily streaks fight a
sniper cadence. **Better-for-him spec:** "Gap Sprint" — from a Taleem gap, one click drafts an in_forge
entry with a 2-week window, a concrete deliverable ("deploy one service on k8s, README with numbers"),
and the citation trail of WHY (retro count + demand rank). Nabz already watches for the repo and
auto-proposes promotion (existing D45/D56 pipeline — zero new machinery). The Briefing shows the one
active sprint and its day count. Cap: ONE active sprint (Aug–Dec is application season, not course
season). Deterministic, zero spend.

**Cross-domain steal:** absorbed above (periodization IS the steal). Considered sentinel-surveillance
epidemiology for the Pulse and dropped — D106 already implements exactly that pattern.

---

## 8 · BRIEFING (the chief-of-staff landing)

**₹1-crore expectation.** Genuinely good: ranked fresh-for-vision matches with reasons, ONE next
action, week stats, follow-ups due, interview prep pointers (D100/D134). Gaps at the bar:

- **No campaign clock.** The entire product exists for a dated campaign — apps Aug–Dec 2026, target
  Jan–May 2027 — and the Briefing doesn't know it. "You're in week 6 of 20; 31 applications sent
  against a ~10/week plan; at this pace you finish at ~140" is the single sentence a paid chief of
  staff would never omit. The sniper quota exists in Settings; pacing against the *calendar* doesn't.
- Deadline lines (once §2's `applyBy` exists) belong here: "2 of your matches close this week."
- Renders blank until live-queries warm (skim-confirmed) — needs a skeleton, not a flash of nothing.

**Best-in-class analog: Sunsama's daily planning ritual.** Why it works: it doesn't show dashboards, it
runs a *ceremony* — yesterday's residue, today's plan, one commitment, done. The Briefing is 80% there;
the campaign clock + weekly-review chip (§6) complete the ceremony. **Better-for-him spec:** a
`campaign` block in settings (start, end, weekly quota — seeded Aug-01→Dec-20, 10/wk, editable), a pure
`paceLine()` from `appliedAt` stamps (D153 made these real), rendered as one honest sentence with no
chart (L5). Trivial effort.

**Cross-domain steal: marathon pace bands.** Runners wrap a wrist band of per-split target times —
against-the-clock truth at a glance, mid-race, no analysis required. That is precisely `paceLine()`:
cumulative-applications-vs-plan as one line. Justified: quota discipline is the app's own anti-spray
doctrine (D6) — this makes the doctrine visible weekly instead of aspirational.

---

## 9 · SETTINGS / BUDGETS

**₹1-crore expectation.** The budget honesty is past the bar and rare in the wild: per-API meters,
daily rations (D152), named skips in yields, the Dimaag Ledger naming which free brain answered (D153),
health badge (D115). Gaps:

- **Information architecture.** ~726 lines, one scroll, no anchors (skim-confirmed): vision, keys,
  budgets, vault, library, rubric, quota, watchlist. Findability is the product defect; every "built
  but buried" incident in the decision log (D69, D96, D125) is partly an IA incident.
- **Rubric weights don't enforce a total** — silent over/under-weighting (skim-confirmed).
- **No reserve doctrine.** Rations spread the month, but the app plans to land at 0 — a hot late-month
  posting (the exact early-applicant case the Radar prizes) can find the JSearch tank empty.

**Best-in-class analog: YNAB.** Why it works: envelopes make trade-offs explicit ("fund this by
unfunding that"), age-of-money reframes health, zero judgment. The meters already exist; the missing
YNAB idea is the *buffer*. **Better-for-him spec:** (a) section anchor nav (a row of jump chips —
one afternoon); (b) rubric editor normalizes to 100 with a live sum chip; (c) a 15% monthly reserve
per metered lane that rations never touch — spendable only via an explicit "use reserve" confirmation
on a manual hunt (human-confirmed spend, I8-visible).

**Cross-domain steal: aviation fuel reserves.** No flight plans to land on fumes; final-reserve fuel is
untouchable by the plan and burning it is a declared event. That is (c), concretely: the ration
algorithm's denominator excludes the reserve; touching it requires the confirm click and is logged in
the yield report. Justified by D152's own lesson — the lane that dies silently mid-month is the lane
that misses the posting that mattered.

---

## THE RANKING — impact-per-effort for THE goal
*(an AI-engineering internship, Jan–May 2027; applications live Aug–Dec 2026)*

| # | Move | Feature | Impact | Effort | Why it wins |
|---|------|---------|--------|--------|-------------|
| 1 | **Campaign pace line** (marathon band) | Briefing | High | Trivial | The whole campaign is dated; pacing is the one sentence that keeps 10/wk real for 20 weeks. |
| 2 | **Outcome memory** (poker hand-history) | Darzi/Sahayak | Very high by Oct | Small | 50+ applications of casting/angle/outcome data currently discarded; the only path to "what actually gets ME replies." Advisory-only, honest small-n. |
| 3 | **Dak interview date-extraction → countdown** | Dak/Morcha | High | Small | Interviews are the conversion point; a missed or under-prepped one costs more than 20 bad applications. |
| 4 | **Gap Sprint** (periodization) | Taleem/Nabz | High | Medium | Closes the app's own named loop: retro finds the gap → sprint ships the repo → Nabz promotes → every future résumé is stronger. Compounding. |
| 5 | **Interview-prep sheet from the packet** (must-have → likely question → his ledger answer) | Darzi | High | Medium | Same evidence, same decode, one more compiled artifact; converts the app's tailoring depth into interview performance. |
| 6 | **`applyBy` deadline capture + "closes in Nd"** | Radar/Briefing | Med-high | Small-med | Intern cycles are deadline machines; a ranked role that silently expires is a false promise. |
| 7 | **Stage-dwell escalation** (ER SLAs) | Morcha | Medium | Small | Ghosting's counter is timing discipline; makes queue rot visible across 40 cards. |
| 8 | **Hunt CPUE + Pulse-proposed ration shifts** | Radar/Khabri | Medium | Small-med | 200 JSearch credits/mo is the scarcest input; spend them where HIS keeps come from. |
| 9 | **Letter lens** (Lavender-style deterministic chips) + Nazar coverage card | Atelier | Medium | Small | Letters are read for 6 seconds; opener + length discipline is cheap and durable. |
| 10 | **Guru commitments + weekly review** (CRM read-back) | Guru/Briefing | Medium | Medium | Turns advice into a ritual; drift-detection on his own strategy. |
| 11 | **Any-URL evidence lane + dead-link sweep + Story view** | Ledger/Nabz | Medium | Medium | Widens the moat beyond GitHub; protects the credibility the whole app is built on. |
| 12 | **Fuel reserve + rubric normalization + Settings anchors** | Settings | Low-med | Small | Hygiene that prevents two known failure classes (silent lane death, buried features). |
| 13 | **Salary INR normalization, dismiss-undo, Guru thread reset/error bubble, Briefing skeleton** | various | Low each | Trivial each | Polish debt; batch into one QoL pass. |

**Already past the ₹1-crore bar — do not touch:** the Darzi compile core (I1/I5/one-page/MMR/Nazar),
the security model (server-verified owner, choke-point guards, server-blind sync), budget honesty
(I8 + daily rations + named skips), the forge pipeline, and the identity/vault architecture
(Pehchaan/Tijori). The ranked work above is loops *around* the sealed core — outcome memory, calendar
awareness, and interview conversion — which is exactly where a compiled-truth product goes after the
compiler is finished.

*Every item above: zero new paid services, existing free lanes only, metered calls budget-capped (I8),
every mutation human-confirmed (Nabz pattern), the résumé compiled from evidence, never written (I1).*
