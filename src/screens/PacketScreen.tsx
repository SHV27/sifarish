import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { CompiledDoc, Job, Packet } from '../types'
import { buildPacket, buildPacketFast, savePacket, overrulePacket, toggleSignature } from '../lib/darzi'
import { CompileError, LINE_METRICS } from '../lib/compile/compiler'
import { saveFile } from '../lib/util/download'
import { fetchJobFromUrl, makePastedJob } from '../lib/radar/pasteLane'
import { markApplied } from '../lib/morcha'
import { buildApplyPlan } from '../lib/guru/applyPlan'
import { Why } from '../components/Why'
import QualityPanel from '../components/QualityPanel'
import Baithak from '../components/Baithak'
import AtelierBaithak from '../components/AtelierBaithak'
import AlignmentMap from '../components/AlignmentMap'
import type { EditorialPlan } from '../types'

export function PacketScreen({ jobId, onPickJob }: { jobId: string | null; onPickJob: (id: string) => void }) {
  const job = useLiveQuery(() => (jobId ? db.jobs.get(jobId) : undefined), [jobId])
  if (!jobId || !job) return <PasteLane onPickJob={onPickJob} />
  return <PacketView key={job.id} job={job} />
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
  // Query as an array so we can distinguish "still loading" (undefined) from "no packet" ([]).
  const packets = useLiveQuery(() => db.packets.where('jobId').equals(job.id).toArray(), [job.id])
  const packetLoaded = packets !== undefined
  const packet = packets?.[0]
  const [error, setError] = useState<{ message: string; suggestions: string[] } | null>(null)
  const [firstBuild, setFirstBuild] = useState(false) // true only until the INSTANT packet lands
  const [parseback, setParseback] = useState<string | null>(null)
  const startedFor = useRef<string | null>(null)

  // Two-phase (D33): phase 1 = instant deterministic packet (v2 speed); phase 2 = the Dimaag
  // Editor's Desk refines casting + letter in the background and updates the view live.
  const tailor = async () => {
    setError(null)
    setFirstBuild(true)
    try {
      const fast = await buildPacketFast(job)
      await savePacket(fast) // resume on screen in ~300ms
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : String(e), suggestions: e instanceof CompileError ? e.suggestions : [] })
      setFirstBuild(false)
      return
    }
    setFirstBuild(false)
    // Phase 2: refine in the background. A failure here just leaves the instant packet in place.
    try {
      const full = await buildPacket(job)
      await savePacket(full)
    } catch (e) {
      if (e instanceof CompileError) setError({ message: e.message, suggestions: e.suggestions })
      // else: keep the instant packet silently; it's fully usable.
    }
  }

  // Auto-tailor the moment we land here from the Radar with no packet yet (one click, not two).
  // Session 6.1 — a stored packet compiled BEFORE the last vault repair keeps serving pre-repair
  // bullets forever unless he knows to click re-tailor. It now re-tailors itself on open, once.
  const settings = useLiveQuery(() => db.settings.get('app'))
  useEffect(() => {
    if (!packet || firstBuild) return
    const reforgedAt = settings?.lastReforgeAt
    if (reforgedAt && packet.createdAt < reforgedAt && startedFor.current !== `stale-${packet.id}`) {
      startedFor.current = `stale-${packet.id}`
      void tailor()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packet?.id, settings?.lastReforgeAt])

  useEffect(() => {
    if (packetLoaded && !packet && !firstBuild && startedFor.current !== job.id) {
      startedFor.current = job.id
      void tailor()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packetLoaded, packet, job.id])

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

      {firstBuild && !packet ? (
        <div className="dossier p-8 text-center animate-dossier-in" aria-live="polite" aria-busy="true">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-stamp animate-nudge mb-3" />
          <p className="font-display font-semibold text-lg text-ink">Compiling your dossier…</p>
          <p className="text-sm text-ink-soft mt-1">One second — assembling the evidence.</p>
        </div>
      ) : !packet ? (
        <div className="dossier p-8 text-center">
          <p className="text-sm text-ink-soft mb-4">
            {error
              ? 'The compile hit a snag (above). You can retry, or open a different role.'
              : 'The Darzi will decode the JD, match it against your ledger, and compile the full dossier.'}
          </p>
          <button className="bg-stamp text-paper font-semibold px-6 py-3 rounded hover:opacity-90 disabled:opacity-50" disabled={firstBuild} onClick={tailor}>
            {error ? 'Retry tailoring →' : 'Tailor this packet →'}
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
        {packet.enhancing && (
          <div className="dossier p-3 mb-3 flex items-center gap-2 animate-dossier-in" aria-live="polite">
            <span className="w-2 h-2 rounded-full bg-forge animate-nudge shrink-0" />
            <p className="text-xs text-ink">
              <strong>Ready to use now.</strong> The Dimaag is refining the casting, angles, and cover letter in
              the background — this dossier will sharpen in a few seconds.
            </p>
          </div>
        )}
        {packet.editorial && <CastingSheet packet={packet} />}

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

        <Baithak key={`baithak-${packet.id}`} packet={packet} />

        {packet.signature && <SignatureToggle packet={packet} />}
        <CopyDoc title="Cover letter" doc={packet.coverLetter} downloadAs={`Shaurya_Verma_Cover_Letter_${job.company.replace(/\W+/g, '')}`} />
        <AtelierBaithak key={`atelier-${packet.id}`} packet={packet} />
        <CopyDoc title="Outreach draft (send it yourself — SIFARISH never sends)" doc={packet.outreach} />
        <ReferralAskPanel job={job} />
        <ApplyPlanPanel packet={packet} job={job} />
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
          {packet.intel && (
            <p className="mt-3 text-[11px] text-ink-soft">
              <span className="stamp stamp-red !text-[9px] !rotate-0 mr-1">intel-informed</span>
              emphasis tuned to {packet.intel.bullets.length} cited facts about {job.company} (below) — framing only, never a claim.
            </p>
          )}
        </section>

        {packet.quality && <QualityPanel quality={packet.quality} />}

        <AlignmentMap packet={packet} />

        <IntelPanel packet={packet} company={job.company} />

        {/* I9 made visible — it's a feature, not a disclaimer. */}
        <p className="text-[11px] text-ink-soft text-center px-2 leading-relaxed">
          Research-backed fit — outcomes depend on interviews. No tool can guarantee selection.
        </p>

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

/** The Sifarish Signature toggle (Atelier) — per-company Dimaag recommendation, Shaurya's final call. */
function SignatureToggle({ packet }: { packet: Packet }) {
  const sig = packet.signature!
  const [busy, setBusy] = useState(false)
  return (
    <section className="dossier p-3 mt-4" aria-label="Sifarish Signature">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink">Sifarish Signature</p>
          <p className="text-[11px] text-ink-soft">The P.S. that reveals this letter was compiled by your own agent.</p>
        </div>
        <button
          className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded ${sig.on ? 'bg-shipped text-paper' : 'bg-paper-sunken text-ink'} disabled:opacity-50`}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await toggleSignature(packet, !sig.on)
            } finally {
              setBusy(false)
            }
          }}
        >
          {sig.on ? 'ON' : 'OFF'}
        </button>
      </div>
      <Why rationale={sig.rationale} label="Dimaag's recommendation" />
    </section>
  )
}

/** The Casting Sheet (Darzi v3) — all four editorial passes, each with its Why, overrulable. */
function CastingSheet({ packet }: { packet: Packet }) {
  const ed = packet.editorial as EditorialPlan
  const [busy, setBusy] = useState(false)

  const overrule = async (opts: { promoteId?: string; benchId?: string }) => {
    setBusy(true)
    try {
      await overrulePacket(packet, opts)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="dossier p-4 mb-3" aria-label="Casting sheet">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-display font-semibold text-ink text-sm">
          The Editor's Desk — casting sheet
        </h2>
        <div className="flex items-center gap-2">
          {ed.overruled && <span className="stamp stamp-forge !text-[9px]">overruled</span>}
          {packet.ready ? (
            <span className="stamp stamp-shipped !text-[10px]">red-team: PASS ✓</span>
          ) : (
            <span className="stamp stamp-red !text-[10px]">red-team: REVISE</span>
          )}
        </div>
      </div>

      {/* Pass 1 — Archetype */}
      <div className="mt-3 ledger-rule pt-2">
        <p className="text-xs text-ink">
          <span className="font-mono text-[10px] text-ink-soft mr-1">1·ARCHETYPE</span>
          Cast as <strong>{ed.archetype.label}</strong>{' '}
          <span className={ed.archetype.by === 'dimaag' ? 'text-shipped' : 'text-forge'}>
            ({ed.archetype.by === 'dimaag' ? '🧠' : '⚙'} {Math.round(ed.archetype.confidence * 100)}%)
          </span>
        </p>
        <p className="text-[11px] text-ink-soft mt-0.5">{ed.archetype.reviewerNote}</p>
        <p className="text-[11px] text-ink-soft">Scans first for: {ed.archetype.priorities.join(' · ')}</p>
      </div>

      {/* Pass 2 — Casting */}
      <div className="mt-2 ledger-rule pt-2">
        <p className="text-xs text-ink">
          <span className="font-mono text-[10px] text-ink-soft mr-1">2·CASTING</span>
          Leading: {ed.chosen.map((c) => c.title).join(', ')}
        </p>
        <Why rationale={ed.casting} label="why this lineup" />
        <div className="mt-2 space-y-1">
          {ed.chosen.map((c) => (
            <div key={c.ledgerId} className="flex items-start justify-between gap-2 text-[11px]">
              <span className="text-ink">
                <span className="text-shipped">▲</span> <strong>{c.title}</strong> — angle: {c.angleLabel}
              </span>
              <button
                className="text-ink-faint hover:text-stamp shrink-0 disabled:opacity-40"
                disabled={busy || ed.chosen.length <= 1}
                onClick={() => overrule({ benchId: c.ledgerId })}
                title="Bench this (studio head overrule)"
              >
                bench ↓
              </button>
            </div>
          ))}
          {ed.benched.map((b) => (
            <div key={b.ledgerId} className="flex items-start justify-between gap-2 text-[11px]">
              <span className="text-ink-soft">
                <span className="text-ink-faint">▽</span> {b.title} — {b.why}
              </span>
              <button
                className="text-ink-faint hover:text-shipped shrink-0 disabled:opacity-40"
                disabled={busy}
                onClick={() => overrule({ promoteId: b.ledgerId })}
                title="Promote this (studio head overrule)"
              >
                promote ↑
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Pass 3 — Surgery (angles) */}
      {ed.chosen.some((c) => c.angleRationale.optionsConsidered.length > 1) && (
        <div className="mt-2 ledger-rule pt-2">
          <p className="text-xs text-ink">
            <span className="font-mono text-[10px] text-ink-soft mr-1">3·SURGERY</span>
            Angle chosen per project (evidence re-ordered, never invented)
          </p>
          {ed.chosen
            .filter((c) => c.angleRationale.optionsConsidered.length > 1)
            .map((c) => (
              <div key={c.ledgerId} className="mt-1">
                <p className="text-[11px] text-ink">{c.title}: {c.angleLabel}</p>
                <Why rationale={c.angleRationale} label="why this angle" />
              </div>
            ))}
        </div>
      )}

      {/* Pass 4 — Red-Team */}
      <div className="mt-2 ledger-rule pt-2">
        <p className="text-xs text-ink">
          <span className="font-mono text-[10px] text-ink-soft mr-1">4·RED-TEAM</span>
          {ed.redTeam.by === 'dimaag' ? '🧠' : '⚙'} {ed.redTeam.verdict}
          {ed.redTeam.smell && <span className="text-ink-soft"> — smell: {ed.redTeam.smell}</span>}
        </p>
        {ed.redTeam.fixes.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {ed.redTeam.fixes.map((f, i) => (
              <li key={i} className="text-[11px] text-stamp">→ {f}</li>
            ))}
          </ul>
        )}
      </div>
      {busy && <p className="mt-2 text-[11px] text-ink-soft font-mono">Re-casting…</p>}
    </section>
  )
}

function IntelPanel({ packet, company }: { packet: Packet; company: string }) {
  if (!packet.intel) {
    return (
      <section className="dossier p-4" aria-label="Company intel">
        <h2 className="font-display font-semibold text-ink text-sm">Company intel</h2>
        <p className="text-xs text-ink-soft mt-1.5 leading-relaxed">
          Keyless mode — add <code className="font-mono text-[11px]">TAVILY_API_KEY</code> on Vercel for cited
          company research. The compile proceeds exactly the same without it.
        </p>
      </section>
    )
  }
  return (
    <section className="dossier p-4" aria-label="Company intel">
      <h2 className="font-display font-semibold text-ink text-sm">
        Intel Dossier — {company} <span className="font-mono text-[10px] text-ink-soft">({packet.intel.bullets.length} cited)</span>
      </h2>
      <ul className="mt-2 space-y-2">
        {packet.intel.bullets.map((b, i) => (
          <li key={i} className="text-xs text-ink-soft leading-relaxed">
            {b.text}{' '}
            <a href={b.url} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-ink underline decoration-dotted">
              {sourceHost(b.url)} ↗
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ApplyPlanPanel({ packet, job }: { packet: Packet; job: Job }) {
  const ledger = useLiveQuery(() => db.ledger.toArray()) ?? []
  const [open, setOpen] = useState(false)
  const plan = buildApplyPlan(job, packet, ledger)
  return (
    <section className="dossier p-4 mt-4" aria-label="Apply plan">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen(!open)} aria-expanded={open}>
        <h2 className="font-display font-semibold text-ink text-sm">Apply plan — you apply, step by step</h2>
        <span className="font-mono text-xs text-ink-soft">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <ol className="mt-3 space-y-2">
            {plan.steps.map((s) => (
              <li key={s.n} className="text-xs text-ink leading-relaxed flex gap-2">
                <span className="font-mono font-semibold text-stamp shrink-0">{s.n}</span>
                <span>
                  <strong className="text-ink">{s.action}.</strong> <span className="text-ink-soft">{s.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-3 ledger-rule pt-2">
            <p className="font-mono text-[11px] uppercase text-ink-soft tracking-wide mb-1">Likely screening questions</p>
            {plan.screeningAnswers.map((sa, i) => (
              <div key={i} className="mb-2">
                <p className="text-xs font-semibold text-ink">{sa.q}</p>
                <p className="text-xs text-ink-soft leading-relaxed">{sa.a}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'source'
  }
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

function CopyDoc({ title, doc, downloadAs }: { title: string; doc: CompiledDoc; downloadAs?: string }) {
  const [copied, setCopied] = useState(false)
  const text = doc.paragraphs.map((p) => p.text).join('\n\n')

  // Most portals want the letter as an uploaded PDF/DOCX, not pasted text — a copy-only letter
  // was a packet that stopped one step short of the actual application (Session 5.4).
  const dlPdf = async () => {
    const { renderLetterPdf } = await import('../lib/export/pdf')
    saveFile(await renderLetterPdf(doc, title), `${downloadAs}.pdf`, 'application/pdf')
  }
  const dlDocx = async () => {
    const { renderLetterDocxBlob } = await import('../lib/export/docx')
    saveFile(await renderLetterDocxBlob(doc), `${downloadAs}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  }

  return (
    <section className="dossier p-4 mt-4" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display font-semibold text-ink text-sm">{title}</h2>
        {downloadAs && (
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button className="text-xs text-ink-soft hover:underline" onClick={() => void dlPdf()}>
              ↓ PDF
            </button>
            <button className="text-xs text-ink-soft hover:underline" onClick={() => void dlDocx()}>
              ↓ DOCX
            </button>
          </div>
        )}
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
            {p.citationUrl && (
              <a
                href={p.citationUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-1 font-mono text-[9px] text-stamp underline decoration-dotted"
                title="Cited company fact (I7)"
              >
                ⌕source
              </a>
            )}
          </p>
        ))}
      </div>
    </section>
  )
}

/**
 * Session 6 (P1) — THE REFERRAL ASK. Referred candidates take ~72% of interviews from ~7% of
 * applicants; a paid reverse-recruiter networks every application. The lawful version: a drafted,
 * evidence-grounded ask HE sends to someone he actually knows (or finds via public sources).
 * Deterministic, zero LLM, zero sends (I3).
 */
function ReferralAskPanel({ job }: { job: Job }) {
  const [copied, setCopied] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const reveal = async () => {
    const [identity, ledger] = await Promise.all([db.identity.get('me'), db.ledger.toArray()])
    if (!identity) return
    const { draftReferralAsk } = await import('../lib/sahayak')
    setText(draftReferralAsk(job, identity, ledger))
  }
  return (
    <section className="dossier p-4" aria-label="Referral ask">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display font-semibold text-ink text-sm">Referral ask (the strongest lawful channel)</h2>
        {text ? (
          <button
            className="text-xs font-mono text-ink-soft hover:text-ink"
            onClick={async () => {
              await navigator.clipboard.writeText(text)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? 'copied ✓' : 'copy'}
          </button>
        ) : (
          <button className="text-xs font-mono text-ink-soft hover:text-ink underline decoration-dotted" onClick={reveal}>
            draft it
          </button>
        )}
      </div>
      <p className="text-[11px] text-ink-soft mt-1 leading-relaxed">
        Referred candidates take the lion's share of interviews. If you know ANYONE at {job.company} — or can
        find the team on their site or GitHub — this draft makes the ask effortless for them. You send it;
        the app never does.
      </p>
      {text && <pre className="mt-2 text-xs text-ink leading-relaxed whitespace-pre-wrap font-sans bg-paper-sunken rounded p-2">{text}</pre>}
    </section>
  )
}
