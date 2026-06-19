import { useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import { riggingDesignApi} from '@/api/endpoints/design'
import {CreateDesignRequest, UpdateDesignRequest} from '@/types'
import { capabilitiesKeys } from '@/features/billing/hooks/useCapabilities'
/**
 * React Query keys for design0
 */
export const designKeys = {
    all: ['designs'] as const,
    lists: () => [...designKeys.all, "list"] as const,
    list: (projectId?: string, analysisId?: string) => [...designKeys.lists(), {
        projectId: projectId ?? null,
        analysisId: analysisId ?? null
    }
    ] as const,
    details: () => [...designKeys.all, 'detail'] as const,
    detail: (id?: string) => [...designKeys.details(), id] as const,
    reports: () => [...designKeys.all, 'report'] as const,
    report: (id?: string, selectedKey?: string) => [...designKeys.reports(), id, selectedKey ?? null] as const,
}

/**
 * Hook to fetch all designs (optionally filtered by projectId and analysisId)
 */
export function useDesigns(projectId?: string, analysisId?: string) {
    return useQuery({
        queryKey: designKeys.list(projectId, analysisId),
        queryFn: () => riggingDesignApi.getAll(projectId, analysisId),
    })
}

/**
 * Hook to fetch a single design by id with full details
 */
export function useDesign(id: string) {
    return useQuery({
        queryKey: designKeys.detail(id),
        queryFn: () => riggingDesignApi.getById(id),
        enabled: !!id,
    })
}

export function useDesignReport(id: string, selectedKey?: string) {
    return useQuery({
        queryKey: designKeys.report(id, selectedKey),
        queryFn: () => riggingDesignApi.getReport(id, selectedKey),
        enabled: !!id,
    })
}

/**
 * Hook to create a new design
 * On success, invalidates design lists AND capabilities
 */
export function useCreateDesign() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (design: CreateDesignRequest) => riggingDesignApi.create(design),
        onSuccess: (_newDesign) => {
            //Invalidate designs list
            queryClient.invalidateQueries({queryKey: designKeys.lists()})
            // Invalidate capabilities to update design counts
            queryClient.invalidateQueries({ queryKey: capabilitiesKeys.current() })
        },
    })
}

/**
 * Hook to update an existing design
 */
export function useUpdateDesign() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({id, data}: {id: string, data: UpdateDesignRequest}) => riggingDesignApi.update(id, data),
        onSuccess: (_updatedDesign, variables) => {
            //Invalidate both list and detail
            queryClient.invalidateQueries({queryKey: designKeys.lists() })
            queryClient.invalidateQueries({queryKey: designKeys.detail(variables.id) })
        },
    })
}

/**
 * Hook to delete a design by id
 * On success, invalidates design lists AND capabilities
 */
export function useDeleteDesign() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string) => riggingDesignApi.delete(id),
        onSuccess: (_data, id) => {
            // Invalidate all list variants (prefix match covers every projectId/analysisId combo)
            queryClient.invalidateQueries({ queryKey: designKeys.lists() })
            // Evict the deleted item's detail and report caches — a refetch would 404
            queryClient.removeQueries({ queryKey: designKeys.detail(id) })
            queryClient.removeQueries({ queryKey: [...designKeys.reports(), id] })
            // Invalidate capabilities to update design counts
            queryClient.invalidateQueries({ queryKey: capabilitiesKeys.current() })
        }
    })
}
