import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SONG_GENRES, SONG_MOODS, keyName } from '@sonara/shared'
import { SONG_CATALOG, catalogSongTitle } from '@/features/songs/catalog'
import { readSongBytes } from '@/features/songs/read-song'

/**
 * The songs that come with the app.
 *
 * The catalog is a list written by hand and the scores are files in another
 * folder, so nothing but this keeps the two in step: a song listed with no
 * score is a row in the chooser that fails when pressed, and a score with no
 * entry is a file shipped to every player that nobody can open.
 *
 * And each is read here the way the chooser reads it. These scores were
 * engraved by many hands in many programs, and one that imports with a hand
 * missing is a piece that plays itself and never asks for half its notes.
 */

const SCORES = path.join(import.meta.dirname, '..', 'public', 'songs')

describe('the built-in songs', () => {
  it('has a score for every song, and a song for every score', () => {
    const listed = SONG_CATALOG.map((entry) => `${entry.id}.mxl`).sort()
    expect(new Set(listed).size).toBe(listed.length)
    expect(readdirSync(SCORES).sort()).toEqual(listed)
  })

  it('gives every song a genre and one or more moods the chooser lists, and leaves no mood empty', () => {
    const genres: readonly string[] = SONG_GENRES.map((genre) => genre.id)
    const moods: readonly string[] = SONG_MOODS.map((mood) => mood.id)
    for (const entry of SONG_CATALOG) {
      expect(genres, entry.id).toContain(entry.genre)
      expect(entry.moods.length, entry.id).toBeGreaterThan(0)
      expect(new Set(entry.moods).size, entry.id).toBe(entry.moods.length)
      for (const mood of entry.moods) expect(moods, entry.id).toContain(mood)
    }
    // A genre can wait for its first song. A mood no song has is a switch
    // that can never be turned on, under every genre at once.
    for (const mood of SONG_MOODS) {
      expect(
        SONG_CATALOG.some((entry) => entry.moods.includes(mood.id)),
        mood.id,
      ).toBe(true)
    }
  })

  it('never calls two songs the same thing', () => {
    // The same piece twice is told apart by its edition, and by nothing else.
    const names = SONG_CATALOG.map(catalogSongTitle)
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([])
  })

  it.each(SONG_CATALOG.map((entry) => [entry.id, entry.key]))(
    '%s reads as a piece for two hands, in %s',
    (id, key) => {
      const result = readSongBytes(new Uint8Array(readFileSync(path.join(SCORES, `${id}.mxl`))), id)
      if (!('song' in result)) throw new Error(`${id} could not be read: ${result.failure}`)

      const { notes } = result.song
      const played = notes.filter((note) => note.role === 'keyboard')
      // Nearly all of it under the fingers. What is not is a line of ornaments
      // the engraver kept on a staff of its own: a note or two in a hundred, where
      // a hand gone missing is forty.
      expect(played.length / notes.length).toBeGreaterThan(0.98)
      expect(played.some((note) => note.hand === 'right')).toBe(true)
      expect(played.some((note) => note.hand === 'left')).toBe(true)
      // From the staves, not guessed from how high each note is.
      expect(result.song.handsInferred).toBe(false)
      expect(result.song.measureCount).toBeGreaterThan(0)
      // The key the chooser files it under is the one its score opens in.
      expect(result.song.key && keyName(result.song.key)).toBe(key)

      // A finger on every note there is to play, and a real one. This is a
      // piano teacher: a bar with no fingering in it is a bar the learner is
      // left to guess at, and forty-five of these pieces used to have some.
      const unfingered = played.filter(
        (note) => note.finger === undefined || note.finger < 1 || note.finger > 5,
      )
      expect(unfingered.length, `${id}: notes without a finger`).toBe(0)
      // And whatever the score printed is still what the note says.
      expect(played.filter((note) => note.fingerGiven).every((note) => note.finger)).toBe(true)
      expect(['score', 'mixed', 'derived']).toContain(result.song.fingeringSource)
    },
  )

  it('keeps every finger a score prints, and fills in round them', () => {
    // Für Elise, which is here both bare and as an editor fingered it: a
    // quarter of its notes. Those are kept, flagged as the score's, and the
    // rest worked out from them.
    const read = (fingering?: 'traditional' | 'natural') =>
      SONG_CATALOG.filter((entry) => entry.id.startsWith('beethoven-fur-elise')).map((entry) => {
        const result = readSongBytes(
          new Uint8Array(readFileSync(path.join(SCORES, `${entry.id}.mxl`))),
          entry.id,
          { fingering },
        )
        if (!('song' in result)) throw new Error(`${entry.id} could not be read`)
        return result.song
      })
    const mixed = read().filter((song) => song.fingeringSource === 'mixed')
    expect(mixed.length).toBeGreaterThan(0)
    for (const song of mixed) {
      const given = song.notes.filter((note) => note.fingerGiven)
      expect(given.length).toBeGreaterThan(0)
      expect(given.length).toBeLessThan(song.notes.length)
      expect(song.fingeredBy).toBe('traditional')
      // The same score under the other system: the editor's fingers are the
      // same fingers on the same notes.
      const other = read('natural').find((again) => again.title === song.title)!
      expect(other.fingeredBy).toBe('natural')
      expect(other.notes.filter((note) => note.fingerGiven).map((note) => note.finger)).toEqual(
        given.map((note) => note.finger),
      )
    }
  })
})
