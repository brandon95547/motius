# Motius: how it is built

React 19, TypeScript, Tailwind 4 and one stylesheet, bundled by Vite (`apps/web`); a Fastify API (`apps/api`); and the code both share (`packages/shared`). The global rules in `~/.claude/CLAUDE.md` apply as written. This file adds Motius's paths, components and checks.

## One component per kind of control

Before writing any control, look in `apps/web/src/ui/`. If what you need is there, use it; if it falls short, add an option to it. Never write a second one beside it.

| Kind of thing                                                        | Use                                                                                 | File              |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------- |
| A dialog in the middle of the screen                                 | `Dialog` (`size` notice, sm or lg, all 4:3; sm is the default)                      | `ui/Dialog.tsx`   |
| A sheet from the side (or bottom, on a phone)                        | `Drawer` (`side`, `fit`)                                                            | `ui/Drawer.tsx`   |
| A menu, or anything that pops up from a control                      | `ActionMenu`, `Popover`                                                             | `ui/Menu.tsx`     |
| Buttons, icon buttons                                                | `Button`, `IconButton` (variants filled, tonal, outlined, text)                     | `ui/Button.tsx`   |
| Fields, selects, combobox, segments, switches, sliders, filter chips | `Field`, `Select`, `Combobox`, `SegmentedControl`, `Switch`, `Slider`, `FilterChip` | `ui/Controls.tsx` |
| Tabs on the top bar                                                  | `BarTabs`                                                                           | `ui/BarTabs.tsx`  |
| Cards and sections                                                   | `Card`, `Section`                                                                   | `ui/Surface.tsx`  |
| Chips, status dots, dividers                                         | `Chip`, `StatusDot`, `Divider`                                                      | `ui/Display.tsx`  |

- **Every action has one home.** A setting lives in one panel; anything else links to it. A copy for a narrow screen shows only where the original is hidden (the `bar-*` and `menu-only-*` classes do this).
- **Before calling a screen done,** list where else the same action, value or look appears, and remove the copy.

## Colors and type

- Colors are custom properties, defined only in `styles/tokens.css` and the theme blocks at the top of `styles/motius.css`. Rules and components read them; they never write a hex, an `rgb()` or a Tailwind palette color.
- Surfaces: the bars are `--c-bar`; dialogs, sheets and the dashboard's cards are `--c-bar-raised`.
- Type sizes come from the `--text-*` tokens (`text-caption`, `text-body-sm`…). No text under 13px.

## Where code goes

- `src/ui/`: the shared components. Nothing else.
- `src/lib/`, `src/state/`: shared logic and stores; the lesson outline is `lib/outline/`.
- `src/features/<name>/`: one folder per feature, with its own stylesheets. A feature does not import another feature, or the frame; what two need moves to `ui/`, `lib/` or `state/`. ESLint enforces this.
- `src/components/`: the app's frame (top bar, stage, settings, the signed-in shell).
- **Styles** live beside what they style and are imported, in cascade order, by `src/styles/motius.css`.
- **Off the first screen** (a panel, a dialog, a page) loads on demand: `lazyExport` and `OnDemand` in `ui/OnDemand.tsx`, as `components/AppShell.tsx` does.
- **A chunk per page, a chunk per tool** (`docs/adr/0008-a-chunk-per-page.md`). A feature adds bytes only to the page and the tool it is on.
  - The shell (`AppShell`, `TopBar`, the stores) holds what every page needs, and nothing else. It never imports the workspace or a builder statically.
  - What is played on the stage goes in the workspace's chunk: `components/Workspace.tsx`, loaded through `components/workspace-chunk.ts`. A bar control that only the workspace shows is exported from there and loaded with `lazyExport(loadWorkspace, …)`.
  - A new practice area's builder is a case in `packages/shared/src/learning/practice-builders.ts` and in `kindOf` (`state/learning-exercise.ts`), and the settings it opens on go in `practice-defaults.ts`. The store fetches it when the area first opens.
  - A new page gets its own chunk and its own line in `SCREENS` (`scripts/check-budgets.mjs`).
