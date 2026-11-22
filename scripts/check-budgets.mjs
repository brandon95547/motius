/**
 * The size budgets, measured on the built web app (`npm run build` first).
 *
 * Each page is measured on its own: the sign-in page, the dashboard, and the
 * workspace where the music is played. A page is the entry plus the chunks it
 * loads at once and everything those import. Its JavaScript and CSS, gzipped,
 * must stay within the budget; so must every chunk loaded on demand, counting
 * what it brings that the dashboard has not loaded. So a feature weighs on its
 * own page and chunk, and a page over budget names the page that grew. The global rules ask for 150 KB of JavaScript for
 * an app page, 40 KB of CSS and 80 KB for a chunk loaded on demand.
 *
 * The pages are over the JavaScript limit today (the entry carries React and
 * zod whole), so each has a ceiling of its own in `scripts/budgets.json`: what it weighs now. A ceiling only comes
 * down — lower it in the change that makes a screen lighter — until it reaches
 * the global limit, and then it is removed. Nothing may grow past it.
 */
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import path from 'node:path'

const DIST = path.resolve(import.meta.dirname, '../apps/web/dist')
const KB = 1024
const BUDGET = { js: 150 * KB, css: 40 * KB, lazy: 80 * KB }
/** Screens still over the limit, and the most each may weigh until it is under (KB, gzipped). */
const CEILINGS = JSON.parse(readFileSync(path.join(import.meta.dirname, 'budgets.json'), 'utf8'))

/**
 * The pages a visit opens on, and the modules each loads at once beside the
 * entry. The workspace is the dashboard's shell plus its own chunk, and the
 * builder of the area it opens on, Scales.
 */
const SHELL = 'src/components/SignedInApp.tsx'
const SCREENS = {
  'Sign-in page': ['src/features/account/SignInPage.tsx'],
  Dashboard: [SHELL],
  Workspace: [
    SHELL,
    'src/components/Workspace.tsx',
    '../../packages/shared/dist/learning/scale-exercise.js',
  ],
}

const manifest = JSON.parse(readFileSync(path.join(DIST, '.vite/manifest.json'), 'utf8'))
const gzipped = (file) => gzipSync(readFileSync(path.join(DIST, file))).length
const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry)

/** The chunk a module ended up in: its own, or one it was merged into and named after it. */
const chunkOf = (source) =>
  manifest[source]
    ? source
    : Object.keys(manifest).find(
        (key) => manifest[key].name === path.basename(source).replace(/\.[^.]+$/, ''),
      )

/** A chunk and everything it imports statically. */
function closure(key, seen = new Set()) {
  if (seen.has(key)) return seen
  seen.add(key)
  for (const next of manifest[key].imports ?? []) closure(next, seen)
  return seen
}

const sizes = (keys) => {
  let js = 0
  let css = 0
  for (const key of keys) {
    js += gzipped(manifest[key].file)
    for (const sheet of manifest[key].css ?? []) css += gzipped(sheet)
  }
  return { js, css }
}

const kb = (bytes) => `${(bytes / KB).toFixed(1)} KB`
const failures = []

for (const [screen, sources] of Object.entries(SCREENS)) {
  const chunks = sources.map(chunkOf)
  const missing = sources.filter((_, index) => !chunks[index])
  if (missing.length) {
    failures.push(`${screen}: no chunk holds ${missing.join(', ')}`)
    continue
  }
  const keys = new Set([...closure(entryKey), ...chunks.flatMap((key) => [...closure(key)])])
  const { js, css } = sizes(keys)
  const limit = CEILINGS[screen] ? CEILINGS[screen] * KB : BUDGET.js
  console.log(
    `${screen}: ${kb(js)} JS (limit ${kb(limit)}), ${kb(css)} CSS (limit ${kb(BUDGET.css)})`,
  )
  if (js > limit) failures.push(`${screen}: ${kb(js)} of JavaScript is over ${kb(limit)}`)
  if (CEILINGS[screen] && js <= BUDGET.js)
    failures.push(`${screen} is under ${kb(BUDGET.js)} now: take its ceiling out of budgets.json`)
  if (css > BUDGET.css) failures.push(`${screen}: ${kb(css)} of CSS is over ${kb(BUDGET.css)}`)
}

// The dashboard carries none of the workspace: not its chunk, and no area's
// builder or section of lessons. Brought in statically, any of them would weigh
// on every page again; this names the one that was.
const ON_DEMAND_ONLY = [
  'src/components/Workspace.tsx',
  ...Object.keys(manifest).filter((key) => /learning\/[a-z-]+-(exercise|lessons)\.js$/.test(key)),
]
const dashboard = new Set([...closure(entryKey), ...closure(chunkOf(SHELL))])
for (const source of ON_DEMAND_ONLY) {
  const key = chunkOf(source)
  if (!key || !manifest[key].isDynamicEntry)
    failures.push(`${source} is not loaded on demand: something imports it statically`)
  else if (dashboard.has(key)) failures.push(`The dashboard loads ${source} at once`)
}

// No browser chunk carries zod: the API checks what it is sent and what it
// sends back, and the shared package keeps its schemas in modules of their own
// (docs/adr/0009). A schema imported for its value, not its type, is named here.
for (const chunk of Object.values(manifest)) {
  if (!chunk.file.endsWith('.js')) continue
  const map = path.join(DIST, `${chunk.file}.map`)
  const { sources = [] } = JSON.parse(readFileSync(map, 'utf8'))
  if (sources.some((source) => source.includes('node_modules/zod/')))
    failures.push(`${chunk.file} carries zod: a schema module is imported for a value`)
}

// A chunk loaded on demand, with what it brings that the app has not loaded.
const screens = Object.values(SCREENS).flat().map(chunkOf)
const initial = new Set([...closure(entryKey), ...closure(chunkOf(SHELL))])
for (const [key, chunk] of Object.entries(manifest)) {
  if (!chunk.isDynamicEntry || screens.includes(key)) continue
  const own = [...closure(key)].filter((each) => !initial.has(each))
  const { js } = sizes(own)
  if (js > BUDGET.lazy)
    failures.push(`${key}, loaded on demand: ${kb(js)} is over ${kb(BUDGET.lazy)}`)
}

if (failures.length) {
  console.error(`\nOver budget:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('Every screen and chunk is within its budget.')
