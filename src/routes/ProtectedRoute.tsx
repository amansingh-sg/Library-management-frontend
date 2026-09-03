import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { FullPageSpinner } from '@/components/ui/FullPageSpinner'

// Route guard: wraps a group of routes in App.tsx and renders their content (via
// <Outlet />) only for a logged-in user; otherwise redirects to /login.
export function ProtectedRoute() {
  const { isAuthenticated, isInitializing } = useAuth()
  const location = useLocation()

  // isInitializing is true while AuthContext is still trying to restore a session
  // from a stored token on first load - wait for that before deciding, so a
  // logged-in user isn't briefly bounced to /login on refresh.
  if (isInitializing) return <FullPageSpinner />

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
