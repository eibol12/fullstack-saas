import { Navigate, Outlet } from 'react-router-dom'
import { useIsAuthenticated, useAuthInitialized } from '@/features/auth/stores/authStore'

/**
 * PROTECTED ROUTE COMPONENT
 *
 * This component guards routes that require authentication
 *
 * HOW IT WORKS:
 * 1. Wait for auth to initialize (critical for page refresh/direct URL)
 * 2. Check if user is authenticated (via Zustand authStore)
 * 3. If YES → render child routes (Outlet)
 * 4. If NO  → redirect to /login
 *
 * USAGE IN ROUTER:
 * <Route element={<ProtectedRoute />}>
 *   <Route path="/dashboard" element={<DashboardPage />} />
 *   <Route path="/projects" element={<ProjectsPage />} />
 * </Route>
 *
 * All nested routes are automatically protected!
 *
 * WHY OUTLET?
 * <Outlet /> is from React Router - it renders the matched child route
 * Think of it as a placeholder where child routes appear
 *
 * FLOW EXAMPLE:
 * User visits /dashboard
 *   → ProtectedRoute waits for auth initialization
 *   → If auth not initialized yet: show loading
 *   → Once initialized, check if logged in
 *   → If logged in: <Outlet /> renders <DashboardPage />
 *   → If not logged in: <Navigate to="/login" /> redirects
 *
 * WHY THE isInitialized CHECK?
 * This fixes the bug where:
 * - User refreshes page or directly enters URL
 * - ProtectedRoute renders before AuthProvider fetches user
 * - isAuthenticated is still false (hasn't hydrated yet)
 * - User gets redirected to /login even though they have valid tokens
 *
 * By waiting for isInitialized, we ensure auth state is fully resolved
 * before making the redirect decision.
 */

export default function ProtectedRoute() {
  const isInitialized = useAuthInitialized()
  const isAuthenticated = useIsAuthenticated()

  /**
   * STEP 1: Wait for auth initialization
   *
   * Show loading spinner while AuthProvider is:
   * - Checking localStorage for tokens
   * - Fetching current user from API
   * - Attempting token refresh if needed
   *
   * This prevents premature redirects to /login
   */
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  /**
   * STEP 2: Check authentication status
   *
   * Auth is now fully initialized, so isAuthenticated is accurate
   * The `replace` prop prevents this redirect from being added
   * to browser history (so "Back" button works correctly)
   */
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  /**
   * STEP 3: Render protected content
   *
   * User is authenticated - render the child route
   * <Outlet /> is React Router's way of rendering nested routes
   * Whatever route matched will be rendered here
   */
  return <Outlet />
}

/**
 * ALTERNATIVE PATTERN (if you want a loading state):
 * 
 * export default function ProtectedRoute() {
 *   const isAuthenticated = useIsAuthenticated()
 *   const isLoading = useAuthLoading()
 * 
 *   if (isLoading) {
 *     return <LoadingSpinner />
 *   }
 * 
 *   if (!isAuthenticated) {
 *     return <Navigate to="/login" replace />
 *   }
 * 
 *   return <Outlet />
 * }
 */

/**
 * SECURITY NOTE:
 * 
 * This component provides UI-level protection only!
 * Your backend API MUST also enforce authentication via JWT tokens
 * 
 * Think of ProtectedRoute as:
 * - Good UX (prevents user from seeing pages they can't access)
 * - NOT security (malicious user could bypass client-side checks)
 * 
 * Real security happens on backend with:
 * @permission_classes([IsAuthenticated])
 */
