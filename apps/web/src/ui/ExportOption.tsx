import * as React from 'react'
import { Download } from 'lucide-react'
import { ActionCard } from './ActionCard'

/**
 * The formats something can be exported to, as cards side by side where
 * there is room and stacked where there is not. A recording and a song offer
 * their formats the same way.
 */
export function ExportOptions({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4">{children}</div>
}

/**
 * One format to export to, as a card that saves it: its name, its extension
 * and a line on what it is.
 */
export function ExportOption({
  title,
  extension,
  accent,
  icon,
  detail,
  onExport,
}: {
  title: string
  extension: string
  /** One of the places' accents, so two formats side by side read as two. */
  accent: string
  icon: React.ReactNode
  detail: string
  onExport: () => void
}) {
  return (
    <ActionCard
      accent={accent}
      label={extension}
      icon={icon}
      name={title}
      description={detail}
      go={<Download size={18} />}
      title={`Export ${title}`}
      onClick={onExport}
    />
  )
}
