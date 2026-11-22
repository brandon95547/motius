import type * as React from 'react'
import { SONG_MOODS, type SongMood } from '@motius/shared'
import { FilterChip, Select } from '@/ui/Controls'
import type { Placed } from './picker-parts'
import { useShelfStore } from './shelf-store'
import { shortKey } from './song-keys'

/**
 * The keys and the moods, the same under every genre: all of them, or one at a
 * time, and each counts what it would show with the other as it is.
 */
export function KeyMoodFilters({
  keyRow,
  keys,
  chosenKey: key,
  mood,
  allKeysCount,
  countInKey,
  keyed,
}: {
  /** The row of keys, scrolled to the one chosen. */
  keyRow: React.Ref<HTMLDivElement>
  keys: readonly string[]
  chosenKey: string | null
  mood: SongMood | null
  /** What All keys would show: the shelf in the mood chosen. */
  allKeysCount: number
  countInKey: (name: string) => number
  /** The shelf in the key chosen: what the moods count. */
  keyed: readonly Placed[]
}) {
  return (
    <div className="flex shrink-0 flex-col gap-3 border-b border-[var(--ds-border-subtle)] py-3 md:pt-5 md:pb-4">
      <div
        ref={keyRow}
        role="group"
        aria-label="Key"
        className="scrollbar-none flex items-center gap-2 overflow-x-auto px-6 md:flex-wrap md:overflow-x-visible coarse:md:gap-y-4"
      >
        <FilterChip
          selected={key === null}
          count={allKeysCount}
          onClick={() => useShelfStore.setState({ key: null })}
        >
          All keys
        </FilterChip>
        {keys.map((name) => {
          const on = key === name
          const count = countInKey(name)
          return (
            <FilterChip
              key={name}
              selected={on}
              count={count}
              // Said in full: "Cm" is not a word a screen reader has.
              aria-label={`${name}, ${count} ${count === 1 ? 'song' : 'songs'}`}
              title={name}
              // Nothing to show is nothing to choose. The one that is
              // chosen stays, though its last song has just left it.
              disabled={count === 0 && !on}
              onClick={() => useShelfStore.setState({ key: name })}
            >
              {shortKey(name)}
            </FilterChip>
          )
        })}
      </div>
      <div className="px-6">
        <div className="w-full sm:w-64">
          <Select
            aria-label="Mood"
            value={mood ?? ''}
            onChange={(event) =>
              useShelfStore.setState({
                mood: (event.target.value || null) as SongMood | null,
              })
            }
            options={[
              { value: '', label: `All moods (${keyed.length})` },
              ...SONG_MOODS.map((each) => {
                const count = keyed.filter((song) => song.moods.includes(each.id)).length
                return {
                  value: each.id,
                  label: `${each.label} (${count})`,
                  disabled: count === 0 && mood !== each.id,
                }
              }),
            ]}
          />
        </div>
      </div>
    </div>
  )
}
