/**
 * /api/gh — GitHub read proxy (Session 5.4, D86). The reason it exists: a DIRECT browser fetch to
 * api.github.com logs a red "Failed to load resource: 404/403" in the console whenever a repo has
 * no README (404) or the 60/hr unauth limit is hit (403). JS cannot suppress that browser-level
 * line — the only cure is to not let the browser make the failing request. So Nabz now calls this
 * proxy, which fetches server-side and returns a clean 200 with { readme:null } or a rate flag. The
 * browser never sees a GitHub 4xx, so the console stays truly empty ("terminate every error").
 *
 * Bonus: server-side it uses GITHUB_PAT (5000/hr) instead of the browser's anonymous 60/hr, so
 * Nabz is far less likely to rate-limit at all. Keyless-safe: with no PAT it falls back to
 * anonymous GitHub and still works. Path is a FIXED allowlist (this owner's repos + readmes only),
 * so it can never be used as an open GitHub proxy.
 *
 * GET only, no Origin gate: browsers omit Origin on same-origin GET, so gating it would 403 the
 * owner's own reads (the D55 lesson). It exposes only public read data — nothing to protect.
 */

export const config = { runtime: 'edge' }

const USER = 'SHV27'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function ghHeaders(accept: string): Record<string, string> {
  const h: Record<string, string> = { Accept: accept, 'User-Agent': 'sifarish-nabz' }
  const pat = process.env.GITHUB_PAT
  if (pat) h.Authorization = `Bearer ${pat}`
  return h
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const kind = url.searchParams.get('kind')

  try {
    if (kind === 'repos') {
      const res = await fetch(`https://api.github.com/users/${USER}/repos?sort=pushed&per_page=100`, {
        headers: ghHeaders('application/vnd.github+json'),
      })
      const budget = {
        remaining: Number(res.headers.get('x-ratelimit-remaining') ?? '0'),
        limit: Number(res.headers.get('x-ratelimit-limit') ?? '60'),
        resetAt: Number(res.headers.get('x-ratelimit-reset') ?? '0') * 1000,
      }
      if (!res.ok) return json({ ok: false, rateLimited: res.status === 403, status: res.status, budget })
      const repos = await res.json()
      return json({ ok: true, repos, budget })
    }

    if (kind === 'readme') {
      const repo = (url.searchParams.get('repo') ?? '').replace(/[^\w.-]/g, '')
      if (!repo) return json({ ok: false, status: 400 })
      const res = await fetch(`https://api.github.com/repos/${USER}/${repo}/readme`, {
        headers: ghHeaders('application/vnd.github.raw+json'),
      })
      // A repo with no README is a clean, expected outcome — not an error the browser should log.
      if (res.status === 404) return json({ ok: true, readme: null })
      if (!res.ok) return json({ ok: false, rateLimited: res.status === 403, status: res.status })
      const readme = await res.text()
      return json({ ok: true, readme })
    }

    // Session 7.2 (C8): repo-existence probe for the Baithak's attach-link liveness check —
    // the browser used to hit api.github.com directly, re-introducing the exact console-4xx
    // class this proxy was built to kill (and burning the 60/hr anonymous budget).
    if (kind === 'repo') {
      const repo = (url.searchParams.get('repo') ?? '').replace(/[^\w.-]/g, '')
      if (!repo) return json({ ok: false, status: 400 })
      const res = await fetch(`https://api.github.com/repos/${USER}/${repo}`, {
        headers: ghHeaders('application/vnd.github+json'),
      })
      return json({ ok: true, alive: res.ok })
    }

    return json({ ok: false, status: 400, error: 'unknown kind' })
  } catch {
    // Network hiccup server-side → tell the client to fall back to cache; never throw at the user.
    return json({ ok: false, status: 0 })
  }
}
