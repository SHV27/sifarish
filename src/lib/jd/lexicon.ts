/**
 * Deterministic keyword lexicon for JD decoding. Each canonical keyword lists the
 * surface patterns that count as a mention. Canonical keys are what the evidence
 * matcher joins against (bullet.keywords / entry.tags use the same vocabulary).
 */
export interface LexiconEntry {
  canonical: string
  /** Lowercase substrings (multi-word allowed). Matched against the lowercased JD. */
  patterns: string[]
  /** AI-first/agentic relevance class — feeds the Radar rubric's 30-point bucket. */
  aiClass?: 'agentic' | 'llm' | 'ml' | 'infra'
}

export const LEXICON: LexiconEntry[] = [
  // Agentic
  { canonical: 'agents', patterns: ['agentic', ' agents', 'ai agent', 'multi-agent', 'multi agent'], aiClass: 'agentic' },
  { canonical: 'langgraph', patterns: ['langgraph'], aiClass: 'agentic' },
  { canonical: 'langchain', patterns: ['langchain'], aiClass: 'agentic' },
  { canonical: 'mcp', patterns: ['model context protocol', 'mcp server', ' mcp'], aiClass: 'agentic' },
  { canonical: 'tool-use', patterns: ['tool use', 'tool calling', 'function calling'], aiClass: 'agentic' },
  { canonical: 'orchestration', patterns: ['orchestration', 'crewai', 'autogen'], aiClass: 'agentic' },
  // LLM
  { canonical: 'llm', patterns: ['llm', 'large language model', 'foundation model', 'genai', 'generative ai'], aiClass: 'llm' },
  { canonical: 'claude', patterns: ['claude', 'anthropic api'], aiClass: 'llm' },
  { canonical: 'gpt', patterns: ['gpt-', 'openai api', ' gpt '], aiClass: 'llm' },
  { canonical: 'rag', patterns: ['rag', 'retrieval-augmented', 'retrieval augmented'], aiClass: 'llm' },
  { canonical: 'embeddings', patterns: ['embedding', 'vector database', 'vector search', 'pinecone', 'weaviate'], aiClass: 'llm' },
  { canonical: 'fine-tuning', patterns: ['fine-tun', 'finetun', 'sft', 'rlhf'], aiClass: 'llm' },
  { canonical: 'lora', patterns: ['lora', 'peft', 'qlora'], aiClass: 'llm' },
  { canonical: 'prompt-engineering', patterns: ['prompt engineering', 'prompting', 'prompt design'], aiClass: 'llm' },
  { canonical: 'guardrails', patterns: ['guardrail', 'safety', 'red team', 'alignment'], aiClass: 'llm' },
  { canonical: 'evals', patterns: ['evals', 'evaluation harness', 'llm evaluation', 'benchmarks', 'model evaluation'], aiClass: 'llm' },
  { canonical: 'local-llm', patterns: ['ollama', 'local llm', 'llama.cpp', 'open-weight', 'open weight'], aiClass: 'llm' },
  { canonical: 'inference', patterns: ['inference', 'serving', 'vllm', 'quantiz'], aiClass: 'infra' },
  // ML core
  { canonical: 'transformers', patterns: ['transformer', 'attention'], aiClass: 'ml' },
  { canonical: 'pytorch', patterns: ['pytorch', 'torch'], aiClass: 'ml' },
  { canonical: 'tensorflow', patterns: ['tensorflow', 'keras'], aiClass: 'ml' },
  { canonical: 'ml', patterns: ['machine learning', ' ml ', 'ml engineer', 'ml intern'], aiClass: 'ml' },
  { canonical: 'deep-learning', patterns: ['deep learning', 'neural network'], aiClass: 'ml' },
  { canonical: 'nlp', patterns: ['nlp', 'natural language'], aiClass: 'ml' },
  { canonical: 'computer-vision', patterns: ['computer vision', ' cv ', 'image recognition', 'ocr'], aiClass: 'ml' },
  { canonical: 'speech', patterns: ['speech', 'asr', 'whisper', 'voice ai', 'text-to-speech', 'tts'], aiClass: 'ml' },
  { canonical: 'data-science', patterns: ['data science', 'data scientist', 'predictive analytics'], aiClass: 'ml' },
  { canonical: 'statistics', patterns: ['statistics', 'statistical', 'probability'], aiClass: 'ml' },
  { canonical: 'linear-algebra', patterns: ['linear algebra'], aiClass: 'ml' },
  // Languages & tools
  { canonical: 'python', patterns: ['python'] },
  { canonical: 'typescript', patterns: ['typescript'] },
  { canonical: 'javascript', patterns: ['javascript', 'node.js', 'nodejs'] },
  { canonical: 'react', patterns: ['react'] },
  { canonical: 'sql', patterns: [' sql', 'postgres', 'database'] },
  { canonical: 'git', patterns: [' git', 'github', 'version control'] },
  { canonical: 'docker', patterns: ['docker', 'container'] },
  { canonical: 'kubernetes', patterns: ['kubernetes', 'k8s'] },
  { canonical: 'aws', patterns: [' aws', 'amazon web services'] },
  { canonical: 'gcp', patterns: [' gcp', 'google cloud'] },
  { canonical: 'api-integration', patterns: ['rest api', 'api integration', 'api design', 'openai-compatible'] },
  { canonical: 'huggingface', patterns: ['hugging face', 'huggingface'] , aiClass: 'infra' },
  { canonical: 'groq', patterns: ['groq'], aiClass: 'infra' },
  { canonical: 'mlops', patterns: ['mlops', 'model deployment', 'ci/cd'], aiClass: 'infra' },
  { canonical: 'system-design', patterns: ['system design', 'distributed systems', 'scalab'] },
  { canonical: 'data-pipeline', patterns: ['data pipeline', 'etl', 'data engineering'] },
]

