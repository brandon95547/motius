/** Where a repository reports a row it had to leave out. */
export type Warn = (fields: Record<string, unknown>, message: string) => void

/**
 * A reader for JSON kept in a table's column.
 *
 * A row whose JSON does not parse (a write cut short, a hand edit) is left out
 * rather than failing every other row with it. It is reported once, with its
 * id, the first time it is read: the same row is read on every request, and
 * one line says all there is to say.
 */
export function storedJson(table: string, warn: Warn) {
  const reported = new Set<string>()
  return (id: string | number, text: string): { value: unknown } | null => {
    try {
      return { value: JSON.parse(text) as unknown }
    } catch {
      const key = String(id)
      if (!reported.has(key)) {
        reported.add(key)
        warn({ table, id: key }, 'stored JSON did not parse; row left out')
      }
      return null
    }
  }
}
