import { afterEach, describe, expect, it } from 'vitest'
import { moveRenamedStorage } from '@/state/renamed-storage'

/**
 * The app was called Sonara, and a browser that used it then has its songs and
 * its settings saved under that name.
 *
 * What is pinned: that they are all still there under the new name the first
 * time the renamed app loads, and that nothing saved since is overwritten by
 * what was saved before.
 */

afterEach(() => {
  localStorage.clear()
})

describe('what was saved under the old name', () => {
  it('is moved to the new one, whichever way the key was written', () => {
    localStorage.setItem('sonara.songs.v1', '[{"id":"a","notes":[]}]')
    localStorage.setItem('sonara.color-theme', 'powerful')
    localStorage.setItem('sonara:instrument', 'bright-upright')

    moveRenamedStorage()

    expect(localStorage.getItem('motius.songs.v1')).toBe('[{"id":"a","notes":[]}]')
    expect(localStorage.getItem('motius.color-theme')).toBe('powerful')
    expect(localStorage.getItem('motius:instrument')).toBe('bright-upright')
    expect(localStorage.length).toBe(3)
  })

  it('remembers the built-in synth by the id it has now', () => {
    localStorage.setItem('sonara:instrument', 'sonara-studio')
    moveRenamedStorage()
    expect(localStorage.getItem('motius:instrument')).toBe('motius-studio')
  })

  it('does not replace what has been saved under the new name since', () => {
    localStorage.setItem('sonara.color-theme', 'powerful')
    localStorage.setItem('motius.color-theme', 'dark-concert')

    moveRenamedStorage()

    expect(localStorage.getItem('motius.color-theme')).toBe('dark-concert')
    expect(localStorage.getItem('sonara.color-theme')).toBeNull()
  })

  it('leaves alone a key that only begins the same way', () => {
    localStorage.setItem('sonarathon', 'kept')
    moveRenamedStorage()
    expect(localStorage.getItem('sonarathon')).toBe('kept')
  })
})
