import { cn } from '@/lib/utils'

/**
 * Semantic status tones supported by StatusPill.
 *
 *  - ok        → engineering pass, compatible, active
 *  - warn      → caution, near limit, draft
 *  - fail      → fail, error, incompatible
 *  - info      → neutral informational state
 *  - muted     → archived / inactive
 */
export type StatusTone = 'ok' | 'warn' | 'fail' | 'info' | 'muted'

const TONE_CLASSES: Record<StatusTone, { ring: string; dot: string; text: string }> = {
  ok: {
    ring: 'border-emerald-500/40 bg-emerald-500/5',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  warn: {
    ring: 'border-amber-500/40 bg-amber-500/5',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]',
    text: 'text-amber-700 dark:text-amber-300',
  },
  fail: {
    ring: 'border-red-500/40 bg-red-500/5',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]',
    text: 'text-red-700 dark:text-red-300',
  },
  info: {
    ring: 'border-sky-500/40 bg-sky-500/5',
    dot: 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.7)]',
    text: 'text-sky-700 dark:text-sky-300',
  },
  muted: {
    ring: 'border-border bg-muted/40',
    dot: 'bg-muted-foreground/60',
    text: 'text-muted-foreground',
  },
}

interface StatusPillProps {
  tone?: StatusTone
  pulse?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * StatusPill
 *
 * Subtle outlined pill with a glowing status dot. Replaces heavy solid pills
 * (e.g., bg-green-100 text-green-800) for a more refined engineering aesthetic.
 *
 *   <StatusPill tone="ok">Compatible</StatusPill>
 *   <StatusPill tone="fail" pulse>Overstressed</StatusPill>
 */
export function StatusPill({
  tone = 'info',
  pulse = true,
  className,
  children,
}: StatusPillProps) {
  const t = TONE_CLASSES[tone]
  return (
    <span className={cn('status-pill', t.ring, t.text, className)}>
      <span
        className={cn('status-dot', t.dot, !pulse && 'animate-none')}
        aria-hidden
      />
      {children}
    </span>
  )
}
