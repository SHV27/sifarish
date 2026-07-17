import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { LedgerEntry } from '../types'
import { FORGE_VERSION } from '../lib/nabz/forge'
import { fetchRepos, refreshEntryFromRepo, type GhRepo } from '../lib/nabz/github'
import { useDarbaan } from './DarbaanControl'

/**
 * THE VAULT REPAIR (Session 6.1) — the missing half of every forge improvement. The tailor's
 * craft ships as code; his bullets live as DATA in his browser, and local-first means no deploy
 * can touch them (D59). Until now the repair path was a button buried in Nabz that he had to know
 * about — which is how a vault full of pre-repair bullets kept compiling pre-repair résumés while
 * every gate glowed green. This banner closes the loop: when the forge craft is newer than the
 * bullets in his vault, the landing screen SAYS so and repairs it in one confirmed click —
 * spaced (D73: a batch that outruns the free tier downgrades itself), never silently, his
 * titles/tiers/edits untouched.
 */

/** Pure + gate-tested: which repo-backed projects were last forged by an older craft (or never)? */
export function needsReforge(ledger: LedgerEntry[]): LedgerEntry[] {
  return ledger.filter(
    (e) => e.kind === 'project' && e.resumeEligible && !!e.evidence?.repo && (e.forgeVersion ?? 0) < FORGE_VERSION,
  )
}

const repoNameFromUrl = (u?: string): string => {
  const m = /github\.com\/[^/]+\/([^/#?]+)/i.exec(u ?? '')
  return (m?.[1] ?? '').toLowerCase()
}

export default function RepairBanner() {
  const owner = useDarbaan()
  const ledger = useLiveQuery(() => db.ledger.toArray()) ?? []
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [done, setDone] = useState<string | null>(null)

  if (!owner) return null
  const stale = needsReforge(ledger)
  if (stale.length === 0 && !done) return null

  const run = async () => {
    setRunning(true)
    setDone(null)
    try {
      const { repos } = await fetchRepos(true)
      const byName = new Map<string, GhRepo>(repos.map((r) => [r.name.toLowerCase(), r]))
      let upgraded = 0
      let waiting = 0
      const targets = needsReforge(await db.ledger.toArray())
      for (let i = 0; i < targets.length; i++) {
        const e = targets[i]
        const repo = byName.get(repoNameFromUrl(e.evidence?.repo))
        if (!repo) continue
        setProgress(`${i + 1}/${targets.length} — re-forging ${e.title.split('—')[0].trim()}…`)
        const r = await refreshEntryFromRepo(repo).catch(() => null)
        if (r?.ok && r.by === 'dimaag') {
          upgraded++
          // D73's law inside the app: a real LLM pass breathes before the next repo, so the batch
          // never trips the per-minute limit and downgrades itself.
          if (i < targets.length - 1) {
            setProgress(`${i + 1}/${targets.length} done — pacing for the token window…`)
            await new Promise((res) => setTimeout(res, 15000))
          }
        } else {
          waiting++
        }
      }
      await db.settings.update('app', { lastReforgeAt: new Date().toISOString() })
      setDone(
        waiting === 0
          ? `${upgraded} project${upgraded === 1 ? '' : 's'} re-forged with the new tailor. Open any packet — it recompiles itself with the new bullets.`
          : `${upgraded} re-forged; ${waiting} hit the per-minute token window and stayed UNTOUCHED (never downgraded). Run this again in a minute — the finished ones are cached and instant.`,
      )
    } finally {
      setRunning(false)
      setProgress('')
    }
  }

  return (
    <section className="dossier p-4 mb-4 border-l-4 border-l-stamp" aria-label="Vault repair">
      {done ? (
        <p className="text-sm text-ink">
          <span className="stamp stamp-shipped !text-[9px] mr-2">repaired</span>
          {done}
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              The tailor learned new craft — {stale.length} project{stale.length === 1 ? '' : 's'} in your ledger still carr{stale.length === 1 ? 'ies' : 'y'} old bullets.
            </p>
            <p className="text-xs text-ink-soft mt-0.5 leading-snug">
              One click re-reads each README and re-forges the bullets (numbers carried, market vocabulary,
              reader-test framing). Your titles, tiers and hand edits are never touched; a rate-limited pass
              leaves the entry as-is instead of downgrading it.
            </p>
          </div>
          <button
            className="shrink-0 bg-stamp text-paper font-semibold text-sm px-4 py-2 rounded hover:opacity-90 disabled:opacity-60"
            onClick={run}
            disabled={running}
          >
            {running ? progress || 'Re-forging…' : `Re-forge ${stale.length} project${stale.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </section>
  )
}
