import { ArrowLeft, ArrowRight, Hammer } from 'lucide-react'
import { cn } from '@/lib/cn'
import { pageActions, usePageStore } from '@/state/page-store'
import {
  CATEGORIES,
  COMING_SOON,
  findCategory,
  isBuilt,
  pagesUnder,
  type Accent,
  type Category,
  type Section,
} from './areas'

/**
 * The pages that lead to the areas: the dashboard, with its nine categories;
 * the page of a category or of a section, with what is under it; and the page
 * a place has while there is nothing in it yet.
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
  const path = usePageStore((state) => state.path)
  const category = findCategory(categoryId)
  if (page === 'dashboard' || !category) return <Categories />

  // The way down to the page that is up, and the page itself at the end of it.
  const way = pagesUnder(category, path)
  const place = way[way.length - 1] ?? category
  const above = way.length > 1 ? way[way.length - 2]! : way.length === 1 ? category : null

  if (!isBuilt(place))
    return (
      <ComingSoon
        place={place}
        back={above?.label ?? 'Dashboard'}
        onBack={() =>
          !above
            ? pageActions.openDashboard()
            : way.length > 1
              ? pageActions.openSection(category, way.slice(0, -1))
              : pageActions.openCategory(category)
        }
      />
    )
  return (
    <Cards
      label={place.label}
      places={place.sections ?? []}
      onOpen={(section) => pageActions.openSection(category, [...way, section])}
    />
  )
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
 * One place, as a card: a category on the dashboard, a section on the page of
 * what it is under.
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
  const built = isBuilt(place)

  return (
    <button
      type="button"
      className="area-card"
      data-accent={place.accent}
      title={built ? `Open ${place.label}` : `${place.label} — ${COMING_SOON.toLowerCase()}`}
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
function ComingSoon({
  place,
  back,
  onBack,
}: {
  place: Category | Section
  /** The name of the page above it. */
  back: string
  onBack: () => void
}) {
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
          <button type="button" className="placeholder__back" onClick={onBack}>
            <ArrowLeft size={16} aria-hidden />
            Back to {back}
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
