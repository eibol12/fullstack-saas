import {useQuery} from "@tanstack/react-query"
import {riggingDesignApi} from "@/api/endpoints/design"

/**
 * React Query Key for component options
 */
export const componentOptionsKey = ["component-options"] as const

/**
 * Hook to fetch component options for dynamic form
 */
export function useComponentOptions() {
    return useQuery({
        queryKey: componentOptionsKey,
        queryFn: () => riggingDesignApi.getComponentOptions(),
        staleTime: 1000 * 60 * 60,
    })
}