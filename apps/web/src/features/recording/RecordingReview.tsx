import { Download, Trash2 } from 'lucide-react'
import { keyFromTonic, performanceLength, writeMidiFile, writeMusicXml } from '@motius/shared'
import { Button } from '@/ui/Button'
import { Drawer } from '@/ui/Drawer'
import { Divider } from '@/ui/Display'
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
      <div className="flex flex-col gap-5">
        <ExportOption
          title="MusicXML"
          extension=".musicxml"
          detail="Notation. Opens in MuseScore, Sibelius, Finale and Dorico as a grand staff you can edit and print."
          caveat="Timing is rounded onto a 4/4 sixteenth-note grid to be written down at all — read it as a tidy copy of the take, not the take."
          onExport={() =>
            downloadText(
              writeMusicXml(take, { bpm, title, key, pedal }),
              `${slug(title)}.musicxml`,
              'application/vnd.recordare.musicxml+xml',
            )
          }
        />
        <Divider />
        <ExportOption
          title="MIDI"
          extension=".mid"
          detail="The performance itself. Every DAW, sequencer and notation program reads it, and it is the format to pick if you intend to keep playing with the take."
          caveat="Keeps your exact timing and how hard each key was struck — nothing is rounded."
          onExport={() =>
            downloadBytes(writeMidiFile(take, { bpm, pedal }), `${slug(title)}.mid`, 'audio/midi')
          }
        />
      </div>
    </Drawer>
  )
}

function ExportOption({
  title,
  extension,
  detail,
  caveat,
  onExport,
}: {
  title: string
  extension: string
  detail: string
  caveat: string
  onExport: () => void
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-ui text-[var(--ds-fg)]">{title}</h3>
        <span className="text-label-sm text-[var(--ds-fg-muted)]" data-tabular>
          {extension}
        </span>
      </div>
      <p className="text-body-sm text-[var(--ds-fg-secondary)]">{detail}</p>
      <p className="text-caption text-[var(--ds-fg-muted)]">{caveat}</p>
      <Button
        size="sm"
        variant="outlined"
        startIcon={<Download />}
        onClick={onExport}
        className="w-fit"
      >
        Export {title}
      </Button>
    </section>
  )
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'recording'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Revoked on the next frame rather than immediately: some browsers have not
  // started reading the blob by the time the click handler returns.
  requestAnimationFrame(() => URL.revokeObjectURL(url))
}

const downloadText = (text: string, filename: string, type: string) =>
  download(new Blob([text], { type }), filename)

const downloadBytes = (bytes: Uint8Array, filename: string, type: string) =>
  download(new Blob([bytes as BlobPart], { type }), filename)
