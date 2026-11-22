import { describe, expect, it } from 'vitest'
import {
  PRACTICE_START,
  practiceAt,
  practiceNoteOn,
  practiceSummary,
  type PracticeStep,
} from './song-practice.js'

// A C, a chord of E and G a second later, then a D.
const steps: PracticeStep[] = [
  { notes: [60], startMs: 0 },
  { notes: [64, 67], startMs: 1000 },
  { notes: [62], startMs: 2000 },
]

describe('practising a song', () => {
  it('judges a step against its beat: on time within 150 ms, else early or late', () => {
    let state = practiceNoteOn(PRACTICE_START, steps, 60, 100)
    expect(state.results).toEqual(['on-time'])
    state = practiceNoteOn(state, steps, 64, 700)
    state = practiceNoteOn(state, steps, 67, 790)
    expect(state.results).toEqual(['on-time', 'early'])
    state = practiceNoteOn(state, steps, 62, 2300)
    expect(state.results).toEqual(['on-time', 'early', 'late'])
  })

  it('judges a chord when all of it is down, and ignores a key not in the step', () => {
    let state = practiceNoteOn(PRACTICE_START, steps, 60, 0)
    state = practiceNoteOn(state, steps, 65, 1000)
    state = practiceNoteOn(state, steps, 64, 1000)
    expect(state.step).toBe(1)
    expect(state.reached).toEqual([64])
    state = practiceNoteOn(state, steps, 67, 1050)
    expect(state.step).toBe(2)
  })

  it('misses a step once the next is due and a margin more, every such step at once', () => {
    expect(practiceAt(PRACTICE_START, steps, 1100).step).toBe(0)
    const state = practiceAt(PRACTICE_START, steps, 2200)
    expect(state.results).toEqual(['missed', 'missed'])
    expect(state.step).toBe(2)
  })

  it('keeps "on time" to the player’s 150 ms at a slower tempo', () => {
    // At half speed, 100 ms of the song is 200 ms of the player's time: late.
    expect(practiceNoteOn(PRACTICE_START, steps, 60, 100, 0.5).results).toEqual(['late'])
  })

  it('counts a run, the steps never reached as missed', () => {
    expect(practiceSummary(['on-time', 'early', 'missed'], 5)).toEqual({
      total: 5,
      onTime: 1,
      early: 1,
      late: 0,
      missed: 3,
      accuracy: 0.4,
    })
  })
})
