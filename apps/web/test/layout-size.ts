/**
 * jsdom lays nothing out: every element measures zero. A test of something
 * drawn in its container's pixels gives every element one size with this,
 * through both ways the app measures — a ResizeObserver and getBoundingClientRect.
 */
export function sizeEverything(box: { width: number; height: number }) {
  class SizedObserver {
    constructor(private readonly notify: ResizeObserverCallback) {}
    observe(target: Element) {
      this.notify(
        [{ target, contentRect: box } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      )
    }
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = SizedObserver as unknown as typeof ResizeObserver
  Element.prototype.getBoundingClientRect = function () {
    return { ...box, top: 0, left: 0, right: box.width, bottom: box.height, x: 0, y: 0 } as DOMRect
  }
}
