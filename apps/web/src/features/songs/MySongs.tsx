import { Trash2 } from 'lucide-react'
import type { Song } from '@motius/shared'
import { cn } from '@/lib/cn'
import { IconButton } from '@/ui/Button'
import { focusRing, OpenMark, row, rowCurrent, rowIdle, Shelved } from './picker-parts'

/** Named for what the file is, not for what it is closest to. */
const SOURCE_LABELS: Record<string, string> = {
  midi: 'MIDI',
  musicxml: 'MusicXML',
  musescore: 'MuseScore',
}

/** The player's own songs: the ones they imported, each to open or remove. */
export function MySongs({
  songs,
  currentId,
  onChoose,
  onRemove,
}: {
  songs: readonly Song[]
  currentId: string | null
  onChoose: (id: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <Shelved title="My songs">
      {songs.length === 0 ? (
        <p className="text-body-sm text-[var(--ds-fg-muted)]">
          Nothing imported yet. A MusicXML or MuseScore file is the one to bring if you have a
          choice: those carry the staves, the dynamics, the pedaling and the fingering. MIDI keeps a
          performance exactly as played, and carries none of those — the format has nowhere to put
          them.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {songs.map((song) => (
            <ImportedRow
              key={song.id}
              song={song}
              current={song.id === currentId}
              onChoose={() => onChoose(song.id)}
              onRemove={() => onRemove(song.id)}
            />
          ))}
        </ul>
      )}
    </Shelved>
  )
}

function ImportedRow({
  song,
  current,
  onChoose,
  onRemove,
}: {
  song: Song
  current: boolean
  onChoose: () => void
  onRemove: () => void
}) {
  return (
    <li className={cn(row, 'coarse:gap-4', current ? rowCurrent : rowIdle)}>
      <button
        type="button"
        aria-current={current ? 'true' : undefined}
        onClick={onChoose}
        className={cn('flex min-w-0 flex-1 flex-col items-start text-left', focusRing)}
      >
        <span className="w-full truncate text-ui text-[var(--ds-fg)]">{song.title}</span>
        <span className="text-caption text-[var(--ds-fg-muted)]">
          {SOURCE_LABELS[song.source] ?? 'Score'} · {song.measureCount}{' '}
          {song.measureCount === 1 ? 'bar' : 'bars'} · {Math.round(song.bpm)} BPM
          {song.handsInferred ? ' · hands guessed from pitch' : ''}
          {song.handsSuggested
            ? ` · hand suggested for ${song.handsSuggested} ${song.handsSuggested === 1 ? 'note' : 'notes'}`
            : ''}
          {(song.parts?.length ?? 0) > 1 && <>{` · ${song.parts.join(', ')}`}</>}
        </span>
        <Provided song={song} />
        {song.partsKnown === false && (
          <span className="mt-1 text-caption text-[var(--ds-warning-text)]">
            Imported before drums were separated, so every part plays on the piano. Import the file
            again to split them.
          </span>
        )}
      </button>
      {current && <OpenMark />}
      <IconButton
        size="sm"
        variant="text"
        label={`Remove ${song.title}`}
        icon={<Trash2 />}
        onClick={onRemove}
      />
    </li>
  )
}

/**
 * What the file carried, and what it did not.
 *
 * Every format loses something different and the player has no way to tell
 * which — "no pedaling in this piece" and "this file did not record pedaling"
 * look identical once imported. Saying so is the only way to tell them apart,
 * and it is also the argument for bringing a score rather than a MIDI.
 */
function Provided({ song }: { song: Song }) {
  const provides = song.provides
  if (!provides) return null

  const labels: [keyof typeof provides, string][] = [
    ['rhythm', 'Rhythm'],
    ['staves', 'Hands'],
    ['dynamics', 'Dynamics'],
    ['pedal', 'Pedal'],
    ['fingering', 'Fingering'],
  ]
  const missing = labels.filter(([key]) => !provides[key])
  if (missing.length === 0) return null

  return (
    <span className="mt-0.5 text-caption text-[var(--ds-fg-muted)]">
      Not in this file: {missing.map(([, label]) => label.toLowerCase()).join(', ')}
    </span>
  )
}
