import { writeSongMidi, writeSongMusicXml, type Song } from '@motius/shared'
import { Dialog } from '@/ui/Dialog'
import { Divider } from '@/ui/Display'
import { ExportOption } from '@/ui/ExportOption'
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
      <div className="flex flex-col gap-5">
        <ExportOption
          title="MusicXML"
          extension=".musicxml"
          detail="Notation. Opens in MuseScore, Sibelius, Finale and Dorico as a grand staff: the right hand on the upper staff, the left on the lower, with the fingering, dynamics, pedaling, repeats and chord symbols."
          caveat={[
            song.provides.rhythm
              ? 'Written as the score states it.'
              : 'This song came from a MIDI file, so its rhythm is rounded to a 32nd-note grid to be written down.',
            leftOut(song),
          ].join(' ')}
          onExport={() => downloadText(writeSongMusicXml(song), `${name}.musicxml`, MUSICXML_TYPE)}
        />
        <Divider />
        <ExportOption
          title="MIDI"
          extension=".mid"
          detail="The performance. Every DAW and sequencer reads it, with each hand on its own track, the right hand first."
          caveat={[
            'Repeats are played out, and fingering is left out: MIDI has no place for either.',
            leftOut(song),
          ].join(' ')}
          onExport={() => downloadBytes(writeSongMidi(song), `${name}.mid`, MIDI_TYPE)}
        />
      </div>
    </Dialog>
  )
}

/** What neither file carries: the parts behind the piano, where the song has any. */
function leftOut(song: Song): string {
  const others = song.notes.some((note) => note.role !== 'keyboard')
  return others ? 'Only the piano part is exported, not the other parts of the arrangement.' : ''
}
