/**
 * The Archetype Library (Darzi v3, Archetype Pass). Encodes what a specific kind of reviewer
 * scans for first in a six-second skim — so casting and surgery optimize the true evidence for
 * THIS reader. Researched from the 2026 AI-hiring market (RESEARCH.md §1–2: skills-over-degrees
 * screening, embedding-similarity ATS ranking, the six-second recruiter skim).
 *
 * These change EMPHASIS and ORDERING only. They never change facts (I1 is eternal).
 */

export interface Archetype {
  id: string
  label: string
  /** What this reviewer's eyes hit first, in order — drives bullet ordering + casting weight. */
  priorities: string[]
  /** Tag/keyword cues that mark a project as strong for this archetype. */
  cues: string[]
  /** The angle language this reader rewards. */
  angleHint: string
  /** One-line note on the reviewer, for the Casting Sheet. */
  reviewerNote: string
}

export const ARCHETYPES: Archetype[] = [
  {
    id: 'applied-ai',
    label: 'Applied AI / AI Engineer Intern',
    priorities: ['shipped LLM or agent product', 'end-to-end delivery', 'evals & guardrails', 'real users / impact'],
    cues: ['llm', 'agentic', 'agents', 'rag', 'groq', 'guardrails', 'evals', 'shipped', 'deployment', 'voice', 'whisper'],
    angleHint: 'Frame as a shipped LLM/agent system with real users and honest evaluation.',
    reviewerNote: 'Wants proof you can take an LLM idea to a working, evaluated product — not just notebooks.',
  },
  {
    id: 'agent-eng',
    label: 'Agent / Agentic Systems Engineer',
    priorities: ['multi-step agents & tool use', 'orchestration (LangGraph/MCP)', 'reliability & guardrails', 'LLM depth'],
    cues: ['agentic', 'agents', 'orchestration', 'langgraph', 'mcp', 'tool-use', 'multi-agent', 'guardrails', 'llm'],
    angleHint: 'Frame projects as agent architectures: planning, tool use, deterministic guardrails.',
    reviewerNote: 'Scans for agent loops, tool orchestration, and how you keep an agent from going off the rails.',
  },
  {
    id: 'research-intern',
    label: 'ML Research Intern',
    priorities: ['ML depth & rigor', 'novel method / experiment', 'math foundations', 'reproducible evaluation'],
    cues: ['transformers', 'pytorch', 'deep-learning', 'fine-tuning', 'lora', 'evals', 'statistics', 'linear-algebra', 'nlp', 'computer-vision'],
    angleHint: 'Frame as method + rigorous evaluation; foreground the modeling and the measurement.',
    reviewerNote: 'Wants depth and rigor: a real method, a real eval, honesty about what worked.',
  },
  {
    id: 'forward-deployed',
    label: 'Forward-Deployed / AI Solutions Engineer',
    priorities: ['shipped end-to-end products', 'breadth across the stack', 'real-world / civic impact', 'communication'],
    cues: ['shipped', 'deployment', 'civic-tech', 'voice', 'accessibility', 'api-integration', 'typescript', 'serverless', 'multilingual'],
    angleHint: 'Frame as customer/field-facing systems delivered end to end for real people.',
    reviewerNote: 'Wants someone who ships to real users and can talk to them — breadth over narrow depth.',
  },
  {
    id: 'ml-generalist',
    label: 'ML / Data Science Intern',
    priorities: ['Python & data fluency', 'ML fundamentals', 'a clean analysis or model', 'stats intuition'],
    cues: ['python', 'ml', 'data-science', 'data-pipeline', 'statistics', 'nlp', 'evals', 'pytorch'],
    angleHint: 'Frame as data → model → measured result, cleanly.',
    reviewerNote: 'Wants solid Python + data instincts and one clean, honest modeling story.',
  },
  {
    id: 'platform-infra',
    label: 'ML Platform / Inference Infra',
    priorities: ['deployment & serving', 'systems thinking', 'reliability', 'cost/latency awareness'],
    cues: ['deployment', 'mlops', 'inference', 'serverless', 'system-design', 'docker', 'huggingface', 'local-llm'],
    angleHint: 'Frame as systems: how it is served, made reliable, and kept cheap/fast.',
    reviewerNote: 'Wants systems maturity: serving, reliability, latency and cost — not just model accuracy.',
  },
]

export const ARCHETYPE_LABELS = ARCHETYPES.map((a) => ({ id: a.id, label: a.label, cues: a.cues }))

export function archetypeById(id: string): Archetype {
  return ARCHETYPES.find((a) => a.id === id) ?? ARCHETYPES[0]
}
