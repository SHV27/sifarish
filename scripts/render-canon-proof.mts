// Arc 2 eyes-proof: compile the seed ledger against a realistic JD and render the canon PDF.
import { writeFileSync } from 'node:fs'
import { compileResume } from '../src/lib/compile/compiler'
import { renderResumePdf } from '../src/lib/export/pdf'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { SEED_IDENTITY, SEED_LEDGER } from '../tests/helpers'

const jd = `We are hiring an AI Engineer Intern to build agentic LLM systems: RAG pipelines,
evals, guardrails, LangChain/LangGraph, Python, TypeScript. You will ship production features
with measurable impact. Remote (India welcome). Stipend paid.`
const decode = decodeJD(jd)
const coverage = matchEvidence(decode, SEED_LEDGER)
const resume = compileResume({ identity: SEED_IDENTITY, ledger: SEED_LEDGER, decode, coverage, jobId: 'proof' })
const pdf = await renderResumePdf(resume)
writeFileSync(process.argv[2] ?? 'canon-proof.pdf', pdf)
console.log('lines:', resume.lines.length, '| runs lines:', resume.lines.filter((l) => l.runs?.length).length)
