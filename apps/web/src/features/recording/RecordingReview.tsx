import { AudioLines, FileMusic, Trash2 } from 'lucide-react'
import { keyFromTonic, performanceLength, writeMidiFile, writeMusicXml } from '@motius/shared'
import { Button } from '@/ui/Button'
import { Drawer } from '@/ui/Drawer'
import { ExportOption, ExportOptions } from '@/ui/ExportOption'
import { downloadBytes, downloadText, fileSlug, MIDI_TYPE, MUSICXML_TYPE } from '@/lib/download'
import { useLearningStore } from '@/state/learning-store'
import { useRecordingStore } from '@/state/recording-store'
import { formatLength } from './RecordControls'

/** What to do with the take, once there is one. */
export function RecordingReview() {
  const status = useRecordingStore((state) => state.status)
  const take = useRecordingStore((state) => state.take)
  const pedal = useRecordingStore((state) => state.pedal)
  const discard = useRecordingStore((state) => state.discard)
  const close = useRecordingStore((state) => state.close)
  const bpm = useLearningStore((state) => state.targetBpm)
  const title = useLearningStore((state) => state.exercise?.title ?? 'Motius recording')
  /*
   * The key to write the export in.
   *
   * Taken from what you were practising rather than guessed from the notes.
   * A signature alone cannot say major or minor — no sharps is both C major and
   * A minor — so the tonic settles it.
   */
  const fifths = useLearningStore((state) => state.exercise?.keyFifths ?? null)
  const tonic = useLearningStore((state) => state.exercise?.rootPitchClass ?? null)
  const key = fifths === null || tonic === null ? null : keyFromTonic(tonic, fifths)

  const open = status === 'review' && take.length > 0

  return (
    <Drawer
      open={open}
      /* Dismissing is not discarding. Escape and a click on the scrim used to
         throw the take away — a reflex keystroke, and a performance nobody can
         get back. They put it down instead, and Discard is the only thing that
         ends it. */
      onClose={close}
      title="Recording finished"
      description={`${take.length} ${take.length === 1 ? 'note' : 'notes'} · ${formatLength(performanceLength(take))}`}
      footer={
        <Button variant="outlined" size="sm" startIcon={<Trash2 />} onClick={discard}>
          Discard
        </Button>
      }
    >
      <ExportOptions>
        <ExportOption
          title="MusicXML"
          extension=".musicxml"
          accent="teal"
          icon={<FileMusic size={28} />}
          detail="Sheet music of your take."
          onExport={() =>
            downloadText(
              writeMusicXml(take, { bpm, title, key, pedal }),
              `${slug(title)}.musicxml`,
              MUSICXML_TYPE,
            )
          }
        />
        <ExportOption
          title="MIDI"
          extension=".mid"
          accent="songs"
          icon={<AudioLines size={28} />}
          detail="Your take, exactly as played."
          onExport={() =>
            downloadBytes(writeMidiFile(take, { bpm, pedal }), `${slug(title)}.mid`, MIDI_TYPE)
          }
        />
      </ExportOptions>
    </Drawer>
  )
}

const slug = (value: string) => fileSlug(value, 'recording')
