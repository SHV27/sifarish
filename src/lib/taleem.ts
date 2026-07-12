import type { Job, LedgerEntry, VisionProfile } from '../types'
import { decodeJD } from './jd/decode'
import { LEXICON } from './jd/lexicon'

/**
 * TALEEM RADAR (U5) — skill-gap vigilance: "meri skills aur market demand mein gap na aaye."
 * Aggregates keyword demand across every JD the app has seen (rolling 90 days), compares it
 * against the ledger, and ranks the gaps by demand × vision-fit. Suggestions only — the owner
 * decides, the ledger stays truthful (an accepted gap becomes an in_forge entry with an ETA,
 * which is honest by definition: I2).
 *
 * Every suggestion carries its receipts (I7): the jobs that demanded it are the citations.
 */

export interface TaleemGap {
  keyword: string
  /** How many recent JDs asked for it. */
  demand: number
  /** 0..1 — how close it sits to the stated vision (agentic/LLM > ml > infra > generic). */
  visionFit: number
  score: number
  rationale: string
  /** The demanding jobs — each is a source URL (I7). */
  citations: { title: string; url: string }[]
  /** Already in the forge? Then it's tracked, not missing. */
  inForge: boolean
  firstResource?: { title: string; url: string }
}

/** Curated first-step resources for common gaps (official docs — stable URLs). */
const FIRST_RESOURCES: Record<string, { title: string; url: string }> = {
  'fine-tuning': { title: 'Hugging Face — LLM fine-tuning course', url: 'https://huggingface.co/learn/llm-course' },
  lora: { title: 'Hugging Face PEFT docs', url: 'https://huggingface.co/docs/peft' },
  transformers: { title: 'Hugging Face Transformers course', url: 'https://huggingface.co/learn/llm-course' },
  langgraph: { title: 'LangGraph docs', url: 'https://langchain-ai.github.io/langgraph/' },
  langchain: { title: 'LangChain docs', url: 'https://python.langchain.com/docs/' },
  mcp: { title: 'Model Context Protocol docs', url: 'https://modelcontextprotocol.io/' },
  evals: { title: 'OpenAI evals guide', url: 'https://platform.openai.com/docs/guides/evals' },
  pytorch: { title: 'PyTorch tutorials', url: 'https://pytorch.org/tutorials/' },
  docker: { title: 'Docker getting started', url: 'https://docs.docker.com/get-started/' },
  kubernetes: { title: 'Kubernetes basics', url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/' },
  sql: { title: 'PostgreSQL tutorial', url: 'https://www.postgresql.org/docs/current/tutorial.html' },
  aws: { title: 'AWS skill builder', url: 'https://skillbuilder.aws/' },
  embeddings: { title: 'Hugging Face — sentence embeddings', url: 'https://huggingface.co/docs/transformers/tasks/sequence_classification' },
  'computer-vision': { title: 'PyTorch vision tutorials', url: 'https://pytorch.org/vision/stable/index.html' },
  speech: { title: 'Whisper repo + docs', url: 'https://github.com/openai/whisper' },
  inference: { title: 'vLLM docs', url: 'https://docs.vllm.ai/' },
}

function visionFitOf(keyword: string, vision?: VisionProfile): number {
  const lex = LEXICON.find((l) => l.canonical === keyword)
  const base = lex?.aiClass === 'agentic' ? 1 : lex?.aiClass === 'llm' ? 0.9 : lex?.aiClass === 'ml' ? 0.6 : lex?.aiClass === 'infra' ? 0.5 : 0.3
  if (!vision) return base
  const targets = vision.targetRoles.join(' ').toLowerCase()
  const bump = (keyword === 'agents' && /agentic/.test(targets)) || (keyword === 'llm' && /llm/.test(targets)) ? 0.1 : 0
  return Math.min(1, base + bump)
}

/** Does the ledger hold SHIPPED evidence for this keyword? (in_forge counts separately.) */
function ledgerState(keyword: string, ledger: LedgerEntry[]): 'shipped' | 'in_forge' | 'none' {
  const k = keyword.toLowerCase()
  const holds = (e: LedgerEntry) =>
    e.tags.includes(k) ||
    e.bullets.some((b) => b.keywords.includes(k)) ||
    e.title.toLowerCase().replace(/-/g, ' ').includes(k.replace(/-/g, ' '))
  const shipped = ledger.some((e) => e.resumeEligible && e.tier === 'shipped' && holds(e))
  if (shipped) return 'shipped'
  const forge = ledger.some((e) => e.resumeEligible && e.tier === 'in_forge' && holds(e))
  return forge ? 'in_forge' : 'none'
}

/** Pure ranking core (fixture-tested). Recent = fetched within `windowDays`. */
export function rankGaps(jobs: Job[], ledger: LedgerEntry[], vision?: VisionProfile, windowDays = 90, now = new Date()): TaleemGap[] {
  const cutoff = now.getTime() - windowDays * 86400000
  const recent = jobs.filter((j) => new Date(j.fetchedAt).getTime() >= cutoff && j.jd.length > 40)

  const demand = new Map<string, Job[]>()
  for (const job of recent) {
    const d = decodeJD(job.jd)
    for (const kw of new Set([...d.mustHave, ...d.niceToHave])) {
      demand.set(kw, [...(demand.get(kw) ?? []), job])
    }
  }

  const gaps: TaleemGap[] = []
  for (const [keyword, demandingJobs] of demand) {
    const state = ledgerState(keyword, ledger)
    if (state === 'shipped') continue // no gap — the ledger already proves it
    const fit = visionFitOf(keyword, vision)
    const score = demandingJobs.length * fit
    gaps.push({
      keyword,
      demand: demandingJobs.length,
      visionFit: fit,
      score,
      rationale:
        `${demandingJobs.length} recent JD(s) ask for "${keyword}" and your ledger has ${state === 'in_forge' ? 'only an in-forge entry' : 'no evidence'} for it. ` +
        `Vision fit ${(fit * 10).toFixed(0)}/10 — ${fit >= 0.9 ? 'core to the agentic-AI lane you chose' : fit >= 0.6 ? 'adjacent to your lane' : 'peripheral; learn only if a target role demands it'}.`,
      citations: demandingJobs.slice(0, 3).map((j) => ({ title: `${j.company} — ${j.title}`, url: j.url })),
      inForge: state === 'in_forge',
      firstResource: FIRST_RESOURCES[keyword],
    })
  }
  return gaps.sort((a, b) => b.score - a.score)
}

/** One-tap: track a gap as an honest in-forge ledger entry (owner-gated by Darbaan). */
export function draftForgeEntry(gap: TaleemGap, eta: string): LedgerEntry {
  return {
    id: `skill-${gap.keyword.replace(/[^a-z0-9]/g, '-')}`,
    kind: 'skill',
    title: gap.keyword
      .split('-')
      .map((w) => w[0]?.toUpperCase() + w.slice(1))
      .join(' '),
    summary: `Learning — driven by market demand (${gap.demand} recent JDs).`,
    bullets: [],
    tier: 'in_forge',
    forgeEta: eta,
    tags: [gap.keyword],
    resumeEligible: true,
  }
}
