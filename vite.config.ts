import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Re-brief Arc 5: the index chunk crossed Vite's 500KB *minified* heuristic by ~1% (agent
    // registry + emphasis layer). The budget that matters is GZIP over the wire — 162KB, well
    // inside the D16/D42 web-vitals bar — and pdf/docx/pdfjs stay dynamically split. Limit set
    // to 560 so the build stays honestly warning-free without artificial splits of hot paths.
    // v2: the lazy PDF export chunk carries pdf-lib + fontkit (font embedding) — loaded only on export, never on the critical path.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Long-lived vendor chunk (react/dexie change rarely) — better caching + entry under the size gate.
        manualChunks(id: string) {
          if (/node_modules[\\/](react|react-dom|scheduler|dexie|dexie-react-hooks)[\\/]/.test(id)) return 'vendor'
          return undefined
        },
      },
    },
  },
})
