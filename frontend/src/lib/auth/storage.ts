// Access token is stored in localStorage so it survives page refreshes.
// The refresh token is intentionally NOT stored here — it lives in an
// HttpOnly cookie set by the backend (JWT_AUTH_HTTPONLY=True). JavaScript
// cannot read or write it; the browser sends it automatically.

const TOKEN_KEY = 'access_token'

export const tokenStorage = {
  getAccessToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY)
  },

  setAccessToken: (access: string): void => {
    localStorage.setItem(TOKEN_KEY, access)
  },

  clearTokens: (): void => {
    localStorage.removeItem(TOKEN_KEY)
  },

  hasValidToken: (): boolean => {
    const token = tokenStorage.getAccessToken()
    if (!token) return false

    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const exp = payload.exp * 1000 // Convert to milliseconds
      return Date.now() < exp
    } catch {
      return false
    }
  },
}
