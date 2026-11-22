import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SetSongCategoryInput, SongCategoryChoice } from '@motius/shared'
import { api } from '@/lib/api'
import { SONG_CATALOG, type CatalogSong } from './catalog'
import type { Placed } from './picker-parts'

/** The key the changed songs are kept under in the query cache. */
const MOVED = ['song-categories'] as const
type Moves = { items: SongCategoryChoice[] }

/**
 * What each song has been changed to, over what the catalog says of it.
 *
 * Asked of the server, which keeps the changes. Without an answer — no
 * server, or nothing changed — every song is as it came, and the chooser is
 * as usable as it was.
 */
export function useSongCategories(open: boolean) {
  const [moveFailed, setMoveFailed] = React.useState<CatalogSong | null>(null)
  const queryClient = useQueryClient()
  const moved = useQuery({
    queryKey: MOVED,
    queryFn: ({ signal }) => api.listSongCategories(signal),
    staleTime: Infinity,
    enabled: open,
  })
  const placed = React.useMemo<readonly Placed[]>(() => {
    const changes = new Map(moved.data?.items.map((item) => [item.songId, item]))
    return SONG_CATALOG.map((entry) => {
      const change = changes.get(entry.id)
      return { entry, genre: change?.genre ?? entry.genre, moods: change?.moods ?? entry.moods }
    })
  }, [moved.data])
  const move = useMutation({
    mutationFn: ({ entry, change }: { entry: CatalogSong; change: SetSongCategoryInput }) =>
      api.setSongCategory(entry.id, change),
    // Where it is going at once, and back as it was if the server refuses.
    onMutate: async ({ entry, change }) => {
      setMoveFailed(null)
      await queryClient.cancelQueries({ queryKey: MOVED })
      const before = queryClient.getQueryData<Moves>(MOVED)
      const earlier = before?.items.find((item) => item.songId === entry.id)
      queryClient.setQueryData<Moves>(MOVED, {
        items: [
          ...(before?.items ?? []).filter((item) => item.songId !== entry.id),
          {
            songId: entry.id,
            genre: change.genre ?? earlier?.genre ?? null,
            moods: change.moods ?? earlier?.moods ?? null,
          },
        ],
      })
      return { before }
    },
    onError: (_error, { entry }, context) => {
      queryClient.setQueryData(MOVED, context?.before)
      setMoveFailed(entry)
    },
  })
  return { placed, move, moveFailed, setMoveFailed }
}
