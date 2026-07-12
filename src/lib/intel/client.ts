import { db } from '../../db/db'
import type { CompanyIntel, IntelBullet } from '../../types'
import { recordSpend } from '../budget'
import { meteredCallsAllowed, meteredHeaders } from '../apiGuard'

/**
 * Company Intel client. Fetches cited intel (I7), caches 7 days per company. Intel changes
 * the packet's EMPHASIS and the cover-letter hook — never a claim (I1 stands). Keyless-safe.
 */

const CACHE_DAYS = 7

export async function getIntel(company: string, force = false): Promise<CompanyIntel> {
  const key = company.trim().toLowerCase()
  const cached = await db.intel.get(key)
  if (!force && cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_DAYS * 86400000) {
    return cached
  }

  // Darshak/demo: cached intel above is free to read; a FRESH fetch spends Tavily — owner only (D44).
  if (!meteredCallsAllowed()) {
    return cached ?? { company: key, bullets: [], fetchedAt: new Date().toISOString(), keyless: true }
  }

  let bullets: IntelBullet[] = []
  let keyless = true
  try {
    const res = await fetch('/api/intel', {
      method: 'POST',
      headers: meteredHeaders(),
      body: JSON.stringify({ company }),
    })
    if (res.ok) {
      const data = (await res.json()) as { keyless: boolean; bullets: IntelBullet[]; creditsSpent?: number }
      keyless = data.keyless
      bullets = data.bullets ?? []
      if (!data.keyless && data.creditsSpent) await recordSpend('tavily', data.creditsSpent)
    }
  } catch {
    keyless = true
  }

  const intel: CompanyIntel = { company: key, bullets, fetchedAt: new Date().toISOString(), keyless }
  // Only cache a real (non-keyless, non-empty) result so a keyless run doesn't poison the cache.
  if (!keyless && bullets.length > 0) await db.intel.put(intel)
  return intel
}

/**
 * Pick one concrete, cited company fact for the cover-letter hook. Returns null in keyless
 * mode → the compiler uses its generic (still honest) hook, exactly as v1.
 */
export function hookFromIntel(intel: CompanyIntel | undefined): IntelBullet | null {
  if (!intel || intel.keyless || intel.bullets.length === 0) return null
  // Prefer a bullet mentioning AI/LLM/engineering — most relevant to Shaurya's pitch.
  return (
    intel.bullets.find((b) => /\b(ai|llm|agent|engineer|research|model|ml)\b/i.test(b.text)) ?? intel.bullets[0]
  )
}