/** Phrases that instantly read as AI slop — zero tolerance in any generated artifact (§7). */
export const SLOP_PHRASES: string[] = [
  // Session 6 (P3): the conversational AI tells recruiters now screen for — mechanically
  // checkable phrases, never single common words (a lone "delve" in prose is a style call;
  // "delve into" as an opener is a tell).
  'delve into',
  'i hope this email finds you well',
  'i hope this finds you well',
  "in today's fast-paced",
  'navigating the ever-evolving',
  'a testament to my',
  'i am excited to express my',
  'results-driven',
  'results driven',
  'passionate about leveraging',
  'dynamic professional',
  'proven track record',
  'spearheaded synergies',
  'leverage synergies',
  'leveraging cutting-edge',
  'cutting-edge solutions',
  'detail-oriented team player',
  'fast-paced environment',
  'thought leader',
  'go-getter',
  'self-starter with a passion',
  'passionate professional',
  'seasoned professional',
  'synergize',
  'utilize my skills',
  'honed my skills',
  'delve into',
  'in today’s rapidly evolving',
  'in today\'s rapidly evolving',
  'i am excited to apply my passion',
  'excited to leverage',
  // Atelier banlist v3 — the phrases every generic cover letter reaches for.
  'i am excited to apply',
  'i am writing to express',
  'i believe i would be a great fit',
  'i would be a great fit',
  'i am a perfect fit',
  'esteemed organization',
  'esteemed company',
  'your esteemed',
  'passionate about technology',
  'passionate about innovation',
  'i am confident that my skills',
  'i am the ideal candidate',
  'wealth of experience',
  'hit the ground running',
  'wear many hats',
  'i am reaching out',
]

/** I9 — guarantee language. Banned in UI copy, Guru replies, and generated documents. */
export const GUARANTEE_PHRASES: string[] = [
  'guaranteed',
  'guarantee you',
  'guarantee a',
  'guarantee the',
  '100% selection',
  '100% placement',
  'assured placement',
  'assured selection',
  'assured job',
  'assured offer',
  'definitely get you',
  "you will definitely get",
  'certain to get hired',
  'promise you a job',
  'promise you an offer',
  'promise you the',
  'sure-shot',
  'sure shot selection',
  'no chance of rejection',
  'cannot be rejected',
]
