import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { EntryKind, LedgerEntry } from '../types'
import { resumeStrength } from '../lib/strength'
import { NabzPanel } from '../components/NabzPanel'

const KIND_ORDER: { kind: EntryKind; label: string }[] = [
  { kind: 'project', label: 'Projects' },
  { kind: 'skill', label: 'Skills' },
  { kind: 'education', label: 'Education' },
  { kind: 'achievement', label: 'Achievements' },
  { kind: 'certification', label: 'Certifications' },
  { kind: 'position', label: 'Positions & Volunteering' },
]

export function Shelf() {
  const entries = useLiveQuery(() => db.ledger.toArray()) ?? []
  const [promoting, setPromoting] = useState<LedgerEntry | null>(null)
  const [justStamped, setJustStamped] = useState<string | null>(null)
  const strength = resumeStrength(entries)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display font-bold text-3xl text-ink">Sach Ledger</h1>
          <p className="text-sm text-ink-soft mt-1">
            Everything here is provable — or honestly dated as in the forge. The resume is compiled from this, never written.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-mono text-xs text-ink-soft">
            {strength.shipped} shipped · {strength.total - strength.shipped} in forge
          </p>
          <QuickAdd />
        </div>
      </div>

      {KIND_ORDER.map(({ kind, label }) => {
        const group = entries.filter((e) => e.kind === kind)
        if (group.length === 0) return null
        return (
          <section key={kind} className="mb-8" aria-label={label}>
            <h2 className="font-display font-semibold text-lg text-ink border-b border-paper-edge pb-1 mb-3">
              {label}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {group
                .slice()
                .sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'shipped' ? -1 : 1))
                .map((e) => (
                  <EntryCard
                    key={e.id}
                    entry={e}
                    stamped={justStamped === e.id}
                    onPromote={() => setPromoting(e)}
                  />
                ))}
            </div>
          </section>
        )
      })}

      <NabzPanel />

      <VoiceBankCard />

      {promoting && (
        <PromoteModal
          entry={promoting}
          onClose={() => setPromoting(null)}
          onDone={(id) => {
            setPromoting(null)
            setJustStamped(id)
            setTimeout(() => setJustStamped(null), 2000)
          }}
        />
      )}
    </div>
  )
}

