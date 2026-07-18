// SIFARISH domain model. The Sach Ledger is the single source of truth (CLAUDE.md §2).

export type Tier = 'shipped' | 'in_forge'

export type EntryKind =
  | 'project'
  | 'skill'
  | 'education'
  | 'achievement'
  | 'certification'
  | 'position'

export interface Bullet {
  id: string
  text: string
  /** Named numbers inside the bullet, kept separately so the fact-drift guard can assert them. */
  metrics?: string
  keywords: string[]
}

export interface Evidence {
  url?: string
  repo?: string
  date: string // MM/YYYY or YYYY-MM-DD
  note: string
}

/**
 * PROJECT CONTEXT (Session 5.4) — the deep-read README kept as SOURCE MATERIAL, not as output.
 *
 * The disease this cures: Nabz used to paste raw README list-items straight in as resume bullets,
 * so `- App: https://…` and sentences sliced mid-word landed on the resume. Bullets are now FORGED
 * from this context (guarded, evidence-true), and the Darzi reasons over the whole context when it
 * decides how to FRAME the project for a given JD. Rich context in → precise framing out.
 *
 * Nothing in here ever renders directly on a resume; it is what the tailor reads before writing.
 */
export interface ProjectContext {
  /** What problem the project attacks, in his own README words. */
  problem?: string
  /** How it works / what's notable — the substantive feature statements, cleaned. */
  features: string[]
  /** Human-readable tech stack ("React · TypeScript · Groq"). */
  stack: string[]
  /** Cleaned README prose (capped) — the tailor's full reading material. */
  readme: string
  /** Where the context came from + when, so staleness is visible (I7 spirit). */
  source: { repo: string; readAt: string }
}

export interface LedgerEntry {
  id: string
  kind: EntryKind
  title: string
  /** Shaurya-voice, human-edited. */
  summary: string
  bullets: Bullet[]
  tier: Tier
  /** Required when tier === 'shipped' (Referee-enforced). */
  evidence?: Evidence
  /** Required when tier === 'in_forge' (Referee-enforced). */
  forgeEta?: string
  /**
   * Deep-read source material (Session 5.4). Present on Nabz-drafted projects; the tailor reads
   * it to frame the project per-JD. Never rendered verbatim — bullets are forged from it.
   */
  context?: ProjectContext
  tags: string[]
  /** Shaurya's call: some real skills are not interview-safe; they never enter any export. */
  resumeEligible: boolean
  /**
   * Session 7 typesetter: optional skill-group override ('AI & ML' | 'Languages' |
   * 'Frameworks & Tools'). Absent → the deterministic lexicon categorizer decides.
   * His hand-set value always wins (D59).
   */
  category?: string
  /**
   * Session 6.1 — the forge craft version that last wrote this entry's bullets via the REAL
   * reasoning pass. Absent/older than FORGE_VERSION on a repo-backed project → the vault-repair
   * banner offers a one-click re-forge (his data, his click — D59).
   */
  forgeVersion?: number
}

export interface Identity {
  id: 'me'
  name: string
  email: string
  phone: string
  github: string
  linkedin: string
  location: string
  headline: string
}

export interface VoiceBank {
  id: 'voice'
  /** Real sentences Shaurya wrote — the anti-slop register reference. */
  samples: string[]
}

// ---------- Radar ----------

export type JobSource =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'smartrecruiters'
  | 'paste'
  | 'jsearch'
  | 'hackernews'
  | 'remotive'
  | 'remoteok'
  | 'arbeitnow'
  | 'jobicy'
  | 'adzuna'
  | 'workingnomads'
  | 'weworkremotely'
  | 'simplify'

export type JobStatus =
  | 'found'
  | 'tailored'
  | 'applied'
  | 'followup'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'ghosted'

export interface ScorePart {
  key: string
  label: string
  points: number
  max: number
  why: string
}

export interface ScoreBreakdown {
  total: number
  parts: ScorePart[]
}

