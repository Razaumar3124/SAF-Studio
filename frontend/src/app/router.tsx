import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PageLoader } from '@/components/layout/PageLoader'
import { ROUTES } from '@/config/routes'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicOnlyRoute } from './PublicOnlyRoute'
import { RouteErrorPage } from './RouteErrorPage'

// Each page is code-split so a visitor on /login never downloads the planner bundle.
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'))
const MemoryWallPage = lazy(() => import('@/features/memory-wall/pages/MemoryWallPage'))
const NotFoundPage = lazy(() => import('@/app/NotFoundPage'))

const withSuspense = (node: ReactNode) => <Suspense fallback={<PageLoader />}>{node}</Suspense>

export const router = createBrowserRouter([
  {
    // Pathless layout route: one error boundary for every page (render errors, failed chunk loads).
    errorElement: <RouteErrorPage />,
    children: [
      { path: ROUTES.home, element: <Navigate to={ROUTES.login} replace /> },
      { path: ROUTES.login, element: <PublicOnlyRoute>{withSuspense(<LoginPage />)}</PublicOnlyRoute> },
      { path: ROUTES.register, element: <PublicOnlyRoute>{withSuspense(<RegisterPage />)}</PublicOnlyRoute> },
      { path: ROUTES.forgotPassword, element: withSuspense(<ForgotPasswordPage />) },
      {
        path: ROUTES.memoryWall,
        element: (
          <ProtectedRoute>
            {withSuspense(<MemoryWallPage />)}
          </ProtectedRoute>
        ),
      },
      { path: '*', element: withSuspense(<NotFoundPage />) },
    ],
  },
])
