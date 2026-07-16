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
  refreshEntryFromRepo,
  removeRepolessProjects,
  repolessProjectNames,
  type RateBudget,
  type RepoOverview,
} from '../lib/nabz/github'

/**
 * GITHUB NABZ (D52) — "Your GitHub, deeply read." EVERY public repo is always shown, richly, with
 * its README distilled to a real description + feature bullets + tech stack + live link. Nothing is
 * ever hidden by a past dismiss (that regression is now impossible). Promotions/new work float up as
 * highlights; every untracked repo has a one-click "Add to ledger". The owner confirms every change.
 */

export function NabzPanel() {
  const pending = useLiveQuery(() => db.suggestions.where('status').equals('pending').toArray()) ?? []
  const [overview, setOverview] = useState<RepoOverview[] | null>(null)
  const [budget, setBudget] = useState<RateBudget | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)
  const [showInLedger, setShowInLedger] = useState(false)
  const [reforging, setReforging] = useState<string | null>(null)
  const [reforgeNote, setReforgeNote] = useState<string | null>(null)
  const [tidyNote, setTidyNote] = useState<string | null>(null)
  const [confirmTidy, setConfirmTidy] = useState(false)
  // Live count of projects with no linked repo — the thin ones the owner wants out for now (D91).
  const repolessNames = useLiveQuery(() => repolessProjectNames()) ?? []

  const tidyRepoless = async () => {
    const r = await removeRepolessProjects()
    setConfirmTidy(false)
    setTidyNote(
      r.removed.length > 0
        ? `Removed ${r.removed.length} project(s) with no repo yet: ${r.removed.join(', ')}. They'll come back the moment you add their repo and re-forge.`
        : 'Nothing to remove — every project already has a linked repo.',
    )
  }

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

  /**
   * Re-read a repo's README and re-forge its ledger bullets (D56). This is the repair path for
   * entries drafted by the old paste-the-README-scraps Nabz: it replaces only what Nabz owns
   * (summary / bullets / context / live link) and leaves every hand-curated field alone.
   */
  const reforgeOne = async (o: RepoOverview) => {
    setReforging(o.repo.name)
    setReforgeNote(null)
    try {
      const r = await refreshEntryFromRepo(o.repo)
      setReforgeNote(r.note)
    } catch (e) {
      setReforgeNote(`Could not re-read ${o.repo.name}: ${e instanceof Error ? e.message : String(e)}. Your entry is untouched.`)
    } finally {
      setReforging(null)
    }
  }

  const reforgeAll = async (repos: RepoOverview[]) => {
    setReforging('*')
    setReforgeNote(null)
    let fixed = 0
    let skipped = 0
    let degraded = 0 // ok, but the smart path was rate-limited and the deterministic path was used
    for (const o of repos) {
      try {
        const r = await refreshEntryFromRepo(o.repo)
        if (r.ok) {
          fixed++
          if (r.by === 'deterministic') degraded++
        } else skipped++
      } catch {
        skipped++
      }
    }
    setReforging(null)
    setReforgeNote(
      `Re-forged ${fixed} entr${fixed === 1 ? 'y' : 'ies'} from their READMEs${skipped ? ` · ${skipped} skipped (no README or nothing bullet-worthy)` : ''}. Your titles, tiers and edits are untouched.` +
        (degraded > 0
          ? ` ${degraded} used the keyless path (Groq's per-minute token limit was hit) — click "Re-forge all" again in a minute to upgrade ${degraded === 1 ? 'it' : 'them'} with the smart path; the already-forged ones are cached and instant.`
          : ''),
    )
  }

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

  // Split so the list never congests: actionable repos (not in ledger) get full cards; repos
  // already shipped/in-forge collapse into one compact line (why waste the space).
  const notInLedger = (overview ?? []).filter((o) => o.status !== 'shipped' && o.status !== 'in_forge')
  const inLedger = (overview ?? []).filter((o) => o.status === 'shipped' || o.status === 'in_forge')
  const untrackedCount = notInLedger.length

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

      {/*
        RE-FORGE, FRONT AND CENTRE (Session 5.4) — this is the single action that upgrades every
        thin project bullet to a real, README-forged one. It used to hide behind a "show N repos"
        toggle at the very bottom and the owner literally could not find it ("aisa koi button nahi
        mila"). A fix nobody can reach is not a fix. It now sits at the top, always visible.
      */}
      {inLedger.length > 0 && (
        <div className="mt-3 dossier border-l-4 border-l-forge p-3 bg-paper-raised/40">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[12rem]">
              <p className="text-sm font-semibold text-ink">Make every project deep ⟳</p>
              <p className="text-[11px] text-ink-soft leading-relaxed mt-0.5">
                Re-reads each linked repo's full README and forges proper, evidence-true résumé
                bullets — the difference between a one-line stub and the depth the tailor needs.
                Your titles, tiers and hand-edits stay untouched.
              </p>
            </div>
            <button
              className="shrink-0 bg-stamp text-paper font-semibold text-xs px-4 py-2.5 rounded hover:opacity-90 disabled:opacity-50"
              disabled={reforging !== null}
              onClick={() => void reforgeAll(inLedger)}
            >
              {reforging === '*' ? 'Re-forging…' : `⟳ Re-forge all ${inLedger.length} projects`}
            </button>
          </div>
          {reforgeNote && <p className="mt-2 text-[11px] text-shipped leading-relaxed">{reforgeNote}</p>}

          {/* Tidy up: drop projects with no repo yet, so only real repo-backed work shows (D91). */}
          {repolessNames.length > 0 && (
            <div className="mt-2 pt-2 ledger-rule">
              {!confirmTidy ? (
                <button className="text-[11px] text-ink-soft hover:text-stamp underline decoration-dotted" onClick={() => setConfirmTidy(true)}>
                  Tidy up — remove {repolessNames.length} project(s) with no repo yet ({repolessNames.join(', ')})
                </button>
              ) : (
                <div className="text-[11px] text-ink">
                  <p className="mb-1.5">
                    Remove <span className="font-mono">{repolessNames.join(', ')}</span>? They render thin because Nabz has no README to
                    forge from. They come back the instant you add their repo and re-forge — nothing is lost for good.
                  </p>
                  <div className="flex gap-2">
                    <button className="text-[11px] font-semibold bg-stamp text-paper px-2.5 py-1 rounded" onClick={() => void tidyRepoless()}>
                      Yes, remove them
                    </button>
                    <button className="text-[11px] text-ink-soft hover:underline" onClick={() => setConfirmTidy(false)}>
                      Keep them
                    </button>
                  </div>
                </div>
              )}
              {tidyNote && <p className="mt-1.5 text-[11px] text-shipped leading-relaxed">{tidyNote}</p>}
            </div>
          )}
        </div>
      )}

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

      {/* NOT in the ledger yet — the actionable repos get the full deep-read card. */}
      <div className="mt-3 space-y-2">
        {overview === null ? (
          <p className="text-xs text-ink-soft">{syncing ? 'Reading your repositories…' : 'Loading…'}</p>
        ) : notInLedger.length === 0 ? (
          <p className="text-xs text-ink-soft">Every public repo is already in your ledger. The truth is in sync. ✓</p>
        ) : (
          notInLedger.map((o) => {
            const d = o.distilled
            const open = expanded.has(o.repo.name)
            const live = o.repo.homepage || d?.liveUrl
            return (
              <div key={o.repo.name} className="ledger-rule pt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <a className="font-mono text-sm font-semibold text-ink underline decoration-dotted" href={o.repo.html_url} target="_blank" rel="noreferrer">{o.repo.name}</a>
                  {o.repo.language && <span className="font-mono text-[10px] text-ink-soft">{o.repo.language}</span>}
                  <button className="ml-auto shrink-0 text-[11px] font-semibold bg-ink text-paper px-2.5 py-1 rounded disabled:opacity-50" disabled={adding === o.repo.name} onClick={() => void addOne(o)}>
                    {adding === o.repo.name ? 'adding…' : '+ Add to ledger'}
                  </button>
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

      {/* Already in the ledger — collapsed to one compact line so it never congests the list. */}
      {inLedger.length > 0 && (
        <div className="mt-3 ledger-rule pt-2">
          <button className="text-[11px] text-ink-soft hover:underline" onClick={() => setShowInLedger((v) => !v)}>
            {showInLedger ? 'hide' : 'show'} {inLedger.length} repo{inLedger.length === 1 ? '' : 's'} already in your ledger ✓
          </button>
          {showInLedger && (
            <div className="mt-1.5">
              <p className="text-[10px] text-ink-soft mb-1.5">
                Tap ⟳ on any one repo to re-forge just it (or use “Re-forge all” above).
              </p>
              <div className="flex flex-wrap gap-1.5">
                {inLedger.map((o) => (
                  <span key={o.repo.name} className="inline-flex items-center gap-1 bg-paper-sunken/60 rounded px-2 py-1" title={o.ledgerTitle}>
                    <a href={o.repo.html_url} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-ink hover:underline">
                      {o.repo.name} <span className={o.status === 'shipped' ? 'text-shipped' : 'text-forge'}>{o.status === 'shipped' ? '✓' : '⋯'}</span>
                    </a>
                    <button
                      className="text-[10px] text-ink-soft hover:text-ink hover:underline disabled:opacity-40"
                      disabled={reforging !== null}
                      title={`Re-read ${o.repo.name}'s README and re-forge its bullets`}
                      onClick={() => void reforgeOne(o)}
                    >
                      {reforging === o.repo.name ? '…' : '⟳'}
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
