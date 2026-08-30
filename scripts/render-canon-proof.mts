// Final-bar eyes-proof: seed ledger + the heart-vision → headline voice + canon register.
import { writeFileSync } from 'node:fs'
import { compileResume } from '../src/lib/compile/compiler'
import { renderResumePdf } from '../src/lib/export/pdf'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { buildSummaryLine } from '../src/lib/darzi/summary'
import { DEFAULT_VISION } from '../src/db/seed'
import { SEED_IDENTITY, SEED_LEDGER } from '../tests/helpers'

const jd = `We are hiring an AI Engineer Intern to build agentic LLM systems: RAG pipelines,
evals, guardrails, LangChain, Python, TypeScript. Remote (India welcome). Paid stipend.`
const decode = decodeJD(jd)
const coverage = matchEvidence(decode, SEED_LEDGER)
const summaryLine = buildSummaryLine({ identity: SEED_IDENTITY, vision: DEFAULT_VISION, ledger: SEED_LEDGER, decode, coverage }) ?? undefined
const resume = compileResume({ identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, jobId: 'proof', summaryLine })
writeFileSync(process.argv[2] ?? 'canon-proof.pdf', await renderResumePdf(resume))
console.log('headline:', resume.lines.find((l) => l.kind === 'summary')?.text)
