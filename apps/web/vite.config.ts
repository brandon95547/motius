import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/** The project's one `.env` is at the root of the repository, for the API and this app alike. */
const ENV_DIR = path.resolve(import.meta.dirname, '../..')

export default defineConfig(({ mode }) => ({
  envDir: ENV_DIR,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: {
    port: 5174,
    // Bound to every interface so the app can be opened from a phone on the
    // same network. Web MIDI needs a secure context, so a phone reaching a dev
    // machine over plain http will report the API as unsupported — which the
    // UI explains rather than failing silently.
    host: true,
    proxy: {
      // Proxying in dev means the browser only ever talks to one origin, so
      // there is no preflight and no CORS surprise between dev and production.
      '/api': {
        target: loadEnv(mode, ENV_DIR, 'VITE_').VITE_API_PROXY_TARGET ?? 'http://localhost:5175',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // What each entry and chunk loads, for `npm run check:budgets`.
    manifest: true,
    rollupOptions: {
      output: {
        // The sample engine pulls in the whole smplr runtime and is only needed
        // once a sampled piano is selected. Splitting it keeps first paint —
        // and the on-screen keyboard — off that download's critical path.
        manualChunks: { smplr: ['smplr'] },
      },
    },
  },
}))
