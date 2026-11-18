#!/usr/bin/env node
// Fails when a stylesheet sets its own color or type size instead of reading a token.
// Colors and sizes are defined once, as custom properties, and every rule
// reads them (CLAUDE.md): a literal in a rule is a second design beside the first.
//
//   node scripts/check-styles.mjs          check against scripts/known-styles.json
//   node scripts/check-styles.mjs --list   print every literal, known or not
//   node scripts/check-styles.mjs --shrink write the counts down after fixing some
//
// Defining a custom property (`--c-bar: #131416`) is where a value belongs, so those are
// not counted; neither is `tokens.css`, the token layer itself. Everything else is: a
// hex or rgb()/hsl() color (in a shadow or gradient too), a font-size that is not a
// var(), and any font-size under 13px, which no text in the app is set below.
//
// The known list holds the counts there were when this check was added, per file and
// rule. More than that fails; fewer fails too, until --shrink writes the lower number,
// so the list only goes down. No dependencies.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCAN = path.join(ROOT, 'apps/web/src')
const SKIP = new Set(['apps/web/src/styles/tokens.css'])
const KNOWN_FILE = path.join(ROOT, 'scripts/known-styles.json')
const MIN_TEXT_PX = 13

const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(\s*[\d.]/
const RULES = {
  color: {
    test: (prop, value) => !prop.startsWith('--') && COLOR.test(value),
    say: 'a color that is not a token',
  },
  'font-size': {
    test: (prop, value) => prop === 'font-size' && /^[\d.]/.test(value),
    say: 'a font-size that is not a token',
  },
  'small-text': {
    test: (prop, value) => prop === 'font-size' && pixels(value) < MIN_TEXT_PX,
    say: `text under ${MIN_TEXT_PX}px`,
  },
}

function pixels(value) {
  const m = /^([\d.]+)(px|rem)$/.exec(value)
  if (!m) return Infinity
  return m[2] === 'px' ? Number(m[1]) : Number(m[1]) * 16
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.css')) out.push(full)
  }
  return out
}

/** Every literal in a stylesheet: its rule, the line, and the declaration. */
export function literalsIn(src) {
  // Comments blanked, not removed, so line numbers still match the file.
  const text = src.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  const found = []
  const decl = /([-\w]+)\s*:\s*([^;{}]+);/g
  for (let m; (m = decl.exec(text));) {
    const prop = m[1].trim()
    const value = m[2].trim()
    const line = text.slice(0, m.index).split('\n').length
    for (const [rule, { test }] of Object.entries(RULES))
      if (test(prop, value)) found.push({ rule, line, text: `${prop}: ${value}` })
  }
  return found
}

const args = new Set(process.argv.slice(2))
const known = fs.existsSync(KNOWN_FILE) ? JSON.parse(fs.readFileSync(KNOWN_FILE, 'utf8')) : {}
const counts = {}
const problems = []

for (const file of walk(SCAN)) {
  const rel = path.relative(ROOT, file)
  if (SKIP.has(rel)) continue
  const found = literalsIn(fs.readFileSync(file, 'utf8'))
  if (args.has('--list'))
    for (const f of found) console.log(`${rel}:${f.line}  ${RULES[f.rule].say}  ${f.text}`)
  for (const f of found) {
    counts[rel] ??= {}
    counts[rel][f.rule] = (counts[rel][f.rule] ?? 0) + 1
  }
}

const firstRun = !fs.existsSync(KNOWN_FILE)
const files = new Set([...Object.keys(known), ...Object.keys(counts)])
if (!args.has('--list'))
  for (const file of files)
    for (const rule of Object.keys(RULES)) {
      const now = counts[file]?.[rule] ?? 0
      const was = known[file]?.[rule] ?? 0
      if (now > was)
        problems.push(
          `${file}: ${now - was} new ${RULES[rule].say}. Read the token instead (--list shows where).`,
        )
      else if (now < was && !args.has('--shrink'))
        problems.push(
          `${file}: ${was - now} fewer ${RULES[rule].say} than the known list says — run with --shrink to write it down.`,
        )
    }

if (args.has('--shrink')) {
  // The first run writes down what is there; after that the counts only go down.
  if (problems.length && !firstRun) {
    console.error(problems.join('\n'))
    process.exit(1)
  }
  fs.writeFileSync(KNOWN_FILE, `${JSON.stringify(counts, null, 2)}\n`)
  console.log('Known style literals written down.')
} else if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
} else if (!args.has('--list')) console.log('Styles read their tokens: no new literals.')
