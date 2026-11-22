import * as React from 'react'
import { ArrowLeft, ArrowRight, Hammer } from 'lucide-react'
import { loadLessons } from '@motius/shared'
import { cn } from '@/lib/cn'
import { pageActions, usePageStore } from '@/state/page-store'
import {
  CATEGORIES,
  COMING_SOON,
  findCategory,
  isBuilt,
  lessonsOf,
  type Accent,
  type Category,
  type Section,
} from '@/lib/outline/outline'

/**
 * The pages that lead to the areas: the dashboard, with its nine categories;
 * the page of a category, with its sections; and the page a category has
 * while there is nothing in it yet. A section is no page: it opens onto the
 * stage, its lessons a sheet from the left (`Lessons`).
 *
 * Drawn to the dashboard mock (new dashboard.png, 2026-10-12): the practice
 * room behind everything, and each place a plain dark card in an accent, three
 * to a row — its number and its icon across the top, its name, and a line
 * about it beside the arrow that opens it. The accents live in the stylesheet,
 * keyed on `data-accent`.
 *
 * None of them has a heading of its own. Where you are is said in the bar
 * across the top, which is the one place it is said on every page, and the
 * page is the cards.
 *
 * A card for something not built yet looks like the others and still opens:
 * the page is there, with its name on it, before what goes in it is.
 */
export function Dashboard() {
  const page = usePageStore((state) => state.page)
  const categoryId = usePageStore((state) => state.category)
  const category = findCategory(categoryId)
  usePrefetchLessons(page === 'category' ? category : null)
  if (page !== 'category' || !category) return <Categories />
  if (!isBuilt(category)) return <ComingSoon place={category} />
  return (
    <Cards
      label={category.label}
      places={category.sections}
      onOpen={(section) => pageActions.openSection(category, [section])}
    />
  )
}

/**
 * A unit open on its sections is the moment before one of its lessons: their
 * content starts loading now, a section at a time, so a lesson opened from here
 * is on the keys at once. Not where the player has asked to save data.
 */
function usePrefetchLessons(category: Category | null) {
  React.useEffect(() => {
    if (!category || (navigator as { connection?: { saveData?: boolean } }).connection?.saveData)
      return
    for (const section of category.sections)
      for (const { lesson } of lessonsOf(section))
        if (lesson.exercise)
          // Ahead of time only: opening the lesson loads it again, and says so
          // if it cannot, so a prefetch that fails has nothing to report.
          loadLessons(lesson.exercise).catch(() => {})
  }, [category])
}

/**
 * One card is in the middle, two are side by side and four are two by two.
 * Any other number fills the grid, three to a row.
 */
const gridFor = (count: number) =>
  cn(
    'area-grid',
    count === 1 && 'area-grid--one',
    (count === 2 || count === 4) && 'area-grid--pairs',
  )

function Categories() {
  return <Cards label="Dashboard" places={CATEGORIES} onOpen={pageActions.openCategory} />
}

/** A page of cards: the places under one, numbered in their order. */
function Cards<P extends Category | Section>({
  label,
  places,
  onOpen,
}: {
  /** The page's name, for what cannot see the bar across the top. */
  label: string
  places: readonly P[]
  onOpen: (place: P) => void
}) {
  return (
    <main className="dashboard" aria-label={label}>
      <div className="dashboard__inner">
        <ul className={gridFor(places.length)}>
          {places.map((place, index) => (
            <li key={place.id} className="flex">
              <PlaceCard place={place} number={index + 1} onOpen={() => onOpen(place)} />
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}

/**
 * One place, as a card: a category on the dashboard, a section on its
 * category's page.
 */
function PlaceCard({
  place,
  number,
  onOpen,
}: {
  place: Category | Section
  /** Where it comes on its page, counting from one. */
  number: number
  onOpen: () => void
}) {
  const Icon = place.icon
  // Every card opens onto something: a section onto its stage, where the keys
  // are, whether or not its lessons are written yet.
  return (
    <button
      type="button"
      className="area-card"
      data-accent={place.accent}
      title={`Open ${place.label}`}
      onClick={onOpen}
    >
      {/* Its place in the order, which the name already has by where it sits. */}
      <span className="area-card__number" aria-hidden>
        {String(number).padStart(2, '0')}
      </span>
      <span className="area-card__icon" aria-hidden>
        <Icon size={28} />
      </span>
      <span className="area-card__name">{place.label}</span>
      {place.description && <span className="area-card__description">{place.description}</span>}
      <span className="area-card__go" aria-hidden>
        <ArrowRight size={18} />
      </span>
    </button>
  )
}

/**
 * The page of a place there is nothing in yet.
 *
 * Its name, what it will be, and the way back. It holds the address the place
 * will have, so that what is built there later is built in a place that
 * already exists and is already linked to.
 */
function ComingSoon({ place }: { place: Category }) {
  const Icon = place.icon
  return (
    <main className="dashboard" aria-label={place.label}>
      <div className="dashboard__inner">
        <Placeholder accent={place.accent}>
          <span className="area-card__icon" aria-hidden>
            <Icon size={28} />
          </span>
          <span className="area-card__name">{place.label}</span>
          <span className="placeholder__rule" aria-hidden />
          {place.description && <p className="area-card__description">{place.description}</p>}
          <p className="placeholder__status">
            <Hammer size={14} aria-hidden />
            {COMING_SOON}
          </p>
          <button type="button" className="placeholder__back" onClick={pageActions.openDashboard}>
            <ArrowLeft size={16} aria-hidden />
            Back to Dashboard
          </button>
        </Placeholder>
      </div>
    </main>
  )
}

function Placeholder({ accent, children }: { accent: Accent; children: React.ReactNode }) {
  return (
    <section className="area-card placeholder" data-accent={accent}>
      {children}
    </section>
  )
}
