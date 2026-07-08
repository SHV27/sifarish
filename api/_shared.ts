/**
 * Shared serverless helpers. All metered keys live ONLY in process.env here (never VITE_,
 * never in the client bundle). Every function degrades to `{ keyless: true }` when its key
 * is absent, so the app is fully functional with zero keys (I4). Per-run caps enforce I8.
 */

export const config = { runtime: 'edge' }

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

/** Clamp a requested count to a hard per-run ceiling (I8 — never let a sweep overspend). */
export function capRuns(requested: number | undefined, ceiling: number): number {
  const n = Math.floor(Number(requested) || 1)
  return Math.max(1, Math.min(n, ceiling))
}
