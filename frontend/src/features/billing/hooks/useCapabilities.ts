import { useQuery } from '@tanstack/react-query'
import { billingApi } from '@/api/endpoints/billing'
import { useIsAuthenticated } from '@/features/auth/stores/authStore'
import { Capabilities } from '@/types/capabilities'

/**
 * React Query keys for capabilities
 */
export const capabilitiesKeys = {
  all: ['capabilities'] as const,
  current: () => [...capabilitiesKeys.all, 'current'] as const,
}

/**
 * Hook to fetch current user's tier capabilities and limits
 *
 * This hook fetches the capabilities endpoint which provides:
 * - current_tier: 'free' | 'starter' | 'pro'
 * - subscription_active: boolean
 * - max_projects: number | null (null = unlimited)
 * - max_analyses_per_project: number | null
 * - max_designs_per_analysis: number | null
 * - can_export_pdf: boolean
 * - can_use_api: boolean
 * - support_level: string
 * - current_projects: number (current usage count)
 *
 * Backend is the source of truth for all tier logic.
 * Frontend uses this data only for UX improvement, not enforcement.
 */
export function useCapabilities() {
  const isAuthenticated = useIsAuthenticated()

  return useQuery({
    queryKey: capabilitiesKeys.current(),
    queryFn: () => billingApi.getCapabilities(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes - capabilities don't change often
    retry: 1,
  })
}

/**
 * Helper: Check if user can create another project
 *
 * @param capabilities - Capabilities object from useCapabilities
 * @returns Object with allowed flag and reason message
 */
export function canCreateProject(capabilities: Capabilities | undefined): {
  allowed: boolean
  reason?: string
} {
  if (!capabilities) {
    return { allowed: false, reason: 'Loading capabilities...' }
  }

  const { max_projects, current_projects } = capabilities

  // Unlimited projects (Pro tier)
  if (max_projects === null) {
    return { allowed: true }
  }

  // Check limit
  if (current_projects >= max_projects) {
    return {
      allowed: false,
      reason: `Project limit reached (${current_projects}/${max_projects}). Upgrade to create more projects.`,
    }
  }

  return { allowed: true }
}

/**
 * Helper: Check if project limit is reached
 */
export function isProjectLimitReached(capabilities: Capabilities | undefined): boolean {
  if (!capabilities) return false

  const { max_projects, current_projects } = capabilities

  if (max_projects === null) return false // Unlimited

  return current_projects >= max_projects
}

/**
 * Helper: Get project usage summary
 */
export function getProjectUsage(capabilities: Capabilities | undefined): {
  current: number
  max: number | null
  percentage: number
  isUnlimited: boolean
} {
  if (!capabilities) {
    return { current: 0, max: 0, percentage: 0, isUnlimited: false }
  }

  const { max_projects, current_projects } = capabilities

  if (max_projects === null) {
    return {
      current: current_projects,
      max: null,
      percentage: 0,
      isUnlimited: true,
    }
  }

  const percentage = max_projects > 0 ? (current_projects / max_projects) * 100 : 0

  return {
    current: current_projects,
    max: max_projects,
    percentage,
    isUnlimited: false,
  }
}

/**
 * Helper: Check if user can create analysis in a project
 *
 * @param capabilities - Capabilities object from useCapabilities
 * @param projectAnalysisCount - Current number of analyses in the specific project
 * @returns Object with allowed flag and reason message
 */
export function canCreateAnalysis(
  capabilities: Capabilities | undefined,
  projectAnalysisCount: number
): {
  allowed: boolean
  reason?: string
} {
  if (!capabilities) {
    return { allowed: false, reason: 'Loading capabilities...' }
  }

  const { max_analyses_per_project } = capabilities

  // Unlimited analyses
  if (max_analyses_per_project === null) {
    return { allowed: true }
  }

  // Check limit for this specific project
  if (projectAnalysisCount >= max_analyses_per_project) {
    return {
      allowed: false,
      reason: `Analysis limit reached (${projectAnalysisCount}/${max_analyses_per_project} for this project). Upgrade to create more.`,
    }
  }

  return { allowed: true }
}

/**
 * Helper: Check if user can create design for an analysis
 *
 * @param capabilities - Capabilities object from useCapabilities
 * @param analysisDesignCount - Current number of designs in the specific analysis
 * @returns Object with allowed flag and reason message
 */
export function canCreateDesign(
  capabilities: Capabilities | undefined,
  analysisDesignCount: number
): {
  allowed: boolean
  reason?: string
} {
  if (!capabilities) {
    return { allowed: false, reason: 'Loading capabilities...' }
  }

  const { max_designs_per_analysis } = capabilities

  // Unlimited designs
  if (max_designs_per_analysis === null) {
    return { allowed: true }
  }

  // Check limit for this specific analysis
  if (analysisDesignCount >= max_designs_per_analysis) {
    return {
      allowed: false,
      reason: `Design limit reached (${analysisDesignCount}/${max_designs_per_analysis} for this analysis). Upgrade to create more.`,
    }
  }

  return { allowed: true }
}

/**
 * Helper: Check if user can export PDF
 */
export function canExportPDF(capabilities: Capabilities | undefined): {
  allowed: boolean
  reason?: string
} {
  if (!capabilities) {
    return { allowed: false, reason: 'Loading capabilities...' }
  }

  if (!capabilities.can_export_pdf) {
    return {
      allowed: false,
      reason: 'PDF export requires Starter tier or higher.',
    }
  }

  return { allowed: true }
}

/**
 * Helper: Check if user can use API
 */
export function canUseAPI(capabilities: Capabilities | undefined): {
  allowed: boolean
  reason?: string
} {
  if (!capabilities) {
    return { allowed: false, reason: 'Loading capabilities...' }
  }

  if (!capabilities.can_use_api) {
    return {
      allowed: false,
      reason: 'API access requires Pro tier.',
    }
  }

  return { allowed: true }
}
