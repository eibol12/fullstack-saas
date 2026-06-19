import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { tokenStorage } from '@/lib/auth/storage'
import { getApiUrl } from '@/lib/utils'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { normalizeApiError } from '@/lib/normalizeApiError'

const api = axios.create({
  baseURL: `${getApiUrl()}/api/v1`,
  timeout: 30000,
  // Required for the browser to send/receive the HttpOnly refresh cookie
  // on cross-origin requests (login sets it, refresh reads it, logout clears it).
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach access token to Authorization header
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getAccessToken()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: on 401, refresh access token via HttpOnly cookie
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // The refresh token lives in the HttpOnly cookie — do NOT send it in
        // the request body. withCredentials causes the browser to include it
        // automatically. Use a bare axios call (not `api`) to avoid re-entering
        // this interceptor if the refresh itself returns 401.
        const refreshResponse = await axios.post(
          `${getApiUrl()}/api/v1/auth/token/refresh/`,
          {},
          { withCredentials: true }
        )

        const { access } = refreshResponse.data
        tokenStorage.setAccessToken(access)

        // Retry the original request with the new access token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access}`
        }
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh cookie absent, expired, or blacklisted — user must log in again
        useAuthStore.getState().logout()
        return Promise.reject(refreshError)
      }
    }

    // Centralized error normalization
    const normalized = normalizeApiError(error);
    (error as any).normalized = normalized;

    return Promise.reject(error)
  }
)

export default api
