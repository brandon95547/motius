import { describe, expect, it } from 'vitest'
import { buildLessonExercise } from './lesson-builders.js'

/**
 * The crossings in Notes A to G, each marked on the step it leads into, with
 * the hand as it stands just before: fingers 1 to 3 on their white keys.
 */
describe('crossings in Notes A to G', () => {
  const crossings = () =>
    buildLessonExercise('notes-a-through-g').steps.flatMap((step) =>
      step.crossing ? [{ label: step.label, ...step.crossing }] : [],
    )

  it('marks the four, and nothing else', () => {
    expect(crossings().map((c) => `${c.hand} ${c.direction} ${c.kind} to ${c.label}`)).toEqual([
      'left up finger-over to F',
      'left down thumb-under to E',
      'right up thumb-under to D',
      'right down finger-over to C',
    ])
  })

  it('draws the right hand going up: 1 2 3 on A B C, the thumb under to D', () => {
    expect(crossings()[2]).toMatchObject({
      keys: ['A', 'B', 'C', 'D'],
      fingers: [
        { finger: 1, key: 0 },
        { finger: 2, key: 1 },
        { finger: 3, key: 2 },
      ],
      finger: 1,
      to: 3,
    })
  })

  it('draws the left hand going up: 3 2 1 on C D E, 3 over the thumb to F', () => {
    expect(crossings()[0]).toMatchObject({
      keys: ['C', 'D', 'E', 'F'],
      fingers: [
        { finger: 1, key: 2 },
        { finger: 2, key: 1 },
        { finger: 3, key: 0 },
      ],
      finger: 3,
      to: 3,
    })
  })

  it('draws each way down as the way up turned round', () => {
    expect(crossings()[3]).toMatchObject({ keys: ['C', 'D', 'E', 'F'], finger: 3, to: 0 })
    expect(crossings()[1]).toMatchObject({ keys: ['E', 'F', 'G', 'A'], finger: 1, to: 0 })
  })
})
