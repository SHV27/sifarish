/**
 * Real-shape JD fixtures for the gate suite. Hand-labeled with the expected top-band
 * rubric signals. Kept representative of the AI-first internship market Shaurya targets.
 */
export interface JDFixture {
  company: string
  title: string
  jd: string
  /** Hand label: should this rank as a strong (>=60) fit for Shaurya? */
  strongFit: boolean
  expectMustHave: string[]
}

export const JD_FIXTURES: JDFixture[] = [
  {
    company: 'Anthropic',
    title: 'AI Engineering Intern',
    strongFit: true,
    expectMustHave: ['python', 'llm'],
    jd: `About the role
We're hiring an AI Engineering Intern to build agentic systems on top of large language models.

Requirements
- Strong Python
- Experience with LLM applications, prompt engineering, and RAG
- Familiarity with building AI agents and tool use
- Comfortable with evals and guardrails

Nice to have
- Fine-tuning / LoRA experience
- TypeScript

This is a paid internship. Remote-friendly. PPO available for strong performers.`,
  },
  {
    company: 'Sarvam AI',
    title: 'ML Intern — Speech',
    strongFit: true,
    expectMustHave: ['python', 'speech'],
    jd: `We are building foundational AI for India.

What you'll need
- Python and PyTorch
- Speech recognition (ASR) and audio ML
- Transformers internals
- Machine learning fundamentals

Bonus
- Whisper, Groq, or similar inference stacks
- Multilingual NLP

Location: Bengaluru, India. Stipend ₹60,000/month.`,
  },
  {
    company: 'GenericCorp',
    title: 'Senior Java Backend Engineer',
    strongFit: false,
    expectMustHave: [],
    jd: `Requirements
- 8+ years of Java and Spring Boot
- Kubernetes, microservices
- Must be a US citizen with work authorization
- Senior-level distributed systems experience`,
  },
  {
    company: 'LangChain',
    title: 'Applied AI Intern',
    strongFit: true,
    expectMustHave: ['llm'],
    jd: `Requirements
- Building with LLMs, agents, and LangGraph
- Python or TypeScript
- RAG pipelines and embeddings
- An eye for evals

Early-career and internship candidates welcome. Remote.`,
  },
]
