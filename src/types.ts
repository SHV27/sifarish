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

export type JobSource = 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters' | 'paste'

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
}

export interface WatchlistCompany {
  id: string
  source: Exclude<JobSource, 'paste'>
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

export interface Settings {
  id: 'app'
  onboarded: boolean
  rubric: RubricWeights
  weeklyQuota: number
  /** Applications marked this ISO week (resets by week key). */
  weekKey: string
  appliedThisWeek: number
}
