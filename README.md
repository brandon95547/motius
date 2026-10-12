# Motius — Next Level Piano Mastery

A virtual piano for the browser. Pick an instrument, play it with a mouse, a
touchscreen or a USB MIDI keyboard, and watch every note land on the keys.

<!-- The keyboard is the product. Everything else on the screen exists to get
     out of its way. -->

## What it does today

### Finding your way

The dashboard has nine categories, each a numbered card, three to a row, in the
order they are taught:

1. **Piano Foundations** — Keyboard Layout, Understanding Pitch, Fingers & Hand
   Positions, Playing Your First Notes.
2. **Music Notation & Reading**
3. **Rhythm & Timing**
4. **Scales, Intervals & Keys** — Scales, Intervals.
5. **Chords & Harmony** — Chords, Arpeggios, Progressions, Cadences.
6. **Piano Technique** — Fingering Exercises.
7. **Musical Expression**
8. **Musical Structure & Styles**
9. **Practice & Repertoire** — Daily Practice, Songs.

A category with something in it opens a page of its sections, and a section
may have sections of its own, as far down as the subject goes. Piano
Foundations is laid out in full: Keyboard Layout has White and black keys,
Musical alphabet and Keyboard navigation, each a page of its lessons; Fingers &
Hand Positions has Finger numbering, Starting positions and Hand movement; and
Understanding Pitch and Playing Your First Notes are pages of lessons
themselves. Under the dashboard and those pages a bar along the bottom leads to
the other places at the top of the app: Home (the dashboard), Lessons, Songs,
Practice, Progress and Search. It is not there in an area, where the bottom of
the screen is the keyboard's and the menu is the way out.

Where you are is said in the bar across the top — `Dashboard › Piano
Foundations › Keyboard Layout` — and each step of it is a way back; on a
narrow bar the steps furthest up fold away first. A section that is built opens
what it is for: Scales, Chords and Arpeggios their areas, Cadences the
cadences, Daily Practice the routines, Fingering Exercises the exercises below,
Songs the song library. A place that is not built yet (every lesson of Piano
Foundations, four of the nine categories, the Intervals and Progressions
sections, and Lessons, Practice, Progress and Search in the bar) has a page of
its own that says so, at the address it will keep —
`#/piano-foundations/keyboard-layout/white-and-black-keys/two-black-key-groups`,
`#/rhythm-and-timing`, `#/progress` — so what is built there later is built in
a place that already exists.

The whole of it is one table (`features/areas/areas.tsx`), from which the
dashboard, those pages, the bar along the bottom and the menu are all drawn.

### The instrument

- **A virtual keyboard on center stage**, responsive from 320px to a 4K monitor.
  It is sized in the sizes keyboards are sold in — 25, 32, 37, 49, 61, 76, 88 —
  defaulting to **76 key**, and each one keeps the range that size really has
  (a 32 starts on F, a 76 on E). Auto narrows when the screen cannot show 76 at
  a playable key width, and never widens past it: a 4K monitor has room for all
  88, but that is not a reason to hand someone more keyboard than they need.
  The view follows what you play, so a note off-screen still shows up.
- **Six pianos** — a sampled concert grand, an upright, a honky-tonk, a Rhodes,
  a Wurlitzer, and a fully synthesized one that needs no network at all. The
  bright upright is the one a new player hears.
- **USB MIDI in**, with per-keyboard detection and configuration: transpose,
  octave shift, velocity curve, channel filter and sustain pedal, saved against
  the keyboard and restored the next time it is plugged in.
- **A live grand staff** above the keyboard, and view controls beneath it —
  follow, key labels (off, notes, degrees or fingers), scale structure, and the
  staff itself.

### Learning a scale

- **Explore, Learn, Practice.** Explore lights every note of the scale across
  the whole keyboard; Learn walks you through one note at a time with the
  recommended finger on the key; Practice takes the guidance away and keeps
  score.
- **A hundred and twenty scale types** — major, all three minors, the five
  modes, both pentatonics, blues, chromatic and whole tone, and after them the
  bebop scales, the symmetric ones, the modes of the melodic minor, the
  harmonic minor and the harmonic major, the double harmonic and Hungarian
  scales, the Neapolitans, Japanese and Ethiopian pentatonics, Balinese pelog,
  the thaats of Hindustani music and the melakartas of Carnatic — in every key,
  one to three octaves, ascending, descending or both. Right hand, left hand,
  or both together: the left hand sits an octave below the right, the way scale
  books print a scale "in octaves".
- **One scale, one name.** A set of notes is in the list once, under the name
  it usually goes by, and is found by any of its others: the picker is typed
  into, and "acoustic", "overtone" and "Vachaspati" all find Lydian Dominant.
  "Understand this scale" says what each is and what else it is called.
- **The other lines of the page.** With both hands: contrary motion from a
  shared note, and the hands a third or a sixth apart — each starting where
  The Brown Scale Book starts it when the connected keyboard reaches that far,
  and an octave higher when it does not.
