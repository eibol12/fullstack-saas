import { lazy, Suspense } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import type { LiftingAnalysis } from '@/types'

const ResultsVisualizer3D = lazy(() =>
  import('./ResultsVisualizer3D').then((m) => ({ default: m.ResultsVisualizer3D })),
)

interface ResultsVisualizerProps {
  analysis: LiftingAnalysis
  className?: string
  height?: number
  bulwark_height?: number | null
}

/**
 * ResultsVisualizer
 *
 * A specialized visualizer for displaying analysis calculation results in 3D.
 * Displays static or dynamic sling loads and hook loads.
 */
export function ResultsVisualizer({
  analysis,
  className,
  height = 320,
  bulwark_height,
}: ResultsVisualizerProps) {
  return (
    <div className={cn('relative', className)}>
      <Suspense
        fallback={
          <Skeleton
            className="w-full rounded-xl"
            style={{ height }}
            aria-label="Loading 3D results visualizer"
          />
        }
      >
        <ResultsVisualizer3D
          analysis={analysis}
          height={height}
          bulwark_height={bulwark_height}
        />
      </Suspense>
    </div>
  )
}

export default ResultsVisualizer
