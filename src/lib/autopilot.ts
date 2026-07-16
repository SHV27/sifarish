import { db } from '../db/db'
import { runSweep, syncVisionHunts } from './khabri/client'
import { runPulse, pulseDue } from './pulse/client'

/**
 * AUTOPILOT (v3, D34) — the app keeps itself current without being asked. On open, if the
 * discovery sweep is stale (>24h) or the market pulse is due (>7d), they run quietly in the
 * background, budget-capped. It's the "self-evolving, never outdated" promise made real —
 * BUT nothing changes without consent: sweeps only surface NEW roles in the Radar (you tailor),
 * and pulse only proposes rubric tweaks you confirm (the Nabz pattern). Zero silent mutations.
 *
 * Fire-and-forget: failures are swallowed; the app is fully usable whether or not this runs.
 */

const SWEEP_STALE_MS = 24 * 60 * 60 * 1000
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

  if (pulseDue(settings.lastPulseAt)) {
    // Delay the pulse a touch so it doesn't contend with the sweep's network burst.
    setTimeout(() => {
      runPulse().catch(() => {})
    }, 4000)
  }
}