export interface Job {
  id: string
  source: JobSource
  externalId?: string
  company: string
  title: string
  location: string
  /** Official apply URL — where every packet ends (I3). */
  url: string
  /** Plain-text job description. */
  jd: string
  updatedAt?: string
  fetchedAt: string
  score?: ScoreBreakdown
  status: JobStatus
  appliedAt?: string
  packetId?: string
  /** Dead-link probe result. */
  linkAlive?: boolean
  /**
   * Session 5.10 — the posting's own board no longer lists it (closed/filled). A closed posting
   * is pulled OUT of the ranked queue entirely (not deprioritized); it reopens if the board
   * relists it. Pipeline statuses are his record and are never closed by a scan.
   */
  closed?: boolean
  notes?: string
  /** Fuzzy company+title+location key for cross-source dedupe (Khabri). */
  dedupeKey?: string
  /** Dak Khana (v4): a mail reply from this company was detected — follow-up nudges auto-clear. */
  replyDetectedAt?: string
  /** Which publisher surfaced it (e.g. "LinkedIn", "Indeed") — for the source badge. */
  publisher?: string
  /** True until the user has seen it in the queue — drives the NEW stamp. */
  isNew?: boolean
  /**
   * Session 6 (P5) — "not for me": owner-dismissed from the ranked queue. Sticky (a re-sweep
   * updates the record but never clears this), reversible only by him. Distinct from `closed`
   * (the board's verdict) — this one is HIS verdict.
   */
  dismissed?: boolean
  /** Salary text when the source provides it. */
  salary?: string
  /**
   * Session 6 — the last board scan that saw this posting still listed (from D122's openIds).
   * Proof of life: a verified-open posting gets its staleness deduction softened, whatever its
   * posted date says. Board sources only; aggregator jobs have no board to verify against.
   */
  lastSeenOpenAt?: string
}

export type AtsSource = 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters'

export interface WatchlistCompany {
  id: string
  source: AtsSource
  company: string
  /** Board token / site slug for the ATS feed. */
  token: string
  starred: boolean
  enabled: boolean
  /** Set by the health probe: does the feed currently return jobs? */
  lastJobCount?: number
  lastChecked?: string
}

export interface RubricWeights {
  aiRelevance: number // /30
  roleFit: number // /25
  remoteIndia: number // /15
  windowFit: number // /15
  compSignal: number // /10
  conviction: number // /5
}

// ---------- Darzi ----------

export type LineKind =
  | 'contact'
  | 'summary'
  | 'heading'
  | 'entry-title'
  | 'meta'
  | 'bullet'
  | 'skills'
  | 'forge'

export interface CompiledLine {
  text: string
  /**
   * I1 — every content line carries its evidence links. Structural: a bullet line
   * with an empty ledgerIds array is a compile ERROR, and renderers refuse it.
   */
  ledgerIds: string[]
  kind: LineKind
  /**
   * Session 7 typesetter: optional right-aligned segment (dates on title lines — the
   * selected-résumé canon). Renderers draw `text` left and `right` at the right margin,
   * in that order, so extracted text = text + right and I5 parse-back holds by construction.
   */
  right?: string
}

export interface CompiledResume {
  lines: CompiledLine[]
  /** Which JD this was compiled against. */
  jobId: string
}

export interface CompiledDoc {
  /** Paragraphs; each carries the ledger entries backing its claims (I1) and an optional
   *  external source URL when the sentence references a cited company fact (I7). */
  paragraphs: { text: string; ledgerIds: string[]; citationUrl?: string }[]
}

export interface KeywordHit {
  keyword: string
  mustHave: boolean
  ledgerIds: string[]
}

export interface CoverageReport {
  /** JD keywords covered by shipped evidence that made the resume. */
  matched: KeywordHit[]
  /** JD keywords whose only evidence is in_forge — rendered ONLY in the Currently Building line (I2). */
  building: KeywordHit[]
  /** JD keywords with zero ledger evidence — NEVER enter the resume (I1); they feed the Gap Note. */
  missing: KeywordHit[]
}

