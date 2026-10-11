import type { Song, SongGenre, SongMood } from '@sonara/shared'
import { readSongBytes } from './read-song'

/**
 * The songs that come with Sonara: the same for everyone, and there before
 * anything has been imported.
 *
 * Each is a score in `public/songs`, named for its id, and is read through the
 * same importer as a file the player brings. Nothing here is a second way to
 * make a song: a built-in piece gets its hands, its bars and its fingering
 * exactly as an imported one does, and an improvement to the importer reaches
 * all of them without a file being touched.
 *
 * They are fetched one at a time, when chosen. All of them together are a
 * megabyte and a half that nobody wants on the way to a scale, and a parsed
 * song is far larger than its file, which is why none is kept in storage
 * either: the library in `localStorage` is for what the player brought.
 *
 * The scores are the MuseTrainer library's, and after those the PDMX
 * collection's: uploads to MuseScore that their uploaders marked public domain
 * or CC0. Where the same piece is here twice, the second says what sets it
 * apart, or failing anything better, that it is another version.
 *
 * They are sorted by genre, and under each genre by mood (`SONG_GENRES` and
 * `SONG_MOODS`, in the shared contract): a piece is in one genre, and is as
 * many of the moods as it is.
 */

export interface CatalogSong {
  /** Also the name of its score: `public/songs/<id>.mxl`. */
  readonly id: string
  readonly title: string
  readonly composer: string
  /**
   * The genre it comes in and the moods it comes under, as a first guess. The
   * chooser lets either be changed, and a change is kept by the server
   * (`/songs/categories`) rather than here, so this is what a song is until
   * someone says otherwise.
   */
  readonly genre: SongGenre
  /** At least one. */
  readonly moods: readonly SongMood[]
  /** What sets this score apart, where the piece is here more than once. */
  readonly edition?: string
}

