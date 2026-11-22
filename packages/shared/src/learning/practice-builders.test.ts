import { describe, expect, it, vi } from 'vitest'
import { buildChordExercise } from './chord-exercise.js'
import { loadOnce } from './load-once.js'
import { loadPracticeBuilder, PRACTICE_KINDS, practiceBuilder } from './practice-builders.js'
import { DEFAULT_CHORD_SPEC } from './practice-defaults.js'

/**
 * Each practice area's builder is its own code, loaded the first time the area
 * opens, so a new area or a bigger builder weighs on that area alone.
 */
describe('loading practice builders on demand', () => {
  it('has no builder until its area asks for it, then the real one', async () => {
    expect(practiceBuilder('chord')).toBeUndefined()
    await loadPracticeBuilder('chord')
    expect(practiceBuilder('chord')!(DEFAULT_CHORD_SPEC)).toEqual(
      buildChordExercise(DEFAULT_CHORD_SPEC),
    )
    // Another area's is still to come.
    expect(practiceBuilder('exercise')).toBeUndefined()
  })

  it('has a builder for every kind', async () => {
    await Promise.all(PRACTICE_KINDS.map(loadPracticeBuilder))
    for (const kind of PRACTICE_KINDS) expect(practiceBuilder(kind)).toBeTypeOf('function')
  })
})

describe('loading once', () => {
  it('fetches each key once, however often it is asked for', async () => {
    const fetch = vi.fn(async () => {})
    const load = loadOnce(fetch)
    expect(load('a')).toBe(load('a'))
    await load('a')
    await load('b')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('tries again after a failed fetch', async () => {
    const fetch = vi
      .fn<(key: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce()
    const load = loadOnce(fetch)
    await expect(load('a')).rejects.toThrow('offline')
    await load('a')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