export interface JDDecode {
  mustHave: string[]
  niceToHave: string[]
  seniority: string
  locationHints: string[]
  compHints: string[]
  /**
   * Per-must-have PROMINENCE weight (Session 5.5). A requirement the JD repeats or leads with
   * matters more than one mentioned once — this weights bullet/project selection toward the JD's
   * dominant asks. Optional + defaults to 2 when absent, so every existing caller is unchanged.
   */
  mustHaveWeights?: Record<string, number>
}

/** The four-pass editorial plan (Darzi v3). Every pass stores its rationale (I10). */
export interface CastChoice {
  ledgerId: string
  title: string
  angleId: string
  angleLabel: string
  angleRationale: Rationale
}
export interface EditorialPlan {
  archetype: { id: string; label: string; priorities: string[]; confidence: number; by: 'dimaag' | 'heuristic'; reviewerNote: string }
  casting: Rationale
  chosen: CastChoice[]
  benched: { ledgerId: string; title: string; why: string }[]
  redTeam: Critique
  redTeamRounds: number
  /** True if the user has manually overruled any casting decision. */
  overruled?: boolean
  /** Ustaad archetype guide's section order (P13) — kept so overrules/edits recompile identically. */
  sectionOrder?: ('education' | 'skills' | 'projects' | 'forge' | 'achievements' | 'certs')[]
}

export interface Packet {
  id: string
  jobId: string
  createdAt: string
  resume: CompiledResume
  coverLetter: CompiledDoc
  outreach: CompiledDoc
  coverage: CoverageReport
  gapNote: string[]
  decode: JDDecode
  /** True when the optional Groq polish pass was applied (and survived the fact-drift guard). */
  polished: boolean
  /** Cited company research (Darzi v2). Changes emphasis + the cover-letter hook, never a claim. */
  intel?: CompanyIntel
  /** The Editor's Desk reasoning (Darzi v3). Absent for v1/v2-style compiles. */
  editorial?: EditorialPlan
  /**
   * Baithak suppressions (Session 5.4) — ledger ids he told the tailor to drop for THIS role.
   * Packet-scoped, never a ledger edit: his truth is untouched and other packets are unaffected.
   */
  excludedIds?: string[]
  /**
   * Baithak rephrasings (Session 5.4) — bulletId → re-expressed text that PASSED the fact-drift
   * guard against the original. Packet-scoped for the same reason. Facts frozen; wording aimed.
   */
  bulletOverrides?: Record<string, string>
  /** Whether the packet passed the red-team gate — required for "ready". */
  ready?: boolean
  /** Atelier (v3): the Sifarish Signature decision + whether it's currently on. */
  signature?: { on: boolean; rationale: Rationale }
  /** True on the instant deterministic packet while the Dimaag layer refines in the background. */
  enhancing?: boolean
  /** Compile Quality (P13): honest rubric estimate with itemized remainders. Never a guarantee (I9). */
  quality?: CompileQuality
  /** Baithak decisions trail (P14): every applied conversational edit, logged. */
  baithakLog?: BaithakLogEntry[]
  /** Professional summary on the resume (default on) — evidence-linked, Baithak-toggleable. */
  summaryOn?: boolean
}

// ---------- Tijori (persistence vault — Session 5) ----------

/** An AES-256-GCM encrypted snapshot of the owner's data, in a table separate from the data
 *  itself so it survives even if the main store is corrupted. Newest N are kept. */
export interface BackupSnapshot {
  id: string // ISO timestamp
  at: string
  saltB64: string
  ivB64: string
  cipherB64: string
  /** Sanity display without decrypting: how many ledger entries the snapshot holds. */
  ledgerCount: number
}

// ---------- Dak Khana (P15, I3 — read-only mail vigilance; sending is structurally impossible) ----------