function EntryCard({
  entry,
  stamped,
  onPromote,
}: {
  entry: LedgerEntry
  stamped: boolean
  onPromote: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(entry.title)
  const [summary, setSummary] = useState(entry.summary)
  const [bullets, setBullets] = useState(entry.bullets.map((b) => b.text))

  const save = async () => {
    await db.ledger.update(entry.id, {
      title,
      summary,
      bullets: entry.bullets.map((b, i) => ({ ...b, text: bullets[i] ?? b.text })),
    })
    setEditing(false)
  }

  return (
    <article className={`dossier p-4 relative animate-dossier-in ${!entry.resumeEligible ? 'opacity-70' : ''}`}>
      {stamped && (
        <div className="absolute inset-0 grid place-items-center bg-paper-raised/60 z-10 rounded">
          <span className="stamp stamp-shipped text-lg animate-stamp-down px-4 py-2">SHIPPED ✓</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        {editing ? (
          <input
            className="font-semibold text-ink bg-paper-sunken px-2 py-1 rounded w-full text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Entry title"
          />
        ) : (
          <h3 className="font-semibold text-ink text-sm leading-snug">{entry.title}</h3>
        )}
        {entry.tier === 'shipped' ? (
          <span className="stamp stamp-shipped shrink-0">Shipped</span>
        ) : (
          <span className="stamp stamp-forge shrink-0">In forge · {entry.forgeEta}</span>
        )}
      </div>

      {editing ? (
        <textarea
          className="mt-2 w-full text-xs text-ink-soft bg-paper-sunken px-2 py-1 rounded"
          rows={2}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          aria-label="Entry summary"
        />
      ) : (
        entry.summary && <p className="mt-1.5 text-xs text-ink-soft leading-relaxed">{entry.summary}</p>
      )}

      {entry.bullets.length > 0 && entry.kind === 'project' && (
        <ul className="mt-2 space-y-1">
          {entry.bullets.map((b, i) => (
            <li key={b.id} className="text-xs text-ink leading-relaxed flex gap-1.5">
              <span className="text-ink-soft shrink-0">·</span>
              {editing ? (
                <textarea
                  className="w-full bg-paper-sunken px-2 py-1 rounded"
                  rows={2}
                  value={bullets[i]}
                  onChange={(e) => setBullets(bullets.map((t, j) => (j === i ? e.target.value : t)))}
                  aria-label={`Bullet ${i + 1}`}
                />
              ) : (
                <span>{b.text}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        {entry.evidence?.url && (
          <a className="font-mono text-ink underline decoration-dotted" href={entry.evidence.url} target="_blank" rel="noreferrer">
            evidence ↗
          </a>
        )}
        {entry.evidence?.repo && (
          <a className="font-mono text-ink underline decoration-dotted" href={entry.evidence.repo} target="_blank" rel="noreferrer">
            repo ↗
          </a>
        )}
        {!entry.resumeEligible && (
          <span className="font-mono text-ink-soft" title="Shaurya's call: never enters any export">
            excluded from resume
          </span>
        )}
        <span className="ml-auto flex gap-2">
          {editing ? (
            <>
              <button className="font-medium text-shipped hover:underline" onClick={save}>
                Save
              </button>
              <button className="text-ink-soft hover:underline" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="text-ink-soft hover:underline" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
          {entry.tier === 'in_forge' && !editing && (
            <button className="font-medium text-shipped hover:underline" onClick={onPromote}>
              Promote →
            </button>
          )}
        </span>
      </div>
    </article>
  )
}

/** The promotion ceremony — watching your truth grow. Evidence is the price of the stamp. */
function PromoteModal({
  entry,
  onClose,
  onDone,
}: {
  entry: LedgerEntry
  onClose: () => void
  onDone: (id: string) => void
}) {
  const [url, setUrl] = useState(entry.evidence?.repo ?? `https://github.com/SHV27/${entry.id.replace('proj-', '')}`)
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  const promote = async () => {
    if (!/^https?:\/\/.+\..+/.test(url)) {
      setErr('The stamp needs evidence: a real, reachable URL.')
      return
    }
    const now = new Date()
    await db.ledger.update(entry.id, {
      tier: 'shipped',
      forgeEta: undefined,
      evidence: {
        url,
        repo: url.includes('github.com') ? url : entry.evidence?.repo,
        date: `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
        note: note || 'Promoted in ceremony.',
      },
    })
    onDone(entry.id)
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-ink/40 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Promote ${entry.title}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dossier p-6 max-w-md w-full animate-dossier-in">
        <h2 className="font-display font-bold text-xl text-ink">Promotion Ceremony</h2>
        <p className="text-sm text-ink-soft mt-1">
          <strong className="text-ink">{entry.title}</strong> moves from the forge to the shelf. The stamp
          requires evidence — that is the whole point of this app.
        </p>
        <label className="block mt-4 text-xs font-medium text-ink">
          Evidence URL (repo, live site, certificate)
          <input
            className="mt-1 w-full bg-paper-sunken px-3 py-2 rounded font-mono text-xs"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/SHV27/…"
          />
        </label>
        <label className="block mt-3 text-xs font-medium text-ink">
          Note (optional)
          <input
            className="mt-1 w-full bg-paper-sunken px-3 py-2 rounded text-xs"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What shipped, in one line"
          />
        </label>
        {err && <p className="mt-2 text-xs text-stamp font-medium">{err}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button className="text-sm text-ink-soft hover:underline" onClick={onClose}>
            Not yet
          </button>
          <button
            className="text-sm font-semibold bg-shipped text-paper px-4 py-2 rounded hover:opacity-90"
            onClick={promote}
          >
            Stamp it SHIPPED
          </button>
        </div>
      </div>
    </div>
  )
}

/** Quick-add: achievement/certification/skill in ≤3 fields — he'll keep winning things. */
function QuickAdd() {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'achievement' | 'certification' | 'skill'>('achievement')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')

  const add = async () => {
    if (!title.trim()) return
    const id = `${kind}-${Date.now()}`
    const now = new Date()
    await db.ledger.put({
      id,
      kind,
      title: title.trim(),
      summary: detail.trim(),
      bullets:
        kind === 'skill'
          ? [{ id: `${id}-b1`, text: title.trim(), keywords: [title.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')] }]
          : [],
      tier: 'shipped',
      evidence: { date: `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`, note: detail.trim() || 'Quick-added.' },
      tags: [kind],
      resumeEligible: true,
    })
    setTitle('')
    setDetail('')
    setOpen(false)
  }

  if (!open)
    return (
      <button className="text-xs font-semibold bg-ink text-paper px-3 py-1.5 rounded hover:opacity-90" onClick={() => setOpen(true)}>
        + Quick add
      </button>
    )

  return (
    <div className="dossier p-3 absolute right-6 z-20 w-72 mt-10 animate-dossier-in">
      <div className="flex gap-1 mb-2">
        {(['achievement', 'certification', 'skill'] as const).map((k) => (
          <button
            key={k}
            className={`text-[11px] px-2 py-1 rounded capitalize ${kind === k ? 'bg-ink text-paper' : 'bg-paper-sunken text-ink'}`}
            onClick={() => setKind(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <input
        className="w-full bg-paper-sunken px-2 py-1.5 rounded text-xs mb-1.5"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={kind === 'skill' ? 'Skill name' : 'Title (e.g. 2nd place, XYZ Hackathon)'}
        aria-label="Quick add title"
        autoFocus
      />
      <input
        className="w-full bg-paper-sunken px-2 py-1.5 rounded text-xs mb-2"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="One-line detail (optional)"
        aria-label="Quick add detail"
      />
      <div className="flex justify-end gap-2">
        <button className="text-xs text-ink-soft" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="text-xs font-semibold bg-shipped text-paper px-3 py-1 rounded" onClick={add}>
          Add · stamped Shipped
        </button>
      </div>
    </div>
  )
}

function VoiceBankCard() {
  const voice = useLiveQuery(() => db.voicebank.get('voice'))
  const [draft, setDraft] = useState('')
  if (!voice) return null

  return (
    <section className="dossier p-4 mt-2" aria-label="Voice Bank">
      <h2 className="font-display font-semibold text-lg text-ink">Voice Bank</h2>
      <p className="text-xs text-ink-soft mt-1">
        Real sentences you wrote. The polish pass is held to this register — anything that doesn't sound like
        you gets rejected by the slop scan.
      </p>
      {voice.samples.length < 5 && (
        <p className="mt-2 text-xs text-forge bg-forge-wash rounded px-3 py-2 leading-relaxed">
          Only {voice.samples.length} sample{voice.samples.length === 1 ? '' : 's'} so far. Add a few more sentences
          you actually wrote (a project blurb, a commit message) — the more you give, the better the polish pass
          sounds like you and the sharper the slop scan gets. Aim for 5+.
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {voice.samples.map((s, i) => (
          <li key={i} className="text-xs text-ink font-mono bg-paper-sunken rounded px-3 py-2 flex justify-between gap-2">
            <span className="leading-relaxed">“{s}”</span>
            <button
              className="text-ink-soft hover:text-stamp shrink-0"
              aria-label={`Remove sample ${i + 1}`}
              onClick={() => db.voicebank.update('voice', { samples: voice.samples.filter((_, j) => j !== i) })}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!draft.trim()) return
          await db.voicebank.update('voice', { samples: [...voice.samples, draft.trim()] })
          setDraft('')
        }}
      >
        <input
          className="flex-1 bg-paper-sunken px-3 py-2 rounded text-xs"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a sentence you actually wrote…"
          aria-label="New voice sample"
        />
        <button className="text-xs font-semibold bg-ink text-paper px-3 py-2 rounded" type="submit">
          Add
        </button>
      </form>
    </section>
  )
}
