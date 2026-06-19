import { cn } from '@/lib/utils'

interface DataCardProps {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  /** Right-aligned slot for status pills, actions, etc. */
  actions?: React.ReactNode
  /** Variant: standard (clean white/dark card) or glass (inset glassmorphism). */
  variant?: 'solid' | 'glass'
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}

/**
 * DataCard
 *
 * Standard container for engineering data sections. Uses subtle inset shadows
 * and the border-token system rather than stark `bg-white` boxes, giving the
 * app a softer drafting-board feel.
 */
export function DataCard({
  title,
  subtitle,
  actions,
  variant = 'solid',
  className,
  bodyClassName,
  children,
}: DataCardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border text-card-foreground shadow-inset-soft',
        variant === 'glass'
          ? 'bg-card/70 backdrop-blur-sm'
          : 'bg-card',
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-3">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </header>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

/**
 * KeyValueRow — small helper for label/value pairs inside a DataCard.
 * The value column is mono+tabular so engineering numbers align.
 */
export function KeyValueRow({
  label,
  value,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 py-1.5 border-b border-border/40 last:border-b-0',
        className,
      )}
    >
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="font-mono tabular-nums text-sm text-foreground">{value}</dd>
    </div>
  )
}
