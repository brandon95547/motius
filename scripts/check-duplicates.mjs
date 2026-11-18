#!/usr/bin/env node
// Fails when code is copied: a run of lines that appears twice, in one file or two, that
// is not in the known list. Logic is written once (CLAUDE.md); a second copy moves into a
// shared helper instead.
//
//   node scripts/check-duplicates.mjs          check against scripts/known-duplicates.json
//   node scripts/check-duplicates.mjs --list   print every copy, known or not
//
// Each line is compared with its comments and spacing removed, and lines that say
// nothing on their own (a lone brace, `break;`, an empty `return;`) are skipped, so a
// copy that was only re-indented or re-commented still counts. A copy is at least
// MIN_LINES such lines and MIN_CHARS characters, which skips the short patterns every
// file repeats (an import block, a guard clause). Data files and generated files are
// left out.
//
// A copy is known by its files and a hash of its text, not its line numbers, so editing
// code above it does not make it new. The known list exists so CI catches NEW copies
// while the ones that were there when this check was added are folded into helpers;
// remove an entry in the same change that removes its copy. A known copy that has gone
// away is reported too, so the list only shrinks.
//
// No dependencies: the job jscpd would do, without an install step.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCAN_DIRS = ['apps/web/src', 'apps/api/src', 'packages/shared/src', 'scripts']
const KNOWN_FILE = path.join(ROOT, 'scripts', 'known-duplicates.json')
export const MIN_LINES = 8
export const MIN_CHARS = 300

// Data-only files: their repetition is the data, not copied logic.
const SKIP = [/\.d\.ts$/, /\/data\//]

const TRIVIAL = /^(?:[{}()[\];,]+|(?:break|continue|return|else|default:|try|finally)[\s{};]*)$/

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') walk(full, out)
    } else if (/\.(m?js|tsx?)$/.test(entry.name)) out.push(full)
  }
  return out
}

// The lines worth comparing, each with the line number it came from.
export function significantLines(src) {
  const out = []
  let inBlock = false
  src.split('\n').forEach((raw, i) => {
    let line = raw
    if (inBlock) {
      const end = line.indexOf('*/')
      if (end < 0) return
      line = line.slice(end + 2)
      inBlock = false
    }
    line = line.replace(/\/\*.*?\*\//g, '')
    const open = line.indexOf('/*')
    if (open >= 0) {
      line = line.slice(0, open)
      inBlock = true
    }
    line = line
      .replace(/(^|[^:'"`\\])\/\/.*$/, '$1')
      .replace(/\s+/g, ' ')
      .trim()
    if (line && !TRIVIAL.test(line)) out.push({ text: line, line: i + 1 })
  })
  return out
}

// Every copy across the given files: [{ hash, lines, at: [{ file, start, end }] }].
export function findDuplicates(files) {
  const windows = new Map() // window text -> [{ file, index }]
  const lines = new Map()
  for (const { file, src } of files) {
    const sig = significantLines(src)
    lines.set(file, sig)
    for (let i = 0; i + MIN_LINES <= sig.length; i++) {
      const text = sig
        .slice(i, i + MIN_LINES)
        .map((l) => l.text)
        .join('\n')
      if (text.length < MIN_CHARS) continue
      if (!windows.has(text)) windows.set(text, [])
      windows.get(text).push({ file, index: i })
    }
  }

  // Grow each matching pair of windows into the longest run they share, once per run.
  const seen = new Set()
  const runs = new Map()
  for (const spots of windows.values()) {
    if (spots.length < 2) continue
    for (let a = 0; a < spots.length; a++) {
      for (let b = a + 1; b < spots.length; b++) {
        const [p, q] = [spots[a], spots[b]]
        if (p.file === q.file && Math.abs(p.index - q.index) < MIN_LINES) continue
        const pl = lines.get(p.file)
        const ql = lines.get(q.file)
        let start = 0
        while (
          p.index - start > 0 &&
          q.index - start > 0 &&
          pl[p.index - start - 1].text === ql[q.index - start - 1].text
        )
          start++
        const pi = p.index - start
        const qi = q.index - start
        const id = `${p.file}:${pi}|${q.file}:${qi}`
        if (seen.has(id)) continue
        seen.add(id)
        let len = 0
        while (
          pi + len < pl.length &&
          qi + len < ql.length &&
          pl[pi + len].text === ql[qi + len].text
        )
          len++
        const text = pl
          .slice(pi, pi + len)
          .map((l) => l.text)
          .join('\n')
        const hash = crypto.createHash('sha1').update(text).digest('hex').slice(0, 12)
        const spot = (f, ls, i) => ({ file: f, start: ls[i].line, end: ls[i + len - 1].line })
        if (!runs.has(hash)) runs.set(hash, { hash, lines: len, at: [] })
        const run = runs.get(hash)
        for (const s of [spot(p.file, pl, pi), spot(q.file, ql, qi)])
          if (!run.at.some((x) => x.file === s.file && x.start === s.start)) run.at.push(s)
      }
    }
  }

  // A run inside a longer run between the same places is part of it, not its own copy.
  const all = [...runs.values()]
  const inside = (r, o) =>
    o !== r &&
    o.lines >= r.lines &&
    r.at.every((s) => o.at.some((t) => t.file === s.file && t.start <= s.start && t.end >= s.end))
  return all
    .filter((r) => !all.some((o) => inside(r, o) && (o.lines > r.lines || o.hash < r.hash)))
    .map((r) => ({
      ...r,
      at: r.at.sort((x, y) => x.file.localeCompare(y.file) || x.start - y.start),
    }))
    .sort((x, y) => y.lines - x.lines || x.hash.localeCompare(y.hash))
}

const keyOf = (d) => `${d.hash} ${[...new Set(d.at.map((s) => s.file))].sort().join(' ')}`
const where = (d) => d.at.map((s) => `${s.file}:${s.start}-${s.end}`).join(', ')

function main() {
  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)))
    .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
    .filter((f) => !SKIP.some((re) => re.test(f)))
    .map((file) => ({ file, src: fs.readFileSync(path.join(ROOT, file), 'utf8') }))
  const dups = findDuplicates(files)

  if (process.argv.includes('--list')) {
    for (const d of dups) console.log(`${d.lines} lines [${d.hash}]: ${where(d)}`)
    console.log(`${dups.length} copied run(s)`)
    return
  }
  const known = fs.existsSync(KNOWN_FILE)
    ? JSON.parse(fs.readFileSync(KNOWN_FILE, 'utf8')).duplicates || []
    : []
  const knownKeys = new Set(known.map((k) => `${k.hash} ${[...k.files].sort().join(' ')}`))
  const foundKeys = new Set(dups.map(keyOf))
  const added = dups.filter((d) => !knownKeys.has(keyOf(d)))
  const gone = known.filter((k) => !foundKeys.has(`${k.hash} ${[...k.files].sort().join(' ')}`))

  for (const d of added)
    console.error(`Copied code (${d.lines} lines), move it into one helper: ${where(d)}`)
  for (const k of gone)
    console.error(
      `Known copy no longer exists, remove it from scripts/known-duplicates.json: ${k.hash} ${k.files.join(', ')}`,
    )
  if (added.length || gone.length) process.exit(1)
  console.log(`No new copied code (${dups.length} known).`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
