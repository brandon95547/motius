import { ListMusic } from 'lucide-react'
import * as React from 'react'
import { fingerSong, type Song } from '@motius/shared'
import { Button } from '@/ui/Button'
import { Field, SegmentedControl } from '@/ui/Controls'
import { Divider } from '@/ui/Display'
import { OptionGroup } from '@/ui/Surface'
import { useLearningStore } from '@/state/learning-store'
import { useCurrentSong, useSongStore, type SongPart } from '@/state/song-store'
import { panelActions } from '@/state/panel-store'
import { useSongPlayback } from './use-song-playback'
import { useSongLearning } from './use-song-learning'
import { useSongPractice } from './use-song-practice'

/**
 * The Songs controls, in the options panel: what is practised — which song,
 * and which hand's part of it. How it is practised (the mode, the tempo and
 * Play) is the bar's one set of playing controls (`PlayControls`), the
 * same as every other screen's.
 *
 * The playback and step-tracking engine is its own component, mounted whenever
 * the topic is Songs, and deliberately not part of any control. It used to live
 * inside the song row, which was fine while the row was always on screen; now
 * that controls fold away at narrow widths and live in a panel that closes, an
 * engine inside one would stop the song every time it did.
 */
export function SongEngine() {
  const song = useCurrentSong()
  useSongFingering(song)
  useSongPlayback(song)
  useSongLearning(song)
  useSongPractice(song)
  return null
}

/**
 * Keeps the open song fingered by the fingering system that is chosen.
 *
 * A song is fingered when it is read, by the system chosen then. So one opened
 * after the setting is changed, or changed under, has the other system's
 * scales in it; and one kept in the library from before every note was
 * fingered has gaps. Either is fingered again here, once, when it is the song
 * that is open — not the whole library at once, which would be seconds of
 * work for songs nobody is looking at.
 */
function useSongFingering(song: Song | null) {
  const system = useLearningStore((state) => state.fingeringSystem)
  React.useEffect(() => {
    if (!song || song.fingeredBy === system) return
    const fingered = fingerSong(song, { system })
    // A song with nothing to finger comes back as it went in.
    if (fingered !== song) useSongStore.getState().replace(fingered)
  }, [song, system])
}

const PART_OPTIONS: readonly { value: SongPart; label: string }[] = [
  { value: 'both', label: 'Both' },
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
]

/** The speeds a passage is usually practised at, as a share of the song's own. */
const SPEEDS = [0.5, 0.75, 1]
const percent = (scale: number) => `${Math.round(scale * 100)}%`

/**
 * The options of the Songs area, for the panel the bar's Options button opens:
 * which song, which hand's part, and how much of its speed.
 */
export function SongOptions() {
  const song = useCurrentSong()
  const part = useSongStore((state) => state.part)
  const setPart = useSongStore((state) => state.setPart)
  const tempoScale = useSongStore((state) => state.tempoScale)
  const setTempoScale = useSongStore((state) => state.setTempoScale)

  return (
    <>
      <OptionGroup>
        <Field label="Song">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-ui text-[var(--ds-fg)]">
              {song ? song.title : 'No song is open'}
            </span>
            <Button
              variant="outlined"
              size="sm"
              startIcon={<ListMusic />}
              className="shrink-0"
              // The chooser is a dialog of its own, and takes this panel's place.
              onClick={() => panelActions.open('library')}
            >
              Choose a song
            </Button>
          </div>
        </Field>
      </OptionGroup>
      {song && (
        <>
          <Divider />
          <OptionGroup>
            <Field label="Hands">
              <SegmentedControl<SongPart>
                label="Hands"
                value={part}
                onChange={setPart}
                options={PART_OPTIONS}
              />
            </Field>
            {/* Where the bar has no room for its tempo: the three speeds worth
                one press. A speed that is none of them lights none. */}
            <Field
              className="panel-only-xs"
              label="Speed"
              hint={`${Math.round(song.bpm * tempoScale)} BPM. The song is written at ${Math.round(song.bpm)}.`}
            >
              <SegmentedControl
                label="Speed"
                value={String(tempoScale)}
                onChange={(scale) => setTempoScale(Number(scale))}
                options={SPEEDS.map((scale) => ({ value: String(scale), label: percent(scale) }))}
              />
            </Field>
          </OptionGroup>
        </>
      )}
    </>
  )
}
