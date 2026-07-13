import { StrictMode, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import App from './App'
import { seedIfEmpty, backfillV2 } from './db/seed'
import { loadLibraryOverride } from './lib/ustaad/library'
import { requestDurableStorage, restoreOnEmptyIfNeeded, autoBackup } from './db/tijori'
import { onOwnerMutation } from './db/db'
import { isOwnerMode } from './lib/pehchaan'

// PEHCHAAN has already resolved the mode synchronously (module load) and db.ts opened the right
// vault. Boot pipeline runs in PARALLEL with the first render (seed off the critical path).
let booted = false
const bootListeners = new Set<() => void>()

async function boot() {
  // Owner vault: request durable storage FIRST (the reproduced data-loss root — FIX-2), then
  // restore from an encrypted backup if the store was evicted/emptied, before seeding.
  if (isOwnerMode()) {
    await requestDurableStorage()
    await restoreOnEmptyIfNeeded()
  }
  await seedIfEmpty()
  await backfillV2()
  await loadLibraryOverride() // Ustaad: an accepted Pulse library update wins over the bundled copy (I13)

  // Auto-backup after owner edits (debounced) — his work is never one glitch from gone.
  if (isOwnerMode()) {
    let timer: ReturnType<typeof setTimeout> | undefined
    onOwnerMutation(() => {
      clearTimeout(timer)
      timer = setTimeout(() => void autoBackup(), 2500)
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
