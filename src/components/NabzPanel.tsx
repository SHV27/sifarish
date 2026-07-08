import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { fetchRepos, computeSuggestions, acceptSuggestion, dismissSuggestion, type RateBudget } from '../lib/nabz/github'

/** GitHub Nabz surface — the pulse, on the Shelf. Nabz drafts; Shaurya confirms every change. */
export function NabzPanel() {
  const pending = useLiveQuery(() => db.suggestions.where('status').equals('pending').toArray()) ?? []
  const [syncing, setSyncing] = useState(false)
  const [budget, setBudget] = useState<RateBudget | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const sync = async () => {
    setSyncing(true)
    setErr(null)
    setNote(null)
    try {
      // A manual click is a deliberate ask for the latest truth — always hit the network,
      // never silently replay the 30-min cache (that's what made a freshly-pushed public
      // repo invisible until the cache expired).
      const { repos, budget, fromCache } = await fetchRepos(true)
      setBudget(budget)
      const suggestions = await computeSuggestions(repos)
      setNote(
        `${repos.length} repos scanned${fromCache ? ' (cached)' : ''} · ${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'}`,
      )
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e))
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="dossier p-4 mt-2" aria-label="GitHub Nabz">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display font-semibold text-lg text-ink">
            GitHub Nabz <span className="font-devanagari text-sm text-stamp">नब्ज़</span>
          </h2>
          <p className="text-xs text-ink-soft">
            The pulse of github.com/SHV27. When a forge repo goes public, Nabz notices — and offers a one-click promotion.
          </p>
        </div>
        <button
          className="shrink-0 bg-ink text-paper font-semibold text-xs px-3 py-2 rounded disabled:opacity-50"
          onClick={sync}
          disabled={syncing}
        >
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {(note || budget) && (
        <p className="mt-2 font-mono text-[11px] text-ink-soft">
          {note}
          {budget && ` · budget ${budget.remaining}/${budget.limit} req left`}
        </p>
      )}
      {err && <p className="mt-2 text-xs text-stamp">{err}</p>}

      {pending.length > 0 && (
        <ul className="mt-3 space-y-2">
          {pending.map((s) => (
            <li key={s.id} className="ledger-rule pt-2">
              <div className="flex items-start gap-2">
                <span className={`stamp shrink-0 !text-[10px] ${s.type === 'promotion' ? 'stamp-forge' : s.type === 'attach_link' ? 'stamp-shipped' : 'stamp-red'}`}>
                  {s.type === 'promotion' ? 'promote' : s.type === 'attach_link' ? 'link' : 'new'}
                </span>
                <p className="text-xs text-ink leading-relaxed flex-1">{s.why}</p>
              </div>
              <div className="mt-1.5 flex items-center gap-3 pl-1">
                <button className="text-xs font-semibold text-shipped hover:underline" onClick={() => acceptSuggestion(s)}>
                  {s.type === 'promotion' ? 'Stamp it shipped ✓' : s.type === 'attach_link' ? 'Attach link ✓' : 'Add to ledger ✓'}
                </button>
                <button className="text-xs text-ink-soft hover:underline" onClick={() => dismissSuggestion(s.id)}>
                  Not now
                </button>
                <a className="text-xs font-mono text-ink underline decoration-dotted ml-auto" href={s.repoUrl} target="_blank" rel="noreferrer">
                  {s.repoName} ↗
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {note && pending.length === 0 && (
        <p className="mt-2 text-xs text-ink-soft">
          Nothing to confirm — every public repo is already reflected in the ledger. The truth is in sync.
        </p>
      )}
    </section>
  )
}