- **Decisions** that shape the code are recorded in `docs/adr/`.
- `packages/shared/`: anything the API and the web app both need, and every exercise builder (`learning/`).
- **Schemas stay out of the browser** (`docs/adr/0009-responses-checked-on-the-server.md`). The server checks requests and replies; the app types replies from the shared schemas and never imports a schema for its value. A shared module's plain values go in `domain/<name>.ts` and its zod schemas in `domain/<name>-schemas.ts`; a builder's spec schema goes in `learning/practice-specs.ts`. `check:budgets` fails a browser chunk that carries zod.

## Lessons and fingering

Before writing or changing a lesson, read the fingering guide and apply it: `~/sites/piano knowledge/topics/fingering-rulebook.md`, with the book notes in `by-book/` for the detail. It is kept outside this repo, which is public, because it is drawn from published books. A lesson's fingers (which hand, which finger, which keys) must match what the guide says; say in the lesson's code comment which part of the guide it follows. Scales, chords and arpeggios take their fingers from the fingering systems in `packages/shared/src/music/`, never from a lesson's own table.

A lesson's exercise and its introduction are content, not first-screen code: both go in its section's module in `packages/shared/src/learning/` (`keyboard-layout-lessons.ts`, `hand-position-lessons.ts`; a new section gets a new module), and its id in `LESSON_SECTIONS` (`lesson-exercise.ts`). The app loads a section the first time one of its lessons opens (`loadLessons`), so a new lesson adds nothing to what the app loads at first (`docs/adr/0007-lessons-are-content.md`).

A lesson's address is fixed. It comes from its first title, and a renamed lesson keeps it with `id` in `apps/web/src/lib/outline/categories.ts`, because its runs and lesson settings are saved under it.

Research for lessons comes from the notes in `~/sites/piano knowledge`, never from the ebooks themselves; where the notes fall short, ask for the pages. Keep a lesson's introduction to a sentence or two: what to do, and where to start.

## Checks

Run them all before committing; CI runs the same on every push:

```bash
npm run check
```

That is formatting, `npm run lint`, `npm run check:styles`, `npm run check:duplicates`, the type check and the tests. CI then builds and runs `npm run check:budgets`.

- **`lint`** (ESLint, `eslint.config.js`): besides the usual rules, outside `src/ui/` it fails a hand-built `role="dialog"`, `menu` or `listbox`, a raw `<button>` with `bar-*` classes, a hex or Tailwind palette color, and a literal text size.
- **`check:styles`** (`scripts/check-styles.mjs`): a stylesheet color or font-size that is not a token, and text under 13px.
- **`check:duplicates`** (`scripts/check-duplicates.mjs`): a run of 8 or more lines copied anywhere in the code.
- **`check:budgets`** (`scripts/check-budgets.mjs`, after `npm run build`): each page's gzipped JavaScript and CSS (the sign-in page, the dashboard, the workspace), every chunk loaded on demand, and that the workspace, the builders and the lesson sections are still loaded on demand, and that no browser chunk carries zod. The budgets (`docs/adr/0011-budgets-from-the-research.md`): 350 KB of JavaScript for an app screen, 100 KB for the sign-in page, 60 KB of CSS, 100 KB for a chunk loaded on demand. A page that grows more than 10 KB since `scripts/page-sizes.json` fails until the change records it (`npm run check:budgets -- --record`) and says why. Code lives where its job puts it: when a page goes over, load the feature that does not belong on it with its own page or tool; never move code to fit a number.

What broke a rule when the checks were added is listed in `eslint-suppressions.json`, `scripts/known-styles.json` and `scripts/known-duplicates.json`. **Those lists only shrink.** Never add to one to make a check pass: fix the code. After fixing a listed item, run `npm run lint:prune`, `node scripts/check-styles.mjs --shrink`, or remove the duplicate's entry, in the same commit.

## Running it

`npm run dev` starts the API on :5175 and the web app on :5174. Pulse runs on :5176, so the two can run side by side.
