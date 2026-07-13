import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { isOwnerMode } from '../lib/pehchaan'
import {
  fetchRepos,
  computeSuggestions,
  acceptSuggestion,
  dismissSuggestion,
  overviewRepos,
  addRepoToLedger,
  type RateBudget,
  type RepoOverview,
} from '../lib/nabz/github'

/**
 * GITHUB NABZ (D52) — "Your GitHub, deeply read." EVERY public repo is always shown, richly, with
 * its README distilled to a real description + feature bullets + tech stack + live link. Nothing is
 * ever hidden by a past dismiss (that regression is now impossible). Promotions/new work float up as
 * highlights; every untracked repo has a one-click "Add to ledger". The owner confirms every change.
 */

const STATUS: Record<RepoOverview['status'], { label: string; tone: string }> = {
  shipped: { label: 'in ledger · shipped', tone: 'stamp-shipped' },
  in_forge: { label: 'in ledger · forge', tone: 'stamp-forge' },
  pending: { label: 'drafted from README', tone: 'stamp-red' },
  dismissed: { label: 'not in ledger', tone: '' },
  untracked: { label: 'not in ledger', tone: '' },
}

export function NabzPanel() {
  const pending = useLiveQuery(() => db.suggestions.where('status').equals('pending').toArray()) ?? []
  const [overview, setOverview] = useState<RepoOverview[] | null>(null)
  const [budget, setBudget] = useState<RateBudget | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)

  const load = async (force: boolean) => {
    setSyncing(true)
    setErr(null)
    try {
      const { repos, budget: b } = await fetchRepos(force)
      setBudget(b)
      await computeSuggestions(repos) // refresh promotion / attach highlights
      setOverview(await overviewRepos(repos, true, b?.remaining))
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e))
    } finally {
      setSyncing(false)
    }
  }

  // Auto-load on mount so the owner always sees his GitHub without a click (cache-first, fast).
  // Owner-only: Nabz watches HIS GitHub to strengthen HIS ledger — never in the demo showcase.
  useEffect(() => {
    if (isOwnerMode()) void load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const highlights = pending.filter((s) => s.type === 'promotion' || s.type === 'attach_link')

  const addOne = async (o: RepoOverview) => {
    setAdding(o.repo.name)
    try {
      // Pending draft → accept it (keeps the rich drafted bullets); else build + add fresh.
      const draft = pending.find((s) => s.type === 'new_entry' && s.repoName === o.repo.name)
      if (draft) await acceptSuggestion(draft)
      else await addRepoToLedger(o.repo)
      const { repos } = await fetchRepos(false)
      setOverview(await overviewRepos(repos, true))
    } finally {
      setAdding(null)
    }
  }

  const toggle = (name: string) => setExpanded((s) => {
    const n = new Set(s)
    n.has(name) ? n.delete(name) : n.add(name)
    return n
  })

  const untrackedCount = overview?.filter((o) => o.status === 'untracked' || o.status === 'dismissed').length ?? 0

  // Nabz is owner-only: it watches Shaurya's real GitHub. The demo showcase never shows it.
  if (!isOwnerMode()) return null

  return (
    <section className="dossier p-4 mt-2" aria-label="GitHub Nabz">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display font-semibold text-lg text-ink">
            GitHub Nabz <span className="font-devanagari text-sm text-stamp">नब्ज़</span>
            <span className="text-ink-soft font-normal"> — your GitHub, deeply read</span>
          </h2>
          <p className="text-xs text-ink-soft">
            Every public repo, read to the README — one click adds any of them to your ledger.
            {untrackedCount > 0 && <span className="text-ink font-medium"> {untrackedCount} not in your ledger yet.</span>}
          </p>
        </div>
        <button className="shrink-0 bg-ink text-paper font-semibold text-xs px-3 py-2 rounded disabled:opacity-50" onClick={() => void load(true)} disabled={syncing}>
          {syncing ? 'Reading…' : 'Sync'}
        </button>
      </div>
      {budget && <p className="mt-1 font-mono text-[10px] text-ink-soft">GitHub budget {budget.remaining}/{budget.limit} req left</p>}
      {err && <p className="mt-2 text-xs text-stamp">{err}</p>}

      {/* Highlights: promotions + link attaches — "the truth caught up" moments */}
      {highlights.length > 0 && (
        <ul className="mt-3 space-y-2">
          {highlights.map((s) => (
            <li key={s.id} className="dossier p-3 border-l-4 border-l-forge">
              <div className="flex items-start gap-2">
                <span className={`stamp shrink-0 !text-[10px] ${s.type === 'promotion' ? 'stamp-forge' : 'stamp-shipped'}`}>{s.type === 'promotion' ? 'promote' : 'link'}</span>
                <p className="text-xs text-ink leading-relaxed flex-1">{s.why}</p>
              </div>
              <div className="mt-1.5 flex items-center gap-3 pl-1">
                <button className="text-xs font-semibold text-shipped hover:underline" onClick={() => acceptSuggestion(s)}>{s.type === 'promotion' ? 'Stamp it shipped ✓' : 'Attach link ✓'}</button>
                <button className="text-xs text-ink-soft hover:underline" onClick={() => dismissSuggestion(s.id)}>Not now</button>
                <a className="text-xs font-mono text-ink underline decoration-dotted ml-auto" href={s.repoUrl} target="_blank" rel="noreferrer">{s.repoName} ↗</a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Every repo, always, deeply read */}
      <div className="mt-3 space-y-2">
        {overview === null ? (
          <p className="text-xs text-ink-soft">{syncing ? 'Reading your repositories…' : 'Loading…'}</p>
        ) : (
          overview.map((o) => {
            const d = o.distilled
            const open = expanded.has(o.repo.name)
            // Anything not already in the ledger can be added inline (untracked / dismissed / drafted).
            const canAdd = o.status === 'untracked' || o.status === 'dismissed' || o.status === 'pending'
            const live = o.repo.homepage || d?.liveUrl
            return (
              <div key={o.repo.name} className="ledger-rule pt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <a className="font-mono text-sm font-semibold text-ink underline decoration-dotted" href={o.repo.html_url} target="_blank" rel="noreferrer">{o.repo.name}</a>
                  <span className={`stamp !text-[9px] !rotate-0 ${STATUS[o.status].tone}`}>{o.ledgerTitle ? `in ledger — ${o.ledgerTitle}` : STATUS[o.status].label}</span>
                  {o.repo.language && <span className="font-mono text-[10px] text-ink-soft">{o.repo.language}</span>}
                  {canAdd && (
                    <button className="ml-auto shrink-0 text-[11px] font-semibold bg-ink text-paper px-2.5 py-1 rounded disabled:opacity-50" disabled={adding === o.repo.name} onClick={() => void addOne(o)}>
                      {adding === o.repo.name ? 'adding…' : o.status === 'pending' ? 'Add to ledger ✓' : '+ Add to ledger'}
                    </button>
                  )}
                </div>
                {d?.summary && <p className="text-[11px] text-ink-soft leading-relaxed mt-1">{d.summary}</p>}
                {d && (d.bullets.length > 0 || d.stack.length > 0) && (
                  <>
                    <button className="text-[10px] text-ink-soft hover:underline mt-0.5" onClick={() => toggle(o.repo.name)}>
                      {open ? 'hide details' : 'deep details'}
                    </button>
                    {open && (
                      <div className="mt-1 pl-2 border-l border-ink-wash">
                        {d.stack.length > 0 && <p className="text-[10px] text-ink-soft mb-1">stack: <span className="font-mono">{d.stack.join(' · ')}</span></p>}
                        <ul className="space-y-0.5">
                          {d.bullets.map((b, i) => (
                            <li key={i} className="text-[11px] text-ink-soft leading-relaxed">– {b}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
                <p className="font-mono text-[10px] text-ink-faint mt-0.5">
                  {live && (
                    <a className="text-shipped underline decoration-dotted mr-2" href={live.startsWith('http') ? live : `https://${live}`} target="_blank" rel="noreferrer">live ↗</a>
                  )}
                  pushed {o.repo.pushed_at?.slice(0, 10)}
                  {d && !d.hasReadme && ' · no README'}
                </p>
              </div>
            )
          })
        )}
      </div>

    </section>
  )
}
