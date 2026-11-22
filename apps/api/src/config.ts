import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { z } from 'zod'

/**
 * Environment parsing.
 *
 * Validated once, at import, and thrown on failure. A server that boots with a
 * missing or malformed variable and only discovers it on the first request is a
 * server that fails in production at the worst possible moment.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
/** `src/` in dev, `dist/` after a build — the workspace root is one level up from either. */
export const APP_ROOT = path.resolve(here, '..')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5175),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_PATH: z.string().min(1).default('./data/motius.sqlite'),
  CORS_ORIGINS: z.string().default('http://localhost:5174,http://127.0.0.1:5174'),
  LOG_LEVEL: z.enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  ADMIN_EMAILS: z.string().default(''),
  SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  /** The largest request body, in bytes. Nothing this API takes is large. */
  BODY_LIMIT_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(16 * 1024 * 1024)
    .default(64 * 1024),
  /** The largest body of POST /runs: a device's runs from before sign-in, at once. */
  RUNS_BODY_LIMIT_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(64 * 1024 * 1024)
    .default(4 * 1024 * 1024),
  /** How long fetching Google's sign-in keys may take before sign-in gives up. */
  GOOGLE_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(5_000),
  /**
   * How long a graceful shutdown gets before the process leaves anyway. A close
   * that never resolves keeps the port, so the next start dies with EADDRINUSE
   * and looks like "the API will not come back up". Five seconds lets any
   * request this API serves finish and stays under a typical orchestrator's
   * kill grace period.
   */
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(5_000),
  /** Set by npm when the API is started through it; the version the docs and health name. */
  npm_package_version: z.string().min(1).default('0.1.0'),
})

export type Config = {
  env: 'development' | 'test' | 'production'
  isProduction: boolean
  port: number
  host: string
  databasePath: string
  corsOrigins: string[]
  logLevel: z.infer<typeof envSchema>['LOG_LEVEL']
  version: string
  /** The OAuth client the sign-in button is for. Empty: nobody can sign in. */
  googleClientId: string
  /** The addresses that are admins, lower-cased. */
  adminEmails: ReadonlySet<string>
  sessionDays: number
  bodyLimitBytes: number
  runsBodyLimitBytes: number
  googleTimeoutMs: number
  shutdownTimeoutMs: number
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  const env = parsed.data

  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    host: env.HOST,
    databasePath:
      env.DATABASE_PATH === ':memory:' ? ':memory:' : path.resolve(APP_ROOT, env.DATABASE_PATH),
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    logLevel: env.LOG_LEVEL,
    version: env.npm_package_version,
    googleClientId: env.GOOGLE_CLIENT_ID.trim(),
    adminEmails: new Set(
      env.ADMIN_EMAILS.split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
    sessionDays: env.SESSION_DAYS,
    bodyLimitBytes: env.BODY_LIMIT_BYTES,
    runsBodyLimitBytes: env.RUNS_BODY_LIMIT_BYTES,
    googleTimeoutMs: env.GOOGLE_TIMEOUT_MS,
    shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
  }
}
