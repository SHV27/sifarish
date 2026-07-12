import { StrictMode, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import App from './App'
import { seedIfEmpty, backfillV2 } from './db/seed'
import { loadLibraryOverride } from './lib/ustaad/library'
import { restoreDarbaan } from './lib/darbaan/lock'

restoreDarbaan() // Darbaan: per-device Owner Mode unlock survives reloads; visitors stay in Darshak

// Boot pipeline runs in PARALLEL with the first render (seed time off the critical path —
// Lighthouse LCP). Until it settles, React shows the same splash the static HTML painted,
// so the swap is pixel-stable (zero layout shift).
let booted = false
const bootListeners = new Set<() => void>()
seedIfEmpty()
  .then(() => backfillV2())
  .then(() => loadLibraryOverride()) // Ustaad: an accepted Pulse library update wins over the bundled copy (I13)
  .finally(() => {
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
