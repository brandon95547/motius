import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HandsReminder } from '@/features/keyboard/HandsReminder'
import { remindThenRun, useHandsReminder } from '@/state/hands-reminder'
import { useViewStore } from '@/state/view-store'

/**
 * Which hand is which, in a dialog, when the notes are about to fall: the
 * music waits on it, and "Show next time" unticked keeps it away.
 */
describe('the hands reminder', () => {
  beforeEach(() => {
    globalThis.localStorage.removeItem('motius.hands-reminder-hidden')
    useHandsReminder.setState({ show: true })
    act(() => useViewStore.getState().setStageView('falling'))
  })
  afterEach(() => {
    cleanup()
    useHandsReminder.setState({ waiting: null })
    act(() => useViewStore.getState().setStageView('staff'))
  })
  const dialog = () => screen.queryByRole('dialog', { name: 'Which hand is which' })

  it('holds Start until it is closed, then starts', () => {
    render(<HandsReminder />)
    const start = vi.fn()
    act(() => remindThenRun(start))
    // The finger chart, the left hand on the left (its tips blue, by its
    // data-hand), each hand's fingers read left to right as the bars run them:
    // the left hand 5 to 1, the right 1 to 5.
    const hands = [...dialog()!.querySelectorAll<HTMLElement>('.finger-chart__hand')]
    expect(hands.map((hand) => hand.dataset.hand)).toEqual(['left', 'right'])
    const fingers = (hand: HTMLElement) =>
      [...hand.querySelectorAll<SVGTextElement>('.finger-chart__number')]
        .sort((a, b) => Number(a.getAttribute('x')) - Number(b.getAttribute('x')))
        .map((number) => number.textContent)
    expect(fingers(hands[0]!)).toEqual(['5', '4', '3', '2', '1'])
    expect(fingers(hands[1]!)).toEqual(['1', '2', '3', '4', '5'])
    expect(dialog()!.textContent).toContain(
      'Blue is your left hand, green your right. The number on each bar is the finger that plays it.',
    )
    expect(start).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(start).toHaveBeenCalledOnce()
    expect(dialog()).toBeNull()
  })

  it('shows again next time, unless Show next time is unticked', () => {
    render(<HandsReminder />)
    act(() => remindThenRun(() => {}))
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    act(() => remindThenRun(() => {}))
    expect(dialog()).not.toBeNull()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show next time' }))
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    const start = vi.fn()
    act(() => remindThenRun(start))
    expect(dialog()).toBeNull()
    expect(start).toHaveBeenCalledOnce()
  })

  it('stays away from the staff, where the hands are not colored', () => {
    act(() => useViewStore.getState().setStageView('staff'))
    render(<HandsReminder />)
    const start = vi.fn()
    act(() => remindThenRun(start))
    expect(dialog()).toBeNull()
    expect(start).toHaveBeenCalledOnce()
  })

  it('comes back from Settings once Show next time was unticked, and is kept on this device', () => {
    render(<HandsReminder />)
    act(() => remindThenRun(() => {}))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show next time' }))
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(globalThis.localStorage.getItem('motius.hands-reminder-hidden')).toBe('true')

    // The Hands reminder switch in Settings sets the same value.
    act(() => useHandsReminder.getState().setShow(true))
    expect(globalThis.localStorage.getItem('motius.hands-reminder-hidden')).toBeNull()
    act(() => remindThenRun(() => {}))
    expect(dialog()).not.toBeNull()
  })
})
