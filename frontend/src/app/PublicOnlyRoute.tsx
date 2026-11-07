import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { PageLoader } from '@/components/layout/PageLoader'
import { ROUTES } from '@/config/routes'
import { useAuth } from './providers/AuthProvider'

export interface PublicOnlyRouteProps {
  children?: ReactNode
}

/**
 * Route wrapper for public auth pages (Login, Register).
 * - While the session state is resolving, renders the PageLoader.
 * - If already authenticated, redirects the user to the Memory Wall.
 * - Otherwise renders the auth page.
 */
export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <PageLoader />
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.memoryWall} replace />
  }

  return <>{children}</>
}

