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
    // Blue on the left, green on the right, said for a screen reader.
    const hands = [...dialog()!.querySelectorAll<HTMLElement>('.hands-reminder__hand')]
    expect(hands.map((hand) => hand.dataset.hand)).toEqual(['left', 'right'])
    expect(dialog()!.textContent).toContain('Blue is your left hand.')
    expect(dialog()!.textContent).toContain('Green is your right hand.')
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
})
