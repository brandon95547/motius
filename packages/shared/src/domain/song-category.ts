/*
 * The genres and moods the built-in songs are sorted by.
 *
 * Plain values, apart from the schemas (`song-category-schemas.ts`), so the browser
 * can use them without carrying zod (docs/adr/0009).
 */

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
