import * as React from 'react'
import { loadChunk } from '@/lib/load-chunk'

/**
 * Loading a part of the app the first time it is needed: a panel, a dialog,
 * a page that is not the first screen. Its code is its own chunk, and nothing
 * asks for it until it opens.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- React.lazy's own constraint
type AnyComponent = React.ComponentType<any>

/**
 * A component from a module loaded on demand, by its export's name, with that
 * export's own props whatever else the module exports.
 */
export function lazyExport<
  Module extends Record<Name, AnyComponent>,
  Name extends keyof Module & string,
>(load: () => Promise<Module>, name: Name): React.LazyExoticComponent<Module[Name]> {
  // A deploy can remove the chunk an open page asks for: reload once onto the new build.
  return React.lazy(async () => ({ default: (await loadChunk(load))[name] }))
}

/**
 * What it holds, from the first time `when` is true, and from then on: so a
 * panel loaded on demand is not fetched before it opens, and still animates
 * shut afterwards.
 */
export function OnDemand({ when, children }: { when: boolean; children: React.ReactNode }) {
  const [wanted, setWanted] = React.useState(when)
  if (when && !wanted) setWanted(true)
  if (!wanted) return null
  return <React.Suspense fallback={null}>{children}</React.Suspense>
}
