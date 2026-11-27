import * as React from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Narration } from '@/ui/Narration'

/**
 * Words read aloud: by themselves only the first time on a device, then from
 * their button, which says Pause while the sound plays, whatever a start that
 * came to nothing answers, and whenever.
 */
beforeEach(() => globalThis.localStorage.clear())
afterEach(cleanup)

describe('the narration button', () => {
  it('says Pause while it plays, though a start cut short is refused after it', async () => {
    let refuse = () => {}
    vi.mocked(HTMLMediaElement.prototype.play)
      // The first start, cut short by the second (React opening it twice, as
      // in development), answers late that it was refused.
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            refuse = () => reject(new DOMException('interrupted', 'AbortError'))
          }),
      )
    render(
      <React.StrictMode>
        <Narration file="two-black-key-groups.mp3" open />
      </React.StrictMode>,
    )
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined()
    await act(async () => refuse())
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined()
  })

  it('plays by itself only the first time, and after that waits for its button', async () => {
    const play = vi.mocked(HTMLMediaElement.prototype.play)
    const first = render(<Narration file="two-black-key-groups.mp3" open />)
    expect(play).toHaveBeenCalledTimes(1)
    first.unmount()
    render(<Narration file="two-black-key-groups.mp3" open />)
    expect(play).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Read the objective aloud' })).toBeDefined()
    // Another recording still plays its first time.
    cleanup()
    render(<Narration file="three-black-key-groups-2.mp3" open />)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('plays by itself again where the browser refused the first time', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
      new DOMException('no click yet', 'NotAllowedError'),
    )
    const first = render(<Narration file="two-black-key-groups.mp3" open />)
    await act(async () => {})
    first.unmount()
    render(<Narration file="two-black-key-groups.mp3" open />)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined()
  })

  it('says Play where the browser will not start it without a click', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
      new DOMException('no click yet', 'NotAllowedError'),
    )
    render(<Narration file="two-black-key-groups.mp3" open />)
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Read the objective aloud' })).toBeDefined()
  })
})
