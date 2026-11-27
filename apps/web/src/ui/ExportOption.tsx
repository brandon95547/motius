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
 * One format to export to, as a card that saves it: its name and extension,
 * what it is for, and what it leaves out.
 */
export function ExportOption({
  title,
  extension,
  accent,
  icon,
  detail,
  caveat,
  onExport,
}: {
  title: string
  extension: string
  /** One of the places' accents, so two formats side by side read as two. */
  accent: string
  icon: React.ReactNode
  detail: string
  caveat: string
  onExport: () => void
}) {
  return (
    <ActionCard
      accent={accent}
      label={extension}
      icon={icon}
      name={title}
      description={detail}
      {...(caveat ? { note: caveat } : {})}
      go={<Download size={18} />}
      title={`Export ${title}`}
      onClick={onExport}
    />
  )
}
