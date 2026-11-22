import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/** The project's one `.env` is at the root of the repository, for the API and this app alike. */
const ENV_DIR = path.resolve(import.meta.dirname, '../..')

/**
 * The root .env is the API's too, and says NODE_ENV=development for it. Read
 * into a build, that ships React's development build, about 58 KB more on every
 * page. A build is always production (the `build` script says so), and this
 * refuses one that is not, once Vite has read the .env.
 */
const productionBuildsOnly: Plugin = {
  name: 'motius:production-builds-only',
  apply: 'build',
  configResolved(resolved) {
    if (!resolved.isProduction)
      throw new Error(
        "This build would ship React's development build (NODE_ENV from .env). Run npm run build.",
      )
  },
}

export default defineConfig(({ mode }) => config(mode))

const config = (mode: string) => ({
  envDir: ENV_DIR,
  plugins: [react(), tailwindcss(), productionBuildsOnly],
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
})
