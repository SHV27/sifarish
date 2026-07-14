import { StrictMode, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import App from './App'
import { seedIfEmpty, backfillV2 } from './db/seed'
import { loadLibraryOverride } from './lib/ustaad/library'
import { requestDurableStorage, restoreOnEmptyIfNeeded, autoBackup } from './db/tijori'
import { pullVault, pushVault, markLocalEdit } from './lib/sync'
import { onOwnerMutation } from './db/db'
import { isOwnerMode } from './lib/pehchaan'

// PEHCHAAN has already resolved the mode synchronously (module load) and db.ts opened the right
// vault. Boot pipeline runs in PARALLEL with the first render (seed off the critical path).
let booted = false
const bootListeners = new Set<() => void>()

async function boot() {
  // Owner vault: request durable storage FIRST (the reproduced data-loss root — FIX-2). Then, in
  // order and each FAIL-SAFE (never wipes local): pull the cloud vault (a fresh device gets his real
  // data instead of a reset), then a local-backup restore-on-empty, then seed only if STILL empty.
  if (isOwnerMode()) {
    await requestDurableStorage()
    const pulled = await pullVault().catch(() => ({ restored: false }))
    if (!pulled.restored) await restoreOnEmptyIfNeeded()
  }
  await seedIfEmpty()
  await backfillV2()
  await loadLibraryOverride() // Ustaad: an accepted Pulse library update wins over the bundled copy (I13)

  if (isOwnerMode()) {
    // Make sure the cloud has this device's latest (idempotent if we just pulled; best-effort).
    void pushVault().catch(() => {})
    // After owner edits (debounced): local encrypted backup + bump the sync version + push to cloud.
    let timer: ReturnType<typeof setTimeout> | undefined
    onOwnerMutation(() => {
      markLocalEdit()
      clearTimeout(timer)
      timer = setTimeout(() => {
        void autoBackup()
        void pushVault()
      }, 2500)
    })
  }
}

boot().finally(() => {
  booted = true
  for (const l of bootListeners) l()
})

function useBooted(): boolean {
  return useSyncExternalStore(
    (cb) => {
      bootListeners.add(cb)
      return () => bootListeners.delete(cb)
    },
    () => booted,
    () => false,
  )
}

function Root() {
  const ready = useBooted()
  if (!ready) {
    return (
      <div className="boot-splash">
        <h1>SIFARISH · सिफ़ारिश</h1>
        <p>Compile truth. Draft everything. Send nothing. — opening the daftar…</p>
      </div>
    )
  }
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
