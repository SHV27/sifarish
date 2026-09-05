import { db } from '../../db/db'
import { distillReadme, fetchReadme, type GhRepo } from '../nabz/github'
import { buildContext } from '../nabz/forge'

/**
 * v2 THE DOSSIER — README re-absorb.
 *
 * "I want sifarish to have deep readme knowledge of every project … unhe deeply padhe." His READMEs
 * are the asset; they change as he ships. This re-reads every repo-linked project's README into
 * its `context` (problem, features, stack, prose, readAt) — the strategist's reading material —
 * and NEVER touches his bullets, summary or title (the silent-downgrade guard of Session 6.1
 * stands: content is his; context is source material). Keyless for public repos via /api/gh's
 * cached lane; a failed fetch keeps the last context, stamped with its readAt.
 */

const REFRESH_FLAG = 'dossier:readme-refresh'
const REFRESH_STALE_MS = 30 * 86400000

function repoOf(url: string): GhRepo | null {
  const m = /github\.com\/([^/]+)\/([^/#?]+)/i.exec(url)
  if (!m) return null
  const name = m[2].replace(/\.git$/, '')
  return { name, html_url: `https://github.com/${m[1]}/${name}`, description: '', pushed_at: new Date().toISOString(), language: null, fork: false, size: 0, homepage: null } as unknown as GhRepo
}

export interface RefreshSummary {
  refreshed: number
  skipped: number
  names: string[]
}

/** Refresh the README context of every repo-linked project. Bullets/summary/title untouched. */
export async function refreshProjectContexts(): Promise<RefreshSummary> {
  const ledger = await db.ledger.toArray()
  let refreshed = 0
  let skipped = 0
  const names: string[] = []
  for (const e of ledger.filter((x) => x.kind === 'project' && (x.evidence?.repo || /github\.com\//i.test(x.evidence?.url ?? '')))) {
    const repo = repoOf(e.evidence!.repo ?? e.evidence!.url!)
    if (!repo) {
      skipped++
      continue
    }
    const readme = await fetchReadme(repo.name).catch(() => null)
    const distilled = readme ? distillReadme(readme) : null
    const ctx = buildContext(repo, distilled)
    if (!ctx) {
      skipped++
      continue
    }
    await db.ledger.update(e.id, { context: { ...ctx, source: { ...ctx.source, repo: repo.html_url } } })
    refreshed++
    names.push(repo.name)
  }
  await db.nabzCache.put({ key: REFRESH_FLAG, json: JSON.stringify({ refreshed, skipped }), fetchedAt: new Date().toISOString() })
  return { refreshed, skipped, names }
}

/** True when no refresh ran in the last 30 days (the autopilot's monthly re-read). */
export async function readmeRefreshDue(): Promise<boolean> {
  const row = await db.nabzCache.get(REFRESH_FLAG).catch(() => undefined)
  return !row || Date.now() - new Date(row.fetchedAt).getTime() > REFRESH_STALE_MS
}
