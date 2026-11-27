import { Download } from 'lucide-react'
import { Button } from './Button'

/**
 * One format to export to: its name and extension, what it is for, what it
 * leaves out, and the button that saves it. A recording and a song offer
 * their formats the same way.
 */
export function ExportOption({
  title,
  extension,
  detail,
  caveat,
  onExport,
}: {
  title: string
  extension: string
  detail: string
  caveat: string
  onExport: () => void
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-ui text-[var(--ds-fg)]">{title}</h3>
        <span className="text-label-sm text-[var(--ds-fg-muted)]" data-tabular>
          {extension}
        </span>
      </div>
      <p className="text-body-sm text-[var(--ds-fg-secondary)]">{detail}</p>
      <p className="text-caption text-[var(--ds-fg-muted)]">{caveat}</p>
      <Button
        size="sm"
        variant="outlined"
        startIcon={<Download />}
        onClick={onExport}
        className="w-fit"
      >
        Export {title}
      </Button>
    </section>
  )
}
