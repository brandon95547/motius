import { ArrowLeft, ArrowRight, Hammer } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useLearningStore } from '@/state/learning-store'
import { useCurrentSong } from '@/state/song-store'
import { pageActions, usePageStore } from '@/state/page-store'
import {
  CATEGORIES,
  COMING_SOON,
  findCategory,
  findSection,
  placeOf,
  type Accent,
  type Category,
  type Section,
} from './areas'

/**
 * The pages that lead to the areas: the dashboard, with its four categories; a
 * category's page, with its sections; and the page a section has while there
 * is nothing in it yet.
 *
 * Drawn to the dashboard mock (reference.png, 2026-09-30) at the Bible's
 * standard card size, centred: the practice room behind everything, and each
 * place a plain dark card in an accent. The accents live in the stylesheet,
 * keyed on `data-accent`.
 *
 * None of them has a heading of its own. Where you are is said in the bar
 * across the top, which is the one place it is said on every page, and the
 * page is the cards.
 *
 * A card that leads somewhere says what is waiting there, so these pages are
 * also how you get back to where you were. A card for something not built yet
 * says so and still opens: the page is there, with its name on it, before what
 * goes in it is.
 */
export function Dashboard() {
  const page = usePageStore((state) => state.page)
  const categoryId = usePageStore((state) => state.category)
  const sectionId = usePageStore((state) => state.section)
  const category = findCategory(categoryId)
  const section = category && findSection(category, sectionId)

  if (page === 'section' && category && section)
    return <ComingSoon category={category} section={section} />
  if (page === 'category' && category) return <CategoryPage category={category} />
  return <Categories />
}

/** Four cards are laid out as four: two by two, or a row. Any other number fills the grid. */
const gridFor = (count: number) => cn('area-grid', count === 4 && 'area-grid--four')

/**
 * What is open in the practice areas, by where it is filed: the exercise under
 * its section and its category, and the song under Songs. Only the area that
 * was last open has an exercise built, so that is the one that can say where
 * it was left.
 */
function useWhere() {
  const topic = useLearningStore((state) => state.topic)
  const progression = useLearningStore((state) => state.progressionType)
  const exercise = useLearningStore((state) => state.exercise?.title)
  const song = useCurrentSong()
  const place = placeOf(topic, progression)
  return (at: Category | Section): string | undefined => {
    if (at === CATEGORIES[0]) return song?.title
    return at === place?.category || at === place?.section ? exercise : undefined
  }
}

function Categories() {
  const where = useWhere()
  return (
    <main className="dashboard" aria-label="Dashboard">
      <div className="dashboard__inner">
        <ul className={gridFor(CATEGORIES.length)}>
          {CATEGORIES.map((category) => (
            <li key={category.id} className="flex">
              <PlaceCard
                place={category}
                current={where(category)}
                // What is inside, where there is more than one thing.
                inside={category.sections.map((entry) => entry.label)}
                onOpen={() => pageActions.openCategory(category)}
              />
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}

function CategoryPage({ category }: { category: Category }) {
  const where = useWhere()
  return (
    <main className="dashboard" aria-label={category.label}>
      <div className="dashboard__inner">
        <ul className={gridFor(category.sections.length)}>
          {category.sections.map((section) => (
            <li key={section.id} className="flex">
              <PlaceCard
                place={section}
                current={where(section)}
                onOpen={() => pageActions.openSection(category, section)}
              />
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
  current,
  inside = [],
  onOpen,
}: {
  place: Category | Section
  /** What was left open there, to go back to. */
  current?: string
  /** The names of what it holds, for a card that holds several things. */
  inside?: readonly string[]
  onOpen: () => void
}) {
  const Icon = place.icon
  // A category is built if anything in it is; a section, if it opens something.
  const built = Boolean(place.opens) || inside.length > 0

  return (
    <button
      type="button"
      className="area-card"
      data-accent={place.accent}
      data-coming={built ? undefined : 'true'}
      title={built ? `Open ${place.label}` : `${place.label} — ${COMING_SOON.toLowerCase()}`}
      onClick={onOpen}
    >
      <span className="area-card__icon" aria-hidden>
        <Icon size={22} strokeWidth={2} />
      </span>
      <span className="area-card__name">{place.label}</span>
      <span className="area-card__rule" aria-hidden />
      <span className="area-card__description">{place.description}</span>
      {inside.length > 0 && (
        <span className="area-card__inside">
          {inside.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </span>
      )}
      <span className="area-card__foot">
        {built ? (
          // Where you left off, in small capitals; or, with nothing to go
          // back to, the invitation — larger, and in white.
          <span className={cn('area-card__status', !current && 'area-card__status--open')}>
            {current ?? 'Open'}
          </span>
        ) : (
          <span className="area-card__status">
            <Hammer size={14} aria-hidden />
            {COMING_SOON}
          </span>
        )}
        <span className="area-card__go" aria-hidden>
          <ArrowRight size={18} />
        </span>
      </span>
    </button>
  )
}

/**
 * The page of a section there is nothing in yet.
 *
 * Its name, what it will be, and the way back. It holds the address the
 * section will have, so that what is built there later is built in a place
 * that already exists and is already linked to.
 */
function ComingSoon({ category, section }: { category: Category; section: Section }) {
  const Icon = section.icon
  return (
    <main className="dashboard" aria-label={section.label}>
      <div className="dashboard__inner">
        <Placeholder accent={section.accent}>
          <span className="area-card__icon" aria-hidden>
            <Icon size={22} strokeWidth={2} />
          </span>
          <span className="area-card__name">{section.label}</span>
          <span className="area-card__rule" aria-hidden />
          <p className="area-card__description">{section.description}</p>
          <p className="placeholder__status">
            <Hammer size={14} aria-hidden />
            {COMING_SOON}
          </p>
          <button
            type="button"
            className="placeholder__back"
            onClick={() => pageActions.openCategory(category)}
          >
            <ArrowLeft size={16} aria-hidden />
            Back to {category.label}
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
