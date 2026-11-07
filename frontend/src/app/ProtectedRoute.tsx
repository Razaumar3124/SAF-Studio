import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { PageLoader } from '@/components/layout/PageLoader'
import { ROUTES } from '@/config/routes'
import { useAuth } from './providers/AuthProvider'

export interface ProtectedRouteProps {
  children?: ReactNode
}

/**
 * Route guard that ensures the user is authenticated.
 * - While the session is being restored (initial silent refresh / getMe), displays a PageLoader.
 * - If unauthenticated, redirects to the Login page with `from` location state so the user can be returned after login.
 * - If authenticated, renders the protected component.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <PageLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}

