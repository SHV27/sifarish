import type { RubricWeights } from '../../types'

/**
 * Scoring rubric weights (CLAUDE.md vision §P3). Visible and editable in Settings;
 * every score expands to show its WHY (Law 4 — causal legibility).
 */
export const DEFAULT_RUBRIC: RubricWeights = {
  aiRelevance: 30, // AI-first/agentic relevance: agents, LLM, RAG, fine-tuning, Claude/GPT tooling
  roleFit: 25, // role fit vs ledger coverage
  remoteIndia: 15, // remote / India-eligible
  windowFit: 15, // internship-window fit (Jan–May 2027, or flexible/rolling)
  compSignal: 10, // stipend ≥₹30–40k, or PPO/full-time-conversion language; currency-aware
  conviction: 5, // company conviction (watchlist starred)
}

export const RUBRIC_LABELS: Record<keyof RubricWeights, string> = {
  aiRelevance: 'AI-first / agentic relevance',
  roleFit: 'Role fit vs ledger',
  remoteIndia: 'Remote / India-eligible',
  windowFit: 'Jan–May 2027 window fit',
  compSignal: 'Compensation signal',
  conviction: 'Company conviction',
}
