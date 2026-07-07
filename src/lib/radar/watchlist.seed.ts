import type { WatchlistCompany } from '../../types'

/**
 * Curated, editable watchlist — every token PROBED LIVE on 07-Jul-2026 and confirmed
 * to return jobs from its keyless public feed. Dead boards were dropped at probe time
 * (Groq, W&B, Pinecone, Hugging Face, Runway, Krutrim, Fractal and others 404'd or
 * returned empty — see RESEARCH.md §F8 on silent ATS migration).
 */
const seed: Array<[WatchlistCompany['source'], string, string, boolean]> = [
  // source, company, token, starred
  ['greenhouse', 'Anthropic', 'anthropic', true],
  ['ashby', 'OpenAI', 'openai', true],
  ['greenhouse', 'xAI', 'xai', false],
  ['lever', 'Mistral AI', 'mistral', true],
  ['ashby', 'Cohere', 'cohere', false],
  ['greenhouse', 'Scale AI', 'scaleai', false],
  ['greenhouse', 'Databricks', 'databricks', false],
  ['ashby', 'Perplexity', 'perplexity', true],
  ['ashby', 'ElevenLabs', 'elevenlabs', false],
  ['ashby', 'Replit', 'replit', false],
  ['ashby', 'LangChain', 'langchain', true],
  ['greenhouse', 'SambaNova', 'sambanovasystems', false],
  ['greenhouse', 'Glean', 'gleanwork', false],
  ['greenhouse', 'Vercel', 'vercel', false],
  ['ashby', 'Cursor (Anysphere)', 'cursor', false],
  ['ashby', 'Character.AI', 'character', false],
  ['greenhouse', 'Google DeepMind', 'deepmind', false],
  ['ashby', 'Sierra', 'sierra', false],
  ['ashby', 'Harvey', 'harvey', false],
  ['ashby', 'Decagon', 'decagon', false],
  ['ashby', 'Mercor', 'mercor', false],
  ['greenhouse', 'Turing', 'turing', false],
  ['ashby', 'Sarvam AI', 'sarvam', true],
  ['greenhouse', 'InMobi', 'inmobi', false],
  ['greenhouse', 'Postman', 'postman', false],
  ['ashby', 'Zed Industries', 'zed', false],
  ['ashby', 'Browserbase', 'browserbase', false],
  ['ashby', 'Modal', 'modal', false],
  ['ashby', 'Baseten', 'baseten', false],
]

export const WATCHLIST_SEED: WatchlistCompany[] = seed.map(([source, company, token, starred]) => ({
  id: `${source}:${token}`,
  source,
  company,
  token,
  starred,
  enabled: true,
}))
