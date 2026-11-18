# Motius: how it is built

React 19, TypeScript, Tailwind 4 and one stylesheet, bundled by Vite (`apps/web`); a Fastify API (`apps/api`); and the code both share (`packages/shared`). The global rules in `~/.claude/CLAUDE.md` apply as written. This file adds Motius's paths, components and checks.

## One component per kind of control

Before writing any control, look in `apps/web/src/ui/`. If what you need is there, use it; if it falls short, add an option to it. Never write a second one beside it.

| Kind of thing                                                        | Use                                                                                 | File              |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------- |
| A dialog in the middle of the screen                                 | `Dialog` (`size` sm, md, lg, xl; md is the default)                                 | `ui/Dialog.tsx`   |
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
- `src/features/<name>/`: one folder per feature. A feature does not import another feature; what two need moves to `ui/`, `lib/` or `state/`.
- `src/components/`: the app's frame (top bar, stage, settings).
- `packages/shared/`: anything the API and the web app both need, and every exercise builder (`learning/`).

## Checks

Run them all before committing; CI runs the same on every push:

```bash
npm run check
```

That is formatting, `npm run lint`, `npm run check:styles`, `npm run check:duplicates`, the type check and the tests.

- **`lint`** (ESLint, `eslint.config.js`): besides the usual rules, outside `src/ui/` it fails a hand-built `role="dialog"`, `menu` or `listbox`, a raw `<button>` with `bar-*` classes, a hex or Tailwind palette color, and a literal text size.
- **`check:styles`** (`scripts/check-styles.mjs`): a stylesheet color or font-size that is not a token, and text under 13px.
- **`check:duplicates`** (`scripts/check-duplicates.mjs`): a run of 8 or more lines copied anywhere in the code.

What broke a rule when the checks were added is listed in `eslint-suppressions.json`, `scripts/known-styles.json` and `scripts/known-duplicates.json`. **Those lists only shrink.** Never add to one to make a check pass: fix the code. After fixing a listed item, run `npm run lint:prune`, `node scripts/check-styles.mjs --shrink`, or remove the duplicate's entry, in the same commit.

## Running it

`npm run dev` starts the API on :5175 and the web app on :5174. Pulse also defaults to :5175; only one of them can run at a time.
