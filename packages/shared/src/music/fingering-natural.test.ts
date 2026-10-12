import { describe, expect, it } from 'vitest'
import { isBlackKey } from '../midi/notes.js'
import { scaleFingering } from './fingering.js'
import {
  DEFAULT_FINGERING_SYSTEM,
  FINGERING_SYSTEMS,
  FINGERING_SYSTEM_IDS,
  fingeringSystem,
} from './fingering-system.js'
import { parsePitch } from './pitch.js'
import { findScaleType, scaleOffsets } from './scales.js'

/**
 * The Natural system, against the charts it is transcribed from.
 *
 * It is the traditional system with some pages turned, so most of what is
 * pinned here is which ones: a page that moved when it should not have is a
 * player being taught something no book prints, and nothing else would notice.
 */

const digits = (fingers: readonly number[]) => fingers.join('')
type Hand = 'right' | 'left'

const scale = (
  rootName: string,
  scaleTypeId: string,
  hand: Hand,
  octaves = 2,
  system: 'traditional' | 'natural' = 'natural',
) => scaleFingering({ rootName, scaleTypeId, hand, octaves, notes: [], system })

const arpeggio = (
  tonic: string,
  mode: 'major' | 'minor',
  hand: Hand,
  position = 0,
  octaves = 2,
  system: 'traditional' | 'natural' = 'natural',
) =>
  digits(
    fingeringSystem(system).arpeggio({ tonic, mode, kind: 'triad', position, hand, octaves }) ?? [],
  )

