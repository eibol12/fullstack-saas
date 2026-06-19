import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** Optional eyebrow / breadcrumb-like context above the title. */
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Right-aligned slot for primary/secondary action buttons. */
  actions?: React.ReactNode
  /**
   * If true, the header becomes sticky just under the app-shell top bar
   * (which is `h-14` ⇒ `top-14`). Use this on long detail pages such as
   * `DesignDetailPage` so the engineer never loses context while scrolling
   * through the appendix.
   */
  sticky?: boolean
  className?: string
}

/**
 * PageHeader
 *
 * Consistent page banner used at the top of every feature page. Supports a
 * "sticky" mode for long detail screens — when enabled the header anchors
 * itself directly below the AuthenticatedLayout's top bar (`top-14`) with a
 * subtle translucent background so content underneath scrolls under it.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  sticky = false,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'border-b border-border bg-background/90 backdrop-blur print:hidden',
        sticky && 'sticky top-14 z-10',
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {eyebrow}
            </div>
          )}
          <h1 className="mt-0.5 text-xl sm:text-2xl font-semibold tracking-tight text-foreground truncate">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  )
}

export default PageHeader