export const SONG_CATALOG: readonly CatalogSong[] = [
  {
    id: 'bach-air-on-the-g-string',
    title: 'Air on the G String',
    composer: 'Johann Sebastian Bach',
    genre: 'classical',
    moods: ['dreamy'],
  },
  {
    id: 'bach-prelude-in-c-major-bwv-846',
    title: 'Prelude in C Major, BWV 846',
    composer: 'Johann Sebastian Bach',
    genre: 'classical',
    moods: ['dreamy'],
  },
  {
    id: 'pachelbel-canon-in-d',
    title: 'Canon in D',
    composer: 'Johann Pachelbel',
    genre: 'classical',
    moods: ['joyful', 'romantic'],
  },
  {
    id: 'schubert-ave-maria',
    title: 'Ave Maria',
    composer: 'Franz Schubert',
    genre: 'classical',
    moods: ['dreamy', 'romantic'],
  },
  // The first and third movements are a PDMX engraving of the whole sonata, cut
  // into its movements and corrected against the Peters edition. Its tremolo
  // shorthand is written out, and its speeds are one a section.
  {
    id: 'beethoven-pathetique-sonata-1',
    title: 'Pathétique Sonata, 1st Movement',
    composer: 'Ludwig van Beethoven',
    genre: 'classical',
    moods: ['mysterious', 'ominous'],
  },
  {
    id: 'beethoven-pathetique-sonata-2',
    title: 'Pathétique Sonata, 2nd Movement',
    composer: 'Ludwig van Beethoven',
    genre: 'classical',
    moods: ['romantic'],
  },
  {
    id: 'beethoven-pathetique-sonata-3',
    title: 'Pathétique Sonata, 3rd Movement',
    composer: 'Ludwig van Beethoven',
    genre: 'classical',
    moods: ['mysterious', 'ominous'],
  },
  {
    id: 'beethoven-fur-elise',
    title: 'Für Elise',
    composer: 'Ludwig van Beethoven',
    genre: 'classical',
    moods: ['romantic'],
  },
  {
    id: 'beethoven-fur-elise-fingered',
    title: 'Für Elise',
    composer: 'Ludwig van Beethoven',
    genre: 'classical',
    moods: ['romantic'],
    edition: 'With fingering',
  },
  {
    id: 'beethoven-fur-elise-easy',
    title: 'Für Elise',
    composer: 'Ludwig van Beethoven',
    genre: 'classical',
    moods: ['romantic'],
    edition: 'Easy',
  },
  // The library's engraving, with its Largo taken at forty-four rather than
  // the fifty it was given.
  {
    id: 'chopin-prelude-op-28-no-4',
    title: 'Prelude in E Minor, Op. 28 No. 4',
    composer: 'Frédéric Chopin',
    genre: 'classical',
    moods: ['mysterious'],
  },
  {
    id: 'chopin-nocturne-no-20',
    title: 'Nocturne No. 20 in C-sharp Minor',
    composer: 'Frédéric Chopin',
    genre: 'classical',
    moods: ['mysterious', 'romantic'],
  },
  {
    id: 'chopin-waltz-in-a-minor',
    title: 'Waltz in A Minor, B. 150',
    composer: 'Frédéric Chopin',
    genre: 'classical',
    moods: ['romantic'],
  },
  {
    id: 'mozart-lacrimosa',
    title: 'Lacrimosa, from the Requiem',
    composer: 'Wolfgang Amadeus Mozart',
    genre: 'classical',
    moods: ['dramatic', 'ominous'],
  },
  {
    id: 'greensleeves',
    title: 'Greensleeves',
    composer: 'Traditional',
    genre: 'folk',
    moods: ['romantic', 'storytelling'],
  },
  {
    id: 'chopin-nocturne-op-9-no-1',
    title: 'Nocturne in B-flat Minor, Op. 9 No. 1',
    composer: 'Frédéric Chopin',
    genre: 'classical',
    moods: ['romantic'],
  },
  {
    id: 'chopin-nocturne-op-9-no-2',
    title: 'Nocturne in E-flat Major, Op. 9 No. 2',
    composer: 'Frédéric Chopin',
    genre: 'classical',
    moods: ['romantic'],
  },
  {
    id: 'chopin-nocturne-op-9-no-2-easy',
    title: 'Nocturne in E-flat Major, Op. 9 No. 2',
    composer: 'Frédéric Chopin',
    genre: 'classical',
    moods: ['romantic'],
    edition: 'Easy',
  },
  {
    id: 'liszt-liebestraum-no-3',
    title: 'Liebestraum No. 3 in A-flat Major',
    composer: 'Franz Liszt',
    genre: 'classical',
    moods: ['romantic'],
  },
  // Typed in from the Breitkopf & Härtel collected edition (1880), not taken
  // from either library.
  {
    id: 'chopin-marche-funebre-op-72-no-2',
    title: 'Marche funèbre, Op. 72 No. 2',
    composer: 'Frédéric Chopin',
    genre: 'classical',
    moods: ['mysterious', 'ominous'],
  },
  // Typed in from the first edition (Breitkopf & Härtel, 1927), not taken from
  // either library. The left hand's tremolo is written out as the
  // thirty-second notes its three beams stand for.
  {
    id: 'liszt-nuages-gris',
    title: 'Nuages gris',
    composer: 'Franz Liszt',
    genre: 'classical',
    moods: ['mysterious'],
  },
  // Read bar by bar from the Mutopia Project's edition (after Breitkopf &
  // Härtel, 1850; typeset by Ryan Prince, CC BY 3.0), not taken from either
  // library. The cadenza is one long bar, and what stands under the octave
  // bracket is written where it sounds.
  {
    id: 'liszt-consolation-no-3',
    title: 'Consolation No. 3 in D-flat Major',
    composer: 'Franz Liszt',
    genre: 'classical',
    moods: ['mysterious'],
  },
  // A library engraving corrected, bar by bar, against Godowsky's edition (Art
  // Publication Society, 1923). Its last pages are on four staves, two to a
  // hand, and so are they here.
  {
    id: 'rachmaninoff-prelude-op-3-no-2',
    title: 'Prelude in C-sharp Minor, Op. 3 No. 2',
    composer: 'Sergei Rachmaninoff',
    genre: 'classical',
    moods: ['mysterious', 'ominous'],
  },
  {
    id: 'schubert-serenade',
    title: 'Serenade (Ständchen)',
    composer: 'Franz Schubert, arr. Franz Liszt',
    genre: 'classical',
    moods: ['romantic'],
  },
  {
    id: 'senneville-mariage-d-amour',
    title: "Mariage d'Amour",
    composer: 'Paul de Senneville',
    genre: 'new-age',
    moods: ['romantic'],
  },
  {
    id: 'senneville-hungarian-sonata',
    title: 'Hungarian Sonata',
    composer: 'Paul de Senneville',
    genre: 'new-age',
    moods: ['romantic'],
  },
  {
    id: 'chopin-waltz-op-64-no-2',
    title: 'Waltz in C-sharp Minor, Op. 64 No. 2',
    composer: 'Frédéric Chopin',
    genre: 'classical',
    moods: ['romantic'],
  },
  {
    id: 'beethoven-ode-to-joy-easy',
    title: 'Ode to Joy',
    composer: 'Ludwig van Beethoven',
    genre: 'classical',
    moods: ['joyful'],
    edition: 'Easy',
  },
  {
    id: 'petzold-minuet-in-g-major',
    title: 'Minuet in G Major, BWV Anh. 114',
    composer: 'Christian Petzold',
    genre: 'classical',
    moods: ['joyful'],
  },
  {
    id: 'petzold-minuet-in-g-major-2',
    title: 'Minuet in G Major, BWV Anh. 114',
    composer: 'Christian Petzold',
    genre: 'classical',
    moods: ['joyful'],
    edition: 'Version 2',
  },
  {
    id: 'mozart-sonata-no-16-k-545-1',
    title: 'Sonata No. 16 in C Major, K. 545, 1st Movement',
    composer: 'Wolfgang Amadeus Mozart',
    genre: 'classical',
    moods: ['joyful'],
  },
  {
    id: 'mozart-sonata-no-16-k-545-1-2',
    title: 'Sonata No. 16 in C Major, K. 545, 1st Movement',
    composer: 'Wolfgang Amadeus Mozart',
    genre: 'classical',
    moods: ['joyful'],
    edition: 'Version 2',
  },
  {
    id: 'happy-birthday-to-you',
    title: 'Happy Birthday to You',
    composer: 'Patty and Mildred J. Hill',
    genre: 'folk',
    moods: ['joyful'],
  },
  {
    id: 'happy-birthday-to-you-easy',
    title: 'Happy Birthday to You',
    composer: 'Patty and Mildred J. Hill',
    genre: 'folk',
    moods: ['joyful'],
    edition: 'Easy',
  },
  {
    id: 'tchaikovsky-waltz-of-the-flowers',
    title: 'Waltz of the Flowers',
    composer: 'Pyotr Ilyich Tchaikovsky',
    genre: 'classical',
    moods: ['joyful'],
  },
  {
    id: 'bach-toccata-and-fugue-in-d-minor',
    title: 'Toccata and Fugue in D Minor, BWV 565',
    composer: 'Johann Sebastian Bach',
    genre: 'classical',
    moods: ['dramatic', 'ominous'],
  },
  {
    id: 'beethoven-symphony-no-5-1',
    title: 'Symphony No. 5, 1st Movement',
    composer: 'Ludwig van Beethoven',
    genre: 'classical',
    moods: ['dramatic', 'ominous'],
    edition: 'Piano solo',
  },
  {
    id: 'beethoven-moonlight-sonata-3',
    title: 'Moonlight Sonata, 3rd Movement',
    composer: 'Ludwig van Beethoven',
    genre: 'classical',
    moods: ['dramatic'],
  },
  {
    id: 'bach-prelude-in-c-minor-bwv-847',
    title: 'Prelude in C Minor, BWV 847',
    composer: 'Johann Sebastian Bach',
    genre: 'classical',
    moods: ['dramatic'],
  },
  // The fugue that follows the Prelude in C Major, in the ASAP dataset's
  // engraving (github.com/fosfrancesco/asap-dataset, CC BY-NC-SA 4.0), not
  // taken from either library. The score gives no tempo; it is taken at
  // seventy-two.
  {
    id: 'bach-fugue-in-c-major-bwv-846',
    title: 'Fugue in C Major, BWV 846',
    composer: 'Johann Sebastian Bach',
    genre: 'classical',
    moods: ['dramatic'],
  },
  {
    id: 'handel-halvorsen-passacaglia',
    title: 'Passacaglia',
    composer: 'George Frideric Handel, arr. Johan Halvorsen',
    genre: 'classical',
    moods: ['dramatic'],
  },
  {
    id: 'tchaikovsky-swan-lake',
    title: 'Swan Lake',
    composer: 'Pyotr Ilyich Tchaikovsky',
    genre: 'classical',
    moods: ['dramatic', 'storytelling'],
  },
  {
    id: 'bella-ciao',
    title: 'Bella Ciao',
    composer: 'Traditional',
    genre: 'folk',
    moods: ['dramatic', 'storytelling'],
  },
  {
    id: 'bella-ciao-lefebvre',
    title: 'Bella Ciao',
    composer: 'Traditional',
    genre: 'folk',
    moods: ['dramatic', 'storytelling'],
    edition: 'Arr. Sami Lefebvre',
  },
  {
    id: 'luo-ni-g-minor-bach',
    title: 'G Minor Bach',
    composer: 'Luo Ni',
    genre: 'new-age',
    moods: ['dramatic'],
  },
  {
    id: 'luo-ni-g-minor-bach-2',
    title: 'G Minor Bach',
    composer: 'Luo Ni',
    genre: 'new-age',
    moods: ['dramatic'],
    edition: 'Version 2',
  },
  {
    id: 'satie-gnossienne-no-1',
    title: 'Gnossienne No. 1',
    composer: 'Erik Satie',
    genre: 'classical',
    moods: ['mysterious'],
  },
  {
    id: 'beethoven-moonlight-sonata-1',
    title: 'Moonlight Sonata, 1st Movement',
    composer: 'Ludwig van Beethoven',
    genre: 'classical',
    moods: ['mysterious'],
  },
  {
    id: 'chopin-ballade-no-1',
    title: 'Ballade No. 1 in G Minor, Op. 23',
    composer: 'Frédéric Chopin',
    genre: 'classical',
    moods: ['mysterious'],
  },
  {
    id: 'carol-of-the-bells',
    title: 'Carol of the Bells',
    composer: 'Mykola Leontovych',
    genre: 'folk',
    moods: ['mysterious'],
  },
  {
    id: 'carol-of-the-bells-easy',
    title: 'Carol of the Bells',
    composer: 'Mykola Leontovych',
    genre: 'folk',
    moods: ['mysterious'],
    edition: 'Easy',
  },
  {
    id: 'tchaikovsky-dance-of-the-sugar-plum-fairy',
    title: 'Dance of the Sugar Plum Fairy',
    composer: 'Pyotr Ilyich Tchaikovsky',
    genre: 'classical',
    moods: ['mysterious'],
  },
  {
    id: 'debussy-clair-de-lune',
    title: 'Clair de Lune',
    composer: 'Claude Debussy',
    genre: 'classical',
    moods: ['dreamy'],
  },
  {
    id: 'debussy-clair-de-lune-2',
    title: 'Clair de Lune',
    composer: 'Claude Debussy',
    genre: 'classical',
    moods: ['dreamy'],
    edition: 'Version 2',
  },
  {
    id: 'debussy-arabesque-no-1',
    title: 'Arabesque No. 1 in E Major',
    composer: 'Claude Debussy',
    genre: 'classical',
    moods: ['dreamy'],
  },
  {
    id: 'satie-gymnopedie-no-1',
    title: 'Gymnopédie No. 1',
    composer: 'Erik Satie',
    genre: 'classical',
    moods: ['dreamy'],
  },
  {
    id: 'joplin-the-entertainer',
    title: 'The Entertainer',
    composer: 'Scott Joplin',
    genre: 'jazz',
    moods: ['playful'],
  },
  {
    id: 'joplin-maple-leaf-rag',
    title: 'Maple Leaf Rag',
    composer: 'Scott Joplin',
    genre: 'jazz',
    moods: ['playful'],
  },
  {
    id: 'mozart-turkish-march',
    title: 'Turkish March (Rondo alla Turca)',
    composer: 'Wolfgang Amadeus Mozart',
    genre: 'classical',
    moods: ['playful'],
  },
  {
    id: 'mozart-turkish-march-fingered',
    title: 'Turkish March (Rondo alla Turca)',
    composer: 'Wolfgang Amadeus Mozart',
    genre: 'classical',
    moods: ['playful'],
    edition: 'With fingering',
  },
  {
    id: 'rimsky-korsakov-flight-of-the-bumblebee',
    title: 'Flight of the Bumblebee',
    composer: 'Nikolai Rimsky-Korsakov',
    genre: 'classical',
    moods: ['playful'],
  },
  {
    id: 'mozart-twinkle-variations',
    title: 'Twinkle, Twinkle, Little Star: 12 Variations',
    composer: 'Wolfgang Amadeus Mozart',
    genre: 'classical',
    moods: ['playful'],
  },
  {
    id: 'beethoven-danse-villageoise',
    title: 'Danse Villageoise No. 2',
    composer: 'Ludwig van Beethoven',
    genre: 'classical',
    moods: ['playful'],
  },
  {
    id: 'liszt-la-campanella',
    title: 'La Campanella',
    composer: 'Franz Liszt',
    genre: 'classical',
    moods: ['playful'],
  },
  {
    id: 'brahms-hungarian-dance-no-5',
    title: 'Hungarian Dance No. 5 in G Minor',
    composer: 'Johannes Brahms',
    genre: 'classical',
    moods: ['playful'],
  },
  {
    id: 'waller-aint-misbehavin',
    title: "Ain't Misbehavin'",
    composer: 'Fats Waller',
    genre: 'jazz',
    moods: ['playful'],
  },
  {
    id: 'arndt-desecration-rag',
    title: 'Desecration Rag',
    composer: 'Felix Arndt',
    genre: 'jazz',
    moods: ['playful'],
  },
  {
    id: 'carmichael-georgia-on-my-mind',
    title: 'Georgia on My Mind',
    composer: 'Hoagy Carmichael',
    genre: 'jazz',
    moods: ['romantic'],
  },
  {
    id: 'scott-frog-legs-rag',
    title: 'Frog Legs Rag',
    composer: 'James Scott',
    genre: 'jazz',
    moods: ['playful'],
  },
  {
    id: 'macleod-amazing-plan',
    title: 'Amazing Plan',
    composer: 'Kevin MacLeod',
    genre: 'jazz',
    moods: ['playful'],
    // Not public domain: free to use under Creative Commons Attribution, which
    // asks for the credit the README gives it. That credit goes where this goes.
  },
  // From here on, recent pieces their own composers published on MuseScore under CC0: given
  // away, not out of copyright by age. Each has the page it was released on.
  {
    // https://musescore.com/user/252611/scores/5985641
    id: 'hortal-xia',
    title: 'Xia',
    composer: 'Jordi Hortal',
    genre: 'classical',
    moods: ['dreamy'],
  },
  {
    // https://musescore.com/user/32246825/scores/5832126
    id: 'composing-hub-waltz-in-c-sharp-minor',
    title: 'Waltz in C-sharp Minor',
    composer: "John's Composing Hub",
    genre: 'classical',
    moods: ['mysterious'],
  },
  {
    // https://musescore.com/user/1225286/scores/6333771
    id: 'harle-sad-dream',
    title: 'Sad Dream',
    composer: 'A. R. Härle',
    genre: 'classical',
    moods: ['storytelling'],
  },
  {
    // https://musescore.com/user/31612550/scores/5881112
    // The Russian folk song, long out of copyright, in the arranger's own setting. Named for
    // the song and not for the game that made it famous, whose name is a trademark.
    id: 'korobeiniki',
    title: 'Korobeiniki',
    composer: 'Traditional',
    genre: 'classical',
    moods: ['mysterious'],
    edition: 'Arr. Tobin Waling',
  },
  {
    // https://musescore.com/user/2758676/scores/5911219
    id: 'kingavery-ranmal-nordom-fantasia-2',
    title: 'Ranmal Nordom Fantasia, 2nd Movement',
    composer: 'KingAvery',
    genre: 'new-age',
    moods: ['dreamy'],
  },
  {
    // https://musescore.com/user/9181221/scores/5968819
    id: 'pineda-afterwords-of-you',
    title: 'Afterwords of You',
    composer: 'Joshua Pineda',
    genre: 'soul',
    moods: ['storytelling'],
  },
  {
    // https://musescore.com/user/30593970/scores/5886791
    id: 'pavel-apocalypse',
    title: 'Apocalypse',
    composer: 'Andrew Pavel',
    genre: 'classical',
    moods: ['ominous'],
  },
  {
    // https://musescore.com/user/34075735/scores/5964428
    id: 'lopez-arzate-sacro',
    title: 'Sacro',
    composer: 'Angélica López Arzate',
    genre: 'new-age',
    moods: ['mysterious'],
  },
  {
    // https://musescore.com/user/24643566/scores/5624530
    id: 'anshari-bittersweet-tears',
    title: 'Bittersweet Tears',
    composer: 'Anshari H',
    genre: 'soul',
    moods: ['romantic'],
  },
  {
    // https://musescore.com/z3r0_music/scores/5979856
    id: 'kvh-etude-no-1-in-d-minor',
    title: 'Etude No. 1 in D Minor',
    composer: 'K.V.H',
    genre: 'classical',
    moods: ['mysterious'],
  },
  {
    // https://musescore.com/aspect-zero/scores/6270459
    id: 'aspect-zero-projection',
    title: 'Projection',
    composer: 'Aspect Zero',
    genre: 'soul',
    moods: ['storytelling'],
  },
  {
    // https://musescore.com/aspect-zero/scores/6287552
    id: 'aspect-zero-spin',
    title: 'Spin',
    composer: 'Aspect Zero',
    genre: 'soul',
    moods: ['storytelling'],
  },
  {
    // https://musescore.com/user/33584914/scores/5986496
    // Its title page says "inspired by Ólafur Arnalds: »saman«". Inspired, by its composer's
    // own account, and not an arrangement of it.
    id: 'schmitt-break',
    title: 'Break',
    composer: 'Alexander Schmitt',
    genre: 'soul',
    moods: ['storytelling'],
  },
  {
    // https://musescore.com/user/33584914/scores/5864396
    id: 'schmitt-fragile',
    title: 'Fragile',
    composer: 'Alexander Schmitt',
    genre: 'soul',
    moods: ['dreamy'],
  },
  {
    // https://musescore.com/user/31464933/scores/5957605
    id: 'auri-squirrels-lullaby',
    title: "Squirrel's Lullaby",
    composer: 'Auri',
    genre: 'soul',
    moods: ['romantic'],
  },
]

/** The id a built-in song has once it is open, which no imported song can have. */
export const catalogSongId = (entry: CatalogSong): string => `catalog:${entry.id}`

/** What the song is called everywhere outside the chooser, where it stands alone. */
export const catalogSongTitle = (entry: CatalogSong): string =>
  entry.edition ? `${entry.title} (${entry.edition})` : entry.title

/**
 * Fetches a built-in song and reads it.
 *
 * It takes the catalog's title rather than the file's: the scores were
 * engraved by many hands, and call themselves "Song", "Ballade I" and nothing
 * at all.
 */
export async function loadCatalogSong(entry: CatalogSong, signal?: AbortSignal): Promise<Song> {
  const name = `${entry.id}.mxl`
  const response = await fetch(`${import.meta.env.BASE_URL}songs/${name}`, { signal })
  if (!response.ok) throw new Error(`${name} answered ${response.status}`)
  const result = readSongBytes(new Uint8Array(await response.arrayBuffer()), name)
  if (!('song' in result)) throw new Error(`${name} could not be read: ${result.failure}`)
  return { ...result.song, id: catalogSongId(entry), title: catalogSongTitle(entry) }
}
