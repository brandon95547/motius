import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { MIGRATIONS, migrate } from '../src/db/migrations.js'

/** The database as it was before devices had owners, with one keyboard in it. */
function before(users: string[]) {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  for (const migration of MIGRATIONS.filter((each) => each.version <= 5)) db.exec(migration.up)
  db.pragma('user_version = 5')
  const now = new Date().toISOString()
  for (const email of users) {
    db.prepare(
      `INSERT INTO users (google_sub, email, name, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(`sub-${email}`, email, email, now, now)
  }
  db.prepare(
    `INSERT INTO devices (id, name, manufacturer, key_count, config, first_seen_at, last_seen_at)
     VALUES ('yamaha-p-125', 'P-125', 'Yamaha', 88, '{}', ?, ?)`,
  ).run(now, now)
  return db
}

describe('migration 6, devices_owner', () => {
  it('gives the devices kept before owners to the first account', async () => {
    const db = before(['first@example.com', 'second@example.com'])
    migrate(db)
    const first = db.prepare('SELECT id FROM users WHERE email = ?').get('first@example.com')
    expect(db.prepare('SELECT user_id AS userId, id FROM devices').all()).toEqual([
      { userId: (first as { id: number }).id, id: 'yamaha-p-125' },
    ])
    db.close()
  })

  it('drops them where nobody has signed in yet', async () => {
    const db = before([])
    migrate(db)
    expect(db.prepare('SELECT COUNT(*) AS n FROM devices').get()).toEqual({ n: 0 })
    db.close()
  })

  it('forgets a player’s devices with their account', async () => {
    const db = before(['first@example.com'])
    migrate(db)
    db.prepare('DELETE FROM users').run()
    expect(db.prepare('SELECT COUNT(*) AS n FROM devices').get()).toEqual({ n: 0 })
    db.close()
  })
})

describe('migration 7, goals_and_seen_badges', () => {
  const migrated = () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    migrate(db)
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO users (google_sub, email, name, created_at, last_seen_at)
       VALUES ('sub-a', 'a@example.com', 'a', ?, ?)`,
    ).run(now, now)
    return db
  }

  it('adds the weekly goal, empty, and the seen badges table', async () => {
    const db = migrated()
    expect(db.pragma('user_version', { simple: true })).toBe(7)
    expect(db.prepare('SELECT weekly_goal AS goal FROM users').get()).toEqual({ goal: null })
    const columns = db.prepare('PRAGMA table_info(seen_badges)').all() as { name: string }[]
    expect(columns.map((each) => each.name)).toEqual(['user_id', 'badge_id', 'seen_at'])
    db.close()
  })

  it('forgets a player’s seen badges with their account', async () => {
    const db = migrated()
    db.prepare(
      `INSERT INTO seen_badges (user_id, badge_id, seen_at)
       SELECT id, 'course-scales', 1 FROM users`,
    ).run()
    db.prepare('DELETE FROM users').run()
    expect(db.prepare('SELECT COUNT(*) AS n FROM seen_badges').get()).toEqual({ n: 0 })
    db.close()
  })
})
