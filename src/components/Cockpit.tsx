import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Job, Packet } from '../types'
import { buildDossierFields, mailtoFromJd, preflight, preflightSummary } from '../lib/cockpit/dossier'
import { buildBookmarklet, buildProfile } from '../lib/cockpit/bookmarklet'

/**
 * THE APPLY COCKPIT (re-brief Pillar 2) — the lawful ceiling of "auto-apply":
 * pre-flight (poka-yoke: work-auth · register · pay · freshness · link) → autofill bookmarklet
 * (install once, fills facts in HIS browser) → per-field copy dossier → mailto lane when the JD
 * asks for email applications → the official apply URL → Mark as Applied. SUBMIT IS ALWAYS HIS.
 */
export default function Cockpit({ job, packet }: { job: Job; packet: Packet }) {
  const identity = useLiveQuery(() => db.identity.get('me'))
  const settings = useLiveQuery(() => db.settings.get('app'))
  const education = useLiveQuery(() => db.ledger.where('kind').equals('education').toArray()) ?? []
  const [copied, setCopied] = useState<string | null>(null)
  const [showFields, setShowFields] = useState(false)

  const checks = useMemo(() => preflight(job, packet, settings?.visionProfile), [job, packet, settings?.visionProfile])
  const summary = preflightSummary(checks)

  if (!identity) return null
  const fields = buildDossierFields(identity, education, settings?.visionProfile, job)
  const liveUrl = packet.resume.lines.find((l) => l.kind === 'meta' && /\.(app|dev|io|com)\b/.test(l.text))?.text.match(/[\w.-]+\.(?:app|dev|io|com)\S*/)?.[0]
  const bookmarklet = buildBookmarklet(buildProfile(identity, education, liveUrl))
  const mailto = mailtoFromJd(job, identity, packet.outreach.paragraphs.map((p) => p.text).join('\n\n'))

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500)
    } catch {
      /* clipboard denied — the value is visible to select by hand */
    }
  }

  const dot = (s: 'green' | 'amber' | 'red') => (s === 'green' ? 'bg-shipped' : s === 'amber' ? 'bg-amber-500' : 'bg-stamp')

  return (
    <section className="dossier p-4" aria-label="Apply Cockpit">
      <h2 className="font-display font-semibold text-ink text-sm">
        🎯 Apply Cockpit <span className="text-ink-soft font-normal">— everything staged, you fire</span>
      </h2>

      {/* PRE-FLIGHT — mistakes die here, not on the application. */}
      <div className="mt-2">
        <p className={`text-[11px] font-mono ${summary.ok ? 'text-shipped' : 'text-stamp'}`}>Pre-flight: {summary.line}</p>
        <ul className="mt-1.5 space-y-1">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-[11px] text-ink-soft leading-snug">
              <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${dot(c.status)}`} aria-label={c.status} />
              <span>
                <strong className="text-ink font-medium">{c.label}:</strong> {c.why}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="ledger-rule my-3" />

      {/* The official door — big, first. */}
      {job.url && (
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          className="block w-full text-center bg-ink text-paper font-semibold px-4 py-2.5 rounded hover:opacity-90"
        >
          Open the official application ↗
        </a>
      )}

      {/* Install-once autofill — password-manager pattern, facts only, human submits. */}
      <div className="mt-3">
        <p className="text-[11px] text-ink-soft leading-relaxed">
          <a href={bookmarklet} className="font-semibold text-ink underline decoration-dotted" onClick={(e) => e.preventDefault()} title="Drag me to your bookmarks bar — don't click here">
            ⚡ Sifarish Autofill
          </a>{' '}
          — drag this ONCE to your bookmarks bar. On any application form, click it: your facts
          (name, contacts, links, education) fill in; questions and files stay yours; it cannot
          submit anything, by construction.
        </p>
      </div>

      {/* Email lane — only when the JD itself asks for it. */}
      {mailto && (
        <a href={mailto} className="mt-2 block text-center text-xs font-semibold border border-ink text-ink px-4 py-2 rounded hover:bg-ink-wash">
          ✉ This posting takes email applications — open a prefilled draft (you attach + send)
        </a>
      )}

      {/* Per-field copy dossier — for everything the bookmarklet honestly won't touch. */}
      <button className="mt-3 font-mono text-[11px] text-ink-soft underline decoration-dotted" onClick={() => setShowFields((v) => !v)}>
        {showFields ? '▾' : '▸'} field-by-field dossier ({fields.length})
      </button>
      {showFields && (
        <ul className="mt-2 space-y-1.5">
          {fields.map((f) => (
            <li key={f.label} className="text-[11px] leading-snug">
              <button
                className="text-left w-full group"
                onClick={() => void copy(f.label, f.value)}
                title="Click to copy"
              >
                <span className="font-medium text-ink">{f.label}</span>
                <span className="text-ink-soft"> — {f.value}</span>
                <span className="font-mono text-[9px] text-shipped ml-1">{copied === f.label ? '✓ copied' : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[10px] text-ink-faint leading-relaxed">
        Everything above stages; nothing submits. LinkedIn/Wellfound stay untouched by automation —
        that's what keeps your accounts alive (RESEARCH.md verdict 1).
      </p>
    </section>
  )
}
