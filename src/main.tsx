import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import App from './App'
import { seedIfEmpty, backfillV2 } from './db/seed'
import { loadLibraryOverride } from './lib/ustaad/library'

seedIfEmpty()
  .then(() => backfillV2())
  .then(() => loadLibraryOverride()) // Ustaad: an accepted Pulse library update wins over the bundled copy (I13)
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
