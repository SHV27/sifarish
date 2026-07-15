import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
    setupFiles: ['tests/setup.ts'],
    // The default `threads` pool fails to initialise its worker runner under Vite 8 (Rolldown) +
    // Node 24 on Windows — every file errors at describe() with "failed to find the runner" while
    // each file passes in isolation. `forks` is stable here and faster (8s vs 38s serial). The app
    // is unaffected; this only concerns how the harness spawns workers. (Session 5.5 infra)
    pool: 'forks',
  },
})
