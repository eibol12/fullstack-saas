import { lazy, Suspense } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import type { GeometryVisualizerInput } from './GeometryVisualizer3D'

// 3D is lazy-loaded so non-visualizer pages don't pay the ~150 KB gzipped
// cost of `three` + `@react-three/fiber` + `@react-three/drei`.
const GeometryVisualizer3D = lazy(() =>
  import('./GeometryVisualizer3D').then((m) => ({ default: m.GeometryVisualizer3D })),
)

interface GeometryVisualizerProps extends GeometryVisualizerInput {
  className?: string
  /** Height of the visualizer viewport in px. Default 320. */
  height?: number
  /** Show the value labels next to each sling. Default true. */
  showLabels?: boolean
}

/**
 * GeometryVisualizer
 *
 * Top-level visualizer used everywhere in the UI. Renders the 3D scene
 * (orbit / pan / zoom around the calculated arrangement — UX_UI_OVERHAUL_PLAN.md §1,
 * "3D Approach: High Impact"). The previously available 2D fallback has
 * been removed; the 3D scene is the single source of truth.
 *
 * The actual Three.js scene is loaded lazily so unrelated pages aren't
 * penalised by the bundle cost.
 */
export function GeometryVisualizer({
  className,
  height = 320,
  showLabels = true,
  ...input
}: GeometryVisualizerProps) {
  return (
    <div className={cn('relative', className)}>
      <Suspense
        fallback={
          <Skeleton
            className="w-full rounded-xl"
            style={{ height }}
            aria-label="Loading 3D visualizer"
          />
        }
      >
        <GeometryVisualizer3D
          {...input}
          height={height}
          showLabels={showLabels}
        />
      </Suspense>
    </div>
  )
}

export default GeometryVisualizer
