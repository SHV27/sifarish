import type { ApplyPlan, ApplyStep, Job, LedgerEntry, Packet } from '../../types'
import { decodeJD } from '../jd/decode'
import { entryRelevance } from '../match/evidence'

/**
 * The Apply Plan — the killer feature. A concrete, numbered walkthrough that guides
 * Shaurya through applying HIMSELF. Every step is human-performed: the app drafts, he acts.
 * There is no auto-fill and no auto-send (I3). Works fully keyless (deterministic template);
 * the Guru's LLM mode may re-voice the prose but never the structure or the facts.
 */

const SCREENING_TEMPLATES: { q: string; match: (jd: string) => boolean }[] = [
  { q: 'Why do you want to work here?', match: () => true },
  { q: 'Walk me through a project you shipped.', match: () => true },
  { q: 'What is your experience with LLMs / agents?', match: (jd) => /llm|agent|genai|rag/i.test(jd) },
  { q: 'When are you available and for how long?', match: () => true },
]

export function buildApplyPlan(job: Job, packet: Packet | undefined, ledger: LedgerEntry[]): ApplyPlan {
  const decode = decodeJD(job.jd || job.title)
  const topProjects = ledger
    .filter((e) => e.resumeEligible && e.tier === 'shipped' && e.kind === 'project')
    .sort((a, b) => entryRelevance(b, decode) - entryRelevance(a, decode))
    .slice(0, 2)

  const hasPacket = !!packet
  const steps: ApplyStep[] = [
    {
      n: 1,
      action: 'Open the official application page',
      detail: job.url || 'Find the role on the company careers page (no apply URL was captured).',
      artifact: 'none',
    },
    {
      n: 2,
      action: 'Attach your tailored resume',
      detail: hasPacket
        ? `Upload Shaurya_Verma_${job.company.replace(/\W+/g, '')}.pdf. If the portal is Workday/iCIMS or rejects the PDF, upload the .docx instead — it parses ~100% reliably.`
        : 'Tailor a packet first (Packet screen) so there is a resume to attach.',
      artifact: hasPacket ? 'resume-pdf' : 'none',
    },
    {
      n: 3,
      action: 'Paste your cover letter',
      detail: hasPacket
        ? 'Copy the compiled cover letter from the packet into the cover-letter field. It already names a specific fact about this company.'
        : 'Available once the packet is compiled.',
      artifact: hasPacket ? 'cover-letter' : 'none',
    },
    {
      n: 4,
      action: 'Answer the screening questions',
      detail: 'Draft answers are below — each is built from your ledger, so every claim is true. Edit in your own words before pasting.',
      artifact: 'none',
    },
    {
      n: 5,
      action: 'Send the outreach yourself',
      detail:
        'After submitting, find the hiring manager or a team engineer on LinkedIn and send the outreach draft (Packet screen). Candidate-initiated outreach massively outperforms inbound — but YOU send it, from your own account. SIFARISH never sends.',
      artifact: 'outreach',
    },
    {
      n: 6,
      action: 'Mark as Applied',
      detail: 'Stamp the packet "Applied". This arms the day-7 and day-14 follow-up nudges automatically — no tracker to fill.',
      artifact: 'none',
    },
  ]

  const screeningAnswers = SCREENING_TEMPLATES.filter((t) => t.match(job.jd || '')).map((t) => {
    if (/want to work here/i.test(t.q)) {
      return {
        q: t.q,
        a: `I build agentic-AI tools for real Indian problems and this role is squarely that work${decode.mustHave.length ? ` (${decode.mustHave.slice(0, 3).join(', ').replace(/-/g, ' ')})` : ''}. Everything I claim is public on my GitHub — I'd rather be judged on shipped work than words.`,
        ledgerIds: topProjects.map((p) => p.id),
      }
    }
    if (/walk me through/i.test(t.q)) {
      const p = topProjects[0]
      return {
        q: t.q,
        a: p ? `${p.title.split('—')[0].trim()}: ${p.bullets[0]?.text ?? p.summary}.${p.evidence?.url ? ` Live at ${p.evidence.url.replace(/^https?:\/\//, '')}.` : ''}` : 'Pick a shipped project from your ledger.',
        ledgerIds: p ? [p.id] : [],
      }
    }
    if (/experience with llm/i.test(t.q)) {
      const p = topProjects.find((x) => x.tags.includes('llm') || x.tags.includes('agentic-ai')) ?? topProjects[0]
      return {
        q: t.q,
        a: p ? `${p.bullets.find((b) => /llm|agent|groq|whisper|guardrail/i.test(b.text))?.text ?? p.bullets[0]?.text ?? p.summary}.` : 'Reference a shipped LLM/agent project.',
        ledgerIds: p ? [p.id] : [],
      }
    }
    return {
      q: t.q,
      a: 'My compulsory internship window is January–May 2027, and I am open to an October start. Remote and remote-international both work for me.',
      ledgerIds: [],
    }
  })

  return { jobId: job.id, steps, screeningAnswers, generatedBy: 'template' }
}
