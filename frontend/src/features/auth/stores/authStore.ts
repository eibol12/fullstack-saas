import { create } from 'zustand'
import { User } from '@/types'
import { tokenStorage } from '@/lib/auth/storage'
import { authApi } from '@/api/endpoints/auth'
import { queryClient } from '@/lib/queryClient'

/**
 * Auth State Interface
 */
interface AuthState {
  // STATE
  user: User | null              // Currently logged-in user (null if not logged in)
  isAuthenticated: boolean       // Quick check: is user logged in?
  isLoading: boolean             // Are we fetching user data?
  isInitialized: boolean         // Has auth been initialized? (critical for route guards)

  // ACTIONS
  initializeAuth: () => Promise<void>              // Initialize auth on app startup
  login: (access: string, user: User) => void      // Call after successful login
  logout: () => void                               // Call to log user out
  setUser: (user: User) => void                    // Update user data
  setLoading: (loading: boolean) => void           // Update loading state
}

export const useAuthStore = create<AuthState>((set) => ({
  // INITIAL STATE
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,

  /**
   * INITIALIZE AUTH
   *
   * Called on app startup (by AuthProvider) to restore session.
   *
   * Flow:
   * 1. Call getCurrentUser with the stored access token
   * 2. If access token is expired → axios interceptor transparently refreshes it
   *    using the HttpOnly refresh cookie, then retries the request
   * 3. On success: mark authenticated
   * 4. On failure (no session or refresh cookie absent/expired): mark unauthenticated
   *
   * We do NOT check for a JS-readable refresh token here — the refresh token is
   * stored in an HttpOnly cookie that JavaScript cannot read. The interceptor
   * handles refresh automatically.
   */
  initializeAuth: async () => {
    try {
      // Don't make an API call if we know we don't have a token
      if (!tokenStorage.getAccessToken()) {
        set({
          user: null,
          isAuthenticated: false,
          isInitialized: true,
        })
        return
      }

      const userData = await authApi.getCurrentUser()
      set({
        user: userData,
        isAuthenticated: true,
        isInitialized: true,
      })
    } catch (error) {
      // No valid session: access token missing/invalid and refresh cookie absent/expired
      tokenStorage.clearTokens()
      set({
        user: null,
        isAuthenticated: false,
        isInitialized: true,
      })
    }
  },

  /**
   * LOGIN
   *
   * Called after successful API login.
   * Stores the access token in localStorage and updates state.
   *
   * The refresh token is NOT stored here — the backend set it as an HttpOnly
   * cookie during the login request (withCredentials:true). It is not
   * accessible from JavaScript by design.
   *
   * @param access - JWT access token from backend JSON response
   * @param user   - User profile data
   */
  login: (access, user) => {
    tokenStorage.setAccessToken(access)
    set({
      user,
      isAuthenticated: true,
      isInitialized: true,
      isLoading: false,
    })
  },

  /**
   * LOGOUT
   *
   * Clears the access token and auth state.
   *
   * The HttpOnly refresh cookie is cleared by the backend when the logout
   * endpoint is called (authApi.logout()). The UI layer is responsible for
   * calling authApi.logout() before or alongside this action so the backend
   * can properly blacklist the refresh token.
   */
  logout: () => {
    tokenStorage.clearTokens()
    queryClient.clear()
    set({
      user: null,
      isAuthenticated: false,
      isInitialized: true,
      isLoading: false,
    })
  },

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ isLoading: loading }),
}))

// Convenience selectors
export const useUser = () => useAuthStore((state) => state.user)
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated)
export const useAuthLoading = () => useAuthStore((state) => state.isLoading)
export const useAuthInitialized = () => useAuthStore((state) => state.isInitialized)
