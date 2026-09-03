import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { jwtDecode } from 'jwt-decode'
import * as authApi from '@/api/auth.api'
import { clearSession, getRefreshToken, getToken, setSession } from '@/utils/session'
import { DEFAULT_ROLE_PERMISSIONS, type Permission, type Role } from '@/types/enums'
import type { AuthTokenPayload, LoginPayload, RegisterPayload } from '@/types/models'

export interface CurrentUser {
  id: string
  email: string
  role: Role
}

interface AuthContextValue {
  user: CurrentUser | null
  isAuthenticated: boolean
  isInitializing: boolean
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
  // NOTE: hasPermission/hasRole are UI-convenience checks only (e.g. hiding a nav
  // link or button a user isn't meant to see). They are NOT real security - the
  // backend independently re-checks every permission on every request and returns
  // 403 if the live grant differs, so a stale/wrong result here can only ever
  // hide/show something incorrectly, never bypass real authorization.
  hasPermission: (...permissions: Permission[]) => boolean
  hasRole: (...roles: Role[]) => boolean
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function decodeUser(token: string): CurrentUser | null {
  try {
    const payload = jwtDecode<AuthTokenPayload>(token)
    if (payload.exp * 1000 < Date.now()) return null
    return { id: payload.id, email: payload.email, role: payload.role }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setIsInitializing(false)
      return
    }

    const decoded = decodeUser(token)
    if (decoded) {
      setUser(decoded)
      setIsInitializing(false)
      return
    }

    // Access token expired while the tab was closed/asleep (it only lives 15
    // minutes) - try the refresh token (valid 7 days) before giving up and
    // logging the user out.
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      clearSession()
      setIsInitializing(false)
      return
    }

    authApi
      .refreshAccessToken(refreshToken)
      .then((session) => {
        setSession(session.token)
        setUser(decodeUser(session.token))
      })
      .catch(() => {
        clearSession()
      })
      .finally(() => {
        setIsInitializing(false)
      })
  }, [])

  const applySession = useCallback((token: string, refreshToken?: string) => {
    setSession(token, refreshToken)
    const decoded = decodeUser(token)
    setUser(decoded)
  }, [])

  const login = useCallback(
    async (payload: LoginPayload) => {
      // The access token (short-lived, ~15 min) is what gets sent on every request;
      // the refresh token (long-lived, 7 days) is only ever used to silently obtain
      // a new access token - see performRefresh in api/client.ts.
      const session = await authApi.login(payload)
      applySession(session.token, session.refreshToken)
    },
    [applySession],
  )

  const register = useCallback(async (payload: RegisterPayload) => {
    // No token to apply - the account isn't verified yet, so it isn't logged in.
    // The user must enter the 6-digit code emailed to them, which does log them
    // in (see VerifyOtpPage).
    await authApi.register(payload)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const hasPermission = useCallback(
    (...permissions: Permission[]) => {
      if (!user) return false
      const granted = DEFAULT_ROLE_PERMISSIONS[user.role] ?? []
      return permissions.some((permission) => granted.includes(permission))
    },
    [user],
  )

  const hasRole = useCallback(
    (...roles: Role[]) => {
      if (!user) return false
      return roles.includes(user.role)
    },
    [user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitializing,
      login,
      register,
      logout,
      hasPermission,
      hasRole,
    }),
    [user, isInitializing, login, register, logout, hasPermission, hasRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
