import { existsSync } from 'node:fs'
import path from 'node:path'
import { buildApp } from './app.js'
import { APP_ROOT, loadConfig } from './config.js'

/**
 * Process entry point. Everything testable lives in `buildApp`; this file owns
 * only the parts that are about being a process — binding a port, and shutting
 * down without dropping a request.
 */

/**
 * The project's `.env`, at the root of the repository, where there is one
 * (copied from `.env.example` there): one file for the API and the web app.
 * Node's own reader, so no dependency. What the environment already sets wins,
 * so a production server's own variables are never overridden by a stray file.
 */
const envFile = path.resolve(APP_ROOT, '..', '..', '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

const config = loadConfig()
const app = await buildApp(config)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info(`${signal} received, closing`)

    const deadline = setTimeout(() => {
      app.log.error(
        `close did not finish within ${config.shutdownTimeoutMs}ms — exiting and releasing the port`,
      )
      process.exit(1)
    }, config.shutdownTimeoutMs)
    // Unref'd so the timer itself never holds the process open once close wins.
    deadline.unref()

    // `close()` stops accepting connections, waits for in-flight requests and
    // then runs the onClose hooks, which is what closes the database cleanly.
    app.close().then(
      () => {
        clearTimeout(deadline)
        process.exit(0)
      },
      (error) => {
        clearTimeout(deadline)
        app.log.error({ err: error }, 'failed to close cleanly')
        process.exit(1)
      },
    )
  })
}

try {
  await app.listen({ port: config.port, host: config.host })
  app.log.info(
    config.isProduction
      ? 'Motius API ready'
      : `Motius API ready — docs at http://localhost:${config.port}/docs`,
  )
} catch (error) {
  if ((error as NodeJS.ErrnoException)?.code === 'EADDRINUSE') {
    // Worth naming outright. The usual causes are a second `npm run dev` and a
    // previous process that has not let go of the port yet, and neither is
    // obvious from a bare stack trace.
    app.log.error(
      `port ${config.port} is already in use — another Motius API is running, or the previous one has not exited yet`,
    )
  } else {
    app.log.error({ err: error }, 'failed to start')
  }
  process.exit(1)
}
