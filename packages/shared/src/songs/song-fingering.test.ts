import { describe, expect, it } from 'vitest'
import { fingerSong } from './song-fingering.js'
import { buildSong, type SongNote } from './song.js'

const note = (pitch: number, startMs: number, extra: Partial<SongNote> = {}): SongNote => ({
  note: pitch,
  velocity: 90,
  startMs,
  durationMs: 400,
  hand: 'right',
  role: 'keyboard',
  ...extra,
})

const song = (notes: SongNote[]) =>
  buildSong({
    id: 'x',
    title: 'x',
    bpm: 120,
    beatsPerMeasure: 4,
    notes,
    source: 'midi',
    handsInferred: true,
  })

/**
 * A song whose hands came from the file, so nothing reassigns them.
 *
 * The distinction matters for anything about reach. Given a free hand, the
 * assignment step will split a chord too wide for one hand across two, which is
 * the right answer for a MIDI file and hides every case this is about. A score
 * that names its staves has already decided, and the reading has to be taken as
 * written.
 */
const scored = (notes: SongNote[]) =>
  buildSong({
    id: 'x',
    title: 'x',
    bpm: 120,
    beatsPerMeasure: 4,
    notes,
    source: 'musescore',
    handsInferred: false,
  })

describe('fingering a song the file did not finger', () => {
  const scale = [60, 62, 64, 65, 67, 69, 71, 72].map((pitch, i) => note(pitch, i * 500))

  it('works out the fingering a MIDI file could never carry', () => {
    const fingered = fingerSong(song(scale))
    expect(fingered.notes.map((n) => n.finger)).toEqual([1, 2, 3, 1, 2, 3, 4, 5])
    expect(fingered.hasFingering).toBe(true)
    expect(fingered.fingeringSource).toBe('derived')
  })

  it('still says the file itself provided none', () => {
    // `provides` is a statement about the file. Working something out does not
    // change what the file held, and the two must not be confused.
    expect(fingerSong(song(scale)).provides.fingering).toBe(false)
  })

  it('keeps every finger an editor wrote, and works out the rest from them', () => {
    // A score with one finger in it used to be left with one finger in it.
    // An editor marks where the hand goes; the notes after it follow from
    // that, and a learner is not expected to know how.
    const edited = song(scale.map((n, i) => (i === 0 ? { ...n, finger: 2 } : n)))
    expect(edited.fingeringSource).toBe('score')
    const after = fingerSong(edited)
    expect(after.notes[0]).toMatchObject({ finger: 2, fingerGiven: true })
    expect(after.notes.every((n) => n.finger !== undefined)).toBe(true)
    expect(after.notes.slice(1).some((n) => n.fingerGiven)).toBe(false)
    // Neither the score's nor Motius's alone, and it says so.
    expect(after.fingeringSource).toBe('mixed')
    // The file still held what it held.
    expect(after.provides).toEqual(edited.provides)
  })

  it('calls a score fingered when its editor fingered every note of it', () => {
    const complete = song(scale.map((n, i) => ({ ...n, finger: [1, 2, 3, 1, 2, 3, 4, 5][i]! })))
    const after = fingerSong(complete)
    expect(after.fingeringSource).toBe('score')
    expect(after.notes.map((n) => n.finger)).toEqual([1, 2, 3, 1, 2, 3, 4, 5])
    expect(after.notes.every((n) => n.fingerGiven)).toBe(true)
  })

  it('can be run again, and keeps the score’s fingers and nothing else when it is', () => {
    const edited = song(scale.map((n, i) => (i === 4 ? { ...n, finger: 1 } : n)))
    const once = fingerSong(edited)
    const twice = fingerSong(once, { system: 'natural' })
    expect(twice.notes.filter((n) => n.fingerGiven).map((n) => n.note)).toEqual([67])
    expect(twice.notes[4]!.finger).toBe(1)
    expect(twice.fingeringSource).toBe('mixed')
    // A song Motius fingered entirely has nothing of the score's to keep.
    const derived = fingerSong(fingerSong(song(scale)))
    expect(derived.notes.some((n) => n.fingerGiven)).toBe(false)
    expect(derived.fingeringSource).toBe('derived')
  })

  it('fingers chords with the fingering the method books print', () => {
    const chords = [0, 1, 2].flatMap((step) => [60, 64, 67].map((pitch) => note(pitch, step * 500)))
    const fingered = fingerSong(song(chords))
    // A root-position triad in the right hand: 1 3 5, on every repetition.
    expect(fingered.notes.map((n) => n.finger)).toEqual([1, 3, 5, 1, 3, 5, 1, 3, 5])
  })

  it('gives four octaves apart to two hands rather than refusing it', () => {
    // It was refusing this, which was right while a note's hand came from its
    // own pitch and nothing else. Two notes four octaves apart are not a chord
    // one hand fails to hold — they are one note in each hand, and now read
    // that way.
    const wide = [36, 84].map((pitch) => note(pitch, 0))
    const fingered = fingerSong(song(wide))
    expect(fingered.notes.map((n) => n.hand)).toEqual(['left', 'right'])
    expect(fingered.notes.every((n) => n.finger !== undefined)).toBe(true)
  })

  it('fingers even what neither hand can hold, and says it is spread', () => {
    // Six notes over five octaves cannot be divided into two grips. They used
    // to be left blank; they are fingered as chords that arrive in pieces,
    // because a player who meets them still has to play them with something.
    const impossible = [24, 40, 55, 72, 88, 103].map((pitch) => note(pitch, 0))
    const fingered = fingerSong(song(impossible))
    expect(fingered.notes.every((n) => n.finger !== undefined)).toBe(true)
    expect(fingered.notes.some((n) => n.rolled)).toBe(true)
  })

  it('fingers a part that alternates between chords and single notes', () => {
    // Why this had to work over steps rather than runs of single notes: a chord
    // used to end the run, so a melody threaded between chords came back in
    // unfingered fragments.
    const mixed: SongNote[] = [
      ...[60, 64, 67].map((p) => note(p, 0)),
      note(69, 500),
      note(71, 1000),
      ...[60, 64, 67].map((p) => note(p, 1500)),
      note(72, 2000),
    ]
    expect(fingerSong(song(mixed)).notes.every((n) => n.finger !== undefined)).toBe(true)
  })

  it('fingers each hand as its own line', () => {
    const both = [
      ...[60, 62, 64, 65].map((pitch, i) => note(pitch, i * 500)),
      ...[48, 50, 52, 53].map((pitch, i) => note(pitch, i * 500, { hand: 'left' })),
    ]
    const fingered = fingerSong(song(both))
    const right = fingered.notes.filter((n) => n.hand === 'right').map((n) => n.finger)
    const left = fingered.notes.filter((n) => n.hand === 'left').map((n) => n.finger)
    expect(right).toEqual([1, 2, 3, 4])
    // The left hand runs the other way, so the same rising line takes the
    // fingers in the opposite order.
    expect(left).toEqual([4, 3, 2, 1])
  })

  it('starts a new run after a rest long enough to move the hand', () => {
    const split = [
      ...[60, 62, 64].map((pitch, i) => note(pitch, i * 400)),
      ...[84, 86, 88].map((pitch, i) => note(pitch, 4000 + i * 400)),
    ]
    const fingered = fingerSong(song(split))
    // A leap of two octaves is beyond any pair of fingers. Fingered as one run
    // it would be unplayable and the whole thing would come back empty.
    expect(fingered.notes.every((n) => n.finger !== undefined)).toBe(true)
  })

  /**
   * A chord wider than the hand.
   *
   * Real music is full of these — a rag's left hand reaching a tenth, a
   * romantic chord spanning a twelfth — and a pianist spreads them from the
   * outer note inwards. The fingering is the same either way, which is why the
   * distinction was easy to lose: the search knew, and then dropped it on the
   * floor, and every reader downstream was left asking for a grip no hand can
   * close on.
   */
  it('marks a chord the hand cannot close on at once', () => {
    // D4 to G5 is a twelfth in one hand — this exact chord appears twice in a
    // published rag, which is how it was found.
    const wide = [62, 67, 70, 79].map((pitch) => note(pitch, 0))
    const fingered = fingerSong(scored(wide))

    expect(fingered.notes.every((n) => n.finger !== undefined)).toBe(true)
    expect(fingered.notes.every((n) => n.rolled === true)).toBe(true)
  })

  it('leaves a chord the hand can hold unmarked', () => {
    const plain = [60, 64, 67].map((pitch) => note(pitch, 0))
    const fingered = fingerSong(scored(plain))

    expect(fingered.notes.map((n) => n.finger)).toEqual([1, 3, 5])
    // Absent, not false: a chord that can be held makes no claim about rolling.
    expect(fingered.notes.every((n) => n.rolled === undefined)).toBe(true)
  })

  it('splits a chord too wide for one hand rather than rolling it, when free to', () => {
    // The other half of the same question. A MIDI file has not said whose hand
    // anything is, so the assignment can put the bottom of a twelfth in the
    // left — which beats rolling it, and is why this case has to be tested
    // separately from a score that named its staves.
    const wide = [62, 67, 70, 79].map((pitch) => note(pitch, 0))
    const fingered = fingerSong(song(wide))
    const hands = new Set(fingered.notes.map((n) => n.hand))
    expect(hands.size).toBe(2)
  })

  it('marks only the hand that has to spread', () => {
    const mixed = [
      ...[62, 67, 70, 79].map((pitch) => note(pitch, 0)),
      ...[36, 40, 43].map((pitch) => note(pitch, 0, { hand: 'left' })),
    ]
    const fingered = fingerSong(scored(mixed))
    expect(fingered.notes.filter((n) => n.hand === 'right').every((n) => n.rolled)).toBe(true)
    expect(fingered.notes.filter((n) => n.hand === 'left').some((n) => n.rolled)).toBe(false)
  })
})

