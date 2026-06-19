import { Capabilities } from '@/types/capabilities'

interface UsageBadgeProps {
  capabilities: Capabilities
  type: 'projects' | 'analyses' | 'designs'
  /** Override the current count from capabilities (use for per-project/per-analysis context) */
  currentCount?: number
  className?: string
}

/**
 * UsageBadge Component
 *
 * Shows current usage vs limit for a resource type
 * Example: "2 / 5 projects" or "3 projects" (if unlimited)
 */
export function UsageBadge({ capabilities, type, currentCount, className = '' }: UsageBadgeProps) {
  const usage = getUsageInfo(capabilities, type, currentCount)

  if (!usage) {
    return null
  }

  const { current, max, label, isUnlimited, isAtLimit } = usage

  // Determine badge color based on usage
  const badgeColor = getBadgeColor(current, max, isAtLimit)

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeColor} ${className}`}
    >
      {isUnlimited ? (
        <>{current} {label}</>
      ) : (
        <>
          {current} / {max} {label}
        </>
      )}
    </span>
  )
}

/**
 * Get usage information for a specific resource type
 */
function getUsageInfo(
  capabilities: Capabilities,
  type: UsageBadgeProps['type'],
  currentCount?: number
): {
  current: number
  max: number | null
  label: string
  isUnlimited: boolean
  isAtLimit: boolean
} | null {
  switch (type) {
    case 'projects': {
      const current = currentCount ?? capabilities.current_projects
      return {
        current,
        max: capabilities.max_projects,
        label: current === 1 ? 'project' : 'projects',
        isUnlimited: capabilities.max_projects === null,
        isAtLimit: capabilities.max_projects !== null && current >= capabilities.max_projects,
      }
    }

    case 'analyses': {
      const current = currentCount ?? capabilities.current_analyses
      return {
        current,
        max: capabilities.max_analyses_per_project,
        label: current === 1 ? 'analysis' : 'analyses',
        isUnlimited: capabilities.max_analyses_per_project === null,
        isAtLimit:
          capabilities.max_analyses_per_project !== null &&
          current >= capabilities.max_analyses_per_project,
      }
    }

    case 'designs': {
      const current = currentCount ?? capabilities.current_designs
      return {
        current,
        max: capabilities.max_designs_per_analysis,
        label: current === 1 ? 'design' : 'designs',
        isUnlimited: capabilities.max_designs_per_analysis === null,
        isAtLimit:
          capabilities.max_designs_per_analysis !== null &&
          current >= capabilities.max_designs_per_analysis,
      }
    }

    default:
      return null
  }
}

/**
 * Determine badge color based on usage percentage
 */
function getBadgeColor(current: number, max: number | null, isAtLimit: boolean): string {
  // Unlimited - blue
  if (max === null) {
    return 'bg-blue-100 text-blue-800'
  }

  // At limit - red
  if (isAtLimit) {
    return 'bg-red-100 text-red-800'
  }

  // Above 80% - yellow
  if (current / max >= 0.8) {
    return 'bg-yellow-100 text-yellow-800'
  }

  // Normal - gray
  return 'bg-gray-100 text-gray-800'
}
