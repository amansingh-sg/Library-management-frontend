import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { jwtDecode } from 'jwt-decode'
import * as authApi from '@/api/auth.api'
import { clearSession, getToken, setSession } from '@/utils/session'
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
    if (token) {
      const decoded = decodeUser(token)
      if (decoded) {
        setUser(decoded)
      } else {
        clearSession()
      }
    }
    setIsInitializing(false)
  }, [])

  const applySession = useCallback((token: string, refreshToken?: string) => {
    setSession(token, refreshToken)
    const decoded = decodeUser(token)
    setUser(decoded)
  }, [])

  const login = useCallback(
    async (payload: LoginPayload) => {
      const session = await authApi.login(payload)
      applySession(session.token, session.refreshToken)
    },
    [applySession],
  )

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const session = await authApi.register(payload)
      applySession(session.token)
    },
    [applySession],
  )

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
