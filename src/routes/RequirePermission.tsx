import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { Permission } from '@/types/enums'

interface RequirePermissionProps {
  anyOf: Permission[]
  children: ReactNode
}

// Route guard: renders `children` only if the current user holds at least one of
// the given permissions, otherwise redirects to a 403 page. This is a UI-only gate
// (see hasPermission's note in AuthContext) - the backend enforces the real check.
export function RequirePermission({ anyOf, children }: RequirePermissionProps) {
  const { hasPermission } = useAuth()

  if (!hasPermission(...anyOf)) {
    return <Navigate to="/403" replace />
  }

  return children
}
