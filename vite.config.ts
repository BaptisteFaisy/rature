import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Webapp statique : le build va dans dist/, servi par Vercel (ou n'importe quel
// hébergeur statique). Aucune variable secrète n'entre dans le bundle : la clé
// InferHub vit dans le proxy (`api/`).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    sourcemap: false,
    // RNF-07 : bundle initial < 300 Ko gzip. On découpe pour que l'accueil
    // (le seul écran du premier rendu) reste léger.
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts', 'api/**/*.test.ts'],
  },
})
