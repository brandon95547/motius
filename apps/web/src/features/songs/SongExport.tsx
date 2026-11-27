import { AudioLines, FileMusic } from 'lucide-react'
import { writeSongMidi, writeSongMusicXml } from '@motius/shared'
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
    <Dialog open={open} onClose={onClose} eyebrow="Export" title={song.title} size="notice">
      <ExportOptions>
        <ExportOption
          title="MusicXML"
          extension=".musicxml"
          accent="teal"
          icon={<FileMusic size={28} />}
          detail="Sheet music, with fingering."
          onExport={() => downloadText(writeSongMusicXml(song), `${name}.musicxml`, MUSICXML_TYPE)}
        />
        <ExportOption
          title="MIDI"
          extension=".mid"
          accent="songs"
          icon={<AudioLines size={28} />}
          detail="The performance, a track per hand."
          onExport={() => downloadBytes(writeSongMidi(song), `${name}.mid`, MIDI_TYPE)}
        />
      </ExportOptions>
    </Dialog>
  )
}
