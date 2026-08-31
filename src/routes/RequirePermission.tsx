import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { Permission } from '@/types/enums'

interface RequirePermissionProps {
  anyOf: Permission[]
  children: ReactNode
}

export function RequirePermission({ anyOf, children }: RequirePermissionProps) {
  const { hasPermission } = useAuth()

  if (!hasPermission(...anyOf)) {
    return <Navigate to="/403" replace />
  }

  return children
}
