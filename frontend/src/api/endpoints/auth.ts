import api from '../axios'
import {
  LoginResponse,
  RegisterResponse,
  User,
  VerifyEmailResponse,
  PasswordResetResponse,
  PasswordChangeResponse
} from '@/types'

/**
 * AUTH API ENDPOINTS
 * 
 * These work with dj-rest-auth (Django allauth)
 * 
 * ENDPOINTS:
 * - POST /api/v1/auth/login/                    (dj-rest-auth)
 * - POST /api/v1/auth/registration/             (dj-rest-auth)
 * - POST /api/v1/auth/logout/                   (dj-rest-auth)
 * - POST /api/v1/auth/registration/verify-email/ (dj-rest-auth)
 * - POST /api/v1/auth/registration/resend-email/ (dj-rest-auth)
 * - POST /api/v1/auth/password/reset/           (dj-rest-auth)
 * - POST /api/v1/auth/password/reset/confirm/   (dj-rest-auth)
 * - POST /api/v1/auth/password/change/          (dj-rest-auth)
 * - GET  /api/v1/auth/user/                     (dj-rest-auth)
 */

export const authApi = {
  fetchCurrentUserWithToken: async (accessToken: string): Promise<User> => {
    const { data } = await api.get('/auth/me/', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    return data
  },

  /**
   * LOGIN
   * 
   * POST /api/v1/auth/login/
   * 
   * dj-rest-auth expects: { email, password }
   * or: { username, password }
   * 
   * Returns: { access, refresh, user }
   */
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await api.post('/auth/login/', {
      email,      // dj-rest-auth accepts email OR username
      password
    })
    const user = await authApi.fetchCurrentUserWithToken(data.access)
    return { ...data, user }
  },

  /**
   * REGISTER
   * 
   * POST /api/v1/auth/registration/
   * 
   * dj-rest-auth expects:
   * {
   *   username: string,
   *   email: string,
   *   password1: string,
   *   password2: string
   * }
   * 
   * We use email as username for simplicity
   */
  register: async (email: string, password: string): Promise<RegisterResponse> => {
    const { data } = await api.post('/auth/registration/', {
      username: email,      // Use email as username
      email: email,
      password1: password,
      password2: password   // Same password for confirmation
    })
    
    // If backend returns an access token, fetch the user profile
    if (data.access) {
      const user = await authApi.fetchCurrentUserWithToken(data.access)
      return { ...data, user }
    }
    
    return data
  },

  /**
   * GET CURRENT USER
   * 
   * GET /api/v1/auth/me/
   * 
   * dj-rest-auth endpoint that returns current user's data
   */
  getCurrentUser: async (): Promise<User> => {
    const { data } = await api.get('/auth/me/')
    return data
  },

  updateProfile: async (payload: FormData): Promise<User> => {
    const { data } = await api.patch('/auth/me/', payload, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return data
  },

  /**
   * LOGOUT
   * 
   * POST /api/v1/auth/logout/
   * 
   * Invalidates the refresh token on backend
   */
  logout: async (): Promise<void> => {
    await api.post('/auth/logout/')
  },

  /**
   * REFRESH TOKEN
   *
   * POST /api/v1/auth/token/refresh/
   *
   * The refresh token is NOT sent in the request body. It lives in the
   * HttpOnly cookie set by the backend (JWT_AUTH_HTTPONLY=True). The browser
   * sends it automatically because withCredentials is set on the axios instance.
   *
   * This method is kept for completeness. In practice, token refresh is handled
   * transparently by the axios response interceptor in axios.ts.
   */
  refreshToken: async (): Promise<{ access: string }> => {
    const { data } = await api.post('/auth/token/refresh/', {})
    return data
  },

  /**
   * VERIFY EMAIL
   *
   * POST /api/v1/auth/registration/verify-email/
   *
   * Verifies user's email address with the key from email link
   */
  verifyEmail: async (key: string): Promise<VerifyEmailResponse> => {
    const { data } = await api.post('/auth/registration/verify-email/', { key })
    return data
  },

  /**
   * RESEND VERIFICATION EMAIL
   *
   * POST /api/v1/auth/registration/resend-email/
   *
   * Resends the email verification link
   */
  resendVerificationEmail: async (email: string): Promise<{ detail: string }> => {
    const { data } = await api.post('/auth/registration/resend-email/', { email })
    return data
  },

  /**
   * PASSWORD RESET REQUEST
   *
   * POST /api/v1/auth/password/reset/
   *
   * Sends password reset email to user
   */
  requestPasswordReset: async (email: string): Promise<PasswordResetResponse> => {
    const { data } = await api.post('/auth/password/reset/', { email })
    return data
  },

  /**
   * PASSWORD RESET CONFIRM
   *
   * POST /api/v1/auth/password/reset/confirm/
   *
   * Confirms password reset with uid, token, and new password
   */
  confirmPasswordReset: async (
    uid: string,
    token: string,
    new_password1: string,
    new_password2: string
  ): Promise<{ detail: string }> => {
    const { data } = await api.post('/auth/password/reset/confirm/', {
      uid,
      token,
      new_password1,
      new_password2,
    })
    return data
  },

  /**
   * PASSWORD CHANGE (Authenticated users)
   *
   * POST /api/v1/auth/password/change/
   *
   * Changes password for logged-in users (requires old password)
   */
  changePassword: async (
    old_password: string,
    new_password1: string,
    new_password2: string
  ): Promise<PasswordChangeResponse> => {
    const { data } = await api.post('/auth/password/change/', {
      old_password,
      new_password1,
      new_password2,
    })
    return data
  },
}
