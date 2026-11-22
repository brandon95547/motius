import type { Database } from 'better-sqlite3'

/**
 * Migrations, applied in order and tracked with SQLite's own `user_version`
 * pragma. No migration table, no extra dependency, and the version travels
 * inside the database file so a copied file can never disagree with itself.
 *
 * Rules: append only, never edit a shipped migration, and each one has to be
 * safe to run against a database that already has data in it.
 */
export interface Migration {
  readonly version: number
  readonly name: string
  readonly up: string
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: /* sql */ `
      -- Known MIDI controllers. Seeded from code on boot (see seed.ts) but kept
      -- in a table rather than a constant so a user-contributed profile has a
      -- place to live without a schema change.
      CREATE TABLE device_profiles (
        id                      TEXT    PRIMARY KEY,
        label                   TEXT    NOT NULL,
        manufacturer            TEXT    NOT NULL,
        key_count               INTEGER NOT NULL,
        range_low               INTEGER NOT NULL,
        range_high              INTEGER NOT NULL,
        name_pattern            TEXT    NOT NULL,
        manufacturer_pattern    TEXT,
        default_velocity_curve  TEXT    NOT NULL,
        key_count_from_name     INTEGER NOT NULL DEFAULT 0,
        priority                INTEGER NOT NULL DEFAULT 50,
        builtin                 INTEGER NOT NULL DEFAULT 1,
        CHECK (range_low  BETWEEN 0 AND 127),
        CHECK (range_high BETWEEN 0 AND 127),
        CHECK (range_low <= range_high),
        CHECK (priority BETWEEN 0 AND 100)
      );

      CREATE INDEX device_profiles_priority_idx ON device_profiles (priority DESC);

      -- Devices the browser has actually reported. The primary key is a
      -- fingerprint of manufacturer + product name, NOT the Web MIDI port id,
      -- which is implementation-defined and changes with the USB socket.
      CREATE TABLE devices (
        id             TEXT PRIMARY KEY,
        name           TEXT NOT NULL,
        manufacturer   TEXT NOT NULL DEFAULT '',
        profile_id     TEXT REFERENCES device_profiles (id) ON DELETE SET NULL,
        key_count      INTEGER NOT NULL,
        -- The config is stored as JSON and validated by zod on the way in and
        -- out. A column per setting would mean a migration every time a new
        -- one is added, and nothing ever queries across these values.
        config         TEXT NOT NULL,
        first_seen_at  TEXT NOT NULL,
        last_seen_at   TEXT NOT NULL
      );

      CREATE INDEX devices_last_seen_idx ON devices (last_seen_at DESC);
    `,
  },
  {
    version: 2,
    name: 'song_categories',
    up: /* sql */ `
      -- The built-in songs that have been moved to another shelf of the song
      -- chooser, and where to. Only the moves: a song with no row is on the
      -- shelf the app's catalog gives it. The songs are the app's, so there is
      -- no table of them here to point at.
      CREATE TABLE song_categories (
        song_id     TEXT PRIMARY KEY,
        category    TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
    `,
  },
  {
    version: 3,
    name: 'song_genres_and_moods',
    up: /* sql */ `
      -- Songs are sorted by genre, and by one or more moods under it, so what
      -- has been changed about a song is either or both of those rather than
      -- one shelf. Each is NULL where it has not been changed. The moods are a
      -- JSON list, validated on the way in and out: nothing queries inside it.
      ALTER TABLE song_categories ADD COLUMN genre TEXT;
      ALTER TABLE song_categories ADD COLUMN moods TEXT;

      -- A shelf was a mood, so a song moved to one that is still a mood keeps
      -- the move, as its only mood. The two shelves that are no longer moods
      -- (Peaceful & Calm, Reflective) have nothing to carry over to, and those
      -- songs go back to what the catalog says.
      UPDATE song_categories
         SET moods = json_array(category)
       WHERE category IN ('romantic', 'joyful', 'dramatic', 'mysterious', 'dreamy', 'playful');
      DELETE FROM song_categories WHERE moods IS NULL;

      ALTER TABLE song_categories DROP COLUMN category;
    `,
  },
  {
    version: 4,
    name: 'accounts_lesson_settings_and_runs',
    up: /* sql */ `
      -- Everyone who has signed in, by their Google account. Whether one is an
      -- admin is not kept here: it is the server's .env that says so, read on
      -- every request, so taking someone off the list takes effect at once.
      CREATE TABLE users (
        id             INTEGER PRIMARY KEY,
        google_sub     TEXT    NOT NULL UNIQUE,
        email          TEXT    NOT NULL,
        name           TEXT    NOT NULL,
        picture        TEXT,
        created_at     TEXT    NOT NULL,
        last_seen_at   TEXT    NOT NULL
      );

      -- A sign-in. Only a hash of the cookie's token is kept, so a copy of the
      -- database signs nobody in.
      CREATE TABLE sessions (
        token_hash  TEXT    PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at  TEXT    NOT NULL,
        expires_at  TEXT    NOT NULL
      );
      CREATE INDEX sessions_user_idx ON sessions (user_id);

      -- How a lesson opens, for everybody, where an admin has said. Each
      -- column is NULL where it has not been set.
      CREATE TABLE lesson_settings (
        lesson_key  TEXT PRIMARY KEY,
        key_labels  TEXT,
        stage_view  TEXT,
        hands       INTEGER,
        bpm         INTEGER,
        updated_at  TEXT NOT NULL,
        updated_by  TEXT NOT NULL
      );

      -- Every run a player has finished: the score of a lesson, an exercise or
      -- a song. Nothing queries inside one, so all but its owner, time and key
      -- is one JSON record, validated on the way in and out.
      CREATE TABLE runs (
        id       INTEGER PRIMARY KEY,
        user_id  INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        at       INTEGER NOT NULL,
        run_key  TEXT    NOT NULL,
        record   TEXT    NOT NULL
      );
      CREATE INDEX runs_user_at_idx ON runs (user_id, at);
    `,
  },
  {
    version: 5,
    name: 'lessons_reset',
    up: /* sql */ `
      -- When a player last started the lessons over, in milliseconds since
      -- 1970: their lesson scores count only the lesson runs after it, while
      -- every run stays in their history. NULL for never.
      ALTER TABLE users ADD COLUMN lessons_reset_at INTEGER;
    `,
  },
  {
    version: 6,
    name: 'devices_owner',
    up: /* sql */ `
      -- A keyboard and its settings belong to the player who announced it, so
      -- each player sees and changes only their own. The same keyboard on two
      -- players' machines is two rows, one each: the key is (user_id, id).
      --
      -- SQLite cannot add a primary key to a table, so it is rebuilt. The
      -- devices kept before there were owners go to the first account (the
      -- lowest user id), which on a one-person install is that person. Where
      -- nobody has signed in yet they have no one to go to and are dropped:
      -- the browser announces every keyboard again on the next page load, so
      -- what is lost is only settings changed before devices had owners.
      CREATE TABLE devices_owned (
        user_id        INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        id             TEXT    NOT NULL,
        name           TEXT    NOT NULL,
        manufacturer   TEXT    NOT NULL DEFAULT '',
        profile_id     TEXT    REFERENCES device_profiles (id) ON DELETE SET NULL,
        key_count      INTEGER NOT NULL,
        config         TEXT    NOT NULL,
        first_seen_at  TEXT    NOT NULL,
        last_seen_at   TEXT    NOT NULL,
        PRIMARY KEY (user_id, id)
      );

      INSERT INTO devices_owned
        (user_id, id, name, manufacturer, profile_id, key_count, config, first_seen_at, last_seen_at)
      SELECT (SELECT MIN(id) FROM users), id, name, manufacturer, profile_id, key_count, config,
             first_seen_at, last_seen_at
        FROM devices
       WHERE EXISTS (SELECT 1 FROM users);

      DROP TABLE devices;
      ALTER TABLE devices_owned RENAME TO devices;
      CREATE INDEX devices_user_last_seen_idx ON devices (user_id, last_seen_at DESC);
    `,
  },
  {
    version: 7,
    name: 'goals_and_seen_badges',
    up: /* sql */ `
      -- The weekly goal a player picked: so many runs at 90% or better a week.
      -- NULL until they pick one.
      ALTER TABLE users ADD COLUMN weekly_goal INTEGER;

      -- The badges whose unlock a player has been shown, so each is shown once
      -- on whichever device it happens. Whether a badge is earned is worked out
      -- from the runs; only that it was seen is kept. seen_at is in ms since 1970.
      CREATE TABLE seen_badges (
        user_id   INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        badge_id  TEXT    NOT NULL,
        seen_at   INTEGER NOT NULL,
        PRIMARY KEY (user_id, badge_id)
      );
    `,
  },
]

/** Applies every migration newer than the file's current `user_version`. */
export function migrate(db: Database, log?: (message: string) => void): number {
  const current = (db.pragma('user_version', { simple: true }) as number) ?? 0
  const pending = MIGRATIONS.filter((m) => m.version > current).sort(
    (a, b) => a.version - b.version,
  )

  for (const migration of pending) {
    // Each migration is one transaction: a half-applied schema is unrecoverable
    // without a backup, and there is no reason to ever risk one.
    const run = db.transaction(() => {
      db.exec(migration.up)
      db.pragma(`user_version = ${migration.version}`)
    })
    run()
    log?.(`migration ${migration.version} applied (${migration.name})`)
  }

  return pending.length
}
