import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { CompiledDoc, Job, Packet } from '../types'
import { buildPacket, savePacket } from '../lib/darzi'
import { CompileError, LINE_METRICS } from '../lib/compile/compiler'
import { saveFile } from '../lib/util/download'
import { fetchJobFromUrl, makePastedJob } from '../lib/radar/pasteLane'
import { markApplied } from '../lib/morcha'

export function PacketScreen({ jobId, onPickJob }: { jobId: string | null; onPickJob: (id: string) => void }) {
  const job = useLiveQuery(() => (jobId ? db.jobs.get(jobId) : undefined), [jobId])
  if (!jobId || !job) return <PasteLane onPickJob={onPickJob} />
  return <PacketView job={job} />
}

/** The Paste Lane — the Darzi's front desk when no job is selected. */
function PasteLane({ onPickJob }: { onPickJob: (id: string) => void }) {
  const [url, setUrl] = useState('')
  const [company, setCompany] = useState('')
  const [title, setTitle] = useState('')
  const [jd, setJd] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const tailored = useLiveQuery(() => db.jobs.where('status').notEqual('found').toArray()) ?? []

  const fromUrl = async () => {
    setBusy(true)
    setErr('')
    try {
      const job = await fetchJobFromUrl(url)
      if (!job) {
        setErr('Not a recognizable Greenhouse/Lever/Ashby job URL. Paste the JD text below instead — that lane always works.')
        return
      }
      await db.jobs.put(job)
      onPickJob(job.id)
    } catch {
      setErr('Could not fetch that posting (network or dead link). Paste the JD text below instead.')
    } finally {
      setBusy(false)
    }
  }

  const fromText = async () => {
    if (jd.trim().length < 40) {
      setErr('That JD looks too short to decode. Paste the full description — requirements section included.')
      return
    }
    const job = makePastedJob(company, title, jd, url)
    await db.jobs.put(job)
    onPickJob(job.id)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display font-bold text-3xl text-ink">Darzi Engine</h1>
      <p className="text-sm text-ink-soft mt-1 mb-6">
        Hand the tailor a job — a Greenhouse/Lever/Ashby URL, or the JD text itself (the LinkedIn lane).
        The packet is compiled from your ledger; nothing is ever invented.
      </p>

      <div className="dossier p-4">
        <label className="block text-xs font-medium text-ink">
          Job URL
          <div className="flex gap-2 mt-1">
            <input
              className="flex-1 bg-paper-sunken px-3 py-2 rounded font-mono text-xs"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://job-boards.greenhouse.io/anthropic/jobs/…"
            />
            <button
              className="text-xs font-semibold bg-ink text-paper px-4 py-2 rounded disabled:opacity-50"
              disabled={busy || !url}
              onClick={fromUrl}
            >
              {busy ? 'Fetching…' : 'Fetch'}
            </button>
          </div>
        </label>

        <div className="ledger-rule my-4" />

        <p className="text-xs font-medium text-ink mb-2">…or paste the JD text</p>
        <div className="grid sm:grid-cols-2 gap-2 mb-2">
          <input
            className="bg-paper-sunken px-3 py-2 rounded text-xs"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company"
            aria-label="Company"
          />
          <input
            className="bg-paper-sunken px-3 py-2 rounded text-xs"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Role title"
            aria-label="Role title"
          />
        </div>
        <textarea
          className="w-full bg-paper-sunken px-3 py-2 rounded text-xs font-mono"
          rows={8}
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste the full job description here…"
          aria-label="Job description text"
        />
        <div className="mt-3 flex items-center gap-3">
          <button className="text-xs font-semibold bg-stamp text-paper px-4 py-2 rounded" onClick={fromText}>
            Tailor from text →
          </button>
          {err && <p className="text-xs text-stamp">{err}</p>}
        </div>
      </div>

      {tailored.length > 0 && (
        <section className="mt-6" aria-label="Existing packets">
          <h2 className="font-display font-semibold text-lg text-ink mb-2">Existing packets</h2>
          <div className="space-y-1.5">
            {tailored.map((j) => (
              <button
                key={j.id}
                className="dossier w-full text-left px-3 py-2 text-sm text-ink flex justify-between gap-2 hover:shadow-dossier-hover"
                onClick={() => onPickJob(j.id)}
              >
                <span className="truncate">
                  {j.title} · <span className="text-ink-soft">{j.company}</span>
                </span>
                <span className="font-mono text-[10px] text-ink-soft uppercase">{j.status}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function PacketView({ job }: { job: Job }) {
  const packet = useLiveQuery(() => db.packets.where('jobId').equals(job.id).first(), [job.id])
  const [error, setError] = useState<{ message: string; suggestions: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [parseback, setParseback] = useState<string | null>(null)

  const tailor = async () => {
    setBusy(true)
    setError(null)
    try {
      const p = await buildPacket(job)
      await savePacket(p)
    } catch (e) {
      if (e instanceof CompileError) setError({ message: e.message, suggestions: e.suggestions })
      else setError({ message: String(e), suggestions: [] })
    } finally {
      setBusy(false)
    }
  }

  const exportPdf = async (p: Packet) => {
    try {
      const { renderResumePdf } = await import('../lib/export/pdf')
      const bytes = await renderResumePdf(p.resume)
      if (import.meta.env.DEV) {
        const { parsebackTest } = await import('../lib/export/parseback')
        const r = await parsebackTest(p.resume, bytes)
        setParseback(r.ok ? 'parse-back ✓ 100%' : `parse-back FAILED: ${r.missing.length} missing`)
      }
      saveFile(bytes, `Shaurya_Verma_Resume_${job.company.replace(/\W+/g, '')}.pdf`, 'application/pdf')
    } catch (e) {
      if (e instanceof CompileError) setError({ message: e.message, suggestions: e.suggestions })
    }
  }

  const exportDocx = async (p: Packet) => {
    const { renderResumeDocxBlob } = await import('../lib/export/docx')
    const blob = await renderResumeDocxBlob(p.resume)
    saveFile(blob, `Shaurya_Verma_Resume_${job.company.replace(/\W+/g, '')}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink">{job.title}</h1>
          <p className="text-sm text-ink-soft">
            {job.company} {job.location && `· ${job.location}`}
          </p>
        </div>
        {job.url && (
          <a
            className="font-mono text-xs text-ink underline decoration-dotted mt-1"
            href={job.url}
            target="_blank"
            rel="noreferrer"
          >
            official apply page ↗
          </a>
        )}
      </div>

      {error && (
        <div className="dossier p-4 mb-4 border-l-4 border-l-stamp" role="alert">
          <p className="text-sm font-semibold text-stamp">Compile error</p>
          <p className="text-sm text-ink mt-1">{error.message}</p>
          {error.suggestions.map((s, i) => (
            <p key={i} className="text-xs text-ink-soft mt-1">
              → {s}
            </p>
          ))}
        </div>
      )}

      {!packet ? (
        <div className="dossier p-8 text-center">
          <p className="text-sm text-ink-soft mb-4">
            No packet yet for this role. The Darzi will decode the JD, match it against your ledger, and
            compile the full application dossier.
          </p>
          <button
            className="bg-stamp text-paper font-semibold px-6 py-3 rounded hover:opacity-90 disabled:opacity-50"
            disabled={busy}
            onClick={tailor}
          >
            {busy ? 'Compiling…' : 'Tailor this packet →'}
          </button>
        </div>
      ) : (
        <PacketBody
          key={packet.id}
          packet={packet}
          job={job}
          onExportPdf={() => exportPdf(packet)}
          onExportDocx={() => exportDocx(packet)}
          onRetailor={tailor}
          parseback={parseback}
        />
      )}
    </div>
  )
}

function PacketBody({
  packet,
  job,
  onExportPdf,
  onExportDocx,
  onRetailor,
  parseback,
}: {
  packet: Packet
  job: Job
  onExportPdf: () => void
  onExportDocx: () => void
  onRetailor: () => void
  parseback: string | null
}) {
  const { coverage } = packet
  const mustTotal = packet.decode.mustHave.length
  const [polishNote, setPolishNote] = useState<string | null>(null)
  const [polishing, setPolishing] = useState(false)

  const polish = async () => {
    setPolishing(true)
    setPolishNote(null)
    try {
      const { polishPacket } = await import('../lib/polish/client')
      const r = await polishPacket(packet)
      setPolishNote(
        r.keyless
          ? 'Keyless mode — compiled text kept as-is (add GROQ_API_KEY on Vercel to enable polish).'
          : `Polish: ${r.applied} line(s) improved, ${r.rejected} rejected by the fact-drift guard.`,
      )
    } finally {
      setPolishing(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5">
      {/* Resume paper preview — the evidence is the interface */}
      <div>
        <div className="dossier p-6 sm:p-8 bg-white relative" aria-label="Compiled resume preview">
          <span className="stamp stamp-red absolute -top-2 -right-2 animate-stamp-down">Compiled · {new Date(packet.createdAt).toLocaleDateString('en-IN')}</span>
          {packet.resume.lines.map((line, i) => (
            <ResumeLine key={i} text={line.text} kind={line.kind} isName={i === 0} count={line.ledgerIds.length} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button className="text-xs font-semibold bg-ink text-paper px-4 py-2 rounded" onClick={onExportPdf}>
            Download PDF
          </button>
          <button className="text-xs font-semibold bg-ink text-paper px-4 py-2 rounded" onClick={onExportDocx}>
            Download DOCX
          </button>
          <button
            className="text-xs font-semibold border border-ink text-ink px-4 py-2 rounded hover:bg-ink-wash disabled:opacity-50"
            onClick={polish}
            disabled={polishing}
            title="Optional LLM phrasing pass — fact-drift-guarded"
          >
            {polishing ? 'Polishing…' : 'Polish for flow'}
          </button>
          <button className="text-xs text-ink-soft hover:underline px-2" onClick={onRetailor}>
            re-tailor
          </button>
          {parseback && <span className="font-mono text-[11px] text-shipped">{parseback}</span>}
        </div>
        {polishNote && <p className="mt-1.5 text-[11px] text-ink-soft">{polishNote}</p>}

        <CopyDoc title="Cover letter" doc={packet.coverLetter} />
        <CopyDoc title="Outreach draft (send it yourself — SIFARISH never sends)" doc={packet.outreach} />
      </div>

      {/* Coverage sidebar */}
      <aside className="space-y-4">
        <section className="dossier p-4" aria-label="JD coverage">
          <h2 className="font-display font-semibold text-ink text-sm">
            JD coverage — {coverage.matched.filter((m) => m.mustHave).length}/{mustTotal} must-haves
          </h2>
          <ChipRow label="Evidence on resume" tone="shipped" hits={coverage.matched.map((h) => h.keyword)} />
          <ChipRow label="Currently building (dated line only)" tone="forge" hits={coverage.building.map((h) => h.keyword)} />
          <ChipRow label="No evidence — kept OFF the resume" tone="stamp" hits={coverage.missing.map((h) => h.keyword)} />
        </section>

        {packet.gapNote.length > 0 && (
          <section className="dossier p-4" aria-label="Gap note">
            <h2 className="font-display font-semibold text-ink text-sm">Gap note (honest ambition)</h2>
            <ul className="mt-2 space-y-1.5">
              {packet.gapNote.map((g, i) => (
                <li key={i} className="text-xs text-ink-soft leading-relaxed">
                  {g}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="dossier p-4">
          {job.status === 'found' || job.status === 'tailored' ? (
            <>
              <p className="text-xs text-ink-soft mb-3">
                When you have submitted it yourself on the official page, stamp it:
              </p>
              <button
                className="w-full bg-shipped text-paper font-semibold px-4 py-3 rounded hover:opacity-90"
                onClick={() => markApplied(job.id)}
              >
                Mark as Applied ✓
              </button>
            </>
          ) : (
            <p className="text-sm text-center">
              <span className="stamp stamp-shipped">Applied {job.appliedAt ? new Date(job.appliedAt).toLocaleDateString('en-IN') : ''}</span>
            </p>
          )}
        </div>
      </aside>
    </div>
  )
}

function ResumeLine({ text, kind, isName, count }: { text: string; kind: keyof typeof LINE_METRICS; isName: boolean; count: number }) {
  // I1 at the renderer: content lines must show their evidence anchors.
  const cls: Record<string, string> = {
    contact: 'text-[11px] text-neutral-700',
    heading: 'text-[12px] font-bold text-neutral-900 mt-3 tracking-wide',
    'entry-title': 'text-[12px] font-semibold text-neutral-900 mt-1.5',
    meta: 'text-[11px] text-neutral-600',
    bullet: 'text-[11.5px] text-neutral-800 leading-snug mt-0.5',
    skills: 'text-[11.5px] text-neutral-800 mt-0.5',
    forge: 'text-[11.5px] text-neutral-800 italic mt-1.5',
  }
  return (
    <p className={`${isName ? 'text-lg font-bold text-neutral-900' : cls[kind]} font-[Arial,Helvetica,sans-serif] group relative`}>
      {text}
      {(kind === 'bullet' || kind === 'forge') && (
        <span className="ml-1.5 font-mono text-[9px] text-shipped align-middle" title={`${count} ledger evidence link(s)`}>
          ⛁{count}
        </span>
      )}
    </p>
  )
}

function ChipRow({ label, tone, hits }: { label: string; tone: 'shipped' | 'forge' | 'stamp'; hits: string[] }) {
  if (hits.length === 0) return null
  const toneCls = { shipped: 'stamp-shipped', forge: 'stamp-forge', stamp: 'stamp-red' }[tone]
  return (
    <div className="mt-3">
      <p className="text-[11px] text-ink-soft mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {hits.map((h) => (
          <span key={h} className={`stamp ${toneCls} !text-[10px] !rotate-0`}>
            {h}
          </span>
        ))}
      </div>
    </div>
  )
}

function CopyDoc({ title, doc }: { title: string; doc: CompiledDoc }) {
  const [copied, setCopied] = useState(false)
  const text = doc.paragraphs.map((p) => p.text).join('\n\n')
  return (
    <section className="dossier p-4 mt-4" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display font-semibold text-ink text-sm">{title}</h2>
        <button
          className="text-xs text-ink-soft hover:underline shrink-0"
          onClick={async () => {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {doc.paragraphs.map((p, i) => (
          <p key={i} className="text-xs text-ink leading-relaxed">
            {p.text}
            {p.ledgerIds.length > 0 && (
              <span className="ml-1 font-mono text-[9px] text-shipped" title={p.ledgerIds.join(', ')}>
                ⛁{p.ledgerIds.length}
              </span>
            )}
          </p>
        ))}
      </div>
    </section>
  )
}
