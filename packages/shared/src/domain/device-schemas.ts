import { z } from 'zod'
import { VELOCITY_CURVES } from '../midi/velocity.js'

export const keyCountSchema = z.union([
  z.literal(25),
  z.literal(32),
  z.literal(37),
  z.literal(49),
  z.literal(61),
  z.literal(76),
  z.literal(88),
])

export const noteNumberSchema = z.number().int().min(0).max(127)

export const noteRangeSchema = z
  .object({ low: noteNumberSchema, high: noteNumberSchema })
  .refine((r) => r.low <= r.high, { message: 'low must be <= high' })

export type NoteRange = z.infer<typeof noteRangeSchema>

/**
 * A known controller. Profiles let the app configure itself the moment a
 * keyboard is plugged in: the right number of keys, starting on the right note,
 * with a velocity curve that suits the action.
 */
export const deviceProfileSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  manufacturer: z.string().min(1),
  keyCount: keyCountSchema,
  range: noteRangeSchema,
  /** Case-insensitive regular expression matched against the reported port name. */
  namePattern: z.string().min(1),
  /** Optional extra constraint on the reported manufacturer. */
  manufacturerPattern: z.string().min(1).nullable(),
  /**
   * Default curve for this action. A weighted hammer action already spans the
   * full velocity range under normal playing, so it wants `linear`; light synth
   * and mini-key actions rarely reach 127, so they want `soft`.
   */
  defaultVelocityCurve: z.enum(VELOCITY_CURVES),
  /**
   * True when this family states its size in the product name, so one profile
   * can cover `Launchkey 25/37/49/61`. False for families whose model number
   * merely contains digits — a Yamaha NP-32 has 76 keys, and reading "32" out
   * of its name is exactly the mistake this flag exists to prevent.
   */
  keyCountFromName: z.boolean(),
  /** More specific patterns must win. Higher is checked first. */
  priority: z.number().int().min(0).max(100),
})

export type DeviceProfile = z.infer<typeof deviceProfileSchema>

export const deviceConfigSchema = z.object({
  /** Semitones. Applied before octave shift. */
  transpose: z.number().int().min(-24).max(24),
  /** Octaves. Separate from transpose because players think of them separately: transpose is for a key change, octave shift is for reaching notes a 25-key controller does not have. */
  octaveShift: z.number().int().min(-4).max(4),
  velocityCurve: z.enum(VELOCITY_CURVES),
  fixedVelocity: z.number().int().min(1).max(127),
  /** `null` means omni — accept every channel. Otherwise 0-15. */
  channelFilter: z.number().int().min(0).max(15).nullable(),
  /** Honour CC 64. Off for controllers whose pedal jack is miswired or inverted. */
  sustainEnabled: z.boolean(),
  /** The keys this controller physically has. Drives the on-screen range. */
  range: noteRangeSchema,
})

export type DeviceConfig = z.infer<typeof deviceConfigSchema>

/** What the browser hands us about a port, before we know anything about it. */
export const deviceIdentitySchema = z.object({
  name: z.string().min(1).max(200),
  manufacturer: z.string().max(200).default(''),
})

export type DeviceIdentity = z.infer<typeof deviceIdentitySchema>

export const deviceSchema = z.object({
  /** Stable fingerprint. See the note at the top of this file. */
  id: z.string().min(1),
  name: z.string(),
  manufacturer: z.string(),
  /** The profile that matched, or `null` when we fell back to a heuristic. */
  profileId: z.string().nullable(),
  keyCount: keyCountSchema,
  config: deviceConfigSchema,
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
})

export type Device = z.infer<typeof deviceSchema>

/** A keyboard announced: the device as kept, whether it is new, and how it was recognized. */
export const registeredDeviceSchema = z.object({
  device: deviceSchema,
  created: z.boolean(),
  detection: z.object({
    source: z.enum(['profile', 'name-heuristic', 'default']),
    profileLabel: z.string().nullable(),
  }),
})

export type RegisteredDevice = z.infer<typeof registeredDeviceSchema>

/** Body of `POST /devices` — announcing a port the browser has just reported. */
export const registerDeviceSchema = deviceIdentitySchema

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>

/** Body of `PATCH /devices/:id/config`. Every field optional — this is a patch. */
export const updateDeviceConfigSchema = deviceConfigSchema.partial()

export type UpdateDeviceConfigInput = z.infer<typeof updateDeviceConfigSchema>
