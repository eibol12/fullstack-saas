import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi } from '@/api/endpoints/projects'
import { CreateProjectRequest, UpdateProjectRequest } from '@/types'
import { capabilitiesKeys } from '@/features/billing/hooks/useCapabilities'

/**
 * React Query keys for projects
 */
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: () => [...projectKeys.lists()] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  overview: () => [...projectKeys.all, 'overview'] as const,
}

/**
 * Hook to fetch the centralized projects overview that powers the
 * `/dashboard` table (projects → analyses → designs).
 */
export function useProjectsOverview() {
  return useQuery({
    queryKey: projectKeys.overview(),
    queryFn: () => projectsApi.getOverview(),
  })
}

/**
 * Hook to fetch all projects
 */
export function useProjects() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => projectsApi.getAll(),
  })
}

/**
 * Hook to fetch a single project with details
 */
export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectsApi.getById(id),
    enabled: !!id,
  })
}

/**
 * Hook to create a new project
 *
 * On success, invalidates projects list AND capabilities
 * (capabilities contains current_projects count that needs to be updated)
 */
export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (project: CreateProjectRequest) => projectsApi.create(project),
    onSuccess: () => {
      // Invalidate all project queries (including list and overview) to refetch
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      // Invalidate capabilities to update project count
      queryClient.invalidateQueries({ queryKey: capabilitiesKeys.current() })
    },
  })
}

/**
 * Hook to update a project
 */
export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectRequest }) =>
      projectsApi.update(id, data),
    onSuccess: (_, variables) => {
      // Invalidate both list, overview, and detail
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.id) })
    },
  })
}

/**
 * Hook to delete a project
 *
 * On success, invalidates projects list AND capabilities
 * (capabilities contains current_projects count that needs to be updated)
 */
export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      // Invalidate all project queries
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      // Invalidate capabilities to update project count
      queryClient.invalidateQueries({ queryKey: capabilitiesKeys.current() })
    },
  })
}
