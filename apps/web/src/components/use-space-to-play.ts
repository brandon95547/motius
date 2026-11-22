import * as React from 'react'

/**
 * Space presses Play: on every screen with music to play, it does what the
 * bar's Play button does — plays, starts, pauses, goes on — as it does in
 * every player. Even with focus left on a button the mouse just pressed (a
 * mode tab, say, which Space would otherwise press again).
 *
 * Not in a field Space types into, nor inside a menu or a dialog, nor on a
 * control reached by the keyboard: there Space presses what it is on, as a
 * keyboard user expects. And never to stop a run: that loses it, and is the
 * button's to do, not a key's.
 *
 * One listener for as long as the bar is up; `action` is read when Space is
 * pressed, so it is always the button's current one.
 */
export function useSpaceToPlay(action: (() => void) | null) {
  const current = React.useRef(action)
  current.current = action

  React.useEffect(() => {
    let taken = false
    // How focus last moved: a press of the mouse or a finger, or a key (Tab,
    // an arrow). Space is the keyboard's on a control the keyboard went to.
    let byPointer = true
    const onPointerDown = () => {
      byPointer = true
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        byPointer = false
        return
      }
      if (event.repeat || !current.current) return
      const target = event.target as Element | null
      if (
        target?.closest?.(
          'input, select, textarea, [contenteditable], [role="dialog"], [role="menu"]',
        )
      )
        return
      if (target?.closest?.('button, [role]') && !byPointer) return
      // Taken before the button sees it: a button presses on Space's release.
      event.preventDefault()
      event.stopPropagation()
      taken = true
      current.current()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || !taken) return
      taken = false
      event.preventDefault()
      event.stopPropagation()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('keyup', onKeyUp, true)
    }
  }, [])
}
