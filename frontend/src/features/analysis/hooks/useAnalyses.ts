import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { analysisApi } from '@/api/endpoints/analysis'
import { CreateAnalysisRequest, UpdateAnalysisRequest } from '@/types'
import { projectKeys } from '@/features/projects/hooks/useProjects'
import { capabilitiesKeys } from '@/features/billing/hooks/useCapabilities'

/**
 * React Query keys for analyses
 */
export const analysisKeys = {
  all: ['analyses'] as const,
  lists: () => [...analysisKeys.all, 'list'] as const,
  list: (projectId?: string) => [...analysisKeys.lists(), { projectId }] as const,
  details: () => [...analysisKeys.all, 'detail'] as const,
  detail: (id: string) => [...analysisKeys.details(), id] as const,
}

/**
 * Hook to fetch all analyses (optionally filtered by project)
 */
export function useAnalyses(projectId?: string) {
  return useQuery({
    queryKey: analysisKeys.list(projectId),
    queryFn: () => analysisApi.getAll(projectId),
  })
}

/**
 * Hook to fetch a single analysis with full details
 */
export function useAnalysis(id: string) {
  return useQuery({
    queryKey: analysisKeys.detail(id),
    queryFn: () => analysisApi.getById(id),
    enabled: !!id,
  })
}

/**
 * Hook to create a new analysis
 */
export function useCreateAnalysis() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (analysis: CreateAnalysisRequest) => analysisApi.create(analysis),
    onSuccess: (newAnalysis) => {
      // Invalidate analyses list
      queryClient.invalidateQueries({ queryKey: analysisKeys.lists() })
      // Invalidate project detail (to update analyses count)
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(newAnalysis.project) })
    },
  })
}

/**
 * Hook to update an analysis
 */
export function useUpdateAnalysis() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAnalysisRequest }) =>
      analysisApi.update(id, data),
    onSuccess: (updatedAnalysis, variables) => {
      // Invalidate both list and detail
      queryClient.invalidateQueries({ queryKey: analysisKeys.lists() })
      queryClient.invalidateQueries({ queryKey: analysisKeys.detail(variables.id) })
      // Invalidate project detail
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(updatedAnalysis.project) })
    },
  })
}

/**
 * Hook to delete an analysis.
 *
 * Accepts { id, projectId } so the owning project's detail cache can be
 * invalidated precisely, instead of relying on the broader lists() key which
 * does not cover projectKeys.detail(id) entries.
 */
export function useDeleteAnalysis() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => analysisApi.delete(id),
    onSuccess: (_data, variables) => {
      // Invalidate all analysis list queries
      queryClient.invalidateQueries({ queryKey: analysisKeys.lists() })
      // Remove the stale detail entry for the deleted analysis
      queryClient.invalidateQueries({ queryKey: analysisKeys.detail(variables.id) })
      // Invalidate the specific project detail (analyses_count + analyses list)
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) })
      // Refresh capability limits (analysis count may have changed)
      queryClient.invalidateQueries({ queryKey: capabilitiesKeys.current() })
    },
  })
}
