import * as React from 'react'
import { ArrowRight } from 'lucide-react'

/**
 * A card that is one button: the whole card is the target, and what it says
 * is inside it. A place on the dashboard opens with one; a format to export
 * to saves with one. Its look is `ui/action-card.css`.
 */
export function ActionCard({
  accent,
  number,
  label,
  icon,
  name,
  description,
  note,
  go = <ArrowRight size={18} />,
  title,
  onClick,
}: {
  /** One of the places' accents (`data-accent`): the icon's color and the hover edge. */
  accent: string
  /** Where it comes on its page, counting from one. */
  number?: number
  /** A word in the number's place, where the card has no order: a file's extension. */
  label?: string
  icon: React.ReactNode
  name: string
  description?: string
  /** A quieter second line: what the card leaves out. */
  note?: string
  /** What sits in the corner: an arrow, or what the card does. */
  go?: React.ReactNode
  title?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="area-card"
      data-accent={accent}
      title={title}
      onClick={onClick}
    >
      {/* Its place in the order, which the name already has by where it sits. */}
      {number !== undefined && (
        <span className="area-card__number" aria-hidden>
          {String(number).padStart(2, '0')}
        </span>
      )}
      {label && <span className="area-card__label">{label}</span>}
      <span className="area-card__icon" aria-hidden>
        {icon}
      </span>
      <span className="area-card__name">{name}</span>
      {description && <span className="area-card__description">{description}</span>}
      {note && <span className="area-card__note">{note}</span>}
      <span className="area-card__go" aria-hidden>
        {go}
      </span>
    </button>
  )
}
