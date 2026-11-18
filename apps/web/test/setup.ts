/**
 * What jsdom does not have and every test needs alike.
 *
 * `matchMedia`: no media query matches, as on a wide screen with a mouse and
 * motion allowed. A test that needs one to match sets its own over this one.
 */
globalThis.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
  onchange: null,
})) as unknown as typeof globalThis.matchMedia
