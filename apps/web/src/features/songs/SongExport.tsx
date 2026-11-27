import { AudioLines, FileMusic } from 'lucide-react'
import { writeSongMidi, writeSongMusicXml, type Song } from '@motius/shared'
import { Dialog } from '@/ui/Dialog'
import { ExportOption, ExportOptions } from '@/ui/ExportOption'
import { useCurrentSong } from '@/state/song-store'
import { downloadBytes, downloadText, fileSlug, MIDI_TYPE, MUSICXML_TYPE } from '@/lib/download'

/**
 * The song on the stage, saved as a file: MusicXML for notation, MIDI for the
 * performance. Opened from the bar's menu, under Import; loaded the first
 * time it opens.
 */
export function SongExport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const song = useCurrentSong()
  if (!song) return null
  const name = fileSlug(song.title, 'song')

  return (
    <Dialog open={open} onClose={onClose} eyebrow="Export" title={song.title}>
      <ExportOptions>
        <ExportOption
          title="MusicXML"
          extension=".musicxml"
          accent="teal"
          icon={<FileMusic size={28} />}
          detail="Sheet music for MuseScore, Sibelius, Finale or Dorico: the right hand on the upper staff and the left on the lower, with fingering, dynamics and pedaling."
          caveat={[
            song.provides.rhythm
              ? 'Written as the score states it.'
              : 'This song came from a MIDI file, so its rhythm is rounded to a 32nd-note grid to be written down.',
            leftOut(song),
          ]
            .filter(Boolean)
            .join(' ')}
          onExport={() => downloadText(writeSongMusicXml(song), `${name}.musicxml`, MUSICXML_TYPE)}
        />
        <ExportOption
          title="MIDI"
          extension=".mid"
          accent="songs"
          icon={<AudioLines size={28} />}
          detail="The performance, for any DAW or sequencer: each hand on its own track."
          caveat={[
            'Repeats are played out, and fingering is left out: MIDI has no place for either.',
            leftOut(song),
          ]
            .filter(Boolean)
            .join(' ')}
          onExport={() => downloadBytes(writeSongMidi(song), `${name}.mid`, MIDI_TYPE)}
        />
      </ExportOptions>
    </Dialog>
  )
}

/** What neither file carries: the parts behind the piano, where the song has any. */
function leftOut(song: Song): string {
  const others = song.notes.some((note) => note.role !== 'keyboard')
  return others ? 'Only the piano part is exported, not the other parts of the arrangement.' : ''
}
