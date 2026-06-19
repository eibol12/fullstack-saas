import { cn } from '@/lib/utils'

interface MonoNumberProps {
  /** Numeric value, or pre-formatted string. */
  value: number | string | null | undefined
  /** Number of decimal digits (default 2). Ignored if value is a string. */
  decimals?: number
  /** Suffix unit (e.g. "kN", "t", "mm"). */
  unit?: string
  /** Fallback when value is null/undefined/NaN. */
  fallback?: string
  /** Optional tone for emphasis. */
  tone?: 'default' | 'muted' | 'accent' | 'danger'
  className?: string
}

const TONE: Record<NonNullable<MonoNumberProps['tone']>, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  accent: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
}

/**
 * MonoNumber
 *
 * Renders an engineering value in a monospace font with tabular figures so
 * decimals align vertically across rows and tables. Optionally appends a unit
 * in a slightly muted weight.
 *
 *   <MonoNumber value={42.518} decimals={2} unit="kN" />
 */
export function MonoNumber({
  value,
  decimals = 2,
  unit,
  fallback = '—',
  tone = 'default',
  className,
}: MonoNumberProps) {
  let display: string
  if (value === null || value === undefined) {
    display = fallback
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      display = fallback
    } else {
      display = value.toFixed(decimals)
    }
  } else {
    display = value
  }

  return (
    <span className={cn('font-mono tabular-nums', TONE[tone], className)}>
      {display}
      {unit && display !== fallback && (
        <span className="ml-1 text-[0.85em] text-muted-foreground">{unit}</span>
      )}
    </span>
  )
}
