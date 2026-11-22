import * as React from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/ui/Button'
import type { ImportFailure, ImportResult } from './read-song'
import { Notice } from './picker-parts'

/**
 * What went wrong, and what to do about it.
 *
 * Each failure needs its own sentence. "Unsupported file" tells someone
 * holding a PDF of the piece they want to learn nothing they can act on, and
 * the three cases here have three genuinely different answers.
 */
export function ImportError({
  result,
}: {
  result: Extract<ImportResult, { failure: ImportFailure }>
}) {
  const body = {
    pdf: {
      title: 'A PDF is a picture of the music, not the music',
      detail:
        'There are no notes inside a PDF, only ink — reading one needs optical recognition, and the result always needs checking by eye. MuseScore is free and can open a PDF and save it as MuseScore or MusicXML. Bring that back here and everything works.',
    },
    empty: {
      title: 'Nothing playable in this file',
      detail: 'The format was recognized, but there were no notes in it.',
    },
    unknown: {
      title: 'Not a file we could read',
      detail: 'Motius reads MusicXML, MuseScore and MIDI files.',
    },
  }[result.failure]

  return <Notice title={body.title} detail={body.detail} name={result.name} />
}

export function ImportButton({ onFiles }: { onFiles: (files: FileList | null) => void }) {
  const input = React.useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".musicxml,.xml,.mxl,.mscz,.mid,.midi,audio/midi,application/vnd.recordare.musicxml+xml"
        multiple
        hidden
        onChange={(event) => {
          onFiles(event.target.files)
          // Cleared so choosing the same file twice in a row still fires.
          event.target.value = ''
        }}
      />
      {/* Outlined: what this dialog is for is choosing, and the songs are the
          way to do that. Importing is the other thing you can do here. */}
      <Button
        size="sm"
        variant="outlined"
        startIcon={<Upload />}
        onClick={() => input.current?.click()}
      >
        Import a song
      </Button>
    </>
  )
}
