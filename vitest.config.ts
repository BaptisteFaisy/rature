import { defineConfig } from 'vitest/config'

// Tests de logique pure : domaine, pipeline (avec client simulé), quota du
// proxy, exports. Aucun réseau, aucun DOM.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts', 'api/**/*.test.ts'],
  },
})
