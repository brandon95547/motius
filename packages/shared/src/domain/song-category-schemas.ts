import { z } from 'zod'
import { SONG_GENRES, SONG_MOODS } from './song-category.js'

/** The ids of a list like the two above, as the tuple `z.enum` asks for. */
const ids = <T extends string>(list: readonly { readonly id: T }[]) =>
  list.map((item) => item.id) as [T, ...T[]]

export const songGenreSchema = z.enum(ids(SONG_GENRES))

export type SongGenre = z.infer<typeof songGenreSchema>

export const songMoodSchema = z.enum(ids(SONG_MOODS))

export type SongMood = z.infer<typeof songMoodSchema>

/** A song's moods: at least one, and none of them twice. */
export const songMoodsSchema = z
  .array(songMoodSchema)
  .min(1)
  .refine((moods) => new Set(moods).size === moods.length, 'A mood is listed twice.')

/** A built-in song's id: the name of its score, in lower case with hyphens. */
export const songIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/)

/**
 * A song that has been changed from how it came, and what to.
 *
 * Only the changes are stored, and each on its own: a song given other moods
 * is still in the genre the catalog has it in, which is what `null` says. A
 * song with nothing here is as it came, so a new song, or one the catalog
 * changes its mind about, needs nothing done here.
 */
export const songCategoryChoiceSchema = z.object({
  songId: songIdSchema,
  genre: songGenreSchema.nullable(),
  moods: songMoodsSchema.nullable(),
})

export type SongCategoryChoice = z.infer<typeof songCategoryChoiceSchema>

/** A change to a song: its genre, its moods, or both. What is left out stays. */
export const setSongCategorySchema = z
  .object({
    genre: songGenreSchema.optional(),
    moods: songMoodsSchema.optional(),
  })
  .refine((change) => change.genre !== undefined || change.moods !== undefined, {
    message: 'Give a genre, moods, or both.',
  })

export type SetSongCategoryInput = z.infer<typeof setSongCategorySchema>
