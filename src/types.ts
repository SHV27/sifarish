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
  tags: string[]
  /** Shaurya's call: some real skills are not interview-safe; they never enter any export. */
  resumeEligible: boolean
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
  notes?: string
  /** Fuzzy company+title+location key for cross-source dedupe (Khabri). */
  dedupeKey?: string
  /** Which publisher surfaced it (e.g. "LinkedIn", "Indeed") — for the source badge. */
  publisher?: string
  /** True until the user has seen it in the queue — drives the NEW stamp. */
  isNew?: boolean
  /** Salary text when the source provides it. */
  salary?: string
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
}

export interface CompiledResume {
  lines: CompiledLine[]
  /** Which JD this was compiled against. */
  jobId: string
}

export interface CompiledDoc {
  /** Paragraphs; each carries the ledger entries backing its claims. */
  paragraphs: { text: string; ledgerIds: string[] }[]
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
}

// ---------- Nabz ----------

export type SuggestionType = 'new_entry' | 'promotion' | 'bullet_update'

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
}

// ---------- Khabri (discovery + signals) ----------

export type DiscoverySource = 'jsearch' | 'hackernews' | 'remotive' | 'remoteok'
export type SignalSource = 'tavily'

export interface SavedHunt {
  id: string
  query: string
  country?: string
  remoteOnly: boolean
  datePosted?: 'all' | 'today' | '3days' | 'week' | 'month'
  enabled: boolean
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