- **Thirds, octaves and the cadence.** A hand can play the scale in double
  thirds (major keys), or in octaves, staccato or legato; and a major or minor
  scale that comes back down can close with I – IV – V – I, the way the book
  ends each one.
- **Fingering from the book, and a choice of book.** The recommended fingers
  for major, minor and chromatic scales are the ones printed in The Brown Scale
  Book — the traditional fingering, and the default. Settings ▸ Fingering
  switches to the **Natural** system, after Penelope Roskell, which puts the
  long fingers on the black keys: the same in most keys, and a different left
  hand in G, D, A and F major and in a number of the minors.
- **Play it to hear it.** A demo button walks the scale at the tempo you have
  set, driving the same finger and target guidance Learn uses.
- **Chords and arpeggios.** Two more areas, built on the same engine: each
  key's triad, its four-note form and its seventh chord (dominant in a major
  key, diminished in a minor) in every position, solid and broken; and the
  same chords as two-octave arpeggios from each position. Fingered from The
  Brown Scale Book in all twenty-four keys.
- **"Understand this scale"** explains the one you have selected: how it is
  built from its tetrachords, its degrees, its relative key, and the fingering
  principle behind the hand you are being shown.

### Fingering exercises

A fingering is a hand position and the ways of leaving it. A piece asks for
all of those at once and in passing, which is the worst way to meet any of them
for the first time, so each has an exercise that is nothing else — in any key,
major or minor, with the staff, the keys, Learn and Practice and the tempo that
every other area has (Practice ▸ Fingering Exercises).

- **Five-Finger Position** — five fingers on five keys, up and back: the
  position everything else leaves.
- **Passing the Thumb** — back and forth over each place _this key's scale_
  passes the thumb: under the 3rd finger after E and under the 4th after B, in
  C major. One hand at a time, because the hands cross in different places.
- **Passing the Thumb in an Arpeggio** — the same across a chord, where the
  thumb has a third or a fourth to travel.
- **Broken Chords** — I, IV and V taken as shapes and played a finger at a
  time.
- **Changing Fingers on a Repeated Note** — each note three times, 3 2 1.
- **Finger Independence** — one figure carried up the scale and back, every
  finger playing in every bar. The figure is the first of Hanon's.

The crossings and the chord shapes are taken from the fingering system chosen
under Settings ▸ Fingering, so what is drilled here is what the scales area
teaches and what a song is fingered with, and changes when the system does:
the left hand passes over its thumb on D and G in G major traditionally, and on
B and E under the Natural system. "Understand this exercise" says what each one
trains and how to practise it. (`learning/fingering-exercise.ts`.)

### Songs

- **Eighty-two pieces come with it**, from Bach to Fats Waller, in a chooser
  that Songs opens on: shelved by genre — Basic, Classical, Gospel, Jazz, Blues,
  Pop, Rock, Country, Soul & R&B, Folk & Traditional, New Age, where Basic is
  the shelf for someone starting: the children's songs and the easy editions —
  and under every genre by the same eight moods: Dramatic & Powerful, Dreamy &
  Atmospheric, Joyful & Uplifting, Mysterious & Dark, Ominous & Apocalyptic,
  Playful & Energetic, Romantic, Storytelling. A piece is in one genre and can
  have several moods;
  the moods are a dropdown over the list — all of them, or one at a time — and
  the list is searchable by title or composer. Either can be changed for any
  piece from the chooser ("Edit categories"), and the change is kept by the
  server for everyone. Above the moods is a button for every key a piece is
  in, A through G with its flat or sharp and an "m" for a minor key, for
  keeping to the keys your hands know; a key stays chosen from genre to genre.
  Your own songs are in the same chooser.
- **Or find it by name, from the bar.** On a window wide enough, a search field
  sits beside the play controls: a few letters list the songs that have them,
  best match first, your own among them, and the one chosen — with the arrows
  and Enter, or a click — is opened without the chooser coming up.
- **Import MusicXML (`.musicxml`, `.xml`), Compressed MusicXML (`.mxl`),
  MuseScore (`.mscz`) and MIDI (`.mid`, `.midi`)** — normalized into one score
  model on the way in, so playback, the keyboard, the staff and Learn never know
  which format a song came from. Formats are identified by their first bytes,
  not their extension.
- **It tells you what the file did not carry.** Notes, rhythm, hands, dynamics,
  pedal and fingering are each recorded as present or absent, and the library
  says so rather than quietly filling gaps.
- **Repeats are played as written.** A repeat sign sends the song back, a first
  ending is taken the first time and stepped over the second, and the page
  shows the signs and the brackets rather than the passage written out twice.
- **A staff is read in the clef the score puts it in.** A right hand that goes
  down into the bass is written in the bass clef while it is there, and a left
  hand that climbs is written in the treble: the notes sit on the staff where
  the page has them rather than on ledger lines, a small clef in the music
  marks each change, and the clef at the head of the line is the one in force.
