import { db } from '../db/db'
import { proposeHuntEdits, runSweep, syncVisionHunts } from './khabri/client'
import { runPulse, pulseDue } from './pulse/client'
import { syncRadar } from './radar/feeds'
import { catchAs } from './boundary'

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
  await syncVisionHunts(settings.visionProfile).catch((e) => catchAs('provider', 'autopilot.visionSync', e))

  // Final Jang W4a — the RETIRE half joins the default path (it only ever ran from a manual
  // Settings edit, so a vision outgrown between sessions left stale derived hunts running
  // forever — the D69 wiring disease, final instance). Idempotent (proposed-once per hunt id),
  // human-confirmed (Pulse brief), hand-set hunts untouchable (D59). Zero budget, zero key.
  await proposeHuntEdits(settings.visionProfile).catch((e) => catchAs('provider', 'autopilot.huntRetire', e))

  // Stagger so we never fire two credit-spending sweeps at the same instant.
  const sweepStale = !settings.lastSweepAt || Date.now() - new Date(settings.lastSweepAt).getTime() > SWEEP_STALE_MS
  if (sweepStale) {
    runSweep().catch((e) => catchAs('provider', 'autopilot.sweep', e)) // budget-gated inside; NEW stamps land in the Radar
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
        .catch((e) => catchAs('provider', 'autopilot.boardScan', e))
    }, 2500)
  }

  if (pulseDue(settings.lastPulseAt)) {
    // Delay the pulse a touch so it doesn't contend with the sweep's network burst.
    setTimeout(() => {
      runPulse().catch((e) => catchAs('provider', 'autopilot.pulse', e))
    }, 4000)
  }

  // Studio W3 (AUDIT Class F): SIX tables grew monotonically and every byte rode the encrypted
  // sync blob forever. pruneAll bounds signals/dak/pulse/usage/errlog/dimaagCache — infra rows
  // only, his story data never.
  setTimeout(() => {
    import('./kv').then((m) => m.pruneAll()).catch((e) => catchAs('provider', 'autopilot.prune', e))
  }, 8000)
}