export interface DakCard {
  id: string // gmail message id
  jobId?: string
  company: string
  subject: string
  from: string
  date: string
  snippet: string
  /** Deep link into Gmail — reading and replying happen THERE, never here (I3). */
  gmailUrl: string
  /** Heuristic stage suggestion — the owner confirms (Nabz pattern), never auto-applied. */
  stageSuggestion?: 'interview' | 'rejected'
  /** DakCard status — 'acked' (Session 5.8) = "I know this one" — seen and handled outside the app; hidden from
   *  the active list forever (the message-id dedupe in sweepMail keeps it from resurfacing). */
  status: 'pending' | 'confirmed' | 'dismissed' | 'acked'
  fetchedAt: string
}

// ---------- Baithak (P14, I11 — conversation cannot bypass the compiler) ----------

export type EditOp =
  | { kind: 'attach-link'; ledgerId: string; url: string }
  | { kind: 'promote-project'; ledgerId: string }
  | { kind: 'bench-project'; ledgerId: string }
  /** Bullet must already exist in the ledger — conversation can pick and order, never mint (I11). */
  | { kind: 'lead-bullet'; ledgerId: string; bulletId: string }
  | { kind: 'set-section-order'; sectionOrder: ('education' | 'skills' | 'projects' | 'forge' | 'achievements' | 'certs')[] }
  /** Runs the existing fact-drift-guarded polish pass — phrasing only, facts frozen (I1). */
  | { kind: 'polish-tone' }
  /** Professional summary on/off — recompiled from real ledger evidence (I1). */
  | { kind: 'set-summary'; on: boolean }
  /**
   * "ye skill hata" / "ye wali daal" — drop or restore a ledger entry for THIS packet only.
   * Suppression is packet-scoped: the ledger (his truth) is never edited, and the same entry
   * still renders for other roles. Hiding a true thing is honest tailoring — a resume is a
   * selection of the truth aimed at one reader, not the whole truth every time.
   */
  | { kind: 'set-entry'; ledgerId: string; on: boolean }
  /**
   * "GLOAMING ko aise explain kar" — re-express a project's bullets in a stated direction.
   * The fact-drift guard freezes every number, technology and proper noun (I1): the wording
   * changes, the facts cannot. A rephrasing that smuggles a new fact is discarded, not shown.
   */
  | { kind: 'reframe-project'; ledgerId: string; direction: string }
  /**
   * "poora resume agentic angle se frame kar" — reframe EVERY currently-leading project toward
   * one stated direction (Session 5.9). Same drift guard per project as reframe-project; a
   * whole-résumé ask should not require him to name each project one by one.
   */
  | { kind: 'rewrite-angle'; direction: string }

export interface ProposedEdit {
  id: string
  op: EditOp
  /** Diff card copy: what the packet says now vs after. */
  before: string
  after: string
  /** Which invariants this op touches (rendered on the card). */
  invariants: string[]
}

export interface BaithakParse {
  reply: string
  proposals: ProposedEdit[]
  /** Set when the utterance asked for an unevidenced claim — the refusal is the feature. */
  refused?: { term: string; gapNote: string }
  citations?: { title: string; url: string }[]
  by: 'deterministic' | 'dimaag'
  /** False when no specific intent matched → the smart LLM layer may take over (owner + keyed). */
  handled?: boolean
}

export interface BaithakLogEntry {
  at: string
  utterance: string
  summary: string
}

// ---------- Ustaad (P13, I13 — the library is data) ----------

export interface UstaadRow {
  id: 'library'
  json: string
  version: string
  updatedAt: string
}

/** Honest rubric-based estimate — never an "ATS score guarantee" (I9). Every missing
 *  point is itemized as either an evidence gap (→ Gap Note) or a deliberate choice. */
export interface QualityItem {
  label: string
  points: number
  max: number
  why: string
  kind: 'ok' | 'gap' | 'choice'
  /** Ustaad pattern this check derives from — the receipt. */
  patternId?: string
}

export interface CompileQuality {
  score: number // 0..100
  items: QualityItem[]
  at: string
}

// ---------- Nabz ----------


export type SuggestionType = 'new_entry' | 'promotion' | 'bullet_update' | 'attach_link'

