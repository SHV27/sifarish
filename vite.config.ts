import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
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
