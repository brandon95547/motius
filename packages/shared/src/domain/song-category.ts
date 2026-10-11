import { z } from 'zod'

/**
 * How the built-in songs are sorted: a genre, and under it a mood.
 *
 * The genre is the shelf a song is on, and it is on one. The moods are how
 * someone choosing a piece to play thinks of it, and a piece can be more than
 * one of them: Swan Lake is dramatic and tells a story. There is one list of
 * moods, and every genre is divided by the same one, so "Romantic" means the
 * same thing under Jazz as under Classical and is written down once.
 *
 * Here, in the contract, because the server stores what a song has been
 * changed to and has to know a genre or a mood from a typo. The songs
 * themselves, and what each starts as, are the app's
 * (`features/songs/catalog.ts`).
 *
 * Basic is first, and is not a kind of music: it is the shelf for someone
 * starting, where the children's songs and the easy editions are, whatever
 * they would otherwise be filed under. A shelf all the same, so a song on it
 * is on no other, and keeps its moods.
 */
export const SONG_GENRES = [
  { id: 'basic', label: 'Basic' },
  { id: 'classical', label: 'Classical' },
  { id: 'gospel', label: 'Gospel' },
  { id: 'jazz', label: 'Jazz' },
  { id: 'blues', label: 'Blues' },
  { id: 'pop', label: 'Pop' },
  { id: 'rock', label: 'Rock' },
  { id: 'country', label: 'Country' },
  { id: 'soul', label: 'Soul & R&B' },
  { id: 'folk', label: 'Folk & Traditional' },
  { id: 'new-age', label: 'New Age' },
] as const

export const SONG_MOODS = [
  { id: 'dramatic', label: 'Dramatic & Powerful' },
  { id: 'dreamy', label: 'Dreamy & Atmospheric' },
  { id: 'joyful', label: 'Joyful & Uplifting' },
  { id: 'mysterious', label: 'Mysterious & Dark' },
  { id: 'ominous', label: 'Ominous & Apocalyptic' },
  { id: 'playful', label: 'Playful & Energetic' },
  { id: 'romantic', label: 'Romantic' },
  { id: 'storytelling', label: 'Storytelling' },
] as const

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
