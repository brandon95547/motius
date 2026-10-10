import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import type { FastifyInstance } from 'fastify'
import { songCategoryChoiceSchema } from '@sonara/shared'
import { MIGRATIONS, migrate } from '../src/db/migrations.js'
import { createTestApp } from './helpers.js'

describe('song categories', () => {
  let app: FastifyInstance
  beforeEach(async () => {
    app = await createTestApp()
  })
  afterEach(async () => {
    await app.close()
  })

  const changed = async () =>
    (await app.inject({ method: 'GET', url: '/api/v1/songs/categories' })).json().items
  const change = (songId: string, payload: { genre?: string; moods?: string[] }) =>
    app.inject({ method: 'PATCH', url: `/api/v1/songs/${songId}/category`, payload })

  it('starts with no song changed: each is as the app has it', async () => {
    expect(await changed()).toEqual([])
  })

  it('remembers a change of moods, in the shape the client parses', async () => {
    const res = await change('bach-air-on-the-g-string', { moods: ['dreamy', 'romantic'] })
    expect(res.statusCode).toBe(200)
    const stored = {
      songId: 'bach-air-on-the-g-string',
      genre: null,
      moods: ['dreamy', 'romantic'],
    }
    expect(res.json()).toEqual(stored)
    const items = await changed()
    expect(items).toEqual([stored])
    for (const item of items) expect(() => songCategoryChoiceSchema.parse(item)).not.toThrow()
  })

  it('keeps the genre and the moods apart: changing one leaves the other', async () => {
    await change('joplin-maple-leaf-rag', { genre: 'blues' })
    expect(await changed()).toEqual([
      { songId: 'joplin-maple-leaf-rag', genre: 'blues', moods: null },
    ])

    await change('joplin-maple-leaf-rag', { moods: ['playful'] })
    await change('joplin-maple-leaf-rag', { moods: ['playful', 'joyful'] })
    expect(await changed()).toEqual([
      { songId: 'joplin-maple-leaf-rag', genre: 'blues', moods: ['playful', 'joyful'] },
    ])

    const both = await change('joplin-maple-leaf-rag', { genre: 'jazz', moods: ['storytelling'] })
    expect(both.json()).toEqual({
      songId: 'joplin-maple-leaf-rag',
      genre: 'jazz',
      moods: ['storytelling'],
    })
  })

  it('refuses what is not a genre or a mood, a song with no mood, and an id that is not a song id', async () => {
    const song = 'pachelbel-canon-in-d'
    expect((await change(song, { genre: 'baroque' })).statusCode).toBe(400)
    expect((await change(song, { moods: ['reflective'] })).statusCode).toBe(400)
    expect((await change(song, { moods: [] })).statusCode).toBe(400)
    expect((await change(song, { moods: ['dreamy', 'dreamy'] })).statusCode).toBe(400)
    expect((await change(song, {})).statusCode).toBe(400)
    expect((await change('Not%20A%20Song', { genre: 'jazz' })).statusCode).toBe(400)
    expect(await changed()).toEqual([])
  })

  it('leaves out what a stored row names that is no longer a genre or a mood', async () => {
    const insert = app.db.prepare(
      `INSERT INTO song_categories (song_id, genre, moods, updated_at) VALUES (?, ?, ?, '2026-01-01')`,
    )
    insert.run('satie-gnossienne-no-1', 'ragtime', '["peaceful","dreamy"]')
    insert.run('greensleeves', 'baroque', '["reflective"]')
    // What is still known is kept, and a row with nothing left is as if never changed.
    expect(await changed()).toEqual([
      { songId: 'satie-gnossienne-no-1', genre: null, moods: ['dreamy'] },
    ])
  })
})

describe('the move from mood shelves to genres and moods', () => {
  it('keeps a move to a shelf that is still a mood, and drops one to a shelf that is not', () => {
    const db = new Database(':memory:')
    const before = MIGRATIONS.filter((migration) => migration.version <= 2)
    for (const migration of before) db.exec(migration.up)
    db.pragma('user_version = 2')
    const insert = db.prepare(
      `INSERT INTO song_categories (song_id, category, updated_at) VALUES (?, ?, '2026-10-09')`,
    )
    insert.run('debussy-arabesque-no-1', 'romantic')
    insert.run('greensleeves', 'peaceful')
    insert.run('satie-gnossienne-no-1', 'reflective')

    expect(migrate(db)).toBe(MIGRATIONS.length - 2)
    expect(db.prepare('SELECT song_id, genre, moods FROM song_categories').all()).toEqual([
      { song_id: 'debussy-arabesque-no-1', genre: null, moods: '["romantic"]' },
    ])
    db.close()
  })
})
