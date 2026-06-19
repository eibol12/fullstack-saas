import { useEffect } from 'react'
import { useAuthStore, useAuthInitialized } from '@/features/auth/stores/authStore'

/**
 * AuthProvider Component
 *
 * Initializes authentication state on app load
 *
 * Purpose:
 * - Restores user session from tokens in localStorage
 * - Prevents protected routes from rendering before auth is resolved
 * - Ensures consistent auth state across page refreshes, direct URL entry, and external returns (Stripe, etc)
 *
 * Flow:
 * 1. App loads
 * 2. AuthProvider mounts
 * 3. Calls authStore.initializeAuth()
 * 4. Shows loading spinner while auth initializes
 * 5. Once initialized, renders children (router, etc)
 *
 * Why this fixes the bug:
 * - Previously: ProtectedRoute checked auth BEFORE user data was fetched
 * - Now: ProtectedRoute waits for isInitialized flag before checking auth
 * - Result: Direct URL entry, refresh, and Stripe return all work correctly
 */

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const initializeAuth = useAuthStore((state) => state.initializeAuth)
  const isInitialized = useAuthInitialized()

  useEffect(() => {
    // Initialize auth on mount
    // This will:
    // 1. Check for tokens in localStorage
    // 2. If tokens exist, fetch current user
    // 3. If fetch fails, clear tokens
    // 4. Set isInitialized = true when done
    initializeAuth()
  }, [initializeAuth])

  // Show loading spinner while checking auth status
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

  return <>{children}</>
}
