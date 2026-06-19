import { QueryClient } from '@tanstack/react-query'

/**
 * Shared React Query Client instance
 *
 * Persists for the lifecycle of the SPA and is cleared on logout
 * to prevent cached data leaks between different user accounts.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false, // Don't refetch on window focus
    },
  },
})
