/**
 * §14 Proof harness — render the seed résumé to a real PDF and REPORT the parse-back result.
 * D139's law: a compile that passes proves the lines; only rendering proves the page.
 * Run: npx tsx scripts/render-proof.mts [outPath]
 */
import { writeFileSync } from 'fs'
import seed from '../seed/ledger.seed.json' with { type: 'json' }
import { compileResume } from '../src/lib/compile/compiler'
import { renderResumePdf } from '../src/lib/export/pdf'
import { parsebackTest } from '../src/lib/export/parseback'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import { buildSummaryLine } from '../src/lib/darzi/summary'
import type { Identity, LedgerEntry, VisionProfile } from '../src/types'

const identity = seed.identity as Identity
const ledger = seed.entries as LedgerEntry[]
const vision = (seed as { vision?: VisionProfile }).vision

const JD = `AI Engineer Intern. Must have: Python, LLM, RAG, evals, guardrails, agents. Nice: TypeScript, prompt engineering.`
const decode = decodeJD(JD)
const coverage = matchEvidence(decode, ledger)
const summaryLine = vision ? buildSummaryLine(vision, ledger, decode) : undefined

const resume = compileResume({ identity, ledger, decode, coverage, jobId: 'proof', summaryLine: summaryLine ?? undefined })
const pdf = await renderResumePdf(resume)
const out = process.argv[2] ?? 'proof-resume.pdf'
writeFileSync(out, pdf)

const pb = await parsebackTest(resume, pdf)
console.log(`lines=${resume.lines.length} pdfBytes=${pdf.length} out=${out}`)
console.log(`parseback ok=${pb.ok} missing=${pb.missing.length} outOfOrder=${pb.outOfOrder.length}`)
if (!pb.ok) {
  console.log('MISSING:', pb.missing.slice(0, 5))
  console.log('OUT-OF-ORDER:', pb.outOfOrder.slice(0, 5))
  process.exit(1)
}