- **A line of music gets the room it needs between its staves.** Each hand is
  on its own staff, so a right hand written far below middle C hangs under the
  treble staff while a left hand written far above it stands over the bass;
  where both happen in one bar the system is opened until the two are clear of
  each other, as a printed page does. One distance for a line — the staff does
  not move under the player — and none added to music that keeps to its staves.
- **A hand written on the other staff is drawn there, and stays with its
  line.** A right hand that runs down into the bass is often written on the
  lower staff, to spare the ledger lines, and beamed to its notes on the upper
  one. It is drawn there, with one beam between the staves and the stems of
  each coming to it, and it is not handed to the left hand for being on the
  left hand's staff.
- **It says where a hand is the score's and where it is a reading.** A staff
  is not proof of a hand and neither is a voice. A hand the score marks — a
  part named for it, an "m.d." or "L.H." over the note — is taken at its word.
  Where the page leaves it open (a line on the other hand's staff, a middle
  staff of three) the note keeps the hand of the line it belongs to, is never
  switched on a guess, and the Hand position panel says "suggested" when you
  reach it.
- **A tied note is written wherever the score writes it**, including where
  nothing is struck beside it: a chord held through the last bar has its
  noteheads, its ties and its bar.
- **Three staves, or four, where the score has them.** Piano music too thick
  for two staves is printed on more — the end of Rachmaninoff's Prelude in
  C-sharp Minor on four, two to a hand — and is drawn on the staves it was
  written on, each in its own clef: three under one brace, four with a brace
  to each hand's pair. A staff that is empty for a long stretch is left off
  the page while it is, the way a printed score goes from two staves to four
  when the music thickens, and the bars before the change are shared between
  the last two lines rather than leaving one alone.
- **Fingering is worked out for files that have none** — see below.
- **Hands over the keys, playing the fingering.** Switched on from the song's
  options, two see-through hands are drawn on the keyboard where the fingering
  puts them: each finger on its key, the others where the hand would have
  them, the thumb reaching in from the side. Playing, a finger sets off just
  before its note and is on the key as it sounds, and its tip fills when the
  key goes down; in Learn the hands show the step you are on and wait. Only
  for a song that has fingering, since that is all they are drawn from.
- **Drums are played as drums.** A MIDI file's percussion channel is routed to a
  synthesized kit rather than onto the piano, and accompaniment parts sound
  without lighting keys you are not being asked to play.
- **Explore and Learn for songs**, with part selection, tempo, a metronome and a
  progress bar over the staff. Imported songs persist between sessions.

### Recording

- **Record what you play**, with a three-second countdown, and export the take as
  **MIDI** or **MusicXML**.

### Fingering on import

MIDI has nowhere to record which finger plays a note — the format has no field
for it — and a published score marks only the fingers that are in doubt: where
the hand is put down, where it moves, where the obvious choice is the wrong one.
The rest is left to a player who knows how a hand lies and how a scale is
fingered. A learner does not yet, so Motius works the rest out, and **every
note of every song has a finger**: all eighty-two of the songs that come with
it, and whatever is imported after them.

It goes on three things.

- **What the score prints.** An editor's finger is the one thing about a
  passage that is known and not inferred. It is kept exactly, and the notes
  round it are fingered to arrive at it and to leave it — which is what the
  mark was for. A score with a few fingers in it used to be left with only
  those; now they are where the rest starts from. Inside a scale run, a printed
  finger is read as the editor saying where the thumb goes, and the run's two
  groups are placed to agree with it.
- **How a hand lies.** Each hand's part is cut into stretches and each is
  fingered by searching every possibility against a published model of what a
  hand finds difficult (Parncutt et al., _Music Perception_ 14(4), 1997 — twelve
  weighted rules the authors tested against fingerings pianists wrote on Czerny
  studies). Chords are fingered from the shapes the method books print, keyed
  by the intervals between the notes: the hand model cannot choose between
  `1 3 5` and `1 2 4` for a C major triad, and a book can.
- **How scales and arpeggios are fingered**, by whichever fingering system is
  chosen under Settings ▸ Fingering. A run up or down a scale is fingered as
  that scale is, a run through a chord as its arpeggio is, and a broken chord —
  an Alberti bass — as the chord is held. So the left hand running down G major
  in a piece takes the fingers it was taught for G major, and different ones
  under the other system. Changing the setting fingers the open song again;
  what the score printed does not change. Five notes in a row are left as a
  hand position, whatever scale they are from: a scale's fingering is where
  the thumb passes, and it only has to from the sixth.

Two things it used to refuse and no longer does.

- **The hand moves.** Two notes that some pair of fingers could reach, taken
  with a pair that cannot, were forbidden outright — right for two notes and
  wrong for a passage. Three notes an octave apart, going up, are thumb, little
  finger, and then nothing; with no way through, the whole stretch came back
  unfingered, and one bar of broken octaves blanked the nine hundred notes
  round it. That was nearly all of the fingering that was missing. A move is
  now priced: more than anything in position between neighbouring notes, and
  little across an octave, where a hand lets go of a bass note to take the
  chord over it. A leap is charged by how far the hand travels, which is why a
  bass note lands on the 5th finger.
