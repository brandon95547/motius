/**
 * Saving something Motius wrote — a recording, a song — as a file.
 */

/** A file name from a title: lower case, words joined by hyphens. */
export const fileSlug = (value: string, fallback: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || fallback

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Revoked on the next frame rather than immediately: some browsers have not
  // started reading the blob by the time the click handler returns.
  requestAnimationFrame(() => URL.revokeObjectURL(url))
}

export const downloadText = (text: string, filename: string, type: string) =>
  download(new Blob([text], { type }), filename)

export const downloadBytes = (bytes: Uint8Array, filename: string, type: string) =>
  download(new Blob([bytes as BlobPart], { type }), filename)

/** The MIME types of the two formats Motius exports. */
export const MUSICXML_TYPE = 'application/vnd.recordare.musicxml+xml'
export const MIDI_TYPE = 'audio/midi'
