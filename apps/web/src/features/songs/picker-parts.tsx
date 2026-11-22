import type * as React from 'react'
import type { SongGenre, SongMood } from '@motius/shared'
import type { CatalogSong } from './catalog'

/** The pieces the song chooser's lists share: what a row is, and how one looks. */

/** A built-in song as it is filed now: by the catalog, or by a change to it. */
export interface Placed {
  readonly entry: CatalogSong
  readonly genre: SongGenre
  readonly moods: readonly SongMood[]
}

/** A stretch of the list under one heading. */
export interface Section {
  readonly id: string
  readonly title: string
  readonly songs: readonly Placed[]
}

/** A piece and which score of it, for naming the controls of one row. */
export const nameOf = (entry: CatalogSong) =>
  `${entry.title}${entry.edition ? `, ${entry.edition}` : ''}`

export const row = [
  'flex w-full items-center gap-3 rounded-[var(--radius-md)] border p-2.5 text-left',
  'transition-[background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]',
].join(' ')
export const rowIdle =
  'border-[var(--ds-border-subtle)] hover:border-[var(--ds-border-strong)] hover:bg-[var(--ds-layer-hover)]'
export const rowCurrent = 'border-[var(--ds-accent-border)] bg-[var(--ds-layer-selected)]'
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus-ring)]'

/** A shelf of the list: its name, a label's distance above what it names. */
export function Shelved({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-overline text-[var(--ds-fg-muted)] uppercase">{title}</h3>
      {children}
    </section>
  )
}

/** Says which song is the one already open. */
export function OpenMark() {
  return <span className="shrink-0 text-label-sm text-[var(--ds-accent-text)]">Open</span>
}

export function Notice({ title, detail, name }: { title: string; detail: string; name?: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--ds-warning-border)] bg-[var(--ds-warning-subtle)] p-3"
    >
      <span className="text-ui text-[var(--ds-fg)]">{title}</span>
      <span className="text-body-sm text-[var(--ds-fg-secondary)]">{detail}</span>
      {name && <span className="text-caption text-[var(--ds-fg-muted)]">{name}</span>}
    </div>
  )
}