const MAJORS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'F', 'B♭', 'E♭', 'A♭', 'D♭']
const MINORS = ['A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'D', 'G', 'C', 'F', 'B♭']

describe('the Natural system', () => {
  it('is offered beside the traditional one, which stays the default', () => {
    expect(FINGERING_SYSTEM_IDS).toEqual(['traditional', 'natural'])
    expect(DEFAULT_FINGERING_SYSTEM).toBe('traditional')
    expect(FINGERING_SYSTEMS.natural.shortName).toBe('Natural')
    // Anything unrecognised is still the default, not the newcomer.
    expect(fingeringSystem('nonsense').id).toBe('traditional')
  })

  describe('major scales', () => {
    it('moves the left hand of G, D, A and F, and nothing else', () => {
      const moved: string[] = []
      for (const key of MAJORS)
        for (const hand of ['right', 'left'] as const)
          if (
            digits(scale(key, 'major', hand).fingers) !==
            digits(scale(key, 'major', hand, 2, 'traditional').fingers)
          )
            moved.push(`${key} ${hand}`)
      expect(moved).toEqual(['G left', 'D left', 'A left', 'F left'])
    })

    it('puts the left hand’s 4th finger on F♯ in the sharp keys and on B♭ in F', () => {
      // As the charts print them, two octaves up.
      expect(digits(scale('G', 'major', 'left').fingers)).toBe('321321432132143')
      expect(digits(scale('D', 'major', 'left').fingers)).toBe('214321321432132')
      expect(digits(scale('A', 'major', 'left').fingers)).toBe('213214321321432')
      // F becomes the flat-key left hand, turning at the top on the 2nd finger.
      expect(digits(scale('F', 'major', 'left').fingers)).toBe('321432132143212')

      const fourthOn = (key: string) => {
        const tonic = parsePitch(key)!.pitchClass
        const offsets = scaleOffsets(findScaleType('major')!)
        const cycle = scale(key, 'major', 'left').cycle!
        return (tonic + offsets[cycle.indexOf(4)]!) % 12
      }
      expect(fourthOn('G')).toBe(6)
      expect(fourthOn('D')).toBe(6)
      expect(fourthOn('A')).toBe(6)
      expect(fourthOn('F')).toBe(10)
    })
  })

  describe('minor scales', () => {
    it('fingers the harmonic minors as the charts do', () => {
      // Four and three in the right hand, so the augmented second falls
      // between the 2nd finger and the 3rd; and it ends on the 4th.
      expect(digits(scale('A', 'harmonic-minor', 'right').fingers)).toBe('123412312341234')
      expect(digits(scale('D', 'harmonic-minor', 'right').fingers)).toBe('123412312341234')
      expect(digits(scale('A', 'harmonic-minor', 'left').fingers)).toBe('214321321432132')
      // C: both of the fingers the thumb passes under are on black keys, and
      // the run goes out 3 4 5 at the top.
      expect(digits(scale('C', 'harmonic-minor', 'right').fingers)).toBe('234123123412345')
      expect(digits(scale('C', 'harmonic-minor', 'left').fingers)).toBe('213214321321432')
      expect(digits(scale('G', 'harmonic-minor', 'left').fingers)).toBe('213214321321432')
      // The sharp minors open 3 4 and come home 3 2.
      const b = scale('B', 'harmonic-minor', 'right')
      expect(digits(b.fingers)).toBe('341231234123123')
      expect(digits(b.closing!)).toBe('231231234123123')
    })

    it('keeps the traditional fingering where the chart does, against its own rule', () => {
      // D harmonic minor's left hand takes B♭ with the 3rd finger in both.
      for (const [key, hand] of [
        ['D', 'left'],
        ['E', 'left'],
        ['F', 'right'],
        ['F', 'left'],
        ['F♯', 'right'],
        ['F♯', 'left'],
        ['D♯', 'right'],
        ['D♯', 'left'],
        ['G', 'right'],
        ['B', 'left'],
      ] as const)
        expect(digits(scale(key, 'harmonic-minor', hand).fingers), `${key} ${hand}`).toBe(
          digits(scale(key, 'harmonic-minor', hand, 2, 'traditional').fingers),
        )
    })

    it('takes the melodic minor up and down on different fingers where the keys ask for it', () => {
      // G minor, left hand: up with the 4th on B♭, down with it on E♭.
      expect(digits(scale('G', 'melodic-minor', 'left').fingers)).toBe('214321321432132')
      expect(digits(scale('G', 'natural-minor', 'left').fingers)).toBe('213214321321432')
      // The right hand comes down as its relative major, B♭, is fingered.
      expect(digits(scale('G', 'natural-minor', 'right').fingers)).toBe('234123123412345')
      expect(digits(scale('D', 'natural-minor', 'right').fingers)).toBe('231234123123412')
      // A is all white keys coming down, and stays as it was both ways.
      for (const type of ['melodic-minor', 'natural-minor'])
        for (const hand of ['right', 'left'] as const)
          expect(digits(scale('A', type, hand).fingers)).toBe(
            digits(scale('A', type, hand, 2, 'traditional').fingers),
          )
    })

    it('never passes a thumb onto a black key', () => {
      for (const [type, keys] of [
        ['major', MAJORS],
        ['harmonic-minor', MINORS],
        ['melodic-minor', MINORS],
        ['natural-minor', MINORS],
      ] as const) {
        const offsets = scaleOffsets(findScaleType(type)!)
        for (const key of keys)
          for (const hand of ['right', 'left'] as const) {
            const cycle = scale(key, type, hand).cycle!
            const tonic = parsePitch(key)!.pitchClass
            cycle.forEach((finger, degree) => {
              if (finger !== 1) return
              expect(isBlackKey(60 + tonic + offsets[degree]!), `${key} ${type} ${hand}`).toBe(
                false,
              )
            })
          }
      }
    })

    it('fingers every degree of every scale it prints with a real finger, each group in order', () => {
      for (const [type, keys] of [
        ['major', MAJORS],
        ['harmonic-minor', MINORS],
        ['melodic-minor', MINORS],
        ['natural-minor', MINORS],
      ] as const)
        for (const key of keys)
          for (const hand of ['right', 'left'] as const) {
            const { cycle } = scale(key, type, hand)
            // One group of three and one of four, whichever degree they start on.
            expect([...cycle!].sort().join(''), `${key} ${type} ${hand}`).toBe('1122334')
          }
    })
  })

  describe('arpeggios', () => {
    it('gives each note of the chord one finger, as the charts print the root position', () => {
      // The thumb on the third, the 4th finger on the tonic an octave up.
      expect(arpeggio('C', 'major', 'right')).toBe('2124124')
      expect(arpeggio('C', 'major', 'left')).toBe('5421421')
      // The thumb on the fifth, so the 4th finger is on the black key.
      expect(arpeggio('D', 'major', 'right')).toBe('2412412')
      // And the left hand's 3rd finger on it, where the tradition has the 4th.
      expect(arpeggio('D', 'major', 'left')).toBe('5321321')
      expect(arpeggio('D', 'major', 'left', 0, 2, 'traditional')).toBe('5421421')
      // B♭'s left hand takes the tonic with the 3rd finger, not the 4th, and
      // turns at the top on the 2nd as the chart does.
      expect(arpeggio('B♭', 'major', 'left')).toBe('3213212')
      expect(arpeggio('B♭', 'major', 'left', 0, 2, 'traditional')).toBe('4214212')
      expect(arpeggio('C', 'minor', 'right')).toBe('2312312')
      expect(arpeggio('A', 'minor', 'right')).toBe('2124124')
      // B is the tradition's, in both modes.
      for (const mode of ['major', 'minor'] as const)
        for (const hand of ['right', 'left'] as const)
          expect(arpeggio('B', mode, hand)).toBe(arpeggio('B', mode, hand, 0, 2, 'traditional'))
    })

    it('agrees with the tradition in the keys whose tonic is black', () => {
      for (const [mode, keys] of [
        ['major', ['D♭', 'E♭', 'A♭']],
        ['minor', ['C♯', 'F♯', 'G♯', 'B♭']],
      ] as const)
        for (const key of keys)
          for (const hand of ['right', 'left'] as const)
            expect(arpeggio(key, mode, hand), `${key} ${mode} ${hand}`).toBe(
              arpeggio(key, mode, hand, 0, 2, 'traditional'),
            )
    })

    it('keeps the same finger on the same note in every inversion', () => {
      // C major, right hand: E is the thumb wherever the arpeggio starts.
      expect(arpeggio('C', 'major', 'right', 1)).toBe('1241245')
      expect(arpeggio('C', 'major', 'right', 2)).toBe('2412412')
      // A first inversion of D opens on the black key, under which the thumb
      // is about to pass: the 2nd finger takes it, not the 4th.
      expect(arpeggio('D', 'major', 'right', 1)).toBe('2124124')
    })

    it('runs to as many octaves as are asked for, where the tradition prints only two', () => {
      expect(arpeggio('C', 'major', 'right', 0, 1)).toBe('2124')
      expect(arpeggio('C', 'major', 'right', 0, 3)).toBe('2124124124')
      expect(arpeggio('C', 'major', 'left', 0, 3)).toBe('5421421421')
      expect(arpeggio('C', 'major', 'right', 0, 3, 'traditional')).toBe('')
    })

    it('hands the seventh chords, the chords and the cadences to the traditional system', () => {
      const natural = fingeringSystem('natural')
      const traditional = fingeringSystem('traditional')
      const seventh = {
        tonic: 'G',
        mode: 'major',
        kind: 'seventh',
        position: 1,
        octaves: 2,
      } as const
      for (const hand of ['right', 'left'] as const) {
        expect(natural.arpeggio({ ...seventh, hand })).toEqual(
          traditional.arpeggio({ ...seventh, hand }),
        )
        expect(natural.chord({ kind: 'triad', mode: 'major', position: 1, hand })).toEqual(
          traditional.chord({ kind: 'triad', mode: 'major', position: 1, hand }),
        )
        expect(natural.cadence({ tonic: 'A', mode: 'major', hand })).toEqual(
          traditional.cadence({ tonic: 'A', mode: 'major', hand }),
        )
      }
    })
  })

  it('leaves what neither book prints to be worked out, as the traditional system does', () => {
    expect(scale('C', 'lydian', 'right', 1).source).toBe('derived')
    expect(digits(scale('C', 'chromatic', 'right', 1).fingers)).toBe(
      digits(scale('C', 'chromatic', 'right', 1, 'traditional').fingers),
    )
  })
})
