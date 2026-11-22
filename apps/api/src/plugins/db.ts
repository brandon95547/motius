import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { openDatabase, type Db } from '../db/index.js'
import { DeviceRepository } from '../repositories/device-repository.js'
import { GoalsRepository } from '../repositories/goals-repository.js'
import { LessonSettingsRepository } from '../repositories/lesson-settings-repository.js'
import { RunRepository } from '../repositories/run-repository.js'
import { SongCategoryRepository } from '../repositories/song-category-repository.js'
import type { Warn } from '../repositories/stored-json.js'

declare module 'fastify' {
  interface FastifyInstance {
    db: Db
    devices: DeviceRepository
    goals: GoalsRepository
    lessonSettings: LessonSettingsRepository
    runs: RunRepository
    songCategories: SongCategoryRepository
  }
}

export interface DbPluginOptions {
  databasePath: string
}

/**
 * Opens the database and decorates the instance with it and with the
 * repositories built on top of it.
 *
 * Registered as a plugin so the close hook is owned by Fastify: on SIGTERM the
 * server drains its requests and *then* closes the connection, rather than the
 * process exiting with a write in flight.
 */
export const dbPlugin = fp<DbPluginOptions>(
  async function dbPlugin(app: FastifyInstance, options: DbPluginOptions) {
    const db = openDatabase({
      path: options.databasePath,
      log: (message) => app.log.info({ scope: 'db' }, message),
    })

    app.decorate('db', db)
    const warn: Warn = (fields, message) => app.log.warn({ scope: 'db', ...fields }, message)
    app.decorate('devices', new DeviceRepository(db))
    app.decorate('goals', new GoalsRepository(db))
    app.decorate('lessonSettings', new LessonSettingsRepository(db))
    app.decorate('runs', new RunRepository(db, warn))
    app.decorate('songCategories', new SongCategoryRepository(db, warn))

    app.addHook('onClose', async () => {
      db.close()
      app.log.info({ scope: 'db' }, 'database closed')
    })
  },
  { name: 'motius-db' },
)
