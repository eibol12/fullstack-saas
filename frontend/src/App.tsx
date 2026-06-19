import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/features/auth/components/AuthProvider'
import { router } from './router'
import { queryClient } from '@/lib/queryClient'


/**
 * MAIN APP COMPONENT
 *
 * This is the root component of your React application
 *
 * PROVIDER HIERARCHY:
 * 1. QueryClientProvider - Provides React Query context (data fetching)
 * 2. AuthProvider - Fetches user data on app load if token exists
 * 3. RouterProvider - Provides React Router context (routing/navigation)
 * 4. ReactQueryDevtools - Dev tools for debugging queries (dev only)
 *
 * HOW IT WORKS:
 * - QueryClientProvider: Makes queryClient available to all components
 * - RouterProvider: Provides routing context to entire app
 * - router: Contains all route definitions (from router.tsx)
 *
 * FLOW:
 * 1. App renders
 * 2. QueryClientProvider wraps everything → React Query hooks work
 * 3. RouterProvider reads current URL
 * 4. Finds matching route in router
 * 5. Renders corresponding component
 *
 * EXAMPLES:
 * URL: /login        → LoginPage renders
 * URL: /register     → RegisterPage renders
 * URL: /dashboard    → ProtectedRoute checks auth → DashboardPage renders (if logged in)
 * URL: /dashboard    → ProtectedRoute checks auth → Redirects to /login (if not logged in)
 *
 * WHY THIS PATTERN?
 * - Clean separation: App.tsx handles providers, pages handle logic
 * - QueryClientProvider enables:
 *   - useQuery hooks (data fetching)
 *   - useMutation hooks (create/update/delete)
 *   - Automatic caching and refetching
 * - RouterProvider handles:
 *   - URL changes (forward/back buttons)
 *   - Navigation (Link, navigate())
 *   - Route matching
 *   - Error boundaries
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        {/* Toast notifications — bottom-right, themed via CSS variables */}
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast:
                'group rounded-lg border border-border bg-card text-card-foreground shadow-paper',
              title: 'font-semibold text-sm',
              description: 'text-xs text-muted-foreground',
            },
          }}
        />
        {/* React Query DevTools - only visible in development */}
        <ReactQueryDevtools initialIsOpen={false} />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
