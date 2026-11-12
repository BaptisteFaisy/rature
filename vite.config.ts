import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite n'embarque pas les types Node : on déclare le seul accès utile.
declare const process: { env: Record<string, string | undefined> }

// Webapp statique : le build va dans dist/, servi par GitHub Pages (ou
// n'importe quel hébergeur statique). Aucune variable secrète n'entre dans le
// bundle : la clé InferHub vit dans le proxy (`api/`).
export default defineConfig({
  // GitHub Pages sert le site sous /rature/ ; en local et sur un hôte racine,
  // la base reste '/'. Le workflow pages.yml pose VITE_BASE=/rature/.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    sourcemap: false,
    // RNF-07 : bundle initial < 300 Ko gzip. On découpe le socle React pour
    // que l'accueil (seul écran du premier rendu) reste léger.
    rollupOptions: {
      output: {
        manualChunks: { vendor: ['react', 'react-dom'] },
      },
    },
  },
})
