// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as authApi from '@/services/authApi'
import { tokenStorage } from '@/services/tokenStorage'
import { AuthProvider } from './providers/AuthProvider'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicOnlyRoute } from './PublicOnlyRoute'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  tokenStorage.clear()
})

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /login and preserves intended destination', async () => {
    tokenStorage.clear()

    const router = createMemoryRouter(
      [
        {
          path: '/memory-wall',
          element: (
            <AuthProvider>
              <ProtectedRoute>
                <h1>Protected Content</h1>
              </ProtectedRoute>
            </AuthProvider>
          ),
        },
        {
          path: '/login',
          element: <h1>Login Page</h1>,
        },
      ],
      { initialEntries: ['/memory-wall'] },
    )

    render(<RouterProvider router={router} />)

    // Should redirect to Login
    expect(await screen.findByRole('heading', { name: 'Login Page' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.state).toEqual({ from: '/memory-wall' })
  })

  it('allows authenticated users to view protected content', async () => {
    tokenStorage.save({
      access_token: 'valid-test-token',
      refresh_token: 'valid-test-refresh',
      token_type: 'bearer',
      expires_in: 1800,
    })

    vi.spyOn(authApi, 'getMe').mockResolvedValue({
      id: '123',
      email: 'user@example.com',
      full_name: 'Test User',
      phone: '+919876543210',
      role: 'customer',
      is_active: true,
      created_at: '2026-11-08T00:00:00Z',
    })

    const router = createMemoryRouter(
      [
        {
          path: '/memory-wall',
          element: (
            <AuthProvider>
              <ProtectedRoute>
                <h1>Protected Content</h1>
              </ProtectedRoute>
            </AuthProvider>
          ),
        },
        {
          path: '/login',
          element: <h1>Login Page</h1>,
        },
      ],
      { initialEntries: ['/memory-wall'] },
    )

    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { name: 'Protected Content' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/memory-wall')
  })
})

describe('PublicOnlyRoute', () => {
  it('redirects authenticated users away from /login to /memory-wall', async () => {
    tokenStorage.save({
      access_token: 'valid-test-token',
      refresh_token: 'valid-test-refresh',
      token_type: 'bearer',
      expires_in: 1800,
    })

    vi.spyOn(authApi, 'getMe').mockResolvedValue({
      id: '123',
      email: 'user@example.com',
      full_name: 'Test User',
      phone: '+919876543210',
      role: 'customer',
      is_active: true,
      created_at: '2026-11-08T00:00:00Z',
    })

    const router = createMemoryRouter(
      [
        {
          path: '/login',
          element: (
            <AuthProvider>
              <PublicOnlyRoute>
                <h1>Login Form</h1>
              </PublicOnlyRoute>
            </AuthProvider>
          ),
        },
        {
          path: '/memory-wall',
          element: <h1>Memory Wall Planner</h1>,
        },
      ],
      { initialEntries: ['/login'] },
    )

    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { name: 'Memory Wall Planner' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/memory-wall')
  })

  it('renders login form for unauthenticated visitors', async () => {
    tokenStorage.clear()

    const router = createMemoryRouter(
      [
        {
          path: '/login',
          element: (
            <AuthProvider>
              <PublicOnlyRoute>
                <h1>Login Form</h1>
              </PublicOnlyRoute>
            </AuthProvider>
          ),
        },
      ],
      { initialEntries: ['/login'] },
    )

    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { name: 'Login Form' })).toBeTruthy()
  })
})

