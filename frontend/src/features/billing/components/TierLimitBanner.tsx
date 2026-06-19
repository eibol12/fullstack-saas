import { Capabilities, TierName } from '@/types/capabilities'

interface TierLimitBannerProps {
  capabilities: Capabilities
  limitType: 'projects' | 'analyses' | 'designs' | 'export' | 'api'
  onUpgrade?: () => void
}

/**
 * TierLimitBanner Component
 *
 * Shows a warning banner when user approaches or hits a tier limit
 * Provides upgrade guidance and call-to-action
 */
export function TierLimitBanner({ capabilities, limitType, onUpgrade }: TierLimitBannerProps) {
  const banner = getBannerContent(capabilities, limitType)

  if (!banner) {
    return null
  }

  const { severity, message, showUpgrade } = banner

  const bgColor = severity === 'error' ? 'bg-red-50' : 'bg-yellow-50'
  const borderColor = severity === 'error' ? 'border-red-200' : 'border-yellow-200'
  const textColor = severity === 'error' ? 'text-red-800' : 'text-yellow-800'
  const iconColor = severity === 'error' ? 'text-red-400' : 'text-yellow-400'

  return (
    <div className={`rounded-md ${bgColor} border ${borderColor} p-4`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className={`h-5 w-5 ${iconColor}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <p className={`text-sm ${textColor}`}>{message}</p>
          {showUpgrade && onUpgrade && (
            <div className="mt-2">
              <button
                onClick={onUpgrade}
                className={`text-sm font-medium ${textColor} underline hover:no-underline`}
              >
                View upgrade options
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Determine banner content based on capabilities and limit type
 */
function getBannerContent(
  capabilities: Capabilities,
  limitType: TierLimitBannerProps['limitType']
): { severity: 'warning' | 'error'; message: string; showUpgrade: boolean } | null {
  switch (limitType) {
    case 'projects':
      return getProjectLimitBanner(capabilities)
    case 'analyses':
      return getAnalysisLimitBanner(capabilities)
    case 'designs':
      return getDesignLimitBanner(capabilities)
    case 'export':
      return getExportLimitBanner(capabilities)
    case 'api':
      return getAPILimitBanner(capabilities)
    default:
      return null
  }
}

function getProjectLimitBanner(capabilities: Capabilities) {
  const { max_projects, current_projects, current_tier } = capabilities

  // Unlimited
  if (max_projects === null) {
    return null
  }

  const remaining = max_projects - current_projects

  // At limit
  if (remaining <= 0) {
    return {
      severity: 'error' as const,
      message: `You've reached your project limit (${current_projects}/${max_projects}). Upgrade to create more projects.`,
      showUpgrade: true,
    }
  }

  // Approaching limit (80% or 1 remaining)
  if (remaining === 1 || current_projects / max_projects >= 0.8) {
    return {
      severity: 'warning' as const,
      message: `Projects: ${current_projects} / ${max_projects} used — ${remaining} remaining on your ${getTierDisplayName(current_tier)} plan.`,
      showUpgrade: true,
    }
  }

  return null
}

function getAnalysisLimitBanner(capabilities: Capabilities) {
  const { max_analyses_per_project, current_tier } = capabilities

  if (max_analyses_per_project === null) {
    return null
  }

  // Show general info about limit
  return {
    severity: 'warning' as const,
    message: `Your ${getTierDisplayName(current_tier)} plan allows up to ${max_analyses_per_project} analysis per project.`,
    showUpgrade: false,
  }
}

function getDesignLimitBanner(capabilities: Capabilities) {
  const { max_designs_per_analysis, current_tier } = capabilities

  if (max_designs_per_analysis === null) {
    return null
  }

  return {
    severity: 'warning' as const,
    message: `Your ${getTierDisplayName(current_tier)} plan allows up to ${max_designs_per_analysis} design per analysis.`,
    showUpgrade: false,
  }
}

function getExportLimitBanner(capabilities: Capabilities) {
  if (capabilities.can_export_pdf) {
    return null
  }

  return {
    severity: 'error' as const,
    message: 'PDF export is not available on the Free plan. Upgrade to Starter or Pro to export your designs.',
    showUpgrade: true,
  }
}

function getAPILimitBanner(capabilities: Capabilities) {
  if (capabilities.can_use_api) {
    return null
  }

  return {
    severity: 'error' as const,
    message: 'API access is not available on your current plan. Upgrade to Pro for full API access.',
    showUpgrade: true,
  }
}

function getTierDisplayName(tier: TierName): string {
  const displayNames: Record<TierName, string> = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
  }
  return displayNames[tier] || tier
}