describe('a song fingered by the chosen system', () => {
  const run = (pitches: number[], hand: 'right' | 'left') =>
    pitches.map((pitch, i) => note(pitch, i * 250, { hand, durationMs: 200 }))
  const inKey = (notes: SongNote[], pitchClass: number, mode: 'major' | 'minor', fifths: number) =>
    buildSong({
      id: 'x',
      title: 'x',
      bpm: 120,
      beatsPerMeasure: 4,
      notes,
      source: 'musescore',
      handsInferred: false,
      key: { pitchClass, mode, fifths, declared: true },
    })
  const fingers = (fingered: { notes: readonly SongNote[] }) =>
    fingered.notes.map((n) => n.finger).join('')

  // G major, two octaves, in the left hand.
  const gMajor = [43, 45, 47, 48, 50, 52, 54, 55, 57, 59, 60, 62, 64, 66, 67]

  it('fingers a scale run as the system fingers that scale', () => {
    const piece = inKey(run(gMajor, 'left'), 7, 'major', 1)
    // The traditional left hand: 5 4 3 2 1, 3 2 1.
    expect(fingers(fingerSong(piece))).toBe('543213214321321')
    // The natural one: the 4th finger on F♯.
    const natural = fingers(fingerSong(piece, { system: 'natural' }))
    expect(natural.slice(0, 13)).toBe('3213214321321')
    for (const [index, pitch] of gMajor.entries())
      if (pitch % 12 === 6 && index < 13) expect(natural[index]).toBe('4')
  })

  it('fingers the same notes differently when the system is changed, and only those', () => {
    const piece = inKey(run(gMajor, 'left'), 7, 'major', 1)
    const once = fingerSong(piece, { system: 'natural' })
    const back = fingerSong(once, { system: 'traditional' })
    expect(fingers(back)).toBe(fingers(fingerSong(piece)))
  })

  it('takes a harmonic minor as one run of that scale, not a natural minor with a stray', () => {
    // A to G♯ and on: the natural system's four and three in the right hand.
    const aHarmonic = [57, 59, 60, 62, 64, 65, 68, 69, 71, 72, 74, 76, 77, 80, 81]
    const piece = inKey(run(aHarmonic, 'right'), 9, 'minor', 0)
    expect(fingers(fingerSong(piece, { system: 'natural' })).slice(0, 14)).toBe('12341231234123')
    expect(fingers(fingerSong(piece)).slice(0, 14)).toBe('12312341231234')
  })

  it('fingers an arpeggio as the system does, opening and closing it as the hand would', () => {
    const cMajor = inKey(run([60, 64, 67, 72, 76, 79, 84], 'right'), 0, 'major', 0)
    expect(fingers(fingerSong(cMajor))).toBe('1231235')
    // The natural system's thumb is on the third.
    expect(fingers(fingerSong(cMajor, { system: 'natural' })).slice(0, 6)).toBe('212412')
    const dMajor = inKey(run([38, 42, 45, 50, 54, 57, 62], 'left'), 2, 'major', 2)
    expect(fingers(fingerSong(dMajor))).toBe('5421421')
    expect(fingers(fingerSong(dMajor, { system: 'natural' }))).toBe('5321321')
  })

  it('leaves five notes under five fingers, whatever scale they are from', () => {
    const fragment = inKey(run([60, 62, 64, 65, 67, 65, 64, 62, 60], 'right'), 0, 'major', 0)
    for (const system of ['traditional', 'natural'] as const)
      expect(fingers(fingerSong(fragment, { system }))).toBe('123454321')
  })

  it('fingers a broken chord as the chord is held', () => {
    // An Alberti bass: C G E G, then the first inversion of G.
    const alberti = [48, 55, 52, 55, 48, 55, 52, 55, 47, 55, 50, 55, 47, 55, 50, 55]
    expect(fingers(fingerSong(inKey(run(alberti, 'left'), 0, 'major', 0)))).toBe('5131513151315131')
  })

  it('places a scale’s two groups where a printed finger says the thumb goes', () => {
    // C major up two octaves with the editor's thumb on G: 1 2 3 4, 1 2 3.
    const cMajor = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84]
    const marked = run(cMajor, 'right').map((n, i) => (i === 4 ? { ...n, finger: 1 } : n))
    const fingered = fingerSong(inKey(marked, 0, 'major', 0))
    expect(fingers(fingered).slice(0, 12)).toBe('123412312341')
    expect(fingered.notes[4]).toMatchObject({ finger: 1, fingerGiven: true })
  })

  it('fingers every note of a part with leaps an octave wide in it', () => {
    // What used to blank a whole stretch: nothing in position reaches the
    // third of these, so the hand moves.
    const leaping = run([36, 48, 60, 62, 64, 65, 67, 55, 43, 31], 'left')
    const fingered = fingerSong(inKey(leaping, 0, 'major', 0))
    expect(fingered.notes.every((n) => n.finger !== undefined)).toBe(true)
  })
})
