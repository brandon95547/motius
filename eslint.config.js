import { readdirSync } from 'node:fs'
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * The checks that keep Motius one design and one copy of everything.
 *
 * Beside the usual correctness rules, the web app has rules for what CLAUDE.md
 * asks: a dialog, a sheet, a menu or a list pop-up comes from `src/ui/`; a bar
 * button is not a raw <button> with its own classes; and colors and type sizes
 * come from the tokens. The shared components themselves live in `src/ui/`,
 * so that is the one place these rules do not reach.
 *
 * What broke a rule when the rules were added is in `eslint-suppressions.json`.
 * It only shrinks: fix one and run `npm run lint:prune`, which takes it out.
 * Anything new fails.
 */

const SHARED =
  'Use the shared component in src/ui/ — Dialog, Drawer, ActionMenu or Popover — instead of building one.'

/** Hex colors: `#fff`, `#1a2b3c`, `bg-[#fff]`. Not an address: `#/piano-foundations`. */
const HEX = '/(^|[^\\w/&])#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/'
/** Tailwind's own palette (`bg-white`, `text-gray-500`) and literal type sizes (`text-[11px]`). */
const PALETTE =
  '/\\b(bg|text|border|ring|fill|stroke|from|via|to|outline|shadow)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3})\\b/'
const LITERAL_SIZE = '/\\btext-\\[\\d/'

/** The web app's features, one folder each, read from the tree so a new one is covered. */
const FEATURES = readdirSync(new URL('./apps/web/src/features/', import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

const designRules = [
  {
    selector:
      "JSXAttribute[name.name='role'] > Literal[value=/^(dialog|alertdialog|menu|listbox)$/]",
    message: SHARED,
  },
  {
    selector:
      "JSXOpeningElement[name.name='button'] JSXAttribute[name.name='className'] Literal[value=/(^|\\s)bar-(icon-button|options|record|start)/]",
    message:
      'A bar button comes from one shared component in src/ui/, not a raw <button> with bar-* classes.',
  },
  { selector: `Literal[value=${HEX}]`, message: 'Colors come from the tokens, not hex values.' },
  {
    selector: `TemplateElement[value.raw=${HEX}]`,
    message: 'Colors come from the tokens, not hex values.',
  },
  {
    selector: `Literal[value=${PALETTE}]`,
    message: "Colors come from the tokens, not Tailwind's palette.",
  },
  {
    selector: `Literal[value=${LITERAL_SIZE}]`,
    message: 'Type sizes come from the tokens (text-caption, text-body-sm…), not a literal size.',
  },
]

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'apps/web/public/**',
      'apps/api/data/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/ui/**'],
    rules: { 'no-restricted-syntax': ['error', ...designRules] },
  },
  // Imports point one way: the shared layer imports no feature and not the
  // frame, and a feature imports no other feature. What two need moves down.
  {
    files: ['apps/web/src/{ui,lib,state,audio,midi}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '@/components/*'],
              message: 'Shared code imports no feature and not the frame: move what it needs down.',
            },
          ],
        },
      ],
    },
  },
  ...FEATURES.map((feature) => ({
    files: [`apps/web/src/features/${feature}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', `!@/features/${feature}`, `!@/features/${feature}/*`],
              message:
                'A feature imports no other feature: what two need moves to ui/, lib/ or state/.',
            },
            {
              group: ['@/components/*'],
              message: 'A feature imports no part of the frame.',
            },
          ],
        },
      ],
    },
  })),
)
