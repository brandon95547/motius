import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useDismissable } from '@/lib/hooks'
import { Listbox, ListboxOption, listKeys, useActiveInView } from '../Listbox'
import { controlShell, controlSizes, type ControlSize } from './control-shell'

export interface ComboboxOption {
  value: string
  label: string
  /** The heading it is listed under. Options of one heading are given together. */
  group?: string
  /** What else it is called: looked through by a search, and said when it is what matched. */
  also?: readonly string[]
}

/** Lower case and without accents, so "thaat" finds "Thãt" and "hirajoshi" finds "Hirajōshi". */
const foldText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/**
 * Combobox — UI Bible spec.
 *
 * A field that is typed in to choose from a list too long to scan. Past about
 * fifteen options a select stops being faster than typing: "hira" finds
 * Hirajoshi among a hundred and twenty scales, where a select would have to be
 * scrolled to it. It is still a choice of one, not free text. What is typed
 * narrows the list, and leaving without choosing puts the field back.
 *
 * Untouched, the list is everything under its headings, opened at the current
 * choice — so it still works as the select it replaces, for someone who would
 * rather look than type. A search looks through each option's other names
 * too, and says which one it found.
 *
 * Focus never leaves the field. The arrows move a highlight through the list
 * (`aria-activedescendant`), so typing and arrowing can be mixed.
 *
 * The list sits under the field, inside whatever holds it, rather than
 * floating over the page: the options panel scrolls, and a list that scrolls
 * with its field cannot come loose from it.
 */
export function Combobox({
  id,
  options,
  value,
  onChange,
  size = 'md',
  emptyText = 'No matches',
  'aria-label': ariaLabel,
}: {
  id?: string
  options: readonly ComboboxOption[]
  value: string
  onChange: (value: string) => void
  size?: ControlSize
  emptyText?: string
  'aria-label'?: string
}) {
  const selected = options.find((option) => option.value === value)
  const [open, setOpen] = React.useState(false)
  /** What has been typed since the list opened. Null while the field still shows the choice. */
  const [query, setQuery] = React.useState<string | null>(null)
  const [active, setActive] = React.useState(0)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const listId = React.useId()

  const close = React.useCallback(() => {
    setOpen(false)
    setQuery(null)
  }, [])
  useDismissable(open, close, [wrapRef])

  const sought = foldText((query ?? '').trim())
  const results = React.useMemo(() => {
    if (!sought)
      return options.map((option) => ({ option, found: undefined as string | undefined }))
    // A name that begins with what was typed, then one that has it anywhere,
    // then one found by another of its names.
    const begins: { option: ComboboxOption; found: string | undefined }[] = []
    const within: typeof begins = []
    const byOther: typeof begins = []
    for (const option of options) {
      const label = foldText(option.label)
      if (label.startsWith(sought)) begins.push({ option, found: undefined })
      else if (label.includes(sought)) within.push({ option, found: undefined })
      else {
        const found = option.also?.find((name) => foldText(name).includes(sought))
        if (found) byOther.push({ option, found })
      }
    }
    return [...begins, ...within, ...byOther]
  }, [options, sought])

  const openList = () => {
    setOpen(true)
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    )
  }
  const choose = (option: ComboboxOption | undefined) => {
    if (!option) return
    onChange(option.value)
    close()
  }

  // The highlighted option stays in sight, including the current choice when
  // the list first opens: a list of a hundred opened at its top hides where
  // you are.
  useActiveInView(listRef, open, active, sought)

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        value={query ?? selected?.label ?? ''}
        onFocus={(event) => {
          // Everything selected, so the first key typed replaces the name
          // rather than adding to it.
          event.target.select()
          if (!open) openList()
        }}
        onClick={() => {
          if (!open) openList()
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          setActive(0)
        }}
        onBlur={(event) => {
          if (!wrapRef.current?.contains(event.relatedTarget)) close()
        }}
        onKeyDown={listKeys({
          open,
          count: results.length,
          setActive,
          onOpen: openList,
          onChoose: () => choose(results[active]?.option),
          // The list's Escape, not the panel's: it shuts the list.
          onEscape: () => {
            if (open) close()
            return open
          },
        })}
        className={cn(
          controlShell(),
          controlSizes[size],
          // Sixteen pixels where a finger types: smaller, and a phone zooms the
          // page in to the field.
          'pr-9 pl-3 text-body text-[var(--ds-fg)] md:text-body-sm',
        )}
      />
      <ChevronDown
        size={15}
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[var(--ds-fg-muted)]"
      />

      {open && (
        <Listbox ref={listRef} id={listId} className="top-[calc(100%+6px)] right-0 left-0 max-h-64">
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-caption text-[var(--ds-fg-muted)]">
              {emptyText}
            </p>
          )}
          {results.map(({ option, found }, index) => {
            // Headings only while nothing is being searched for: a search
            // gathers its finds from every heading into one short list.
            const heading =
              !sought && option.group && option.group !== results[index - 1]?.option.group
                ? option.group
                : null
            const chosen = option.value === value
            return (
              <React.Fragment key={option.value}>
                {heading && (
                  <div
                    role="presentation"
                    className="px-2.5 pt-2.5 pb-1 text-overline text-[var(--ds-fg-muted)] uppercase first:pt-1.5"
                  >
                    {heading}
                  </div>
                )}
                <ListboxOption
                  listId={listId}
                  index={index}
                  active={index === active}
                  selected={chosen}
                  onHover={setActive}
                  onChoose={() => choose(option)}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        'truncate text-label',
                        chosen ? 'text-[var(--ds-fg)]' : 'text-[var(--ds-fg-secondary)]',
                      )}
                    >
                      {option.label}
                    </span>
                    {(found || (sought && option.group)) && (
                      <span className="truncate text-caption text-[var(--ds-fg-muted)]">
                        {found ? `Also called ${found}` : option.group}
                      </span>
                    )}
                  </span>
                  {chosen && (
                    <Check
                      size={14}
                      aria-hidden
                      className="shrink-0 text-[var(--ds-accent-text)]"
                    />
                  )}
                </ListboxOption>
              </React.Fragment>
            )
          })}
        </Listbox>
      )}
    </div>
  )
}
