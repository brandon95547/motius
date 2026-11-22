import { PIANO_HIGHEST_NOTE, PIANO_LOWEST_NOTE } from '../midi/notes.js'
import type { DeviceConfig, DeviceIdentity } from './device-schemas.js'

/*
 * A MIDI keyboard's sizes, its settings before any are changed, and how a
 * keyboard is recognized.
 *
 * Plain values, apart from the schemas (`device-schemas.ts`), so the browser
 * can use them without carrying zod (docs/adr/0009).
 */

/**
 * MIDI device identity, profiles and per-device configuration.
 *
 * ## Why devices are fingerprinted rather than keyed by `MIDIInput.id`
 *
 * The Web MIDI `id` is explicitly implementation-defined. Chrome derives it
 * from the port's OS handle, so it changes when the keyboard is plugged into a
 * different USB socket; Firefox numbers ports sequentially per session. Keying
 * saved settings on it means a player's transpose and velocity curve vanish
 * because they used the other port on the back of their laptop.
 *
 * So a device is identified by what it says it is — manufacturer plus product
 * name — normalised. That is stable across ports, sessions and browsers, and
 * the only thing it cannot tell apart is two identical keyboards plugged in at
 * once, which is a trade we are happy to make.
 */

export const KEY_COUNTS = [25, 32, 37, 49, 61, 76, 88] as const

export type KeyCount = (typeof KEY_COUNTS)[number]

export const DEFAULT_DEVICE_CONFIG: DeviceConfig = {
  transpose: 0,
  octaveShift: 0,
  velocityCurve: 'linear',
  fixedVelocity: 100,
  channelFilter: null,
  sustainEnabled: true,
  range: { low: PIANO_LOWEST_NOTE, high: PIANO_HIGHEST_NOTE },
}

/**
 * Builds a stable id from what the port reports.
 *
 * Lower-cased, non-alphanumerics collapsed to a single dash, trimmed. Chrome
 * reports `"Yamaha P-125"` and Firefox `"Yamaha P-125 MIDI 1"` for the same
 * hardware; the trailing port index is stripped so both land on one record.
 */
export function fingerprintDevice(identity: DeviceIdentity): string {
  const name = identity.name
    .replace(/\s+(midi|port)\s*\d+$/i, '')
    .replace(/\s+\d+$/, '')
    .trim()
  const raw = `${identity.manufacturer} ${name}`.trim() || name
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'unknown-device'
}
