import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CrossingTip } from '@/features/areas/CrossingTip'
import { useCrossingTips } from '@/state/crossing-tips'
import { useLearningStore } from '@/state/learning-store'
import { useViewStore } from '@/state/view-store'

/**
 * How to cross, in Notes A to G: when the run reaches a key the hand has to
 * cross to, a dialog shows how before it is played, once a run, in Lesson mode.
 */
const learning = () => useLearningStore.getState()
// The left hand from low A: A B C D E, fingers 5 to 1; then 3 over to F.
const UP_TO_E = [45, 47, 48, 50, 52]
const tip = () => screen.queryByRole('dialog', { name: /over|under/ })

beforeEach(() => {
  useCrossingTips.setState({ show: true, closed: null })
  act(() => {
    learning().setLesson('notes-a-through-g')
    learning().setTopic('lesson')
    learning().setMode('learn')
  })
})
afterEach(() => {
  act(() => learning().reset())
  cleanup()
})

const playToTheCrossing = () =>
  act(() => {
    learning().start()
    for (const note of UP_TO_E) learning().noteOn(note)
  })

describe('the crossing tip', () => {
  it('stops before the key the hand crosses to, says how, and lets the run go on', () => {
    render(<CrossingTip />)
    playToTheCrossing()
    expect(screen.getByRole('dialog', { name: 'Finger 3 over' })).toBeDefined()
    expect(tip()!.textContent).toContain('Left hand, going up')
    expect(tip()!.textContent).toContain(
      'Cross finger 3 over your thumb to play F. Your hand follows it.',
    )
    expect(screen.getByRole('img', { name: 'Finger 3 moves over the thumb to F.' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(tip()).toBeNull()
    act(() => learning().noteOn(53))
    expect(learning().session.completedSteps).toBe(6)
  })

  it('points to the hands on the keyboard, where they are showing', () => {
    act(() => useViewStore.getState().setHands(false))
    render(<CrossingTip />)
    playToTheCrossing()
    expect(tip()!.textContent).not.toContain('Watch the hands on the keyboard')
    act(() => useViewStore.getState().setHands(true))
    expect(tip()!.textContent).toContain('Watch the hands on the keyboard: they show it too.')
    act(() => useViewStore.getState().setHands(false))
  })

  it('says the thumb goes under on the way back down', () => {
    render(<CrossingTip />)
    playToTheCrossing()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    act(() => {
      for (const note of [53, 55, 53]) learning().noteOn(note)
    })
    expect(screen.getByRole('dialog', { name: 'Thumb under' })).toBeDefined()
    expect(tip()!.textContent).toContain('Tuck your thumb under your fingers to play E.')
  })

  it('stays away in Practice, which keeps time, and once Show next time is unticked', () => {
    act(() => learning().setMode('practice'))
    render(<CrossingTip />)
    playToTheCrossing()
    expect(tip()).toBeNull()

    act(() => learning().setMode('learn'))
    playToTheCrossing()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show next time' }))
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(useCrossingTips.getState().show).toBe(false)
    playToTheCrossing()
    expect(tip()).toBeNull()
  })

  it('waits for Play with Reduce Motion on: pressing it is the asking', () => {
    vi.spyOn(globalThis, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('reduced-motion'),
          addEventListener() {},
          removeEventListener() {},
        }) as unknown as MediaQueryList,
    )
    render(<CrossingTip />)
    playToTheCrossing()
    fireEvent.click(screen.getByRole('button', { name: 'Play the movement' }))
    expect(screen.queryByRole('button', { name: 'Play the movement' })).toBeNull()
    vi.restoreAllMocks()
  })
})