export interface NabzSuggestion {
  id: string
  type: SuggestionType
  repoName: string
  repoUrl: string
  /** Human-readable reason: what changed on GitHub to justify this. */
  why: string
  /** For new_entry: a draft LedgerEntry. For promotion: the target ledger id. */
  draftEntry?: LedgerEntry
  targetLedgerId?: string
  status: 'pending' | 'accepted' | 'dismissed'
  createdAt: string
}

export interface NabzCacheRow {
  key: string
  json: string
  fetchedAt: string
}

// ---------- Dimaag (reasoning core, I10) ----------

/**
 * I10 — every consequential decision carries a stored, inspectable rationale.
 * A decision without one is a bug. Rationales are honest about uncertainty.
 */
export interface Rationale {
  question: string
  optionsConsidered: string[]
  criteria: string[]
  choice: string
  ranking?: string[]
  why: string
  confidence: number // 0..1 — honest about uncertainty
  citations?: { title: string; url: string }[]
  /** Ledger entry ids the reasoning leaned on. */
  evidenceRefs?: string[]
  /** Whether an LLM reasoned this or the deterministic heuristic did (keyless). */
  by: 'dimaag' | 'heuristic'
  at: string
}

export interface Critique {
  verdict: 'PASS' | 'REVISE'
  /** Top fixes, most important first. */
  fixes: string[]
  smell?: string
  by: 'dimaag' | 'heuristic'
  at: string
}

export type DimaagTier = 'reasoning' | 'classify'

export interface DimaagCacheRow {
  hash: string
  json: string
  at: string
}

/** Per-feature usage this month — the Dimaag Ledger (zero-wastage discipline, I8). */
export interface DimaagUsageRow {
  id: string // `${feature}:${monthKey}`
  feature: string
  monthKey: string
  calls: number // real LLM calls (spent budget)
  tokens: number
  cacheHits: number // identical input served from cache (0 cost)
  fallbacks: number // deterministic heuristic used (keyless / over-budget; 0 cost)
}

// ---------- Settings ----------

export interface VisionProfile {
  /** Shaurya's dream statement — feeds the Guru's system prompt so it knows him. */
  dream: string
  targetRoles: string[]
  notInterested: string[]
  compFloorStipend: number // ₹/month
  ppoFloorLpa: number // ≥16 LPA
  windowStart: string // 'Jan 2027'
  windowEnd: string // 'May 2027'
  remoteInternational: boolean
  openToOctoberStart: boolean
  /**
   * Session 6 — companies he specifically wants (from his own feed: Netomi, Weekday, Wingify…).
   * deriveHunts turns each into a per-company aggregator hunt — the lawful door to companies on
   * Workday/custom ATSes with no public feed (D122): their postings ARE on LinkedIn/Indeed, and
   * JSearch reaches those via Google-for-Jobs.
   */
  dreamCompanies?: string[]
}

export interface RubricChange {
  at: string
  summary: string
  source?: string
}

export interface Settings {
  id: 'app'
  onboarded: boolean
  rubric: RubricWeights
  weeklyQuota: number
  /** Applications marked this ISO week (resets by week key). */
  weekKey: string
  appliedThisWeek: number
  visionProfile?: VisionProfile
  rubricChangelog?: RubricChange[]
  lastSweepAt?: string
  lastPulseAt?: string
  /** Session 6.1 — set when the vault repair re-forges the ledger; packets older than this
   *  auto re-tailor on open, so a stored packet can never keep serving pre-repair bullets. */
  lastReforgeAt?: string
}

// ---------- Khabri (discovery + signals) ----------

export type DiscoverySource = 'jsearch' | 'hackernews' | 'remotive' | 'remoteok' | 'arbeitnow' | 'jobicy' | 'adzuna' | 'workingnomads' | 'weworkremotely'
export type SignalSource = 'tavily'

