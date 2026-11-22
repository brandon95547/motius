import * as React from 'react'
import { useLearningStore } from '@/state/learning-store'
import { useSongStore } from '@/state/song-store'
import { readSong, type ImportResult } from './read-song'

/**
 * Importing the player's own files into the chooser.
 *
 * The readers come in with this module, which only the chooser imports, so
 * they stay out of the first load.
 *
 * The import is deliberately format-sniffing rather than extension-trusting.
 * A `.mid` that is really XML, or a `.xml` that is really a MIDI file, are both
 * things that happen when files come out of other programs, and the first four
 * bytes settle it in a way a filename never can.
 */
export function useSongImport(onClose: () => void) {
  const { add } = useSongStore.getState()
  const [importError, setImportError] = React.useState<ImportResult | null>(null)

  const onFiles = async (list: FileList | null) => {
    // Copied out before the first await. A FileList is a live view of the
    // input, and the input is cleared the moment this returns — so reading it
    // again after an await finds it empty, and the dialog never closes.
    const files = [...(list ?? [])]
    if (files.length === 0) return

    setImportError(null)
    let imported = 0
    for (const file of files) {
      const result = await readSong(file, {
        fingering: useLearningStore.getState().fingeringSystem,
      })
      if ('song' in result) {
        add(result.song)
        imported++
      } else {
        setImportError(result)
      }
    }
    // Out of the way once there is something to play. A file we could not read
    // keeps the dialog open, with the reason on screen.
    if (imported > 0) onClose()
  }

  return { importError, setImportError, onFiles }
}
