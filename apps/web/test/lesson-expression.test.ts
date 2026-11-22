import { beforeEach, describe, expect, it } from 'vitest'
import { useLearningStore } from '@/state/learning-store'

/**
 * Soft and loud reach the run: a key's velocity goes with it, a release is
 * told, and a held long note is counted by the time that passes.
 */
const learning = () => useLearningStore.getState()

describe('playing soft, loud and long in a lesson', () => {
  beforeEach(() => {
    learning().setLesson('whisper-and-shout')
    learning().setTopic('lesson')
    learning().setMode('learn')
    learning().start()
  })

  it('tells a soft note played loud to go softer, and takes it played soft', () => {
    learning().noteOn(60, 110)
    expect(learning().session.feedback?.kind).toBe('softer')
    expect(learning().session.stepIndex).toBe(0)
    learning().noteOn(60, 40)
    expect(learning().session.stepIndex).toBe(1)
    expect(learning().session.feedback).toBeNull()
  })

  it('has a long note let go too soon played again', () => {
    learning().setLesson('hold-it')
    learning().start()
    for (const _ of [1, 2, 3, 4]) learning().noteOn(60)
    expect(learning().session.stepIndex).toBe(4)
    learning().noteOn(60)
    expect(learning().session.holding?.note).toBe(60)
    learning().noteOff(60)
    expect(learning().session.feedback?.kind).toBe('longer')
    expect(learning().session.stepIndex).toBe(4)
  })
})
