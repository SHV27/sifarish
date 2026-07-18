import { db } from '../db/db'
import { runSweep, syncVisionHunts } from './khabri/client'
import { runPulse, pulseDue } from './pulse/client'
import { syncRadar } from './radar/feeds'

/**
 * AUTOPILOT (v3, D34) — the app keeps itself current without being asked. On open, if the
 * discovery sweep is stale (>24h) or the market pulse is due (>7d), they run quietly in the
 * background, budget-capped. It's the "self-evolving, never outdated" promise made real —
 * BUT nothing changes without consent: sweeps only surface NEW roles in the Radar (you tailor),
 * and pulse only proposes rubric tweaks you confirm (the Nabz pattern). Zero silent mutations.
 *
 * Fire-and-forget: failures are swallowed; the app is fully usable whether or not this runs.
 */

// Session 7 (H5/H7): LinkedIn is a continuous feed; a 24h window left the queue a day behind.
// 6h keeps every open fresh while budgets still gate every credit (I8).
const SWEEP_STALE_MS = 6 * 60 * 60 * 1000
// The 32 ATS boards are KEYLESS and board-verified — the freshest source was the least-run one
// (its only caller was a manual button). Autopilot now scans them on open, 6h-cached, ₹0.
const BOARD_SCAN_STALE_MS = 6 * 60 * 60 * 1000
let ranThisSession = false

export async function runAutopilot(): Promise<void> {
  if (ranThisSession) return
  ranThisSession = true

  const settings = await db.settings.get('app').catch(() => undefined)
  if (!settings?.onboarded) return

  // Vision drives the queue (Session 5.6, D68/D85): reconcile his Vision Profile into the hunts on
  // every open BEFORE the sweep — additive + idempotent, so a vision edit made last session takes
  // effect now and his manual hunts are never touched. Then the sweep hunts his queries first.
  await syncVisionHunts(settings.visionProfile).catch(() => {})

  // Stagger so we never fire two credit-spending sweeps at the same instant.
  const sweepStale = !settings.lastSweepAt || Date.now() - new Date(settings.lastSweepAt).getTime() > SWEEP_STALE_MS
  if (sweepStale) {
    runSweep().catch(() => {}) // budget-gated inside; new finds land in the Radar with a NEW stamp
  }

  // Session 7 (H5): the board scan joins the autopilot — keyless, board-verified-open truth
  // (D122/D131) refreshing itself instead of waiting for a manual click. Delayed a touch so it
  // never contends with the sweep's network burst.
  const scanRow = await db.nabzCache.get('radar:lastBoardScan').catch(() => undefined)
  const scanStale = !scanRow || Date.now() - new Date(scanRow.fetchedAt).getTime() > BOARD_SCAN_STALE_MS
  if (scanStale) {
    setTimeout(() => {
      syncRadar()
        .then(() => db.nabzCache.put({ key: 'radar:lastBoardScan', json: '1', fetchedAt: new Date().toISOString() }))
        .catch(() => {})
    }, 2500)
  }

  if (pulseDue(settings.lastPulseAt)) {
    // Delay the pulse a touch so it doesn't contend with the sweep's network burst.
    setTimeout(() => {
      runPulse().catch(() => {})
    }, 4000)
  }

  // Session 7.2 (C12): the reasoning cache had NO pruning — unbounded growth per unique input
  // hash, forever. Keep the newest 500; identical inputs re-cache on their next real call.
  setTimeout(() => {
    void (async () => {
      try {
        const n = await db.dimaagCache.count()
        if (n > 600) {
          const stale = await db.dimaagCache.orderBy('at').limit(n - 500).primaryKeys()
          await db.dimaagCache.bulkDelete(stale)
        }
      } catch {
        /* housekeeping only */
      }
    })()
  }, 8000)
}
