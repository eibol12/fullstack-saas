import { cn } from '@/lib/utils'

/**
 * Skeleton
 *
 * Animated placeholder block used while data is loading.
 * Replaces spinner-based loading states for reduced perceived latency
 * and zero layout shift.
 *
 * Usage:
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton className="h-24 w-full" />
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} {...props} />
}

/**
 * SkeletonText — convenience for paragraph-style placeholders.
 */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}

/**
 * SkeletonCard — full data-card placeholder used in list pages.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('card-glass p-4 space-y-3', className)}>
      <Skeleton className="h-5 w-1/2" />
      <SkeletonText lines={2} />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  )
}