export interface SavedHunt {
  id: string
  query: string
  country?: string
  remoteOnly: boolean
  datePosted?: 'all' | 'today' | '3days' | 'week' | 'month'
  /**
   * True once HE picks the window himself — the freshness migration (D66) then leaves it alone.
   * His deliberate choice outranks our default, always.
   */
  ownerSetDate?: boolean
  enabled: boolean
  /**
   * True when this hunt was auto-derived from his Vision Profile (Session 5.6). The sweep hunts
   * derived queries FIRST (his vision gets budget priority), and the sync only ever ADDS them —
   * a hunt he created or toggled by hand is never touched.
   */
  derived?: boolean
  /**
   * Session 6 (P7 lane depth) — optional JSearch employment-type filter for THIS hunt
   * (comma-sep of FULLTIME, CONTRACTOR, PARTTIME, INTERN). Unset = all types (never narrows
   * by default; his vision spans internships AND roles).
   */
  employmentTypes?: string
}

/** A hiring signal — news/announcement, not a posting. Every one carries a source URL (I7). */
export interface Signal {
  id: string
  source: SignalSource
  headline: string
  url: string
  publishedAt?: string
  whyItMatters: string
  company?: string
  seen: boolean
  fetchedAt: string
}

export interface SweepYield {
  found: number
  new: number
  duplicate: number
  bySource: Record<string, number>
  creditsSpent: number
  keylessLanes: string[]
  keyedLanes: string[]
  failed: string[]
}

// ---------- Intel (Darzi v2) ----------

export interface IntelBullet {
  text: string
  url: string
}

export interface CompanyIntel {
  company: string
  bullets: IntelBullet[] // cited (I7)
  fetchedAt: string
  keyless: boolean
}

// ---------- Budgets (I8) ----------

export interface Budget {
  id: string // 'tavily' | 'jsearch' | 'groq'
  label: string
  monthKey: string // 'YYYY-MM'
  used: number
  monthlyCap: number
  perRunCap: number
  unit: string // 'credits' | 'requests' | 'calls'
}

// ---------- Pulse ----------

export interface PulseBrief {
  id: string
  at: string
  topic: string
  headline: string
  url: string
  insight: string
  /** Suggested rubric/keyword change; human confirms (Nabz pattern). */
  suggestion?: string
  /**
   * A hunt the market pulse implies (D89) — when an emerging skill/role trends, the Pulse proposes
   * a radar hunt for it. Accepting the brief adds it to savedHunts (human-confirmed). This is the
   * self-evolving discovery loop: Khabri sees the trend → the Radar starts hunting those roles.
   */
  proposedHunt?: { query: string; why: string }
  /**
   * Session 5.10 (closes D68 fully): when the VISION changes, derived hunts it no longer implies
   * are proposed for RETIREMENT — human-confirmed (accept disables the hunt; it is never deleted,
   * and a hunt he set or touched by hand is never proposed — D59/D88).
   */
  proposedHuntRemoval?: { huntId: string; query: string; why: string }
  /**
   * Session 6 — THE WATCHLIST GROWS ITSELF (lawfully). When an aggregator job's apply URL
   * resolves to a public ATS board (greenhouse/lever/ashby/smartrecruiters) not yet on the
   * watchlist, the token is proposed here; accepting adds the board — from then on that company's
   * EVERY posting arrives board-verified, not just what the aggregators happen to index.
   */
  proposedBoard?: { source: AtsSource; token: string; company: string; why: string }
  status: 'pending' | 'accepted' | 'dismissed'
}

// ---------- Guru ----------

export interface GuruMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  /** Citations attached to an assistant message (I7). */
  citations?: { title: string; url: string }[]
  toolName?: string
}

export interface GuruThread {
  id: string
  title: string
  messages: GuruMessage[]
  createdAt: string
  updatedAt: string
}

export interface ApplyStep {
  n: number
  action: string
  detail: string
  /** e.g. attach file, paste text — always Shaurya-performed (I3). */
  artifact?: 'resume-pdf' | 'resume-docx' | 'cover-letter' | 'outreach' | 'none'
}

export interface ApplyPlan {
  jobId: string
  steps: ApplyStep[]
  screeningAnswers: { q: string; a: string; ledgerIds: string[] }[]
  generatedBy: 'guru' | 'template'
}