- **A chord no hand can hold is fingered anyway**, in the order the hand lies,
  and marked as one that arrives in pieces. A bass note with a melody two
  octaves over it on the same staff is still played, and a player still wants
  to know what with. About one note in fifty of the built-in songs is in a
  chord like that.

**You can always tell which you are looking at.** A note says whether its
finger is the score's, and a song is labeled _Fingered score_ where an editor
fingered all of it, _Suggested_ where Motius did, and _Score and suggested_ for
the usual case between. The staff prints the fingers a reader could not have
worked out — a new position, a leap, a change of shape — and always the ones
the score itself printed; Settings ▸ Staff ▸ Fingering prints all of them, or
none.

Imported through the real path, a MIDI C major scale up and back down comes out
`1 2 3 1 2 3 4 5 · 4 3 2 1 3 2 1` — the fingering a method book prints, from a
file that could not have contained it.

The full reference for all of this — the twelve rules, the span tables, the
published scale fingerings and how they were verified — is
`piano-fingering-reference.md`, kept alongside this repo rather than inside it
because it is source material for more than one project.

## Getting started

Node **24** — pinned in `.nvmrc` / `.node-version` and used by CI. With
[nvm](https://github.com/nvm-sh/nvm), identically on macOS and Linux:

```bash
nvm install && nvm use
```

```bash
npm install
npm run dev
```

That starts both halves: the API on **:5175** and the app on **:5174**. Vite
proxies `/api` to the API, so the browser only ever talks to one origin — no
CORS in development and no difference from production.

| Command             | What it does                         |
| ------------------- | ------------------------------------ |
| `npm run dev`       | API + web, both in watch mode        |
| `npm run build`     | Type-check and build every workspace |
| `npm test`          | Every workspace's tests              |
| `npm run typecheck` | Type-check without emitting          |
| `npm run format`    | Prettier over the repo               |

Node 24 is the pinned version; 22.12+ also works. Node **23 does not** — it is
end-of-life and several dependencies exclude it, which shows up as `EBADENGINE`
warnings on install. API docs are served at
<http://localhost:5175/docs> from the OpenAPI document the routes generate.

### Is it already running, and how to stop it

```bash
lsof -nP -iTCP:5174 -iTCP:5175 -sTCP:LISTEN
```

A line for 5175 means the API is up, a line for 5174 means the web app is up,
and no output means nothing is serving.

That only shows what is listening. To see the processes behind the stack as
well — including a watcher that is still alive after its server was killed:

```bash
pgrep -fl "motius/node_modules/.bin/(concurrently|tsx|vite)"
```

To stop it, press Ctrl-C in the terminal where `npm run dev` is running. If
that terminal cannot be found:

```bash
pkill -f "motius/node_modules/.bin/(concurrently|tsx|vite)"
```

**Do not `kill` the pid that `lsof` reports on 5175.** That is only the server
process. Its parent is `tsx watch`, which starts a new server the next time a
watched file changes, so the API comes back by itself. The `pkill` above takes
out the watcher too.

### If the app says "Loading pianos…" and stays there

The API is not answering. Almost always that is **two `npm run dev` stacks at
once**: the second one's API cannot bind port 5175, dies, and leaves the first
one's socket in place — so requests are accepted and never answered.

```bash
ps aux | grep concurrently      # should show exactly one stack
ss -tln | grep 517              # 5174 and 5175, one owner each
curl --max-time 5 localhost:5175/api/v1/health
```

The app now says so rather than spinning: the client gives a request six
seconds, the app bar switches to _Pianos unavailable_ on the first failure, and
the page shows what went wrong with a Try again once the retry is spent.

### Checking that it actually makes a sound

A silent app and a working one are identical in the DOM — the key lights up
either way, and every unit test passes either way. `npm run verify:audio`
(with `npm run dev` already running) drives real Chrome over the DevTools
Protocol, taps every connection into the audio destination with an analyzer,
clicks middle C and reads the RMS.

It deliberately does **not** relax Chrome's autoplay policy. Browsers refuse to
start audio before a user gesture, so a freshly loaded page sits with a
suspended AudioContext and the first click on a key has to both unlock the
audio and play the note. That is the interesting case, and relaxing the policy
would hide it. Until that first gesture the app says so, on the instrument
itself, rather than being quietly silent.

## Layout

```
packages/shared   the domain: MIDI decoding, note math, scales and
                  fingering, the score model and its importers' output,
                  velocity curves, device profiles, and the zod schemas the
                  API and the app both validate against
apps/api          Fastify + SQLite. The piano catalog, the controller
                  profile database, and per-device configuration
apps/web          React + Vite + Tailwind v4. The keyboard, the audio
                  engines, and the Web MIDI integration
```

`@motius/shared` is the contract. Both sides import the same zod schemas, so a
response the server can emit and the client cannot parse is a build error
rather than a runtime one.

## How it is put together

### The design system

The interface follows the [UI Bible](https://ui.skylanex.com), which is the
interface standard across these products. `apps/web/src/styles/tokens.css` is a
verbatim copy of its token layer — three tiers, primitive → semantic →
component, and a component that reaches past the semantic tier is a bug. Fix
values upstream and re-copy rather than editing them here.

Motius's own additions live in `motius.css`, in the component tier. The
keyboard is the one deliberate exception to reasoning from the elevation ramp:
a piano key is a depiction of a physical object, and a "white key" assigned
`--ds-surface-raised` because that is where it sits in the hierarchy is a piano
nobody recognizes. The reasoning is written next to the values.

A key changes colour on the frame its note sounds, with no fade, and each black
key is drawn on a layer of its own. Both are for what the keyboard costs while
a song plays. A fade of 75ms kept some key part-way through one at every
moment of a fast piece, so the browser drew a frame sixty times a second
instead of when a key changed; and the black keys' blurred shadows shared a
surface with every other key, so lighting one key blurred all of them again.
Playing the Moonlight Sonata's third movement cost one and a half processor
cores before the two changes and about four-fifths of one after.

### Audio

Two engines behind one interface.

`SynthEngine` is additive synthesis in the browser — a bank of decaying sine
partials through a velocity-tracking low-pass, plus a noise transient for the
hammer. No network, no license, always available.

`SampledEngine` wraps [smplr](https://github.com/danigb/smplr) and streams real
piano samples from a CDN.

Selecting a sampled piano does **both**: the built-in engine is built
immediately from that instrument's own voicing so the keyboard is playable on
the very next keystroke, and the samples are swapped in underneath when they
arrive. If they never arrive — an offline laptop, a captive portal, a blocked
CDN — nothing swaps, the UI says so, and the piano still plays. Every catalog
entry carries a voicing for exactly this reason.

The sustain pedal is held by the provider rather than by either engine: it is a
property of the performance, not of the instrument, so every engine gets
identical pedal behavior and an engine swap mid-pedal cannot strand a note.

An audio engine with nothing to play is put to sleep. A running `AudioContext`
renders silence at full price — about a twentieth of a processor core for the
two Motius keeps, for as long as the tab is open — so each one is suspended a
minute after its last sound, or five seconds after if the page is hidden, and
woken by the next note, click or touch (`audio/quiet.ts`). Waking takes about
fifteen milliseconds. A key held down, or held by the pedal, keeps it awake for
as long as it is held.

### The learning system

Everything Motius can teach reduces to the same thing: an ordered list of steps,
where a step is a set of notes that has to sound before the next one is due. A
scale is a sequence of one-note steps; a chord is one step of three notes; a
progression is a sequence of chord-shaped steps.

```
packages/shared/src/music/      pitch spelling, scale definitions, fingering
packages/shared/src/learning/   the Exercise model, builders, the session engine
```

Nothing downstream — not the engine, not the keyboard, not the dashboard — knows
which of those it is looking at. Chords and Arpeggios arrived that way: a
builder each (`learning/chord-exercise.ts`) that returns steps, and the
highlighting, the finger badges, the staff, the scoring and the dashboard worked
on them as they were. Progressions and Exercises are still to come; their cards
are shown and locked rather than hidden, because the shape of the thing is the
promise.

The session engine is a **pure reducer over note events**, deliberately:
everything interesting in it — when a step advances, what counts as a mistake,
how tempo is inferred — is logic that has to be right, and logic that is right is
logic you can test without a browser, an AudioContext or a MIDI cable.

**Notes are spelled properly.** A MIDI note number knows its pitch but not its
name: note 6 is F♯ in D major and G♭ in D♭ major. Each degree takes the letter
its _number_ implies and whatever accidental makes that letter sound right, so
A♭ major comes out as A♭ B♭ C D♭ E♭ F G rather than G♯ A♯ C C♯ D♯ F G, C blues
keeps its traditional G♭ and G♮ on the same letter, and G♯ harmonic minor gets
the F𝄪 it actually has. The root spelling is chosen the way a musician would —
whichever of the two enharmonics needs fewer accidentals — which is how pitch
class 1 comes out as D♭ _major_ and C♯ _minor_.

**Fingering is a recommendation, never a reading.** MIDI reports which note was
played and how hard. It does not report which finger played it, and Motius does
not pretend otherwise — the cards say so.

Two sources answer two different questions, and which one applies decides what
the answer is labeled.

_A fingering system_ answers for the scales its source prints. There are two,
chosen under Settings ▸ Fingering. **Traditional / Orthodox** is the default,
and it is a transcription of the fingering printed in _Scales, Chords and Arpeggios for
Piano — The Brown Scale Book_ (Frederick Harris): every major key, every minor
key in its harmonic and melodic forms, and the chromatic scale; each key's
chords, which the book fingers alike in every key; each key's arpeggios, which
it fingers differently in every one; double thirds in the major keys; octaves;
and the closing cadence. It is held to one rule — it says
what the page says:

- **The ends of a run are kept as printed.** The book opens A♭ major in the
  right hand on `2 3` and only takes `3 4` on those notes an octave later; it
  turns the left hand at the top of F♯ major on the 2nd finger though F♯ takes
  the 4th everywhere below. A run is stored as what repeats plus what the page
  does differently on its lowest and highest notes, so those survive at any
  length.
- **Printed digits only.** The scan it was read from has a previous owner's
  pencil over several openings. The print underneath is what counts.
- **A melodic minor is fingered as two scales**, up and down, because the page
  prints both — and a natural minor, which has no line of its own in the book,
  is fingered as the melodic form's descent.
- **Keys are looked up by name, not by pitch class.** D♯ minor and E♭ minor are
  the same piano keys and different keys: other signature, other note names.
  The book prints D♯ minor, so that is the page; E♭ minor is played _from_ that
  page by a stated step, the way the book's own titles read "F♯ Major
  (Enharmonic G♭ Major)". The key picker offers both names where both are real
  keys.

The notes of a scale live in `music/scales.ts` and know nothing about fingers.
A system is asked, separately, which fingers it puts on them
(`music/fingering-system.ts`), so adding one is a new file and a line in a
table, and no scale definition changes.

**Natural / Topographical** is the second (`music/fingering-natural.ts`),
transcribed from the charts of Penelope Roskell's _The Art of Piano Fingering:
A New Approach to Scales and Arpeggios_ (LCM Publications, 1996). The
traditional fingerings are C major's carried to every key; this school starts
from the keyboard instead — the black keys are shorter and higher and the three
middle fingers are the long ones, so the finger the thumb passes under goes on
a black key wherever the scale has one to give it. Jon Verbalis's _Natural
Fingering_ (Oxford, 2012) argues the same and says it shorter: fourth on black,
thumb on white.

It is the traditional pages with some of them turned, and it names the ones it
turns:

- **Major scales:** the left hand of G, D, A and F, each with its 4th finger on
  the key's one convenient black key. Every other major is the tradition's.
- **Minor scales:** the right hand of A, C and D harmonic minor and of the
  sharp minors' openings; the left hand of A, C and G harmonic and of C, D, F
  and G melodic. A melodic minor comes down as its relative major is fingered,
  so some hands descend on different fingers from the ones they climbed on.
- **Arpeggios of the triad:** one finger for each note of the chord, kept in
  every inversion and at any number of octaves, with the thumb on the third or
  the fifth where the tradition puts it on a white tonic.

It keeps the traditional fingering wherever Roskell's chart does, including
against its own rule, and it asks the traditional system for what is not
transcribed yet: the chords, the octaves and the cadences, which she fingers as
the tradition does, and the double thirds and seventh-chord arpeggios, which
she does not.

_Worked out_ covers everything else — the modes, the pentatonics, blues, whole
tone, and the hundred-odd scales of `music/scale-library.ts`. For scales with
no published fingering the
thumb positions are planned across the whole passage by shortest path and the
fingers filled in afterwards, which makes the result playable by construction —
no finger reachable twice, the little finger only at an end. Run over the notes
of the 24 published scales it reproduces the body of every one, differing only
at the outer notes where the page opens or turns its own way. Two
rules do that work, and their order is the whole point: "the thumb avoids black
keys" is a preference, "the hand has five fingers" is anatomy, and enforcing the
first absolutely while letting the second slide produces fingerings that ask the
little finger for three rising notes in a row.

Anything worked out is labeled _Suggested_, and anything a system supplied is
labeled with the system's name, because those are different claims.

### Songs

Four formats in, one score model out. `read-song.ts` is the only way in and
sniffs the first bytes rather than trusting an extension — a `.xml` that is
really MIDI and a `.mid` that is really XML both happen when files come out of
other programs.

`.mxl` and `.mscz` are both zips. The MusicXML one is read through the manifest
its spec requires; the MuseScore one is **not**, because MuseScore 4 lists every
file in the archive as a `<rootfile>` with the style sheet first, so following
the pointer hands back `score_style.mss`. The score is found by extension
instead. MuseScore 3 happens to put it first and survives either reading, which
is why both are kept as fixtures.

A staff is only a hand when one `<Part>` owns two of them. Two single-staff
parts are two instruments, and reading the lower one as a left hand puts a
melody where no left hand plays — and, worse, claims the score said so.

With one exception, in MusicXML: two one-staff parts that are both keyboards,
the first in the treble clef and the second in the bass, are one piano written
a staff to a hand, and are read as its right and left. And where several parts
are called a piano, the one on two staves is the piano; a one-staff part beside
it is a line of ornaments, heard and not asked for.

Which hand plays a note is read in this order, and nothing lower down the
list overrules what is higher:

1. **What the score states.** A part named for a hand. A hand marked over the
   music ("m.d.", "m.g.", "m.s.", "R.H.", "L.H.", or the words): where one
   line of music begins at the mark, that note is the marked hand's.
2. **The line it belongs to.** A voice has a staff of its own — MuseScore
   numbers them (1 to 4 on the upper staff, 5 to 8 on the lower), and
   otherwise it is the staff most of the voice is on — and a note has its
   voice's hand, on whichever staff it is written.
3. **The staff**, where a file's voice numbers name nothing (the same number
   for a line on each staff).

Neither a staff nor a voice is proof of a hand, so wherever the two disagree
the note carries `handSuggested` (and `staff`, to say where it is drawn), and
`Song.handsSuggested` counts them. The same goes for the notes a hand mark
governs after the one it stands on — the phrase it opens, read as that line
running on unbroken on the same staff until a rest or another mark — and for
the notes on an inner staff of a piano on three staves or four. A note is
never moved to the other hand because that hand is free to take it: a run
written across the staves in one voice may well be shared between the hands,
and the score has not said so. Where more than one line begins at a hand mark
it is given to none of them, whichever staff it is written against: nothing is
moved, and the notes it disagrees with are marked as open.

A MusicXML piano part on three staves or four keeps them. Every note, rest and
clef carries the number of the staff it is on (`staff`, with `Song.staves`
saying how many there are), and the hand is read from the staff: the upper half
are the right hand's and the lower the left's, and the middle one of an odd
number goes by the clef it opens in. The top staff and the bottom one are a
piano page's usual two. Whose the staves between them are is custom and not
something a file states, so every note on one is marked `handSuggested`. The page draws such a score a pair of staves at
a time (`layersOf`), each pair by the code that draws a piano's usual two, set
under one another with the room between any two neighbors that their notes
ask for (`layoutOf`). A staff with nothing on it for eight bars or more is left
off the page for as long as it is empty (`regionsOf`), never leaving fewer than
two: the page view starts a new line where the staves change, and the moving
staff shows one such stretch at a time.

Two parts named for the hands ("Right Hand" and "Left Hand", "Piano, RH" and
"Piano, LH", and the like in French, Spanish, Italian and German) are the two
hands of one piano, however many staves each is on: two of two staves are a
piano on four. That is the one thing a part list can say about hands. Two
parts that are each simply a piano stay two pianos, the first played and the
second heard — of the 218 such files in the PDMX piano collection nearly all
are duets or pieces for two pianos, and nothing in a file tells those from one
pianist's music written on four staves.

A song keeps what is written apart from how it is played. Its notes and bars
are the score, once, in score time; `sections` is the order the bars are played
in where a repeat or an ending makes that something other than once through
(`songs/performance.ts`, which also turns one clock into the other). Playback,
the playhead and Learn all go through it, so a repeated passage is the same
notes on the page the second time, and the staff draws repeat signs and ending
brackets instead of growing a bar for every bar repeated. MusicXML's repeats
and endings are read; D.C., D.S. and codas are not yet, and neither are a
MuseScore file's repeats.

A note sounds for as long as it is written, and its key is lit for as long as a
finger can be on it, which is not always the same. Where a hand has to go
before its note is over — a bass note written for the bar under a chord the
same hand plays a beat later — the note sounds on and the key comes up as the
hand leaves (`songs/key-holds.ts`: the two fingers have to be two that span
the distance, by the same table the fingering is worked out from). It comes
up in the strike of the note that takes the hand away, not on a timer of its
own, so the two happen together however busy the page is.
And a key that is about to be struck again comes up for a moment first, as it
has to on a piano: lit for as long as each is written, a repeated note is one
unbroken light, the first ending as the second begins (`keyRestrikes`, and
`LIFT_MS` in the playback).

The hands over the keys are drawn from the same reading (`features/hands`).
`hand-poses.ts` is the part with no drawing in it: which key each finger is
on from moment to moment, and where that puts the fingertips and the knuckles
over a keyboard, in the keys' own percentages. `HandsOverlay.tsx` draws it, on
the keybed and under the finger numbers, and moves it by hand rather than by
rendering: it listens to the playhead and to the keys, and a hand is ten lines
whose ends it sets, eased over the tenth of a second a finger is given to get
to its key.

The page is engraved from the same song, by one engraver for both views. A
staff that carries two voices in a bar is written as two: each voice a chord
of its own, with its own length and its stem pointing away from the other
(`VoicePart`, decided bar by bar in `staff/score.ts`). A tied note is one note
to play and as many noteheads as the score wrote, the later ones standing at
their own moments with a tie back to the one before. Rests are drawn where a
hand is waiting — in the middle of the bar for a whole bar's rest, with the
other hand's chord at the same moment, or in the room before the next chord —
and not for a voice that rests while its own hand plays the other. Everything
drawn is attached to a chord or a bar, so both views lay it out the same way
and only the stretch near the window is ever in the page.

The songs that come with the app are scores in `apps/web/public/songs`, listed
in `features/songs/catalog.ts` with a title, a composer, the key its score
opens in (which the catalog test holds to the score), a genre and one or
more moods each (`SONG_GENRES` and `SONG_MOODS` in the shared contract: one
list of moods, shared by every genre; a song whose genre or moods were changed
is a row in the API's `song_categories` table, and only what was changed is
stored). They are read through `read-song.ts` like any other file, one at a
time as they are chosen, and held in memory rather than in storage: they come
back with the app, and the stored library is for what the player brought.
`song-catalog.test.ts` reads every one of them, so a score that loses a hand
on import fails there rather than in front of a player. The scores are from the
[MuseTrainer library](https://github.com/musetrainer/library) and the
[PDMX](https://zenodo.org/records/15571083) collection, but for three read
from old editions, bar by bar: Liszt's "Nuages gris" from its first edition
(Breitkopf & Härtel, 1927), Chopin's Marche funèbre, Op. 72 No. 2, from the
Breitkopf & Härtel collected edition (1880), and Rachmaninoff's Prelude in
C-sharp Minor, a PDMX engraving corrected against Godowsky's edition (Art
Publication Society, 1923), on four staves where that goes onto four — each
hand's pair a part named for it, as the page labels them, so its hands are the
page's and not a reading.
The first movement of Beethoven's Pathétique is likewise a PDMX engraving
corrected against the Peters edition, its left-hand tremolo shorthand written
out as the eighth notes it stands for. Its third movement is the
[Mutopia Project](https://www.mutopiaproject.org)'s edition (after Berners,
1908), typeset by Chris Sawer and placed in the public domain, converted from
its LilyPond source.
Liszt's Consolation No. 3 was read, bar by bar, from the
[Mutopia Project](https://www.mutopiaproject.org)'s edition (after Breitkopf &
Härtel, 1850), typeset by Ryan Prince and licensed under
[Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/).
Bach's Fugue in F-sharp Major, BWV 858, and the second movement of his Italian
Concerto, BWV 971, are the engravings in the
[ASAP dataset](https://github.com/fosfrancesco/asap-dataset) (Foscarin, McLeod,
Rigaux, Jacquemard and Sakai, 2020), which is licensed under
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/):
shared with credit, and not for commercial use.

Fourteen are recent pieces their own composers published under CC0, giving up their
rights in them; `catalog.ts` has the page each was released on. One more is not in
the public domain and is here under its license: "Amazing
Plan" by Kevin MacLeod ([incompetech.com](https://incompetech.com)), licensed
under [Creative Commons: By Attribution 4.0](https://creativecommons.org/licenses/by/4.0/),
transcribed here as a piano score.

Where the file names no hands at all, which is most MIDI files, they are worked
out from the music rather than from each note's pitch. A chord is decided as a
chord, hands divide at a gap of an octave or more rather than at middle C, and a
passage stays in the hand already playing it. Splitting by pitch tore the
opening of every song whose chords sit across middle C — which is most of them.

Fingering that the file did not carry is worked out on import by
`songs/song-fingering.ts`, over the hand model in `music/hand-model.ts` and the
search in `music/finger-passage.ts`. Runs break at chords and at rests long
enough to move the hand.

### MIDI

Web MIDI needs a secure context, so the app must be on `https` or `localhost` —
opening a dev server's LAN address on a phone will report MIDI as unavailable,
and the UI says which of the four possible reasons applies.

Every connected port is listened to, not just a selected one: a player with a
controller and a digital piano plugged in at once expects both to work. Each
port carries its own configuration, and messages go through the same pipeline in
the same order — decode, channel filter, velocity curve, transpose. Downstream,
the keyboard and the engines see notes that are already correct and know nothing
about devices.

Devices are identified by a **fingerprint of manufacturer plus product name**,
not by `MIDIInput.id`. The Web MIDI id is implementation-defined: Chrome derives
it from the USB port, so it changes when you move the cable to the other socket,
and settings keyed on it vanish. The fingerprint also strips the trailing port
index browsers append, so Chrome's `P-125` and Firefox's `P-125 MIDI 1` are one
keyboard.

### Device profiles

`apps/api/src/data/device-profiles.ts` holds around thirty controller profiles,
seeded into SQLite on boot. Detection runs in three tiers — a curated profile, a
key count read out of the product name, then a 61-key default — and the tier is
returned to the client so an auto-guess is never presented as a fact.

A profile marked `keyCountFromName` lets the product name override its size, so
one `Launchkey` row covers the 25, 37, 49 and 61. Profiles without it keep their
own size, because a Yamaha NP-32 has 76 keys and reading "32" out of the model
number is exactly the mistake the flag exists to prevent.

## Database

SQLite, migrated by `user_version` so the schema version travels inside the file.
Migrations are append-only and each one runs in its own transaction.

WAL mode means the newest writes live in the `-wal` file, not the main one:
`cp motius.sqlite` silently loses them. Back up with
`VACUUM INTO 'backup.sqlite'` instead.

## Browser support

Playing, and everything on screen, works everywhere. **MIDI input needs Chrome,
Edge or Opera** — Safari and Firefox have no Web MIDI. The app detects this and
says so rather than appearing to ignore the keyboard.
