import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CrossingTip } from '@/features/areas/CrossingTip'
import { openLessonAbout } from '@/features/areas/Lessons'
import { useCrossingTips } from '@/state/crossing-tips'
import { usePanelStore } from '@/state/panel-store'
import { useLearningStore } from '@/state/learning-store'
import { useViewStore } from '@/state/view-store'

/**
 * How to cross, in Notes A to G: when the run reaches a key the hand has to
 * cross to, a dialog shows how before it is played, once a run, in Lesson mode.
 */
const learning = () => useLearningStore.getState()
// The left hand from low A: A B C D E, fingers 5 to 1; then 3 over to F.
const UP_TO_E = [45, 47, 48, 50, 52]
const tip = () => screen.queryByRole('dialog', { name: /over|under|^Right hand$/ })

beforeEach(() => {
  useCrossingTips.setState({ show: true, closed: null, asked: null })
  usePanelStore.setState({ panel: null })
  globalThis.localStorage.clear()
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
      'Cross finger 3 over your thumb to play F, letting your hand follow. Watch the keyboard fingering. Finger crossings are highlighted in purple.',
    )
    expect(screen.getByRole('img', { name: 'Finger 3 moves over the thumb to F.' })).toBeDefined()
    // Read aloud, the first time, from its own recording.
    const play = vi.mocked(HTMLMediaElement.prototype.play)
    expect((play.mock.contexts.at(-1) as HTMLAudioElement).src).toMatch(
      /\/narration\/finger-3-over-to-f-2\.mp3$/,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(tip()).toBeNull()
    act(() => learning().noteOn(53))
    expect(learning().session.completedSteps).toBe(6)
  })

  it('points to the hands on the keyboard in its own recorded words, and adds nothing', () => {
    act(() => useViewStore.getState().setHands(true))
    render(<CrossingTip />)
    playToTheCrossing()
    expect(tip()!.textContent).toContain('Watch the keyboard fingering.')
    expect(tip()!.textContent).not.toContain('Watch the hands on the keyboard')
    act(() => useViewStore.getState().setHands(false))
  })

  it('says, simply, where the right hand starts, and that the green bars are its', () => {
    render(<CrossingTip />)
    playToTheCrossing()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    act(() => {
      // The left hand on to its next A.
      for (const note of [53, 55, 57]) learning().noteOn(note)
    })
    expect(screen.getByRole('dialog', { name: 'Right hand' })).toBeDefined()
    expect(tip()!.textContent).toContain(
      'Your right hand starts here with your thumb. The green bars represent your right hand.',
    )
    // No crossing drawn: the right hand, its fingers numbered, and only it.
    expect(within(tip()!).queryByRole('img')).toBeNull()
    const hands = [...tip()!.querySelectorAll('.finger-chart__hand')]
    expect(hands.map((hand) => hand.getAttribute('data-hand'))).toEqual(['right'])
    expect(hands[0]!.textContent).toBe('54321')
    // Read aloud as it opens, with a button to pause it.
    const play = vi.mocked(HTMLMediaElement.prototype.play)
    expect((play.mock.contexts.at(-1) as HTMLAudioElement).src).toMatch(
      /\/narration\/right-hand-starts\.mp3$/,
    )
    expect(within(tip()!).getByRole('button', { name: 'Pause' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(tip()).toBeNull()
  })

  it('says the thumb goes under for the right hand, on its way up to D', () => {
    render(<CrossingTip />)
    playToTheCrossing()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    act(() => {
      // The left hand on to its next A; then the right from the A below middle C.
      for (const note of [53, 55, 57]) learning().noteOn(note)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    act(() => {
      for (const note of [57, 59, 60]) learning().noteOn(note)
    })
    expect(screen.getByRole('dialog', { name: 'Thumb under' })).toBeDefined()
    expect(tip()!.textContent).toContain('Right hand, going up')
    expect(tip()!.textContent).toContain(
      'Tuck your thumb under your fingers to play D, letting your hand follow. Watch the keyboard fingering below and notice the purple falling bars where the change happens.',
    )
    expect(
      (vi.mocked(HTMLMediaElement.prototype.play).mock.contexts.at(-1) as HTMLAudioElement).src,
    ).toMatch(/\/narration\/thumb-under-to-d-3\.mp3$/)
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

  it('opens, from the info button, the tip for the part of the run the player is on', () => {
    render(<CrossingTip />)
    const panel = () => usePanelStore.getState().panel
    // Before the run: the lesson's introduction.
    act(() => openLessonAbout())
    expect(panel()).toBe('lesson')
    act(() => usePanelStore.setState({ panel: null }))

    // Past the left hand's crossing: that tip again, the introduction a click away.
    playToTheCrossing()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    act(() => learning().noteOn(53))
    act(() => openLessonAbout())
    expect(screen.getByRole('dialog', { name: 'Finger 3 over' })).toBeDefined()
    expect(panel()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Lesson introduction' }))
    expect(tip()).toBeNull()
    expect(panel()).toBe('lesson')
    act(() => usePanelStore.setState({ panel: null }))

    // Past the right hand taking over: that one.
    act(() => {
      for (const note of [55, 57]) learning().noteOn(note)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    act(() => learning().noteOn(57))
    act(() => openLessonAbout())
    expect(screen.getByRole('dialog', { name: 'Right hand' })).toBeDefined()
    // Opened as the run waits for no tip: Got it closes it and the run goes on.
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(tip()).toBeNull()
    act(() => learning().noteOn(59))
    expect(learning().session.completedSteps).toBe(10)
  })

  it('opens the introduction again once the run has ended', () => {
    render(<CrossingTip />)
    playToTheCrossing()
    act(() => learning().reset())
    act(() => openLessonAbout())
    expect(tip()).toBeNull()
    expect(usePanelStore.getState().panel).toBe('lesson')
  })
})
