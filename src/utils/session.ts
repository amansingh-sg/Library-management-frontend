const TOKEN_KEY = 'library.token'
const REFRESH_TOKEN_KEY = 'library.refreshToken'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setSession(token: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}
