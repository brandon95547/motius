import { describe, expect, it } from 'vitest'
import type { Exercise, ExerciseStep } from './exercise.js'
import { IDLE_SESSION, sessionReducer, STEP_DYNAMICS, type SessionState } from './session.js'

/**
 * Soft and loud, and long notes held: a step may ask how hard it is played,
 * and to be held for its length. The right key played otherwise is a slip,
 * with a word on which way to go, and does not move the run on.
 */
const step = (extra: Partial<ExerciseStep>): ExerciseStep => ({
  id: String(Math.random()),
  notes: [60],
  fingers: [{ finger: 1, hand: 'right' }],
  label: 'C',
  ...extra,
})
const exercise = (steps: ExerciseStep[]) => ({ steps }) as unknown as Exercise

const run = (ex: Exercise, ...events: Parameters<typeof sessionReducer>[1][]) =>
  events.reduce<SessionState>(
    (state, event) => sessionReducer(state, event, ex),
    sessionReducer(IDLE_SESSION, { type: 'start', at: 0 }, ex),
  )

describe('soft and loud', () => {
  const ex = exercise([step({ dynamic: 'soft' }), step({ dynamic: 'loud' })])
  const soft = STEP_DYNAMICS.softAtMost
  const loud = STEP_DYNAMICS.loudAtLeast

  it('moves on when the key is as soft, then as loud, as asked', () => {
    const state = run(
      ex,
      { type: 'noteOn', note: 60, at: 1, velocity: soft },
      { type: 'noteOn', note: 60, at: 2, velocity: loud },
    )
    expect(state.status).toBe('complete')
    expect(state.mistakes).toBe(0)
  })

  it('says softer for a soft note played loud, and stays on it', () => {
    const state = run(ex, { type: 'noteOn', note: 60, at: 1, velocity: loud })
    expect(state.stepIndex).toBe(0)
    expect(state.mistakes).toBe(1)
    expect(state.feedback).toEqual({ kind: 'softer', at: 1 })
  })

  it('says louder for a loud note played between the two', () => {
    const state = run(
      ex,
      { type: 'noteOn', note: 60, at: 1, velocity: soft },
      { type: 'noteOn', note: 60, at: 2, velocity: soft + 5 },
    )
    expect(state.stepIndex).toBe(1)
    expect(state.feedback).toEqual({ kind: 'louder', at: 2 })
  })
})

describe('long notes', () => {
  const ex = exercise([step({ beats: 4, hold: true }), step({})])

  it('counts a long note once it has been held most of its length', () => {
    const held = run(
      ex,
      { type: 'noteOn', note: 60, at: 0 },
      { type: 'tick', at: 1000, beatMs: 500 },
    )
    expect(held.stepIndex).toBe(0)
    expect(held.holding).toEqual({ note: 60, since: 0 })
    const counted = sessionReducer(held, { type: 'tick', at: 1800, beatMs: 500 }, ex)
    expect(counted.stepIndex).toBe(1)
    expect(counted.holding).toBeNull()
  })

  it('has it played again when let go too soon', () => {
    const state = run(
      ex,
      { type: 'noteOn', note: 60, at: 0 },
      { type: 'noteOff', note: 60, at: 700 },
    )
    expect(state.stepIndex).toBe(0)
    expect(state.mistakes).toBe(1)
    expect(state.feedback).toEqual({ kind: 'longer', at: 700 })
    expect(state.satisfied).toEqual([])
  })

  it('pays no mind to letting go of a note that asks nothing', () => {
    const state = run(
      exercise([step({}), step({})]),
      { type: 'noteOn', note: 60, at: 0 },
      {
        type: 'noteOff',
        note: 60,
        at: 10,
      },
    )
    expect(state.stepIndex).toBe(1)
    expect(state.mistakes).toBe(0)
  })
})
