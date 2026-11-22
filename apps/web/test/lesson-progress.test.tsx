import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AudioProvider } from '@/audio/AudioProvider'
import { Stage } from '@/components/Stage'
import { useLearningStore } from '@/state/learning-store'
import { sizeEverything } from './layout-size'

/**
 * Two black keys in Lesson mode: every group on the keys from the start,
 * the first marked as where to begin; each one played filled in as done; and a
 * group of three pressed instead said for what it is.
 */

sizeEverything({ width: 1200, height: 400 })

const learning = () => useLearningStore.getState()
const roles = () => {
  const { annotations, exercise } = learning()
  return exercise!.steps.map((step) => annotations[step.notes[0]!]?.role)
}

beforeEach(() =>
  act(() => {
    learning().setLesson('two-black-key-groups')
    learning().setTopic('lesson')
    learning().setMode('learn')
  }),
)
afterEach(() => {
  act(() => learning().reset())
  cleanup()
})

describe('two-black-key groups, played as a lesson', () => {
  it('marks every group from the start, the first as where to begin', () => {
    expect(roles()).toEqual(['target', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
  })

  it('fills each group in as done once it is played', () => {
    act(() => {
      learning().start()
      for (const note of learning().exercise!.steps[0]!.notes) learning().noteOn(note)
    })
    expect(roles()).toEqual(['done', 'target', 'upcoming', 'upcoming', 'upcoming'])
  })

  it('says a group of three is three, and says nothing for a white key', () => {
    render(
      <AudioProvider>
        <Stage />
      </AudioProvider>,
    )
    act(() => learning().start())
    act(() => learning().noteOn(54)) // F♯, in a group of three
    expect(screen.getByText("That's three. Look for a pair.")).toBeDefined()
    act(() => learning().noteOn(60)) // C, a white key
    expect(screen.queryByText("That's three. Look for a pair.")).toBeNull()
  })

  it('keeps the other lessons as they were: the next few marked, the rest a wash', () => {
    act(() => learning().setLesson('three-black-key-groups'))
    expect(roles().slice(0, 5)).toEqual(['target', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
    act(() => {
      learning().start()
      for (const note of learning().exercise!.steps[0]!.notes) learning().noteOn(note)
    })
    expect(roles()[0]).toBe('scale')
  })
})

describe('a lesson’s phrases, said over the music', () => {
  it('names the pattern being played, and moves on with the tune', () => {
    act(() => learning().setLesson('combining-patterns'))
    render(
      <AudioProvider>
        <Stage />
      </AudioProvider>,
    )
    expect(screen.getByText('Au clair de la lune. Repeats: C, C, C')).toBeDefined()
    act(() => {
      learning().start()
      for (const note of [60, 60, 60]) learning().noteOn(note)
    })
    expect(screen.getByText('Steps up: D, then E')).toBeDefined()
    // Still that phrase's word one key into it.
    act(() => learning().noteOn(62))
    expect(screen.getByText('Steps up: D, then E')).toBeDefined()
  })
})
