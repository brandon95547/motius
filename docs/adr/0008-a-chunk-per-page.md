# 0008 A chunk and a budget per page, a chunk per tool

Accepted, 2026-11-22. Takes up the gap 0003 left open ("the dashboard loads the practice workspace's code").

**Context.** The signed-in app was one chunk with one budget: the dashboard, the stage, the session engine and every practice area's builder loaded at sign-in, even for a visit that only looked at the dashboard. Every feature anywhere in the workspace counted against what the dashboard downloads. The ceiling was tripped again and again (lessons in 0007, then Single notes' soft, loud and hold judgement). Splitting off one thing at a time does not scale; the structure has to stop features from adding to pages they are not on.

**Decision.** Code loads the way content does (0007): by page, then by tool, each with its own budget.

- **Pages.** The shell (top bar, navigation, account, stores) stays small. The workspace is its own chunk (`components/Workspace.tsx`): the stage, the keys, the engines, a lesson's dialogs, and the bar's controls that only the workspace shows (Options, Play, song search). The shell and the bar load it through one loader (`components/workspace-chunk.ts`), and the shell fetches it once the dashboard has drawn and the browser is idle, unless the player saves data.
- **Tools.** Each practice area's builder loads the first time the area opens (`packages/shared/src/learning/practice-builders.ts`, through `loadOnce`, which lessons now share). The settings each area opens on are plain data in `practice-defaults.ts`, so the stores hold them from the start without the builders. The store builds through `practiceBuilder` and, when a builder or a lesson's section is not loaded yet, fetches it and puts the exercise on the keys when it arrives (`fetchExercise`, called as an area or a lesson opens and when the workspace mounts).
- **Budgets.** `check:budgets` measures the sign-in page, the dashboard and the workspace separately (the workspace counts the shell, its chunk and Scales' builder, where it opens). It also fails when the workspace's chunk or any builder or lesson section is no longer loaded on demand, or the dashboard loads one at once, so a static import that undoes this is named in CI.

**Consequences.** The shell went from 139 KB to 57 KB gzipped, and the dashboard from 302.5 KB to 223.8 KB. A new practice area, a bigger builder or a new engine rule weighs on the workspace and on nothing else.

The workspace weighs 302.5 KB, which is everything the old single chunk held, plus the Single notes engine. Its ceiling is 303 KB, 1 KB above the old app's 302 KB. That 0.5 KB is the soft, loud and hold judgement, which runs on every key press on the workspace's first screen. Under the old structure it was charged to the dashboard; it is now charged only to the page that draws it.

All three pages are still over the 150 KB limit, and so keep ceilings, because the entry carries React and the whole of zod (152 KB gzipped; zod alone is tens of KB of it). Every page pays for the entry. Validating the API's responses with `zod/mini` would remove most of that from every page, and is the next step.
